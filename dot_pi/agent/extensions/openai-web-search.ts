import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

type SearchSource = {
  title?: string;
  url: string;
  type?: string;
};

type SearchDetails = {
  answer: string;
  model: string;
  query: string;
  sources: SearchSource[];
};

type OpenAIResponse = {
  error?: { message?: string };
  output?: Array<{
    type?: string;
    action?: { sources?: unknown[] };
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: Array<{
        type?: string;
        title?: string;
        url?: string;
      }>;
    }>;
  }>;
  output_text?: string;
};

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 60_000;
const TOOL_NAME = "openai-web-search";

const parameters = Type.Object({
  query: Type.String({ description: "Question or topic to research on the web" }),
  allowedDomains: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional domains to include, without http:// or https://",
      maxItems: 100,
    }),
  ),
  blockedDomains: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional domains to exclude, without http:// or https://",
      maxItems: 100,
    }),
  ),
});

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: TOOL_NAME,
    label: "OpenAI Web Search",
    description:
      "Search the live web using OpenAI's hosted web_search tool and return a sourced answer. Only available while the active Pi model uses the OpenAI provider.",
    promptSnippet: "Search the live web with OpenAI and return an answer with sources",
    promptGuidelines: [
      "Use openai-web-search instead of ad-hoc search-engine requests through bash when current or externally sourced information is needed.",
      "Cite the source URLs returned by openai-web-search when answering research questions.",
    ],
    parameters,

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      if (ctx.model?.provider !== "openai") {
        throw new Error("OpenAI web search is only available with an OpenAI model");
      }

      const query = params.query.trim();
      if (!query) {
        throw new Error("Search query cannot be empty");
      }

      const apiKey = await ctx.modelRegistry.getApiKeyForProvider("openai");
      if (!apiKey) {
        throw new Error("No OpenAI API credentials are configured");
      }

      const tool: Record<string, unknown> = {
        type: "web_search",
        external_web_access: true,
        search_context_size: "medium",
      };
      if (params.allowedDomains || params.blockedDomains) {
        tool.filters = {
          ...(params.allowedDomains ? { allowed_domains: params.allowedDomains } : {}),
          ...(params.blockedDomains ? { blocked_domains: params.blockedDomains } : {}),
        };
      }

      const timeoutSignal = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
      const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

      let response: Response;
      try {
        response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: ctx.model.id,
            input: query,
            tools: [tool],
            tool_choice: "required",
            include: ["web_search_call.action.sources"],
          }),
          signal: requestSignal,
        });
      } catch (error) {
        if (signal?.aborted) {
          throw new Error("OpenAI web search cancelled");
        }
        if (timeoutSignal.aborted) {
          throw new Error(`OpenAI web search timed out after ${SEARCH_TIMEOUT_MS / 1000} seconds`);
        }
        throw new Error(`OpenAI web search failed: ${errorMessage(error)}`);
      }

      const body = await response.text();
      if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error("OpenAI web search response exceeded 5 MB");
      }

      const payload = parseResponse(body);
      if (!response.ok) {
        const reason = payload.error?.message ?? `${response.status} ${response.statusText}`;
        throw new Error(`OpenAI web search failed: ${reason}`);
      }

      const answer = extractAnswer(payload);
      const sources = extractSources(payload);
      const details: SearchDetails = { answer, model: ctx.model.id, query, sources };

      return {
        content: [{ type: "text", text: formatResult(answer, sources) }],
        details,
      };
    },

    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("openai-web-search "))}${theme.fg("accent", `"${args.query}"`)}`,
        0,
        0,
      );
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Searching the web..."), 0, 0);
      }

      const details = result.details as SearchDetails | undefined;
      if (!details) {
        return new Text(theme.fg("dim", "No search details"), 0, 0);
      }

      let text = theme.fg(
        details.sources.length > 0 ? "success" : "dim",
        `${details.sources.length} source${details.sources.length === 1 ? "" : "s"} · ${details.model}`,
      );

      if (expanded) {
        for (const [index, source] of details.sources.entries()) {
          text += `\n${theme.fg("accent", `${index + 1}. ${source.title ?? source.url}`)}`;
          if (source.title) text += `\n${theme.fg("dim", source.url)}`;
        }
      }

      return new Text(text, 0, 0);
    },
  });

  pi.on("session_start", (_event, ctx) => syncAvailability(pi, ctx));
  pi.on("model_select", (event) => syncAvailability(pi, undefined, event.model.provider));
}

function syncAvailability(
  pi: ExtensionAPI,
  ctx?: ExtensionContext,
  provider = ctx?.model?.provider,
) {
  const activeTools = new Set(pi.getActiveTools());
  if (provider === "openai") {
    activeTools.add(TOOL_NAME);
  } else {
    activeTools.delete(TOOL_NAME);
  }
  pi.setActiveTools([...activeTools]);
}

function parseResponse(body: string): OpenAIResponse {
  try {
    return JSON.parse(body) as OpenAIResponse;
  } catch {
    throw new Error("OpenAI web search returned invalid JSON");
  }
}

function extractAnswer(payload: OpenAIResponse): string {
  if (payload.output_text?.trim()) return payload.output_text.trim();

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((content) => content.type === "output_text" && content.text)
    .map((content) => content.text?.trim())
    .filter((text): text is string => Boolean(text))
    .join("\n\n");
}

function extractSources(payload: OpenAIResponse): SearchSource[] {
  const sources: SearchSource[] = [];

  for (const item of payload.output ?? []) {
    for (const source of item.action?.sources ?? []) {
      const normalized = normalizeSource(source);
      if (normalized) sources.push(normalized);
    }

    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) {
          sources.push({ title: annotation.title, url: annotation.url });
        }
      }
    }
  }

  return [...new Map(sources.map((source) => [source.url, source])).values()];
}

function normalizeSource(value: unknown): SearchSource | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  if (typeof source.url !== "string" || !isHttpUrl(source.url)) return undefined;

  return {
    url: source.url,
    ...(typeof source.title === "string" ? { title: source.title } : {}),
    ...(typeof source.type === "string" ? { type: source.type } : {}),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function formatResult(answer: string, sources: SearchSource[]): string {
  const output = answer || "OpenAI completed the web search without returning a text answer.";
  if (sources.length === 0) return output;

  const formattedSources = sources.map(
    (source, index) => `${index + 1}. ${source.title ?? source.url}\n   ${source.url}`,
  );
  return `${output}\n\nSources:\n${formattedSources.join("\n")}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
