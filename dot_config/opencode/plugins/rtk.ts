// Based on upstream rtk-ai/rtk hooks/opencode/rtk.ts. Local additions:
// package-manager lint guard (repo lint is oxfmt/lint-staged, not ESLint),
// RTK_DISABLED passthrough.
import { execFile } from "node:child_process";

const RTK_COMMAND_PREFIX = /^(?:env\s+\S+\s+)*rtk(?:\s|$)/;
const PACKAGE_MANAGER_LINT_COMMAND = /^(?:env\s+\S+\s+)*(?:pnpm|npm|yarn|bun)\s+run\s+lint(?:\s|$)/;
const RTK_REWRITE_CODES = new Set([0, 3]);

type ToolExecuteBeforeInput = {
  tool?: string;
};

type ToolExecuteBeforeOutput = {
  args: {
    command?: string;
    [key: string]: unknown;
  };
};

function hasRtk(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("which", ["rtk"], (error) => resolve(!error));
  });
}

function rewriteCommand(command: string): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile("rtk", ["rewrite", command], { timeout: 3000 }, (error, stdout) => {
      if (!error) {
        resolve({ code: 0, stdout: stdout.trim() });
        return;
      }

      const code = typeof error.code === "number" ? error.code : 1;
      resolve({ code, stdout: stdout.trim() });
    });
  });
}

export const Rtk = async () => {
  if (!(await hasRtk())) {
    console.warn("[rtk] rtk binary not found in PATH — plugin disabled");
    return {};
  }

  return {
    "tool.execute.before": async (
      input: ToolExecuteBeforeInput,
      output: ToolExecuteBeforeOutput,
    ) => {
      const tool = String(input.tool ?? "").toLowerCase();
      if (tool !== "bash" && tool !== "shell") return;

      const command = output.args.command;
      if (!command) return;
      const trimmed = command.trim();
      if (RTK_COMMAND_PREFIX.test(trimmed) || PACKAGE_MANAGER_LINT_COMMAND.test(trimmed)) {
        return;
      }
      if (process.env.RTK_DISABLED === "1") return;

      const result = await rewriteCommand(command);
      if (!RTK_REWRITE_CODES.has(result.code)) return;

      const rewritten = result.stdout.trim();
      if (rewritten && rewritten !== command) {
        output.args.command = rewritten;
      }
    },
  };
};
