import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  addUsage,
  childDirectories,
  dateString,
  directoryExists,
  earlierDate,
  filesMatching,
  getSession,
  incrementRecord,
  numberField,
  objectField,
  parseJsonObject,
  stringField,
} from "../shared.ts";
import type { CollectOptions, SessionCost, SourceData } from "../types.ts";

export async function collectClaude(options: CollectOptions): Promise<SourceData> {
  const sessions = new Map<string, SessionCost>();
  const projectsDir = join(homedir(), ".claude", "projects");
  let fileCount = 0;
  let messageCount = 0;

  if (await directoryExists(projectsDir)) {
    for (const projectDir of await childDirectories(projectsDir)) {
      for (const jsonl of await filesMatching(projectDir, (path) => path.endsWith(".jsonl"))) {
        fileCount += 1;
        messageCount += await ingestJsonl(projectDir, jsonl, sessions, options);
      }
    }
  }

  return {
    source: "claude",
    label: "Claude Code",
    sessions: [...sessions.values()],
    messageCount,
    fileCount,
    extraRepos: [],
  };
}

async function ingestJsonl(
  projectDir: string,
  jsonl: string,
  sessions: Map<string, SessionCost>,
  options: CollectOptions,
): Promise<number> {
  const lines = createInterface({
    input: createReadStream(jsonl),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  let messageCount = 0;

  for await (const line of lines) {
    const record = parseJsonObject(line);
    if (!record) {
      continue;
    }

    const sessionId = stringField(record, "sessionId") ?? basename(jsonl, ".jsonl");
    const session = getSession(sessions, "claude", sessionId);

    if (record.type === "ai-title") {
      session.title = stringField(record, "aiTitle") ?? session.title;
      continue;
    }

    if (record.type !== "assistant") {
      continue;
    }

    const message = objectField(record, "message");
    const usageRecord = message ? objectField(message, "usage") : undefined;
    const model = message ? stringField(message, "model") : undefined;
    if (!message || !usageRecord || !model || model === "<synthetic>") {
      continue;
    }

    const timestamp = stringField(record, "timestamp");
    const date = timestamp ? dateString(new Date(timestamp)) : undefined;
    if (!date || date < options.since) {
      continue;
    }

    const usage = {
      input: numberField(usageRecord, "input_tokens"),
      output: numberField(usageRecord, "output_tokens"),
      cacheWrite: numberField(usageRecord, "cache_creation_input_tokens"),
      cacheRead: numberField(usageRecord, "cache_read_input_tokens"),
    };
    const cost = options.costFor(
      model,
      usage.input,
      usage.output,
      usage.cacheWrite,
      usage.cacheRead,
    );

    session.cwd ??= stringField(record, "cwd") ?? basename(projectDir);
    session.date = earlierDate(session.date, date);
    incrementRecord(session.branchCounts, stringField(record, "gitBranch"), 1);
    addUsage(session, model, usage, cost);
    messageCount += 1;
  }

  return messageCount;
}
