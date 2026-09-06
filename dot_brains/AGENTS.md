# Personal preferences

## Tools

- Use ast-grep for structural source-code searches. Use text search for plain text, configuration,
  logs, and filenames. If ast-grep is unavailable, use scoped text search.
- Use the `ntn` CLI instead of the Notion MCP. Use the `glab` CLI instead of a GitLab MCP.
- Read-only connected-service access is allowed when needed. Include the resource's HTTP URL in
  responses when available.
- In user-facing responses, link Linear issues, Notion documents, PRs, and MRs using their titles,
  shortened when needed—not IDs or slugs. IDs are fine in tool calls.
- Do not install tools, skills, browsers, or dependencies, run downloaded code, or change global
  configuration without explicit approval. This includes implicit downloads and lifecycle scripts.

## Scripting

For standalone cross-platform shell scripts, use Bash with `#!/usr/bin/env bash` and
`set -euo pipefail`. Keep scripts compatible with macOS Bash 3.2 unless another runtime is required.
Use zsh only for files sourced by zsh. Do not use POSIX sh.

## Terminal file links

Use short repo-relative `path:line` references so terminal users can open files with cmd-click. Put
important references on separate lines without decorations that interfere with detection.

## Code comments

Prefer self-explanatory code. Add comments only to explain non-obvious intent, invariants,
constraints, or workarounds. Do not restate what the code does.

## Technical English

When writing technical documentation or instructions, apply ASD-STE100 principles: use short
sentences, active voice, consistent terms, and concrete instructions. Avoid idioms, vague words, and
unnecessary words. Use "must" for requirements and "should" for recommendations.

I also have ADHD, be concise and to the point.
