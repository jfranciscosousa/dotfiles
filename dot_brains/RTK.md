# RTK - Rust Token Killer

**Usage**: Token-optimized CLI proxy (60-90% savings on dev operations)

## Meta Commands (always use rtk directly)

```bash
rtk gain              # Show token savings analytics
rtk gain --history    # Show command usage history with savings
rtk discover          # Analyze Claude Code history for missed opportunities
rtk proxy <cmd>       # Execute raw command without filtering (for debugging)
```

## Installation Verification

```bash
rtk --version         # Should show: rtk X.Y.Z
rtk gain              # Should work (not "command not found")
which rtk             # Verify correct binary
```

⚠️ **Name collision**: If `rtk gain` fails, you may have reachingforthejack/rtk (Rust Type Kit)
installed instead.

## Hook-Based Usage

All other commands are automatically rewritten:

- **Claude Code**: via the `PreToolUse` Bash hook (`rtk hook claude`) in `~/.claude/settings.json`.
- **OpenCode**: via the `tool.execute.before` plugin at `~/.config/opencode/plugins/rtk.ts`, which
  calls `rtk rewrite <command>`.

Example: `git status` → `rtk git status` (transparent, 0 tokens overhead).

## Prefer rtk wrappers explicitly

For package scripts named exactly `lint`, use `rtk pnpm run lint`, never bare `pnpm run lint`. RTK
incorrectly rewrites that bare command to `rtk lint` and attempts to run ESLint.

The auto-rewriter only matches **bare commands**. Chained pipelines (`a; b; c`) bypass it because
the leading verb is `echo` or similar. Reach for rtk wrappers directly:

- `rtk git status/diff/log/branch/show/...`
- `rtk read <file>` (instead of `cat`/`head`/`tail`)
- `rtk grep`, `rtk find`, `rtk ls`, `rtk tree`
- `rtk gh`, `rtk glab` (GitHub/GitLab CLIs)
- `rtk json` (key-only or compact JSON)
- `rtk wc`, `rtk env`, `rtk diff`
- `rtk test`, `rtk jest`, `rtk vitest`, `rtk tsc`, `rtk lint`
- `rtk docker`, `rtk kubectl`, `rtk aws`, `rtk psql`, `rtk pnpm`

When you need multiple outputs, prefer **separate tool calls** over chained pipelines so each
command can be rewritten individually.
