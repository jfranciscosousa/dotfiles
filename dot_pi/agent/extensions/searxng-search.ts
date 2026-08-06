import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { hostname } from "node:os";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

type SearxResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
};

type SearxResponse = {
  results?: SearxResult[];
};

type SearchDetails = {
  query: string;
  results: Array<Required<Pick<SearxResult, "title" | "url">> & Pick<SearxResult, "engine">>;
};

const SEARXNG_URL = "https://searxng.fell-mirach.ts.net";
const TOOL_NAME = "searxng-search";
const SEARCH_TIMEOUT_MS = 30_000;
const REMOTE_HOSTNAME_PREFIX = "Remote-";

const parameters = Type.Object({
  query: Type.String({ description: "Question or search terms" }),
  categories: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional SearXNG categories, such as general, news, or science",
      maxItems: 10,
    }),
  ),
  limit: Type.Optional(
    Type.Integer({ description: "Maximum results to return", minimum: 1, maximum: 10 }),
  ),
});

export default function (pi: ExtensionAPI) {
  // The instance is reachable only through the personal Tailscale network.
  if (hostname().startsWith(REMOTE_HOSTNAME_PREFIX)) return;

  pi.registerTool({
    name: TOOL_NAME,
    label: "SearXNG Search",
    description: "Search the web through the personal SearXNG instance and return sourced results.",
    promptSnippet: "Search the web through SearXNG and return source URLs",
    promptGuidelines: [
      "Use searxng-search instead of ad-hoc search-engine requests through bash when current or externally sourced information is needed.",
      "Cite the source URLs returned by searxng-search when answering research questions.",
    ],
    parameters,

    async execute(_toolCallId, params, signal) {
      const query = params.query.trim();
      if (!query) throw new Error("Search query cannot be empty");

      const url = new URL("/search", SEARXNG_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      if (params.categories?.length)
        url.searchParams.set("categories", params.categories.join(","));

      const timeoutSignal = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
      const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: requestSignal,
        });
      } catch (error) {
        if (signal?.aborted) throw new Error("SearXNG search cancelled");
        if (timeoutSignal.aborted) throw new Error("SearXNG search timed out after 30 seconds");
        throw new Error(`SearXNG search failed: ${errorMessage(error)}`);
      }

      const body = await response.text();
      if (!response.ok)
        throw new Error(`SearXNG search failed: ${response.status} ${response.statusText}`);

      const payload = parseResponse(body);
      const results = (payload.results ?? [])
        .filter((result): result is Required<Pick<SearxResult, "title" | "url">> & SearxResult =>
          Boolean(result.title && result.url),
        )
        .slice(0, params.limit ?? 5);

      const details: SearchDetails = {
        query,
        results: results.map(({ title, url, engine }) => ({
          title,
          url,
          ...(engine ? { engine } : {}),
        })),
      };

      return {
        content: [{ type: "text", text: formatResults(results) }],
        details,
      };
    },

    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("searxng-search "))}${theme.fg("accent", `"${args.query}"`)}`,
        0,
        0,
      );
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Searching the web..."), 0, 0);

      const details = result.details as SearchDetails | undefined;
      if (!details) return new Text(theme.fg("dim", "No search details"), 0, 0);

      let text = theme.fg(
        "success",
        `${details.results.length} result${details.results.length === 1 ? "" : "s"}`,
      );
      if (expanded) {
        for (const [index, source] of details.results.entries()) {
          text += `\n${theme.fg("accent", `${index + 1}. ${source.title}`)}`;
          text += `\n${theme.fg("dim", source.url)}`;
        }
      }
      return new Text(text, 0, 0);
    },
  });
}

function parseResponse(body: string): SearxResponse {
  try {
    return JSON.parse(body) as SearxResponse;
  } catch {
    throw new Error("SearXNG returned invalid JSON");
  }
}

function formatResults(results: SearxResult[]): string {
  if (results.length === 0) return "SearXNG returned no results.";

  return results
    .map((result, index) => {
      const snippet = result.content?.replace(/\s+/g, " ").trim();
      return [
        `${index + 1}. ${result.title}`,
        result.url,
        ...(snippet ? [snippet.slice(0, 500)] : []),
      ].join("\n");
    })
    .join("\n\n");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
