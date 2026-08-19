---
name: orchestrate-create
description: Create a background cmux workspace named for any work request.
---

# Orchestrate Create

Treat the input as a work request from any source, such as a repository task, ticket, thread, or
telemetry link.

First, run:

```bash
cmux identify --json
```

If it does not identify the caller as a cmux workspace, stop. Report that you cannot create the
workspace because the current session is not in cmux. Do not inspect the input or run another
command.

If the input contains a URL, identify its service from the URL and use its authenticated CLI or MCP
tool to read the linked resource. Do not modify the resource.

Create a short, clear workspace title of a few words from the request and retrieved context.

Run exactly this command once:

```bash
cmux new-workspace --name "<title>" --focus false
```

Return the created workspace reference. Do not focus the workspace. Do not start the task.
