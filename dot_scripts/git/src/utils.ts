import { spawn } from "node:child_process";

export type CommandResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
};

export type AiResult = { success: true; text: string } | { success: false; details: string };

export function runCommand(
  command: string,
  args: string[],
  input?: string,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    const chunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", (error) => {
      resolve({ code: null, signal: null, output: error.message });
    });
    child.on("close", (code, signal) => {
      resolve({ code, signal, output: Buffer.concat(chunks).toString() });
    });

    if (input !== undefined) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}

export async function gitOutput(args: string[]): Promise<string> {
  const result = await runCommand("git", args);
  if (result.code === 0) {
    return result.output;
  }

  console.error(`Error running: ${commandForLog(["git", ...args])}`);
  if (result.output.trim()) {
    console.error(result.output.trimEnd());
  }
  process.exit(-1);
}

export async function maybeGitOutput(args: string[]): Promise<string> {
  const result = await runCommand("git", args);
  return result.code === 0 ? result.output : "";
}

export async function detectDefaultBranch(): Promise<string> {
  let ref = (await maybeGitOutput(["symbolic-ref", "refs/remotes/origin/HEAD"])).trim();

  if (!ref) {
    await maybeGitOutput(["remote", "set-head", "origin", "--auto"]);
    ref = (await maybeGitOutput(["symbolic-ref", "refs/remotes/origin/HEAD"])).trim();
  }

  return ref ? ref.replace(/^refs\/remotes\/origin\//, "") : "main";
}

export async function repoRoot(): Promise<string | undefined> {
  const root = (await maybeGitOutput(["rev-parse", "--show-toplevel"])).trim();
  return root || undefined;
}

export async function relevantDiff(diffArgs: string[]): Promise<string> {
  return gitOutput(["diff", ...diffArgs]);
}

export async function aiGenerate(
  prompt: string,
  options: { model?: string; fast?: boolean } = {},
): Promise<AiResult> {
  const model = options.fast
    ? (process.env.DOTFILES_FAST_MODEL ?? process.env.DOTFILES_MODEL ?? options.model)
    : (process.env.DOTFILES_MODEL ?? options.model);

  return aiGeneratePi(prompt, model ?? "openai-codex/gpt-5.6-terra");
}

async function aiGeneratePi(prompt: string, model: string): Promise<AiResult> {
  const command = [
    "pi",
    "--mode",
    "json",
    "--no-session",
    "--no-tools",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-context-files",
    "--offline",
  ];
  if (model) {
    command.push("--model", model);
  }
  command.push("--", prompt);

  debug(`model=${model}`);
  debug(`command=${commandForLog(command)}`);
  const result = await runCommand(command[0]!, command.slice(1));
  const text = extractPiText(result.output);

  if (result.code === 0 && text) {
    return { success: true, text };
  }

  const reason =
    result.code !== 0
      ? "pi exited unsuccessfully"
      : result.output.trim()
        ? "pi returned no final text"
        : "pi returned no output";
  return { success: false, details: aiFailureDetails("pi", model, command, result, reason) };
}

function extractPiText(raw: string): string {
  let text = "";

  for (const line of raw.split(/\r?\n/)) {
    const event = parseJsonObject(line);
    if (event?.type !== "message_end") {
      continue;
    }

    const message = objectValue(event.message);
    if (message?.role !== "assistant" || !Array.isArray(message.content)) {
      continue;
    }

    text = message.content
      .map(objectValue)
      .map((part) => (part ? stringField(part, "text") : undefined))
      .filter((part): part is string => Boolean(part))
      .join("");
  }

  return text.trim();
}

function aiFailureDetails(
  provider: string,
  model: string | undefined,
  command: string[],
  result: CommandResult,
  reason: string,
): string {
  const details = [
    `provider: ${provider}`,
    `model: ${model || "(default)"}`,
    `reason: ${reason}`,
    `status: ${statusSummary(result)}`,
    `command: ${commandForLog(command)}`,
  ];
  const output = result.output.trim();

  if (output) {
    details.push(`output:\n${output}`);
  }

  return details.join("\n");
}

function statusSummary(result: CommandResult): string {
  if (result.code !== null) {
    return `exit ${result.code}`;
  }

  if (result.signal) {
    return `signal ${result.signal}`;
  }

  return "unknown";
}

export function splitTitleBody(text: string, fallback: string): [string, string] {
  const lines = stripCodeFences(text)
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const index = lines.findIndex((line) => line.trim() && !line.trim().startsWith("```"));

  if (index === -1) {
    return [fallback, ""];
  }

  let title = lines[index]!.trim()
    .replace(/^#+\s+/, "")
    .replace(/^(?:title|subject)\s*[:-]\s*/i, "")
    .replace(/^\*\*(.*)\*\*$/, "$1")
    .replace(/^["'](.*)["']$/, "$1")
    .trim();
  title ||= fallback;

  let bodyLines = lines.slice(index + 1);
  while (bodyLines[0]?.trim() === "") {
    bodyLines = bodyLines.slice(1);
  }

  return [title, bodyLines.join("\n").trim()];
}

export function stripCodeFences(text: string): string {
  return text
    .replace(/^```[^\n]*\n/, "")
    .replace(/\n```$/, "")
    .trim();
}

export function wrap(text: string, width: number): string {
  const words = text.trimEnd().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.join("\n");
}

export function titleStyle(label: string, maxChars = 70): string {
  return `Write the ${label} in imperative mood, with no trailing period, under ${maxChars} characters. If the branch name or commits contain a ticket or issue ID, prefix the ${label} with it.`;
}

export async function hasCommand(command: string): Promise<boolean> {
  return (await runCommand("sh", ["-c", `command -v ${shellEscape(command)}`])).code === 0;
}

export function parseJsonObject(line: string): Record<string, unknown> | undefined {
  try {
    return objectValue(JSON.parse(line));
  } catch {
    return undefined;
  }
}

export function firstJsonArrayObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) && parsed.length > 0 ? objectValue(parsed[0]) : undefined;
  } catch {
    return undefined;
  }
}

export function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" ? value : undefined;
}

export function nonEmptyStringField(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = stringField(record, field);
  return value ? value : undefined;
}

export function nestedStringField(
  record: Record<string, unknown>,
  field: string,
  nestedField: string,
): string | undefined {
  const nested = objectValue(record[field]);
  return nested ? nonEmptyStringField(nested, nestedField) : undefined;
}

export function stringArg(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string");
  }

  return undefined;
}

export function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

export function commandForLog(command: string[]): string {
  return command
    .map((arg) => {
      if (arg.includes("\n") || Buffer.byteLength(arg) > 120) {
        return `<${Buffer.byteLength(arg)} byte prompt>`;
      }

      return shellEscape(arg);
    })
    .join(" ");
}

export function shellEscape(value: string): string {
  if (/^[A-Za-z0-9_/:=-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function printOutput(output: string): void {
  if (!output) {
    return;
  }

  process.stdout.write(output);
  if (!output.endsWith("\n")) {
    process.stdout.write("\n");
  }
}

export function debug(message: string): void {
  if (process.env.DEBUG) {
    console.error(`[DEBUG] ${message}`);
  }
}
