import type { Message } from "@earendil-works/pi-ai";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  type ExtensionAPI,
  formatSize,
  truncateTail,
} from "@earendil-works/pi-coding-agent";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

const Effort = StringEnum(["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const, {
  description: "Reasoning effort. Defaults to the caller's effort.",
});

const Parameters = Type.Object({
  prompt: Type.String({ description: "Task for the subagent" }),
  model: Type.Optional(
    Type.String({
      description:
        "Model ID, optionally prefixed with its provider. Defaults to the caller's model.",
    }),
  ),
  effort: Type.Optional(Effort),
});

interface SubagentResult {
  output: string;
  model: string;
  effort: string;
}

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  if (currentScript && !currentScript.startsWith("/$bunfs/root/") && existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }

  const executable = basename(process.execPath).toLowerCase();
  if (!/^(node|bun)(\.exe)?$/.test(executable)) {
    return { command: process.execPath, args };
  }

  return { command: "pi", args };
}

function finalAssistantText(messages: Message[]): string {
  const message = messages.findLast((candidate) => candidate.role === "assistant");
  if (!message || message.role !== "assistant") return "";

  return message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

async function truncateOutput(output: string): Promise<string> {
  const truncated = truncateTail(output, {
    maxBytes: DEFAULT_MAX_BYTES,
    maxLines: DEFAULT_MAX_LINES,
  });
  if (!truncated.truncated) return output;

  const directory = join(tmpdir(), "pi-subagent-output");
  await mkdir(directory, { recursive: true });
  const outputPath = join(directory, `output-${crypto.randomUUID()}.txt`);
  await writeFile(outputPath, output, { encoding: "utf8", mode: 0o600 });

  return `${truncated.content}\n\n[Output truncated to ${formatSize(truncated.outputBytes)}. Full output: ${outputPath}]`;
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Delegate a task to a synchronous subagent with an isolated context. The subagent uses the caller's working directory, active tools, model, and effort unless overridden. It can inspect and modify the project and run commands. Returns only its final report.",
    promptSnippet: "Delegate a task to a synchronous agent with an isolated context",
    parameters: Parameters,

    renderCall(args, theme) {
      return new Text(`${theme.fg("toolTitle", theme.bold("subagent"))} ${args.prompt}`, 0, 0);
    },

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (!ctx.model)
        throw new Error("Cannot start a subagent because the caller has no active model.");

      const model = params.model ?? `${ctx.model.provider}/${ctx.model.id}`;
      const effort = params.effort ?? pi.getThinkingLevel();
      const activeTools = pi.getActiveTools();
      const args = [
        "--mode",
        "json",
        "--print",
        "--no-session",
        "--model",
        model,
        "--thinking",
        effort,
        ctx.isProjectTrusted() ? "--approve" : "--no-approve",
      ];

      if (activeTools.length > 0) args.push("--tools", activeTools.join(","));
      else args.push("--no-tools");
      args.push(params.prompt);

      onUpdate?.({
        content: [{ type: "text", text: `Subagent is working with ${model} (${effort})...` }],
        details: { output: "", model, effort } satisfies SubagentResult,
      });

      const invocation = getPiInvocation(args);
      const messages: Message[] = [];
      let stderr = "";
      let buffer = "";
      let spawnError: Error | undefined;

      const exitCode = await new Promise<number>((resolve) => {
        const child = spawn(invocation.command, invocation.args, {
          cwd: ctx.cwd,
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
        });

        const processLine = (line: string) => {
          if (!line.trim()) return;
          try {
            const event = JSON.parse(line) as { type?: string; message?: Message };
            if (event.type === "message_end" && event.message) messages.push(event.message);
          } catch {
            // Ignore non-event output from child extensions.
          }
        };

        child.stdout.on("data", (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        });
        child.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        child.on("error", (error) => {
          spawnError = error;
        });
        child.on("close", (code) => {
          processLine(buffer);
          resolve(code ?? 1);
        });

        const abort = () => child.kill("SIGTERM");
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });

      if (signal?.aborted) throw new Error("Subagent was aborted.");
      if (spawnError) throw new Error(`Could not start subagent: ${spawnError.message}`);

      const output = finalAssistantText(messages);
      if (exitCode !== 0) {
        throw new Error(stderr.trim() || output || `Subagent exited with code ${exitCode}.`);
      }
      if (!output) throw new Error(stderr.trim() || "Subagent returned no report.");

      const report = await truncateOutput(output);
      return {
        content: [{ type: "text", text: report }],
        details: { output, model, effort } satisfies SubagentResult,
      };
    },
  });
}
