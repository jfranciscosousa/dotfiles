import {
  createBashToolDefinition,
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  getAgentDir,
  type ExtensionAPI,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Container } from "@earendil-works/pi-tui";

function hidden() {
  return new Container();
}

type ToolFactory = (cwd: string) => ToolDefinition<any, any, any>;

const toolFactories: ToolFactory[] = [
  createBashToolDefinition,
  createReadToolDefinition,
  createGrepToolDefinition,
  createFindToolDefinition,
  createLsToolDefinition,
];

const statePath = join(getAgentDir(), "quiet-tools.json");

type QuietToolsState = {
  quietTools: boolean;
};

async function loadQuietTools(): Promise<boolean> {
  try {
    const state = JSON.parse(await readFile(statePath, "utf8")) as Partial<QuietToolsState>;
    return state.quietTools ?? true;
  } catch {
    return true;
  }
}

async function saveQuietTools(quietTools: boolean): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify({ quietTools })}\n`, { mode: 0o600 });
}

function registerTool(pi: ExtensionAPI, createDefinition: ToolFactory, quiet: boolean) {
  const base = createDefinition(process.cwd());
  const {
    renderCall: _renderCall,
    renderResult: _renderResult,
    renderShell: _renderShell,
    ...tool
  } = base;

  pi.registerTool({
    ...tool,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createDefinition(ctx.cwd).execute(toolCallId, params, signal, onUpdate, ctx);
    },
    ...(quiet && {
      renderShell: "self" as const,
      renderCall: hidden,
      renderResult: hidden,
    }),
  });
}

export default async function (pi: ExtensionAPI) {
  let quietTools = await loadQuietTools();

  const applyQuietTools = () => {
    for (const createDefinition of toolFactories) {
      registerTool(pi, createDefinition, quietTools);
    }
  };

  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setHiddenThinkingLabel(quietTools ? "" : undefined);
  });

  pi.on("message_end", (event) => {
    if (!quietTools || event.message.role !== "assistant") return;

    const content = event.message.content.filter((block) => block.type !== "thinking");
    if (content.length === event.message.content.length) return;

    return {
      message: {
        ...event.message,
        content,
      },
    };
  });

  pi.registerCommand("quiet-tools", {
    description: "Show or set quiet tool and thinking output: /quiet-tools [on|off]",
    handler: async (args, ctx) => {
      const setting = args.trim().toLowerCase();

      if (!setting) {
        ctx.ui.notify(`Quiet tools are ${quietTools ? "enabled" : "disabled"}`, "info");
        return;
      }

      if (setting !== "on" && setting !== "off") {
        ctx.ui.notify("Usage: /quiet-tools [on|off]", "warning");
        return;
      }

      quietTools = setting === "on";
      applyQuietTools();
      ctx.ui.setHiddenThinkingLabel(quietTools ? "" : undefined);

      try {
        await saveQuietTools(quietTools);
        ctx.ui.notify(`Quiet tools ${quietTools ? "enabled" : "disabled"}`, "info");
      } catch (error) {
        ctx.ui.notify(`Quiet tools changed but could not be saved: ${String(error)}`, "error");
      }
    },
  });

  applyQuietTools();
}
