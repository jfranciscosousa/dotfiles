// Emit a terminal bell when OpenCode goes idle or needs permission.
// Zed's terminal listens for the bell character (\x07) and surfaces a
// notification on the host. Documented at:
// https://zed.dev/docs/ai/agent-clients
export const ZedBell = async () => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.idle" || event.type === "permission.asked") {
        process.stdout.write("\x07");
      }
    },
  };
};
