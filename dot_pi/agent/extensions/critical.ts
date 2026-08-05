import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const CRITICAL_DOC_PATH = join(homedir(), ".brains", "CRITICAL.md");

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", async (event) => {
    const criticalDoc = await readFile(CRITICAL_DOC_PATH, "utf8");

    return {
      systemPrompt: `${event.systemPrompt}\n\n${criticalDoc}`,
    };
  });
}
