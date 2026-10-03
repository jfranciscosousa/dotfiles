#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const install = execFileSync("mise", ["where", "npm:context-mode@1.0.169"], {
  encoding: "utf8",
}).trim();
const packageRoot = join(install, "lib/node_modules/context-mode");
const require = createRequire(join(packageRoot, "package.json"));
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js");
const root = mkdtempSync(join(tmpdir(), "context-mode-check-"));
const project = join(root, "project");
mkdirSync(join(project, ".claude"), { recursive: true });
writeFileSync(
  join(project, ".claude/settings.json"),
  JSON.stringify({ permissions: { deny: ["Bash(fs-context-mode-denied *)", "Read(.env)"] } }),
);
writeFileSync(join(project, ".env"), "fixture only");
writeFileSync(join(root, "outside.txt"), "outside-project fixture");
const client = new Client({ name: "context-mode-installation-check", version: "1" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [join(packageRoot, "start.mjs")],
  cwd: project,
  env: {
    ...process.env,
    PWD: project,
    CONTEXT_MODE_PLATFORM: process.argv[2] ?? "opencode",
    CONTEXT_MODE_DIR: join(root, "state"),
  },
  stderr: "pipe",
});
transport.stderr?.on("data", () => {});
const text = (result) =>
  result.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
const call = (name, args) => client.callTool({ name, arguments: args });

try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 11);
  const marker = "fs-context-mode-runtime-48271";
  const indexed = await call("ctx_index", {
    content: `# Verification\n${"Harmless fixture data.\n".repeat(2000)}\n${marker}`,
    source: "installation-check",
  });
  assert.ok(!indexed.isError, text(indexed));
  const found = await call("ctx_search", { queries: [marker], source: "installation-check" });
  assert.ok(!found.isError && text(found).includes(marker), text(found));
  const executed = await call("ctx_execute", {
    language: "javascript",
    code: "console.log(6 * 7)",
  });
  assert.ok(!executed.isError && text(executed).includes("42"), text(executed));
  const denied = await call("ctx_execute", {
    language: "shell",
    code: "fs-context-mode-denied test",
  });
  assert.ok(denied.isError && text(denied).includes("security policy"), text(denied));
  for (const path of [join(project, ".env"), join(root, "outside.txt")]) {
    const blocked = await call("ctx_execute_file", {
      path,
      language: "javascript",
      code: "console.log(FILE_CONTENT)",
    });
    assert.ok(blocked.isError && text(blocked).includes("File access blocked"), text(blocked));
  }
  const stats = await call("ctx_stats", {});
  assert.ok(!stats.isError && text(stats).includes("1.0.169"), text(stats));
  console.log(
    "PASS: 11 MCP tools, large-content retrieval, execution, deny rules, file boundary, statistics",
  );
} finally {
  await client.close();
  rmSync(root, { recursive: true, force: true });
}
