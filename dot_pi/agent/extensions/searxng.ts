import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

const SEARXNG_URL = "https://searxng.fell-mirach.ts.net";
const SEARCH_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const TOOL_NAME = "searxng_search";
const GPT_SEARCH_PROVIDERS = new Set(["openai", "openai-codex"]);

const parameters = Type.Object({
  query: Type.String({ description: "Search query" }),
  categories: Type.Optional(
    Type.Array(Type.String(), {
      description: "SearXNG categories to search, such as general, news, or images",
      maxItems: 10,
    }),
  ),
  language: Type.Optional(
    Type.String({ description: "Search language code, such as en or pt-PT" }),
  ),
  timeRange: Type.Optional(
    StringEnum(["day", "month", "year"] as const, {
      description: "Restrict results to this time range",
    }),
  ),
  limit: Type.Optional(
    Type.Integer({
      description: "Maximum number of results to return",
      minimum: 1,
      maximum: 20,
    }),
  ),
});

type SearxngResult = {
  title?: string;
  url?: string;
  content?: string;
  engine?: string;
  publishedDate?: string;
};

type SearxngResponse = {
  results?: SearxngResult[];
  suggestions?: string[];
  answers?: string[];
};

type SearchDetails = {
  query: string;
  resultCount: number;
  results: SearxngResult[];
  suggestions: string[];
};

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: TOOL_NAME,
    label: "SearXNG Search",
    description:
      "Search the user's private SearXNG instance and return up to 20 web results. Results are limited to 50 KB.",
    promptSnippet: "Search the web through the user's private SearXNG instance",
    promptGuidelines: [
      "Use searxng_search for web research when current or external information is needed.",
      "Cite the result URLs returned by searxng_search when answering research questions.",
    ],
    parameters,

    async execute(_toolCallId, params, signal, onUpdate) {
      const query = params.query.trim();
      if (!query) throw new Error("Search query cannot be empty");

      onUpdate?.({ content: [{ type: "text", text: "Searching SearXNG..." }] });

      const url = new URL("/search", SEARXNG_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "json");
      if (params.categories?.length)
        url.searchParams.set("categories", params.categories.join(","));
      if (params.language?.trim()) url.searchParams.set("language", params.language.trim());
      if (params.timeRange) url.searchParams.set("time_range", params.timeRange);

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
        if (timeoutSignal.aborted) {
          throw new Error(`SearXNG search timed out after ${SEARCH_TIMEOUT_MS / 1000} seconds`);
        }
        throw new Error(`SearXNG search failed: ${errorMessage(error)}`);
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw new Error("SearXNG search response exceeded 5 MB");
      }

      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error("SearXNG search response exceeded 5 MB");
      }
      if (!response.ok)
        throw new Error(`SearXNG search failed: ${response.status} ${response.statusText}`);

      let payload: SearxngResponse;
      try {
        payload = JSON.parse(body) as SearxngResponse;
      } catch {
        throw new Error(
          "SearXNG search returned invalid JSON; enable the JSON format in SearXNG settings",
        );
      }

      const results = (payload.results ?? [])
        .filter((result) => typeof result.url === "string" && isHttpUrl(result.url))
        .slice(0, params.limit ?? 10);
      const suggestions = (payload.suggestions ?? []).filter(
        (suggestion): suggestion is string => typeof suggestion === "string",
      );
      const details: SearchDetails = { query, resultCount: results.length, results, suggestions };

      return {
        content: [{ type: "text", text: formatResults(results, suggestions) }],
        details,
      };
    },

    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("searxng_search "))}${theme.fg("accent", `"${args.query}"`)}`,
        0,
        0,
      );
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Searching SearXNG..."), 0, 0);

      const details = result.details as SearchDetails | undefined;
      if (!details) return new Text(theme.fg("dim", "No search details"), 0, 0);

      let text = theme.fg(
        details.resultCount > 0 ? "success" : "dim",
        `${details.resultCount} result${details.resultCount === 1 ? "" : "s"}`,
      );
      if (expanded) {
        for (const [index, item] of details.results.entries()) {
          text += `\n${theme.fg("accent", `${index + 1}. ${item.title ?? item.url}`)}`;
          text += `\n${theme.fg("dim", item.url ?? "")}`;
        }
      }
      return new Text(text, 0, 0);
    },
  });

  pi.on("session_start", (_event, ctx) => syncAvailability(pi, ctx.model?.provider));
  pi.on("model_select", (event) => syncAvailability(pi, event.model.provider));
}

function syncAvailability(pi: ExtensionAPI, provider?: string) {
  const activeTools = new Set(pi.getActiveTools());
  if (provider && GPT_SEARCH_PROVIDERS.has(provider)) {
    activeTools.delete(TOOL_NAME);
  } else {
    activeTools.add(TOOL_NAME);
  }
  pi.setActiveTools([...activeTools]);
}

function formatResults(results: SearxngResult[], suggestions: string[]): string {
  if (results.length === 0) return "No SearXNG results found.";

  const output = results.map((result, index) => {
    const lines = [`${index + 1}. ${result.title ?? result.url}`, result.url ?? ""];
    if (result.content) lines.push(result.content);
    if (result.engine) lines.push(`Engine: ${result.engine}`);
    return lines.join("\n");
  });
  if (suggestions.length) output.push(`Suggestions: ${suggestions.join(", ")}`);
  return output.join("\n\n");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
