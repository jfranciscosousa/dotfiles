import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Bucket, CommandResult, SessionCost, Source, Usage } from "./types.ts";

export function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      resolve({ code: null, signal: null, stdout: "", stderr: error.message });
    });
    child.on("close", (code, signal) => {
      resolve({
        code,
        signal,
        stdout: Buffer.concat(stdout).toString(),
        stderr: Buffer.concat(stderr).toString(),
      });
    });
  });
}

export async function filesMatching(
  root: string,
  matches: (path: string) => boolean,
): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesMatching(path, matches)));
    } else if (entry.isFile() && matches(path)) {
      files.push(path);
    }
  }

  return files.sort();
}

export async function childDirectories(path: string): Promise<string[]> {
  return (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(path, entry.name))
    .sort();
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

export async function directoryExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

export function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    return objectValue(JSON.parse(text));
  } catch {
    return undefined;
  }
}

export function parseJsonArray(text: string): Record<string, unknown>[] {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? value.map(objectValue).filter(isDefined) : [];
  } catch {
    return [];
  }
}

export function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

export function objectField(
  record: Record<string, unknown>,
  field: string,
): Record<string, unknown> | undefined {
  return objectValue(record[field]);
}

export function stringField(record: Record<string, unknown>, field: string): string | undefined {
  const value = record[field];
  return typeof value === "string" && value ? value : undefined;
}

export function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function dateString(date: Date): string {
  const local = localMidnight(date);
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function earlierDate(current: string | undefined, next: string): string {
  return current && current < next ? current : next;
}

export function getSession(
  sessions: Map<string, SessionCost>,
  source: Source,
  sessionId: string,
): SessionCost {
  const key = `${source}\0${sessionId}`;
  let session = sessions.get(key);
  if (!session) {
    session = {
      source,
      sessionId,
      branchCounts: {},
      modelCosts: {},
      bucket: newBucket(),
    };
    sessions.set(key, session);
  }

  return session;
}

export function newBucket(): Bucket {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
}

export function addUsage(session: SessionCost, model: string, usage: Usage, cost: number): void {
  incrementRecord(session.modelCosts, model, cost);
  session.bucket.input += usage.input;
  session.bucket.output += usage.output;
  session.bucket.cacheWrite += usage.cacheWrite;
  session.bucket.cacheRead += usage.cacheRead;
  session.bucket.cost += cost;
}

export function incrementRecord(
  record: Record<string, number>,
  key: string | undefined,
  amount: number,
): void {
  if (!key) {
    return;
  }

  record[key] = (record[key] ?? 0) + amount;
}

export function maxRecordEntry(record: Record<string, number>): [string, number] | undefined {
  return Object.entries(record).sort(([, a], [, b]) => b - a)[0];
}

export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
