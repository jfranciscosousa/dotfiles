import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const criticalInstructionsPath = join(homedir(), ".brains", "CRITICAL.md");

export const CriticalInstructions = async () => ({
  "experimental.chat.system.transform": async (_input: unknown, output: { system: string[] }) => {
    output.system.push(await readFile(criticalInstructionsPath, "utf8"));
  },
});
