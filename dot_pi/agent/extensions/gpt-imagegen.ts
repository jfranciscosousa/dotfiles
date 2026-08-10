import {
  withFileMutationQueue,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, resolve } from "node:path";
import { Type } from "typebox";

const CHATGPT_CODEX_URL = "https://chatgpt.com/backend-api/codex/responses";
const IMAGE_MODEL = "gpt-5.5";
const IMAGE_TIMEOUT_MS = 5 * 60_000;
const MAX_RESPONSE_BYTES = 100 * 1024 * 1024;
const MAX_VERSION_SUFFIX = 999;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const TOOL_NAME = "gpt_imagegen";
const PROVIDER = "openai-codex";

const parameters = Type.Object({
  prompt: Type.String({ description: "Description of the image to generate." }),
  out: Type.String({
    description:
      "Output PNG path, relative to the project directory unless absolute. Existing files are never overwritten.",
  }),
  quality: StringEnum(["low", "medium", "high", "auto"] as const, {
    description: "Generation quality passed to OpenAI's hosted image_generation tool.",
  }),
  size: Type.Optional(
    Type.String({
      description:
        "Optional size: `auto` or WIDTHxHEIGHT. Dimensions must be multiples of 16, each edge at most 3840, ratio at most 3:1, and total pixels from 655,360 through 8,294,400.",
    }),
  ),
  images: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "Optional reference image paths, relative to the project directory unless absolute. Describe each image's role in the prompt.",
    }),
  ),
});

type ImageDetails = {
  billing: "subscription";
  model: string;
  out: string;
  versioned: boolean;
};

type RequestAuth = {
  accessToken: string;
  accountId?: string;
};

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: TOOL_NAME,
    label: "GPT Image Generation",
    description: [
      "Generate one raster image with OpenAI's hosted image_generation tool through the user's ChatGPT subscription.",
      "Use for AI-created bitmap visuals such as photos, illustrations, textures, sprites, and mockups.",
      "Do not use when SVG, vector, HTML, CSS, canvas, or an established icon or logo system is more suitable.",
      "Reference images can be supplied with `images`; describe each image's role in `prompt`.",
      "For distinct assets, call gpt_imagegen once per asset because each call returns one image.",
      "Requires OpenAI Codex OAuth credentials. Returns the absolute path of the saved PNG.",
    ].join(" "),
    promptSnippet: "Generate a PNG with ChatGPT Images and optionally use reference images",
    promptGuidelines: [
      "Use gpt_imagegen for AI-created bitmap visuals, and use code-native tools for SVG, HTML, CSS, canvas, and established icon or logo systems.",
      "Call gpt_imagegen once per distinct requested asset because it returns one image per call.",
    ],
    parameters,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const prompt = params.prompt.trim();
      if (!prompt) throw new Error("Image prompt cannot be empty");

      validateSize(params.size);
      const outputPath = resolveToolPath(params.out, ctx.cwd);
      if (extname(outputPath).toLowerCase() !== ".png") {
        throw new Error("The output path must use the .png extension");
      }

      onUpdate?.({
        content: [{ type: "text", text: "Reading reference images..." }],
        details: { model: IMAGE_MODEL },
      });
      const inputImages = await Promise.all(
        (params.images ?? []).map((path) => readImageAsDataUrl(path, ctx.cwd)),
      );
      const auth = await resolveAuth(ctx);

      onUpdate?.({
        content: [{ type: "text", text: "Generating image..." }],
        details: { model: IMAGE_MODEL },
      });
      const base64 = await generateImage(
        auth,
        {
          prompt,
          quality: params.quality,
          size: params.size,
        },
        inputImages,
        signal,
      );
      const png = decodePng(base64);

      const saved = await withFileMutationQueue(outputPath, async () =>
        saveWithoutOverwrite(outputPath, png),
      );
      const details: ImageDetails = {
        billing: "subscription",
        model: IMAGE_MODEL,
        out: saved.path,
        versioned: saved.path !== outputPath,
      };
      const versionNote = details.versioned
        ? ` The requested path already existed, so the new image was versioned to avoid overwriting it.`
        : "";

      return {
        content: [{ type: "text", text: `Generated image saved to ${saved.path}.${versionNote}` }],
        details,
      };
    },

    renderCall(args, theme) {
      return new Text(
        `${theme.fg("toolTitle", theme.bold("gpt_imagegen "))}${theme.fg("accent", args.out)}`,
        0,
        0,
      );
    },

    renderResult(result, { isPartial }, theme) {
      if (isPartial) return new Text(theme.fg("warning", "Generating image..."), 0, 0);

      const details = result.details as ImageDetails | undefined;
      if (!details) return new Text(theme.fg("dim", "No image details"), 0, 0);

      const suffix = details.versioned ? " · versioned" : "";
      return new Text(
        `${theme.fg("success", details.out)}${theme.fg("dim", ` · ${details.model}${suffix}`)}`,
        0,
        0,
      );
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
  const tools = new Set(pi.getActiveTools());
  if (provider === PROVIDER) tools.add(TOOL_NAME);
  else tools.delete(TOOL_NAME);
  pi.setActiveTools([...tools]);
}

async function resolveAuth(ctx: ExtensionContext): Promise<RequestAuth> {
  const accessToken = await ctx.modelRegistry.getApiKeyForProvider(PROVIDER);
  if (!accessToken) throw new Error("OpenAI Codex OAuth credentials are not configured");

  return { accessToken, accountId: getCodexAccountId(accessToken) };
}

function getCodexAccountId(token: string): string | undefined {
  try {
    const payload = token.split(".")[1];
    if (!payload) return undefined;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      "https://api.openai.com/auth"?: { chatgpt_account_id?: unknown };
    };
    const accountId = claims["https://api.openai.com/auth"]?.chatgpt_account_id;
    return typeof accountId === "string" && accountId ? accountId : undefined;
  } catch {
    return undefined;
  }
}

async function generateImage(
  auth: RequestAuth,
  args: { prompt: string; quality: "low" | "medium" | "high" | "auto"; size?: string },
  inputImages: string[],
  signal?: AbortSignal,
): Promise<string> {
  const content: Array<Record<string, string>> = [{ type: "input_text", text: args.prompt }];
  for (const imageUrl of inputImages) content.push({ type: "input_image", image_url: imageUrl });

  const timeoutSignal = AbortSignal.timeout(IMAGE_TIMEOUT_MS);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let response: Response;

  try {
    response = await fetch(CHATGPT_CODEX_URL, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        authorization: `Bearer ${auth.accessToken}`,
        ...(auth.accountId ? { "chatgpt-account-id": auth.accountId } : {}),
        "content-type": "application/json",
        originator: "pi",
        "user-agent": "pi-gpt-imagegen",
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        instructions:
          "You are an image generation assistant running inside the Codex backend. Always satisfy the request by invoking the image_generation tool exactly once. Do not respond with text only.",
        input: [{ role: "user", content }],
        tools: [
          {
            type: "image_generation",
            output_format: "png",
            quality: args.quality,
            ...(args.size ? { size: args.size } : {}),
          },
        ],
        tool_choice: { type: "image_generation" },
        stream: true,
        store: false,
      }),
      signal: requestSignal,
    });
  } catch (error) {
    if (signal?.aborted) throw new Error("Image generation cancelled");
    if (timeoutSignal.aborted) {
      throw new Error(`Image generation timed out after ${IMAGE_TIMEOUT_MS / 60_000} minutes`);
    }
    throw new Error(`Image generation request failed: ${errorMessage(error)}`);
  }

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Image generation request failed: ${response.status} ${detail.slice(0, 500)}`.trim(),
    );
  }

  return parseImageResult(response.body);
}

async function parseImageResult(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let bytesRead = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    if (bytesRead > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Image generation response exceeded 100 MB");
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const result = imageResultFromEvent(block);
      if (result) {
        await reader.cancel();
        return result;
      }
    }
  }

  buffer += decoder.decode();
  const result = imageResultFromEvent(buffer);
  if (result) return result;
  throw new Error("No image_generation result was returned by the Codex backend");
}

function imageResultFromEvent(block: string): string | undefined {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");
  if (!data || data === "[DONE]") return undefined;

  try {
    const event = JSON.parse(data) as {
      type?: string;
      item?: { type?: string; result?: unknown };
      error?: { message?: string };
    };
    if (event.type === "error") {
      throw new Error(event.error?.message ?? "Codex image generation failed");
    }
    if (
      event.type === "response.output_item.done" &&
      event.item?.type === "image_generation_call" &&
      typeof event.item.result === "string" &&
      event.item.result
    ) {
      return event.item.result;
    }
  } catch (error) {
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }

  return undefined;
}

async function readImageAsDataUrl(path: string, cwd: string): Promise<string> {
  const absolutePath = resolveToolPath(path, cwd);
  const data = await readFile(absolutePath);
  const mime = detectImageMime(data);
  if (!mime) throw new Error(`Unsupported reference image type: ${absolutePath}`);
  return `data:${mime};base64,${data.toString("base64")}`;
}

function detectImageMime(data: Buffer): string | undefined {
  if (data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return "image/png";
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (data.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (
    data.subarray(0, 4).toString("ascii") === "RIFF" &&
    data.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return undefined;
}

function decodePng(base64: string): Buffer {
  const normalized = base64.replace(/\s/g, "");
  if (!normalized || normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) {
    throw new Error("Image generation returned invalid base64 data");
  }

  const png = Buffer.from(normalized, "base64");
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error("Image generation did not return a valid PNG");
  }
  return png;
}

async function saveWithoutOverwrite(
  requestedPath: string,
  data: Buffer,
): Promise<{ path: string }> {
  await mkdir(dirname(requestedPath), { recursive: true });
  const extension = extname(requestedPath);
  const stem = requestedPath.slice(0, -extension.length);

  for (let version = 1; version <= MAX_VERSION_SUFFIX; version++) {
    const candidate = version === 1 ? requestedPath : `${stem}-v${version}${extension}`;
    try {
      await writeFile(candidate, data, { flag: "wx" });
      return { path: candidate };
    } catch (error) {
      if (isAlreadyExistsError(error)) continue;
      throw error;
    }
  }

  throw new Error(`Could not find a free output filename after ${MAX_VERSION_SUFFIX} attempts`);
}

function validateSize(size?: string): void {
  if (!size || size === "auto") return;

  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) throw new Error("Image size must be `auto` or WIDTHxHEIGHT");
  const width = Number(match[1]);
  const height = Number(match[2]);
  const pixels = width * height;
  const ratio = Math.max(width, height) / Math.min(width, height);

  if (
    width % 16 !== 0 ||
    height % 16 !== 0 ||
    Math.max(width, height) > 3840 ||
    ratio > 3 ||
    pixels < 655_360 ||
    pixels > 8_294_400
  ) {
    throw new Error(
      "Image dimensions must be multiples of 16, max edge 3840, ratio at most 3:1, and total pixels from 655,360 through 8,294,400",
    );
  }
}

function resolveToolPath(path: string, cwd: string): string {
  const normalized = path.startsWith("@") ? path.slice(1) : path;
  return isAbsolute(normalized) ? normalized : resolve(cwd, normalized);
}

function isAlreadyExistsError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
