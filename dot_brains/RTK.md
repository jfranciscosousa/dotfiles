# RTK - Rust Token Killer

RTK reduces CLI output sent to the model. It is an output filter, not a permission boundary or a
substitute for verification.

## Usage

Prefer explicit wrappers for supported commands:

- `rtk git status`, `rtk git diff`, `rtk git log`, `rtk git show`
- `rtk gh`, `rtk glab`
- `rtk grep`, `rtk find`, `rtk ls`, `rtk tree`, `rtk diff`
- `rtk test`, `rtk jest`, `rtk vitest`, `rtk tsc`, `rtk pnpm`
- `rtk docker`, `rtk kubectl`, `rtk aws`, `rtk psql`

Use native file-reading and search tools when available. In a shell-only environment, use
`rtk read <file>` for compact inspection. Retain ast-grep for structural searches.

For package scripts named exactly `lint`, use `rtk pnpm run lint`, never bare `pnpm run lint`: RTK
can rewrite the bare command to `rtk lint` and attempt to run ESLint. Repository-specific check
scope still applies; this example does not authorize a full-project lint.

Use `rtk proxy <command>` when filtering hides diagnostics or exact output is required. Inspect
truncated files and diffs completely before making claims that depend on the omitted content. Do not
rerun a mutating command just to recover its output; inspect existing results or logs instead.

If RTK is unavailable, report it and use the underlying command with the same permission limits. Do
not install or reconfigure RTK implicitly.

## Automatic rewriting

This repository configures RTK integrations for:

- Claude Code: `PreToolUse` Bash hook in `~/.claude/settings.json`.
- OpenCode: `tool.execute.before` plugin at `~/.config/opencode/plugins/rtk.ts`.
- Cursor: `preToolUse` Shell hook in `~/.cursor/hooks.json`.
- Pi: `tool_call` extension at `~/.pi/agent/extensions/rtk.ts`.

Rewriting depends on the installed version, active hook, and command shape. Do not assume compound
commands or pipelines are rewritten. Prefer separate tool calls for independent commands and
explicit wrappers where supported. Never bypass approval restrictions through a wrapper.

## Diagnostics

Use these only when diagnosing RTK, not at the start of every task:

```bash
rtk --version
rtk gain
rtk gain --history
rtk discover
```

`rtk gain` identifies the intended CLI. If it fails, check for a name collision with
`reachingforthejack/rtk` (Rust Type Kit) before proposing installation changes.
