import { isToolCallEventType, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const RTK_DOC_PATH = join(homedir(), ".brains", "RTK.md");
const RTK_COMMAND_PREFIX = /^(?:env\s+\S+\s+)*rtk(?:\s|$)/;

export default function (pi: ExtensionAPI) {
  let rtkDoc: string | undefined;
  let warnedUnavailable = false;

  pi.on("session_start", async (_event, ctx) => {
    rtkDoc = await readRtkDoc();
    ctx.ui.setStatus("rtk", "rtk");
  });

  pi.on("before_agent_start", async (event) => {
    rtkDoc ??= await readRtkDoc();
    if (!rtkDoc) return;

    return {
      systemPrompt: `${event.systemPrompt}\n\n${rtkDoc}`,
    };
  });

  pi.on("tool_call", async (event, ctx) => {
    if (!isToolCallEventType("bash", event)) return;

    const command = event.input.command;
    if (!command || RTK_COMMAND_PREFIX.test(command.trim())) return;

    try {
      const result = await pi.exec("rtk", ["rewrite", command], {
        signal: ctx.signal,
        timeout: 3000,
      });

      if (result.code !== 0) {
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
