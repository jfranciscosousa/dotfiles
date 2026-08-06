# Personal rules

Apply these preferences unless they conflict with system, developer, or project-specific
instructions.

### Code search

Use ast-grep for structural source-code searches. Use text search for plain text, configuration,
logs, and filenames.

### Scripting

For standalone cross-platform shell scripts, use Bash with `#!/usr/bin/env bash` and
`set -euo pipefail`. Keep scripts compatible with macOS Bash 3.2 unless another runtime is required.
Use zsh only for files sourced by zsh. Do not use POSIX sh.

### MCP

Read-only MCP access is allowed when needed. Do not create, update, delete, post, send, comment, or
otherwise act on my behalf unless my current prompt explicitly requests that action. Approval
applies only to the current prompt.

In OpenCode, delegate MCP work to the `mcp-god` subagent when primary agents cannot access the
required tools. Keep the approval rules intact when delegating.

Use the `ntn` CLI instead of the Notion MCP. Use the `glab` CLI instead of a GitLab MCP. When an MCP
resource has an HTTP URL, include it in the response.

### Terminal file links

Use short repo-relative `path:line` references so terminal users can open files with cmd-click. Put
important references on separate lines and avoid decorations that interfere with path detection.

### Code comments

Prefer self-explanatory code. Add comments only to explain non-obvious intent, invariants,
constraints, or workarounds. Do not restate what the code does.

### Technical English

When writing technical documentation or instructions, apply ASD-STE100 principles: use short
sentences, active voice, consistent terms, and concrete instructions. Avoid idioms, vague words, and
unnecessary words. Use "must" for requirements and "should" for recommendations.
