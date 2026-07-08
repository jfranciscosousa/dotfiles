import { homedir } from "node:os";
import { join } from "node:path";
import {
  addUsage,
  dateString,
  earlierDate,
  fileExists,
  getSession,
  numberField,
  parseJsonArray,
  runCommand,
  stringField,
} from "../shared.ts";
import type { CollectOptions, SessionCost, SourceData } from "../types.ts";

export async function collectOpenCode(options: CollectOptions): Promise<SourceData> {
  const opencodeDb = join(homedir(), ".local", "share", "opencode", "opencode.db");
  const sessions = new Map<string, SessionCost>();
  const extraRepos = new Set<string>();
  let messageCount = 0;

  if (await fileExists(opencodeDb)) {
    messageCount = await collectMessages(opencodeDb, sessions, options);
    await collectProjects(opencodeDb, extraRepos);
  }

  return {
    source: "opencode",
    label: "OpenCode",
    sessions: [...sessions.values()],
    messageCount,
    fileCount: 0,
    extraRepos: [...extraRepos],
  };
}

async function collectMessages(
  opencodeDb: string,
  sessions: Map<string, SessionCost>,
  options: CollectOptions,
): Promise<number> {
  const query = `
    SELECT
      message.session_id                                 AS session_id,
      json_extract(message.data, '$.modelID')            AS model,
      json_extract(message.data, '$.tokens.input')       AS input,
      json_extract(message.data, '$.tokens.output')      AS output,
      json_extract(message.data, '$.tokens.cache.write') AS cache_write,
      json_extract(message.data, '$.tokens.cache.read')  AS cache_read,
      json_extract(message.data, '$.time.created')       AS created_ms,
      json_extract(message.data, '$.path.cwd')           AS cwd,
      session.title                                      AS title
    FROM message
    LEFT JOIN session ON session.id = message.session_id
    WHERE json_extract(message.data, '$.role') = 'assistant'
      AND json_extract(message.data, '$.time.created') >= ${options.sinceTimeMs}
      AND json_extract(message.data, '$.tokens.input') IS NOT NULL
  `;
  const result = await runCommand("sqlite3", ["-json", opencodeDb, query]);
  if (result.code !== 0 || !result.stdout.trim()) {
    return 0;
  }

  let messageCount = 0;
  for (const row of parseJsonArray(result.stdout)) {
    if (ingestRow(row, sessions, options)) {
      messageCount += 1;
    }
  }

  return messageCount;
}

function ingestRow(
  row: Record<string, unknown>,
  sessions: Map<string, SessionCost>,
  options: CollectOptions,
): boolean {
  const model = String(row.model ?? "");
  const sessionId = stringField(row, "session_id");
  if (!model || !sessionId) {
    return false;
  }

  const createdMs = numberField(row, "created_ms");
  const date = dateString(new Date(createdMs));
  if (date < options.since) {
    return false;
  }

  const usage = {
    input: numberField(row, "input"),
    output: numberField(row, "output"),
    cacheWrite: numberField(row, "cache_write"),
    cacheRead: numberField(row, "cache_read"),
  };
  const cost = options.costFor(model, usage.input, usage.output, usage.cacheWrite, usage.cacheRead);
  const session = getSession(sessions, "opencode", sessionId);

  session.cwd ??= stringField(row, "cwd") ?? "unknown";
  session.date = earlierDate(session.date, date);
  session.title ??= stringField(row, "title");
  addUsage(session, model, usage, cost);
  return true;
}

async function collectProjects(opencodeDb: string, extraRepos: Set<string>): Promise<void> {
  const result = await runCommand("sqlite3", [opencodeDb, "SELECT DISTINCT worktree FROM project"]);
  if (result.code !== 0) {
    return;
  }

  for (const line of result.stdout.split(/\r?\n/)) {
    const path = line.trim();
    if (path) {
      extraRepos.add(path);
    }
  }
}
