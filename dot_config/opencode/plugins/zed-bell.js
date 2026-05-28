// Emit a terminal bell when OpenCode goes idle or needs permission.
// Zed's terminal listens for the bell character (\x07) and surfaces a
// notification on the host. Documented at:
// https://zed.dev/docs/ai/agent-clients
//
// Sub-agent sessions also emit `session.idle`, which used to ping the bell
// every time any sub-agent finished. We filter those out by looking up the
// session and skipping it when `parentID` is set, so the bell only fires
// when the top-level session needs the user's attention.
export const ZedBell = async ({ client }) => {
  const isSubAgentSession = async (sessionID) => {
    if (!sessionID) return false;
    try {
      const result = await client.session.get({ path: { id: sessionID } });
      return Boolean(result?.data?.parentID);
    } catch {
      // On lookup failure, fall through and ring the bell — better to
      // over-notify than to silently swallow a top-level idle event.
      return false;
    }
  };

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        const sessionID = event.properties?.sessionID;
        if (await isSubAgentSession(sessionID)) return;
        process.stdout.write("\x07");
        return;
      }
      if (event.type === "permission.asked") {
        process.stdout.write("\x07");
      }
    },
  };
};
