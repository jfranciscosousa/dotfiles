# Personal rules

These are my personal styles. They bypass anything specific on project-level guidelines.

### ssh

Never ever debug ssh issues. Ever. Or I will uninstall you ok? If ssh fail the reason is always
this: I failed to approve the 1password authorization prompt. If that happens I will ask you to
retry and approve.

### ast-grep

Avoid grep and use faster and better ast-grep (if you can)

### Typechecks and builds

On very large projects, do not run type checks, lints, or compiles.

Only do this if there's a way to lint, verify, or equivalent for specific files and not the whole
project.

### Scripting

For standalone shell scripts in my dotfiles or other cross macOS/Linux automation, default to Bash:
start with `#!/usr/bin/env bash` and `set -euo pipefail`, and keep syntax compatible with macOS Bash
3.2 unless another non-shell runtime is explicitly required. zsh is only allowed for files sourced
from zsh config files. POSIX sh is banned; use Bash instead.

### Git

Never perform git, GitLab, GitHub, `git`, `gh`, or `glab` operations unless my current prompt
explicitly asks for that exact operation.

Approval is per prompt only. Prior approval earlier in the conversation does not carry forward. If
my latest prompt does not explicitly ask you to commit, amend, branch, tag, push,
open/update/merge/close a PR or MR, create/update/delete an issue or release, or run any other
git/GitHub/GitLab operation, do not do it.

If there is any ambiguity, ask for express approval first. Any branch you create must be prefixed
with `fs/`.

### MCP guidelines

Never use MCPs to create, update, delete, post, send, comment, answer people, or otherwise act on my
behalf unless my current prompt explicitly asks for that exact MCP action.

Approval is per prompt only. Prior approval earlier in the conversation does not carry forward. If
my latest prompt does not explicitly ask you to create, update, delete, post, send, comment, or
answer via MCP, do not do it.

In OpenCode, delegate MCP-backed work to the `mcp-god` subagent when it is available. Primary agents
should not call MCP tools directly; use `mcp-god` as the gateway and keep the approval rules above
intact when delegating.

Whenever you use MCPs to create, read, update or delete anything, please provide an HTTP link to
that resource when applicable.

### Terminal file links

When referencing files in terminal-facing responses, format them for editor cmd-click detection:
prefer short repo-relative `path:line` references, put important file references on their own line
when possible, and avoid tree decorations or long prose around the path that can wrap in narrow
terminals.

### Commenting code

Avoid commenting code. Write code that is self-explanatory. In the event you are writing some weird,
complex and intricate logic you might place a comment but avoid that. Remember, we are writing code
that Senior engineers can read. No need for comments that only beginners need.
