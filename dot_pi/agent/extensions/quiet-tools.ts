import {
  createFindToolDefinition,
  createGrepToolDefinition,
  createLsToolDefinition,
  createReadToolDefinition,
  type ExtensionAPI,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Container } from "@earendil-works/pi-tui";

function hidden() {
  return new Container();
}

function registerQuietTool(pi: ExtensionAPI, createDefinition: (cwd: string) => ToolDefinition) {
  const base = createDefinition(process.cwd());

  pi.registerTool({
    ...base,
    renderShell: "self",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return createDefinition(ctx.cwd).execute(toolCallId, params, signal, onUpdate, ctx);
    },
    renderCall: hidden,
    renderResult: hidden,
  });
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    ctx.ui.setHiddenThinkingLabel("");
  });

  pi.on("message_end", (event) => {
    if (event.message.role !== "assistant") return;

    const content = event.message.content.filter((block) => block.type !== "thinking");
    if (content.length === event.message.content.length) return;

    return {
      message: {
        ...event.message,
        content,
      },
    };
  });

  registerQuietTool(pi, createReadToolDefinition);
  registerQuietTool(pi, createGrepToolDefinition);
  registerQuietTool(pi, createFindToolDefinition);
  registerQuietTool(pi, createLsToolDefinition);
}
