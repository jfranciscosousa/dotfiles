// Based on upstream rtk-ai/rtk hooks/pi/rtk.ts. Local additions: RTK.md
// system-prompt injection, rtk-gain command, package-manager lint guard.
import type {
  BashToolCallEvent,
  ExtensionAPI,
  ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const RTK_DOC_PATH = join(homedir(), ".brains", "RTK.md");
const RTK_COMMAND_PREFIX = /^(?:env\s+\S+\s+)*rtk(?:\s|$)/;
const PACKAGE_MANAGER_LINT_COMMAND = /^(?:env\s+\S+\s+)*(?:pnpm|npm|yarn|bun)\s+run\s+lint(?:\s|$)/;
const RTK_REWRITE_CODES = new Set([0, 3]);
const REWRITE_TIMEOUT_MS = 3000;
const MIN_SUPPORTED_RTK_MINOR = 23;

// Local reimplementation of the package's `isToolCallEventType("bash", event)`
// type guard. That helper is a value export, so importing it pulls in the whole
// package barrel at extension load; these type-only imports are erased at
// compile time. Mirrors upstream.
function isBashToolCallEvent(event: ToolCallEvent): event is BashToolCallEvent {
  return event.toolName === "bash";
}

// Parse "X.Y.Z" semver, return [major, minor, patch] or null.
function parseSemver(raw: string): [number, number, number] | null {
  const m = raw.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

export default async function (pi: ExtensionAPI) {
  let rtkDoc: string | undefined;
  let warnedUnavailable = false;

  pi.on("session_start", async (_event) => {
    rtkDoc = await readRtkDoc();
  });

  pi.on("before_agent_start", async (event) => {
    rtkDoc ??= await readRtkDoc();
    if (!rtkDoc) return;

    return {
      systemPrompt: `${event.systemPrompt}\n\n${rtkDoc}`,
    };
  });

  // Probe rtk at load; without a new-enough binary the rewrite handler stays
  // unregistered and commands pass through unchanged. The RTK.md guidance
  // above still applies: it describes the rtk-unavailable fallback.
  try {
    const ver = await pi.exec("rtk", ["--version"], { timeout: REWRITE_TIMEOUT_MS });
    if (ver.code !== 0) throw new Error("rtk --version failed");
    const parsed = parseSemver(ver.stdout.replace(/^rtk\s+/, ""));
    if (parsed && parsed[0] === 0 && parsed[1] < MIN_SUPPORTED_RTK_MINOR) {
      throw new Error(`rtk ${parsed.join(".")} predates 0.23.0`);
    }
  } catch {
    console.warn("[rtk] rtk binary not found or too old (need >= 0.23.0) — rewrite disabled");
    return;
  }

  pi.on("tool_call", async (event, ctx) => {
    if (!isBashToolCallEvent(event)) return;

    const command = event.input.command;
    if (!command) return;
    const trimmed = command.trim();
    if (RTK_COMMAND_PREFIX.test(trimmed) || PACKAGE_MANAGER_LINT_COMMAND.test(trimmed)) return;
    if (process.env.RTK_DISABLED === "1") return;

    try {
      const result = await pi.exec("rtk", ["rewrite", command], {
        signal: ctx.signal,
        timeout: REWRITE_TIMEOUT_MS,
      });

      if (!RTK_REWRITE_CODES.has(result.code)) {
        if (!warnedUnavailable && ctx.hasUI) {
          warnedUnavailable = true;
          ctx.ui.notify("rtk rewrite unavailable; leaving bash commands unchanged", "warning");
        }
        return;
      }

      const rewritten = result.stdout.trim();
      if (rewritten && rewritten !== command) {
        event.input.command = rewritten;
      }
    } catch {
      if (!warnedUnavailable && ctx.hasUI) {
        warnedUnavailable = true;
        ctx.ui.notify("rtk rewrite failed; leaving bash commands unchanged", "warning");
      }
    }
  });

  pi.registerCommand("rtk-gain", {
    description: "Show RTK token savings analytics",
    handler: async (_args, ctx) => {
      const result = await pi.exec("rtk", ["gain"], { timeout: 5000 });
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      ctx.ui.notify(output || "rtk gain produced no output", result.code === 0 ? "info" : "error");
    },
  });
}

async function readRtkDoc() {
  try {
    return await readFile(RTK_DOC_PATH, "utf8");
  } catch {
    return undefined;
  }
}
