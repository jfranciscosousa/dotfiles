import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { createInterface } from "node:readline/promises";
import {
  addUsage,
  dateString,
  directoryExists,
  earlierDate,
  filesMatching,
  getSession,
  numberField,
  objectField,
  parseJsonObject,
  stringField,
} from "../shared.ts";
import type { CollectOptions, SessionCost, SourceData } from "../types.ts";

export async function collectPi(options: CollectOptions): Promise<SourceData> {
  const sessions = new Map<string, SessionCost>();
  const sessionsDir = join(homedir(), ".pi", "agent", "sessions");
  let fileCount = 0;
  let messageCount = 0;

  if (await directoryExists(sessionsDir)) {
    for (const jsonl of await filesMatching(sessionsDir, (path) => path.endsWith(".jsonl"))) {
      fileCount += 1;
      messageCount += await ingestJsonl(jsonl, sessions, options);
    }
  }

  return {
    source: "pi",
    label: "pi",
    sessions: [...sessions.values()],
    messageCount,
    fileCount,
    extraRepos: [],
  };
}

async function ingestJsonl(
  jsonl: string,
  sessions: Map<string, SessionCost>,
  options: CollectOptions,
): Promise<number> {
  const lines = createInterface({
    input: createReadStream(jsonl),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  const fallbackSessionId = fallbackId(jsonl);
  let sessionId = fallbackSessionId;
  let session = getSession(sessions, "pi", sessionId);
  let messageCount = 0;

  for await (const line of lines) {
    const record = parseJsonObject(line);
    if (!record) {
      continue;
    }

    if (record.type === "session") {
      const explicitId = stringField(record, "id");
      if (explicitId && explicitId !== sessionId) {
        sessions.delete(`pi\0${sessionId}`);
        sessionId = explicitId;
        session = getSession(sessions, "pi", sessionId);
      }
      session.cwd ??= stringField(record, "cwd");
      session.date = stringField(record, "timestamp")
        ? earlierDate(session.date, dateString(new Date(stringField(record, "timestamp")!)))
        : session.date;
      continue;
    }

    if (record.type !== "message") {
      continue;
    }

    const message = objectField(record, "message");
    if (!message) {
      continue;
    }

    if (message.role === "user") {
      session.title ??= firstText(message);
      continue;
    }

    if (message.role !== "assistant") {
      continue;
    }

    const usageRecord = objectField(message, "usage");
    const model = stringField(message, "model");
    if (!usageRecord || !model) {
      continue;
    }

    const timestamp = stringField(record, "timestamp") ?? stringField(message, "timestamp");
    const date = timestamp ? dateString(new Date(timestamp)) : undefined;
    if (!date || date < options.since) {
      continue;
    }

    const usage = {
      input: numberField(usageRecord, "input"),
      output: numberField(usageRecord, "output"),
      cacheWrite: numberField(usageRecord, "cacheWrite"),
      cacheRead: numberField(usageRecord, "cacheRead"),
    };
    const cost = options.costFor(
      model,
      usage.input,
      usage.output,
      usage.cacheWrite,
      usage.cacheRead,
    );

    session.date = earlierDate(session.date, date);
    addUsage(session, model, usage, cost);
    messageCount += 1;
  }

  return messageCount;
}

function fallbackId(jsonl: string): string {
  const file = basename(jsonl, ".jsonl");
  return file.split("_").at(-1) ?? file;
}

function firstText(message: Record<string, unknown>): string | undefined {
  const content = message.content;
  if (!Array.isArray(content)) {
    return undefined;
  }

  for (const item of content) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const text = stringField(item as Record<string, unknown>, "text");
    if (text) {
      return text;
    }
  }

  return undefined;
}
