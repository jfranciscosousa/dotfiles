import { spawn } from "node:child_process";

export type CommandResult = {
  code: number | null;
  signal: NodeJS.Signals | null;
  output: string;
};

export type AiResult = { success: true; text: string } | { success: false; details: string };

const SELECTION_MIN_FILES = 2;
const SELECTION_MIN_BYTES = 4_000;

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

export async function relevantDiff(
  diffArgs: string[],
  options: { log?: string } = {},
): Promise<string> {
  const full = await gitOutput(["diff", ...diffArgs]);
  const stat = (await gitOutput(["diff", "--stat", ...diffArgs])).trim();
  const nameStatus = (await gitOutput(["diff", "--name-status", ...diffArgs])).trim();
  const changed = nameStatus
    .split(/\r?\n/)
    .map((line) => line.split("\t").at(-1)?.trim())
    .filter((file): file is string => Boolean(file));

  if (changed.length < SELECTION_MIN_FILES || Buffer.byteLength(full) < SELECTION_MIN_BYTES) {
    return full;
  }

  const selected = await selectFiles(nameStatus, stat, changed, options.log ?? "");
  const omitted = changed.filter((file) => !selected.includes(file));
  const sections = [`Changed files:\n${stat}`];

  if (selected.length > 0) {
    const selectedDiff = (await gitOutput(["diff", ...diffArgs, "--", ...selected])).trim();
    sections.push(`Full diff of the files that need review:\n${selectedDiff}`);
  }

  if (omitted.length > 0) {
    sections.push(`Other changed files (path/status only):\n${omitted.join("\n")}`);
  }

  return sections.join("\n\n");
}

async function selectFiles(
  nameStatus: string,
  stat: string,
  changed: string[],
  log: string,
): Promise<string[]> {
  const commits = log.trim() ? `\n\nCommits:\n${log.trim()}` : "";
  const prompt = `You are gathering context to summarize a set of code changes.
Below are the changed files (git status + line counts).
List the files whose FULL DIFF you must read to summarize the changes accurately.
Skip files where the path and change type already tell the story: lock files,
generated or minified files, vendored dependencies, and pure renames or deletions.
Output one file path per line, exactly as written below, and nothing else.
Output NONE if the file list alone is enough.

Files:
${nameStatus}

Stat:
${stat}${commits}`;
  const result = await aiGenerate(prompt, { fast: true });

  if (!result.success) {
    return changed;
  }

  const output = stripCodeFences(result.text);
  if (/^\s*NONE\s*$/i.test(output)) {
    return [];
  }

  const picks = output
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, "")
        .replaceAll(/[`'"]/g, "")
        .trim(),
    )
    .filter(Boolean);
  const selected = picks.filter((file) => changed.includes(file));

  return selected.length > 0 ? selected : changed;
}

export async function aiGenerate(
  prompt: string,
  options: { model?: string; provider?: string; fast?: boolean } = {},
): Promise<AiResult> {
  const provider = options.fast
    ? (process.env.DOTFILES_FAST_PROVIDER ??
      process.env.DOTFILES_PROVIDER ??
      options.provider ??
      "opencode")
    : (process.env.DOTFILES_PROVIDER ?? options.provider ?? "opencode");
  const model = options.fast
    ? (process.env.DOTFILES_FAST_MODEL ?? process.env.DOTFILES_MODEL ?? options.model)
    : (process.env.DOTFILES_MODEL ?? options.model);

  if (provider === "claude") {
    return aiGenerateClaude(prompt, model ?? "haiku");
  }

  if (provider === "opencode") {
    return aiGenerateOpencode(prompt, model ?? "openai/gpt-5.4-mini");
  }

  if (provider === "pi") {
    return aiGeneratePi(prompt, model ?? "openai/gpt-5.4-mini");
  }

  throw new Error(`Unknown provider: ${provider}`);
}

async function aiGenerateClaude(prompt: string, model: string): Promise<AiResult> {
  const command = [
    "claude",
    "--print",
    "--model",
    model,
    "--no-session-persistence",
    "--tools",
    "",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "-",
  ];
  debug(`model=${model}`);
  debug(`command=${commandForLog(command)}`);
  const result = await runCommand(command[0]!, command.slice(1), prompt);
  const text = result.output.trim();

  if (result.code === 0 && text) {
    return { success: true, text };
  }

  const reason = result.code === 0 ? "claude returned no text" : "claude exited unsuccessfully";
  return { success: false, details: aiFailureDetails("claude", model, command, result, reason) };
}

async function aiGenerateOpencode(prompt: string, model: string): Promise<AiResult> {
  const command = ["opencode", "run", "--format", "json", "--dir", "/tmp"];
  if (model) {
    command.push("--model", model);
  }
  command.push(prompt);

  debug(`model=${model}`);
  debug(`command=${commandForLog(command)}`);
  const result = await runCommand(command[0]!, command.slice(1));
  const text = extractOpencodeText(result.output);

  if (result.code === 0 && text) {
    return { success: true, text };
  }

  const reason =
    result.code !== 0
      ? "opencode exited unsuccessfully"
      : result.output.trim()
        ? "opencode returned no final text"
        : "opencode returned no output";
  return { success: false, details: aiFailureDetails("opencode", model, command, result, reason) };
}

async function aiGeneratePi(prompt: string, model: string): Promise<AiResult> {
  const command = ["pi", "--print", "--no-session", "--no-tools"];
  if (model) {
    command.push("--model", model);
  }
  command.push(prompt);

  debug(`model=${model}`);
  debug(`command=${commandForLog(command)}`);
  const result = await runCommand(command[0]!, command.slice(1));
  const text = result.output.trim();

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

function extractOpencodeText(raw: string): string {
  const final: string[] = [];
  let last: string | undefined;

  for (const line of raw.split(/\r?\n/)) {
    const event = parseJsonObject(line);
    if (!event || event.type !== "text") {
      continue;
    }

    const part = objectValue(event.part);
    const text = part ? stringField(part, "text") : undefined;
    if (!text?.trim()) {
      continue;
    }

    last = text;
    const metadata = part ? objectValue(part.metadata) : undefined;
    const phases = metadata
      ? Object.values(metadata)
          .map((value) => objectValue(value)?.phase)
          .filter((phase): phase is string => typeof phase === "string")
      : [];

    if (phases.includes("final_answer")) {
      final.push(text);
    }
  }

  return (final.length > 0 ? final : last ? [last] : []).join("").trim();
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
