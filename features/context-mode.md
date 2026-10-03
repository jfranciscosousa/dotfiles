# Context Mode

[Context Mode](https://github.com/mksglu/context-mode) indexes large tool outputs in local SQLite
and retrieves relevant sections. Chezmoi configures it on personal and `Remote-*` work machines, on
macOS and Linux. Pi and Codex remain excluded on work machines. Zed AI remains disabled.

## Installation

The global mise configuration installs `npm:context-mode@1.0.169`. After applying the configuration,
run `mise install npm:context-mode@1.0.169`. The managed `~/.scripts/bin/context-mode-mcp` launcher
resolves that installation through mise and runs its `start.mjs` entry point. Node must be on PATH.

| Agent       | Integration                                                               | Lifecycle hooks     |
| ----------- | ------------------------------------------------------------------------- | ------------------- |
| Claude Code | User-scoped marketplace plugin, installed when its CLI is available       | Plugin hooks        |
| Codex       | User-scoped marketplace plugin, personal machines only                    | Requires hook trust |
| OpenCode 2  | Global MCP server and scoped routing instructions                         | None                |
| Pi 1        | Built-in global MCP server with codemode exposure, personal machines only | None                |
| Cursor      | Global MCP server, routing rule, and hooks alongside RTK                  | Tool and stop hooks |

The apply script installs missing Claude Code and Codex plugins. It preserves installed plugins and
enabled states. It skips unavailable CLIs and reports installation failures as warnings. A later
apply retries after the CLI becomes available. It never grants hook trust.

OpenCode 2 uses `mcp.servers`, as specified in its
[MCP documentation](https://opencode.ai/v2/docs/mcp-servers). Context Mode 1.0.169's native OpenCode
plugin uses the older plugin API and does not load in OpenCode 2. Do not configure both the plugin
and the MCP fallback. Existing Remote MCP servers remain in the same server map.

Pi uses its built-in MCP support instead of Context Mode's Pi package. That package registers its
own tools through a legacy bridge; adding it alongside the managed MCP server creates duplicate
integrations. Pi's existing VCC and Ponytail packages remain unchanged.

## Security and limitations

Execution tools run arbitrary code with the server's OS privileges. They are not an OS sandbox and
do not reproduce every agent's permission policy. Never use them to bypass denied native tools,
plan-mode restrictions, sandbox boundaries, authentication controls, or required approvals.

Context Mode's server reads Claude-style `permissions.deny` rules. Version 1.0.169's Bash policy
reader requires `CLAUDE_PROJECT_DIR`. The default CLI and Pi bridge do not initialize it for a
normal non-Claude session. The managed MCP launcher runs `start.mjs`, which initializes this path
from the workspace. Codex's native plugin also uses `start.mjs`. The runtime check verifies Bash and
Read deny rules plus the project boundary for `ctx_execute_file`. These checks do not prove complete
host-sandbox equivalence.

Keep RTK for supported CLI output filtering. OpenCode and Pi use MCP without Context Mode lifecycle
hooks, so this setup does not promise Context Mode compaction recovery. Pi retains VCC for its
existing session-memory workflow. Cursor project hook files can override global hooks.

## Verification

Run these checks from the chezmoi source directory:

```bash
python3 scripts/check-context-mode.py
node scripts/check-context-mode.mjs
node scripts/check-context-mode.mjs pi
node scripts/check-context-mode.mjs codex
pi mcp list
opencode mcp list
codex plugin list --marketplace context-mode --json
codex mcp get context-mode --json
```

The Python check requires Python 3.11+. It renders personal/work macOS/Linux templates, verifies
configuration merges, and checks installer idempotency with a mock CLI. The Node check requires the
pinned mise package. It uses temporary fixtures to verify MCP tools, large-content retrieval,
execution, deny rules, file containment, and statistics. It removes only its temporary fixtures.

Restart Pi, Codex, Claude Code, or Cursor after configuration changes. Reload OpenCode configuration
with `opencode reload`. MCP startup is asynchronous; retry its status check after initialization. In
Codex, review `/hooks` and approve the Context Mode hooks when prompted. Plugin registration and
`ctx_stats` connectivity do not prove that hooks are trusted or running.

In each available agent, ask it to index a harmless marker with `ctx_index`, retrieve it with
`ctx_search`, and call `ctx_stats`. Do not use `ctx_upgrade`, `ctx_purge`, or automatic permission
approval as part of verification.

## Updates and removal

The npm package is pinned. To update it, change the mise version, launcher version, and check-script
version together, install the new version, and rerun the checks. Native marketplace plugins use the
harness-managed update mechanisms from `tooling-update`; their versions can differ from the pinned
MCP package. Do not use Context Mode's self-upgrader to rewrite managed configuration.

To remove the feature, remove its mise entry, installer, MCP entries, routing instructions, and
Cursor hooks. Uninstall the native plugins through their CLIs. Add removed managed targets to
`.chezmoiremove`. Do not delete session databases or indexed content without explicit approval.
