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

export const Rtk = async () => ({
  "tool.execute.before": async (input: ToolExecuteBeforeInput, output: ToolExecuteBeforeOutput) => {
    if (input.tool !== "bash") return;

    const command = output.args.command;
    if (
      !command ||
      RTK_COMMAND_PREFIX.test(command.trim()) ||
      PACKAGE_MANAGER_LINT_COMMAND.test(command.trim())
    ) {
      return;
    }

    const result = await rewriteCommand(command);
    if (!RTK_REWRITE_CODES.has(result.code)) return;

    const rewritten = result.stdout.trim();
    if (rewritten && rewritten !== command) {
      output.args = { ...output.args, command: rewritten };
    }
  },
});
