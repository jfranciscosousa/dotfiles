import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const piEntry = new URL(import.meta.resolve("@earendil-works/pi-coding-agent")).pathname;
const piRequire = createRequire(piEntry);
const { createJiti } = piRequire("jiti");
const jiti = createJiti(import.meta.url);
const root = new URL("../", import.meta.url);
const output = await mkdtemp(join(tmpdir(), "pi-read-url-check-"));

async function tool(file) {
  let definition;
  const factory = await jiti.import(new URL(file, root).pathname, { default: true });
  factory({
    registerTool(value) {
      definition = value;
    },
    on() {},
  });
  return definition;
}

const reader = await tool("dot_pi/agent/extensions/read-url.ts");
const binary = process.env.LIGHTPANDA_BIN;
const fixture = join(output, "lightpanda");
await writeFile(
  fixture,
  `#!/usr/bin/env node
const args = process.argv.slice(2);
if (!args.includes('--block-private-networks') || !args.includes('--obey-robots')) process.exit(1);
const url = args.at(-1);
if (url.includes('slow')) setTimeout(() => {}, 30000);
else if (url.includes('failure')) process.exit(22);
else console.log(JSON.stringify({url, http_status: 200, content: '😀'.repeat(14000), error: null}));
`,
  { mode: 0o700 },
);
process.env.LIGHTPANDA_BIN = fixture;
const execute = (params, signal) => reader.execute("check", params, signal);
const first = await execute({ url: "https://example.org" });
assert.equal(first.details.nextOffset, 6000);
assert.equal(first.details.returnedBytes, 24000);
assert.equal(first.details.cached, false);
const second = await execute({ url: "https://example.org", offset: 6000 });
assert.equal(second.details.cached, true);
assert.equal(second.details.nextOffset, 12000);
const last = await execute({ url: "https://example.org", offset: 12000 });
assert.equal(last.details.nextOffset, null);
assert.equal(last.details.returnedBytes, 8000);
assert.ok(first.content[0].text.includes("Untrusted webpage"));
await assert.rejects(execute({ url: "https://example.org", find: "missing" }), /not found/);
await assert.rejects(execute({ url: "https://example.org", find: "😀", offset: 1 }), /not both/);
assert.equal(
  (await execute({ url: "https://example.org", find: "😀", limit: 1 })).details.nextOffset,
  1,
);
await assert.rejects(execute({ url: "file:///etc/passwd" }));
await assert.rejects(execute({ url: "https://user:pass@example.org" }));
await assert.rejects(execute({ url: "https://example.org", limit: 12001 }));
await assert.rejects(execute({ url: "https://example.org", offset: 14001 }));
await assert.rejects(execute({ url: "https://unseen.example.org", offset: 1 }), /snapshot/);
await assert.rejects(execute({ url: "https://failure.example.org" }), /failed/);
const controller = new AbortController();
setTimeout(() => controller.abort(), 50);
await assert.rejects(execute({ url: "https://slow.example.org" }, controller.signal));
for (let n = 0; n < 4; n++) await execute({ url: `https://example.org/${n}` });
await assert.rejects(execute({ url: "https://example.org", offset: 1 }), /snapshot/);
const searchFixture = await tool("dot_pi/agent/extensions/openai-web-search.ts");
const savedFetch = globalThis.fetch;
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      output: [
        {
          action: {
            sources: Array.from({ length: 12 }, (_, n) => ({ url: `https://example.org/${n}` })),
          },
        },
        {
          content: [
            {
              type: "output_text",
              text: "Answer",
              annotations: [{ type: "url_citation", url: "https://cited.example.org" }],
            },
          ],
        },
      ],
    }),
  );
try {
  const result = await searchFixture.execute("fixture", { query: "test" }, undefined, undefined, {
    model: { provider: "openai", id: "test" },
    modelRegistry: { getProviderAuth: async () => ({ auth: { apiKey: "fixture" } }) },
  });
  assert.equal(result.details.sources.length, 8);
  assert.equal(result.details.sources[0].url, "https://cited.example.org");
} finally {
  globalThis.fetch = savedFetch;
}
console.log(
  "PASS: bounds, Unicode, pagination, cache eviction, validation, failures, cancellation, cited-source priority",
);
if (binary) process.env.LIGHTPANDA_BIN = binary;
else delete process.env.LIGHTPANDA_BIN;

if (process.argv.includes("--live")) {
  assert.ok(binary, "Set LIGHTPANDA_BIN for live checks");
  const liveReader = await tool("dot_pi/agent/extensions/read-url.ts");
  const read = async (params) => {
    const start = performance.now();
    const result = await liveReader.execute("live", params);
    return {
      result,
      ms: Math.round(performance.now() - start),
      bytes: Buffer.byteLength(result.content[0].text),
    };
  };
  await assert.rejects(read({ url: "http://127.0.0.1:8765" }), /failed/);
  console.log("PASS: actual Lightpanda private-network block");
  const { ModelRuntime } = await import("@earendil-works/pi-coding-agent");
  const { ReadOnlyAuthStorage } = await import(
    new URL("./core/auth-storage.js", `file://${piEntry}`).href
  );
  const runtime = await ModelRuntime.create({
    credentials: new ReadOnlyAuthStorage(),
    modelsPath: null,
    modelsStorePath: join(output, "models.json"),
    refreshOnCreate: false,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    const response = await originalFetch(...args);
    if (!response.ok)
      console.log(`HTTP diagnostic: ${(await response.clone().text()).slice(0, 1000)}`);
    return response;
  };
  const search = await tool("dot_pi/agent/extensions/openai-web-search.ts");
  const model = {
    provider: process.env.PI_PROVIDER ?? "openai-codex",
    id: process.env.PI_MODEL ?? "gpt-5.4",
  };
  const ctx = {
    model,
    modelRegistry: { getProviderAuth: (provider) => runtime.getAuth(provider) },
  };
  const cases = [
    {
      name: "Lightpanda extraction",
      query:
        "Which Lightpanda fetch CLI options extract Markdown, restrict extraction to a CSS selector, and block private networks? Cite official documentation.",
      url: "https://lightpanda.io/docs/reference/cli/fetch",
      checks: [/--dump/, /--dump-selector/, /--block-private-networks/],
    },
    {
      name: "Node test timeouts",
      query:
        "In Node.js node:test, what is the default test timeout and how do you configure it? Cite official documentation.",
      url: "https://nodejs.org/api/test.html",
      checks: [/Infinity/, /timeout/],
    },
    {
      name: "TypeScript satisfies",
      query:
        "What does the TypeScript satisfies operator check and does it change the resulting type of an expression? Cite official documentation.",
      url: "https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html",
      checks: [/satisfies/, /without changing|without losing|resulting type/i],
    },
  ];
  const rows = [];
  for (const item of cases) {
    const start = performance.now();
    let searched;
    try {
      if (!process.argv.includes("--read-only"))
        searched = await search.execute("bench", { query: item.query }, undefined, undefined, ctx);
    } catch (error) {
      console.log(`Search blocked: ${error.message}`);
    }
    const searchMs = Math.round(performance.now() - start);
    if (searched)
      await writeFile(
        join(output, `${rows.length}-search.json`),
        JSON.stringify(searched, null, 2),
      );
    const searchText = searched?.content[0].text ?? "";
    const row = {
      name: item.name,
      searchMs,
      searchBytes: Buffer.byteLength(searchText),
      sources: searched?.details.sources.length ?? 0,
      searchChecks: item.checks.filter((check) => check.test(searchText)).length,
    };
    try {
      const page = await read({ url: item.url });
      let focused;
      if (item.name === "Node test timeouts")
        focused = await read({ url: item.url, find: "Infinity" });
      if (item.name === "Lightpanda extraction")
        focused = await read({
          url: "https://lightpanda.io/docs/reference/cli/common-options",
          find: "--block-private-networks",
        });
      if (focused)
        await writeFile(
          join(output, `${rows.length}-focused.json`),
          JSON.stringify(focused.result, null, 2),
        );
      await writeFile(
        join(output, `${rows.length}-read.json`),
        JSON.stringify(page.result, null, 2),
      );
      const cached = await read({ url: item.url });
      Object.assign(row, {
        readMs: page.ms,
        readBytes: page.bytes,
        pageCharacters: page.result.details.totalCharacters,
        nextOffset: page.result.details.nextOffset,
        focusedMs: focused?.ms,
        focusedBytes: focused?.bytes,
        readChecks: item.checks.filter((check) =>
          check.test(page.result.content[0].text + (focused?.result.content[0].text ?? "")),
        ).length,
        cachedMs: cached.ms,
        totalChecks: item.checks.length,
      });
    } catch (error) {
      row.readError = error.message;
    }
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  console.log(`Artifacts: ${output}`);
  await writeFile(join(output, "summary.json"), JSON.stringify(rows, null, 2));
}
