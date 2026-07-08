import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { collectClaude } from "./ai-costs/sources/claude.ts";
import { collectOpenCode } from "./ai-costs/sources/opencode.ts";
import { collectPi } from "./ai-costs/sources/pi.ts";
import {
  dateString,
  directoryExists,
  fileExists,
  isString,
  localMidnight,
  maxRecordEntry,
  newBucket,
  numberField,
  objectValue,
  parseJsonObject,
  runCommand,
  sum,
  unique,
} from "./ai-costs/shared.ts";
import type {
  Bucket,
  CollectOptions,
  Rates,
  SessionCost,
  Source,
  SourceData,
} from "./ai-costs/types.ts";

const TITLE_WORD_LIMIT = 6;
const LITELLM_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
const PRICING_CACHE = join(tmpdir(), "ai-costs-pricing.json");
const PRICING_CACHE_TTL_MS = 86_400_000;
const GENERIC_BRANCHES = new Set(["master", "main", "develop", "trunk", "HEAD"]);

const repoRootCache = new Map<string, string>();
const branchesCache = new Map<string, Set<string>>();
let pricing = new Map<string, Rates>();

await main();

async function main(): Promise<void> {
  const since = parseSince(String(argv._[0] ?? "30 days ago"));
  const sinceTimeMs = new Date(`${since}T00:00:00`).getTime();
  pricing = await fetchPricing();

  const options: CollectOptions = { since, sinceTimeMs, costFor };
  const sources = await Promise.all([
    collectClaude(options),
    collectOpenCode(options),
    collectPi(options),
  ]);
  const sessions = sources.flatMap((source) => source.sessions).filter(hasCost);

  if (sessions.length === 0) {
    console.log(yellow(`No Claude Code, OpenCode, or pi sessions found since ${since}.`));
    process.exit(0);
  }

  const cwdLabel = await resolveCwdLabels(
    sessions,
    sources.flatMap((source) => source.extraRepos),
  );
  const grouped = groupSessions(sessions, cwdLabel);
  let grandTotal = 0;

  for (const source of sources) {
    grandTotal += renderSection(grouped, source.source, source.label, since);
  }

  renderModelTotals(sessions);
  renderFooter(sources, sessions.length, grandTotal, since);
}

function hasCost(session: SessionCost): boolean {
  return Object.keys(session.modelCosts).length > 0;
}

async function resolveCwdLabels(
  sessions: SessionCost[],
  extraRepos: string[],
): Promise<Map<string, string>> {
  const allCwds = unique(sessions.map((session) => session.cwd).filter(isString));
  const knownRepos = new Set(extraRepos);

  for (const cwd of allCwds) {
    if (await directoryExists(cwd)) {
      knownRepos.add(await repoRootFor(cwd));
    }
  }

  const worktreeMap = new Map<string, string>();
  for (const repo of knownRepos) {
    for (const [worktree, mainRepo] of await worktreeLinks(repo)) {
      worktreeMap.set(worktree, mainRepo);
    }
  }

  const labels = new Map<string, string>();
  for (const cwd of allCwds) {
    let resolved: string | undefined;
    if (await directoryExists(cwd)) {
      resolved = await repoRootFor(cwd);
    } else {
      resolved = worktreeMap.get(cwd);
    }

    if (resolved) {
      labels.set(cwd, shortenPath(resolved));
    }
  }

  for (const session of sessions) {
    if (!session.cwd || labels.has(session.cwd)) {
      continue;
    }

    const branch = maxRecordEntry(session.branchCounts)?.[0];
    if (!branch || GENERIC_BRANCHES.has(branch)) {
      continue;
    }

    const matches: string[] = [];
    for (const repo of knownRepos) {
      if ((await branchesFor(repo)).has(branch)) {
        matches.push(repo);
      }
    }

    if (matches.length === 1) {
      labels.set(session.cwd, shortenPath(matches[0]!));
    }
  }

  for (const cwd of allCwds) {
    labels.set(cwd, labels.get(cwd) ?? shortenPath(cwd));
  }

  return labels;
}

function groupSessions(
  sessions: SessionCost[],
  cwdLabel: Map<string, string>,
): Map<Source, Map<string, SessionCost[]>> {
  const grouped = new Map<Source, Map<string, SessionCost[]>>();

  for (const session of sessions) {
    const label = cwdLabel.get(session.cwd ?? "") ?? shortenPath(session.cwd ?? "unknown");
    let sourceGroup = grouped.get(session.source);
    if (!sourceGroup) {
      sourceGroup = new Map();
      grouped.set(session.source, sourceGroup);
    }

    const projectSessions = sourceGroup.get(label) ?? [];
    projectSessions.push(session);
    sourceGroup.set(label, projectSessions);
  }

  return grouped;
}

function renderSection(
  grouped: Map<Source, Map<string, SessionCost[]>>,
  source: Source,
  title: string,
  since: string,
): number {
  const sourceGrouped = grouped.get(source);
  if (!sourceGrouped || sourceGrouped.size === 0) {
    return 0;
  }

  let sourceTotal = 0;
  console.log();
  console.log(`${bold(cyan(title))}${dim(`  ·  since ${since}`)}`);
  console.log(dim("─".repeat(80)));

  for (const [projectName, projectSessions] of [...sourceGrouped.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const projectCost = sum(projectSessions.map((session) => session.bucket.cost));
    sourceTotal += projectCost;

    console.log();
    console.log(`  ${bold(projectName.padEnd(44))}${yellow(formatMoney(projectCost))}`);

    for (const session of [...projectSessions].sort((a, b) => b.bucket.cost - a.bucket.cost)) {
      const bucket = session.bucket;
      const dominantModel = maxRecordEntry(session.modelCosts)?.[0] ?? "?";
      const shortModel = dominantModel.replace(/^claude-/, "").replace(/-\d{8}$/, "");
      const tokenIn = formatTokens(bucket.input + bucket.cacheWrite + bucket.cacheRead);
      const tokenOut = formatTokens(bucket.output);
      const titleText = truncateTitle(session.title);

      console.log(
        `    ${dim(session.date ?? "?")}  ${cyan(shortModel.padEnd(12))}${green(
          formatMoney(bucket.cost).padStart(9),
        )}  ${bold(titleText.padEnd(46))} ${dim(`(${tokenIn} in / ${tokenOut} out)`)}`,
      );
    }
  }

  return sourceTotal;
}

function renderModelTotals(sessions: SessionCost[]): void {
  const modelTotals = new Map<string, Bucket>();

  for (const session of sessions) {
    const totalCost = sum(Object.values(session.modelCosts));
    if (totalCost === 0) {
      continue;
    }

    for (const [model, modelCost] of Object.entries(session.modelCosts)) {
      const share = modelCost / totalCost;
      const totals = getBucket(modelTotals, model);
      const bucket = session.bucket;
      totals.cost += modelCost;
      totals.input += Math.round(bucket.input * share);
      totals.output += Math.round(bucket.output * share);
      totals.cacheWrite += Math.round(bucket.cacheWrite * share);
      totals.cacheRead += Math.round(bucket.cacheRead * share);
    }
  }

  console.log();
  console.log(dim("─".repeat(80)));
  console.log(bold("  By model"));
  console.log();

  const rows = [...modelTotals.entries()]
    .sort(([, a], [, b]) => b.cost - a.cost)
    .map(([model, totals]) => [
      model.replace(/^claude-/, "").replace(/-\d{8}$/, ""),
      formatMoney(totals.cost),
      formatTokens(totals.input),
      formatTokens(totals.cacheWrite),
      formatTokens(totals.cacheRead),
      formatTokens(totals.output),
    ]);

  console.log(renderTable(["Model", "Cost", "Input", "Cache write", "Cache read", "Output"], rows));
}

function renderFooter(
  sources: SourceData[],
  sessionCount: number,
  grandTotal: number,
  since: string,
): void {
  const messageBreakdown = sources
    .filter((source) => source.messageCount > 0)
    .map((source) => `${source.messageCount} ${source.source}`)
    .join(" + ");
  const fileBreakdown = sources
    .filter((source) => source.fileCount > 0)
    .map((source) => `${source.fileCount} ${source.source} files`)
    .join(" · ");

  console.log();
  console.log(`  ${bold("TOTAL  ")}${bold(green(formatMoney(grandTotal)))}`);
  console.log(
    dim(
      `  ${since} – ${dateString(new Date())}  ·  ${messageBreakdown} messages · ${sessionCount} sessions${fileBreakdown ? ` · ${fileBreakdown}` : ""}`,
    ),
  );
  console.log();
}

async function fetchPricing(): Promise<Map<string, Rates>> {
  const raw = await readPricingJson();
  const map = new Map<string, Rates>();

  for (const [key, value] of Object.entries(raw)) {
    const data = objectValue(value);
    if (!data) {
      continue;
    }

    const model = normalizeModel(key)
      .replace(/-v\d+:\d+$/, "")
      .replace(/-v\d+$/, "")
      .replace(/@.+$/, "");
    if (!model.startsWith("claude-") && !model.startsWith("gpt-")) {
      continue;
    }

    const input = round4(numberField(data, "input_cost_per_token") * 1_000_000);
    const output = round4(numberField(data, "output_cost_per_token") * 1_000_000);
    const cacheWrite = round4(numberField(data, "cache_creation_input_token_cost") * 1_000_000);
    const cacheRead = round4(numberField(data, "cache_read_input_token_cost") * 1_000_000);
    if (input === 0 && output === 0) {
      continue;
    }

    map.set(model, { input, output, cacheWrite, cacheRead });
  }

  if (map.size === 0) {
    abort("No supported model pricing found in response");
  }

  return map;
}

async function readPricingJson(): Promise<Record<string, unknown>> {
  if (
    (await fileExists(PRICING_CACHE)) &&
    Date.now() - (await stat(PRICING_CACHE)).mtimeMs < PRICING_CACHE_TTL_MS
  ) {
    return parseJsonObject(await readFile(PRICING_CACHE, "utf8")) ?? {};
  }

  const response = await fetch(LITELLM_URL, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    abort(`Failed to fetch pricing: ${response.status} ${response.statusText}`);
  }

  const body = await response.text();
  await mkdir(dirname(PRICING_CACHE), { recursive: true });
  await writeFile(PRICING_CACHE, body);
  return parseJsonObject(body) ?? {};
}

function costFor(
  model: string,
  input: number,
  output: number,
  cacheWrite: number,
  cacheRead: number,
): number {
  const normalized = normalizeModel(model);
  let rates = pricing.get(normalized);

  if (!rates) {
    const parts = normalized.split("-");
    for (let length = parts.length - 1; length >= 2; length -= 1) {
      const prefix = parts.slice(0, length).join("-");
      rates = [...pricing.entries()].find(([key]) => key.startsWith(prefix))?.[1];
      if (rates) {
        break;
      }
    }
  }

  if (!rates) {
    return 0;
  }

  return (
    (input * rates.input +
      output * rates.output +
      cacheWrite * rates.cacheWrite +
      cacheRead * rates.cacheRead) /
    1_000_000
  );
}

function normalizeModel(model: string): string {
  return model
    .replace(/^(?:us|eu|apac)\./, "")
    .replace(/^anthropic[./]/, "")
    .replace(/^(?:openai|azure|azure_ai)\//, "");
}

async function repoRootFor(path: string): Promise<string> {
  const cached = repoRootCache.get(path);
  if (cached) {
    return cached;
  }

  let resolved = path;
  if (await directoryExists(path)) {
    const result = await runCommand("git", [
      "-C",
      path,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    ]);
    const commonDir = result.stdout.trim();
    if (result.code === 0 && commonDir) {
      resolved = commonDir.endsWith("/.git") ? dirname(commonDir) : path;
    }
  }

  repoRootCache.set(path, resolved);
  return resolved;
}

async function worktreeLinks(repo: string): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  const worktreesDir = join(repo, ".git", "worktrees");
  if (!(await directoryExists(worktreesDir))) {
    return links;
  }

  try {
    for (const entry of await readdir(worktreesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const gitdir = (await readFile(join(worktreesDir, entry.name, "gitdir"), "utf8")).trim();
      if (gitdir) {
        links.set(gitdir.replace(/\/\.git$/, ""), repo);
      }
    }
  } catch {
    return new Map();
  }

  return links;
}

async function branchesFor(repo: string): Promise<Set<string>> {
  const cached = branchesCache.get(repo);
  if (cached) {
    return cached;
  }

  const branches = new Set<string>();
  const current = await runCommand("git", [
    "-C",
    repo,
    "for-each-ref",
    "--format=%(refname:short)",
    "refs/heads/",
  ]);
  if (current.code === 0) {
    for (const line of current.stdout.split(/\r?\n/)) {
      if (line.trim()) {
        branches.add(line.trim());
      }
    }
  }

  const reflog = await runCommand("git", ["-C", repo, "reflog", "--all", "--pretty=%gD"]);
  if (reflog.code === 0) {
    for (const match of reflog.stdout.matchAll(/refs\/heads\/(\S+?)@\{/g)) {
      branches.add(match[1]!);
    }
  }

  branchesCache.set(repo, branches);
  return branches;
}

function parseSince(input: string): string {
  const now = localMidnight(new Date());
  const text = input.trim().toLowerCase();
  const relative = text.match(/^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago$/);

  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2]!;
    const date = new Date(now);
    if (unit.startsWith("day")) date.setDate(date.getDate() - amount);
    if (unit.startsWith("week")) date.setDate(date.getDate() - amount * 7);
    if (unit.startsWith("month")) date.setMonth(date.getMonth() - amount);
    if (unit.startsWith("year")) date.setFullYear(date.getFullYear() - amount);
    return dateString(date);
  }

  if (text === "today") {
    return dateString(now);
  }

  if (text === "yesterday") {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    return dateString(date);
  }

  const lastWeekday = text.match(
    /^last\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/,
  );
  if (lastWeekday) {
    return dateString(previousWeekday(now, weekdayIndex(lastWeekday[1]!)));
  }

  const cleaned = text.replace(/\b(\d+)(st|nd|rd|th)\b/g, "$1");
  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    const date = localMidnight(parsed);
    if (date > now) {
      date.setFullYear(date.getFullYear() - 1);
    }
    return dateString(date);
  }

  abort(
    `Couldn't parse '${input}' as a date.\n\nExamples: '2 weeks ago', 'last monday', 'april 1st', 'yesterday'`,
  );
}

function previousWeekday(now: Date, target: number): Date {
  const date = new Date(now);
  let delta = (date.getDay() - target + 7) % 7;
  delta ||= 7;
  date.setDate(date.getDate() - delta);
  return date;
}

function weekdayIndex(weekday: string): number {
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(
    weekday,
  );
}

function getBucket(map: Map<string, Bucket>, key: string): Bucket {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = newBucket();
    map.set(key, bucket);
  }

  return bucket;
}

function formatTokens(count: number): string {
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)}B`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return Math.round(count).toString();
}

function truncateTitle(title: string | undefined): string {
  if (!title?.trim()) {
    return "(untitled)";
  }

  const cleaned = title.replace(/\s+/g, " ").trim();
  const words = cleaned.split(/\s+/);
  return words.length <= TITLE_WORD_LIMIT
    ? cleaned
    : `${words.slice(0, TITLE_WORD_LIMIT).join(" ")}…`;
}

function shortenPath(path: string): string {
  const home = homedir();
  return path.startsWith(home) ? path.replace(home, "~") : path;
}

function formatMoney(value: number): string {
  return `$${value.toFixed(4)}`;
}

function renderTable(header: string[], rows: string[][]): string {
  const allRows = [header, ...rows];
  const widths = header.map((_, index) =>
    Math.max(...allRows.map((row) => row[index]?.length ?? 0)),
  );
  const alignments = ["left", "right", "right", "right", "right", "right"] as const;
  const top = tableBorder("┌", "┬", "┐", widths);
  const middle = tableBorder("├", "┼", "┤", widths);
  const bottom = tableBorder("└", "┴", "┘", widths);
  const lines = [top, tableRow(header, widths, alignments), middle];

  for (const row of rows) {
    lines.push(tableRow(row, widths, alignments));
  }

  lines.push(bottom);
  return lines.map((line) => `  ${line}`).join("\n");
}

function tableBorder(left: string, middle: string, right: string, widths: number[]): string {
  return `${left}${widths.map((width) => "─".repeat(width + 2)).join(middle)}${right}`;
}

function tableRow(
  row: string[],
  widths: number[],
  alignments: readonly ["left", "right", "right", "right", "right", "right"],
): string {
  const cells = row.map((cell, index) => {
    const padded =
      alignments[index] === "left" ? cell.padEnd(widths[index]!) : cell.padStart(widths[index]!);
    return ` ${padded} `;
  });
  return `│${cells.join("│")}│`;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function abort(message: string): never {
  console.error(message);
  process.exit(1);
}

function ansi(code: number, text: string): string {
  return `\u001b[${code}m${text}\u001b[0m`;
}

function bold(text: string): string {
  return ansi(1, text);
}

function dim(text: string): string {
  return ansi(2, text);
}

function cyan(text: string): string {
  return ansi(36, text);
}

function yellow(text: string): string {
  return ansi(33, text);
}

function green(text: string): string {
  return ansi(32, text);
}
