# AGENTS.md

A personal dotfiles repository managed by [chezmoi](https://www.chezmoi.io/). Chezmoi manages
dotfiles by maintaining a source directory (this repo) and applying them to the home directory.

## Key guidelines you must respect at all times

- Do not write to my home directory unless my current prompt explicitly permits it. Permission
  applies only to the paths and actions that the prompt specifies, and only for the current prompt.
- Without explicit permission, make all config changes in this dotfiles repository through chezmoi.
  Do not edit the corresponding files in my home directory directly.
- Standalone executable shell scripts must default to Bash for macOS/Linux portability: start with
  `#!/usr/bin/env bash` and `set -euo pipefail`, and stay compatible with macOS Bash 3.2 unless
  another non-shell runtime is explicitly required. zsh is only allowed for files sourced from zsh
  config files. POSIX sh is banned; use Bash instead.
- Validate only task changes using the scoped checks below. Never run the full-project lint command
  or `lint:staged` package script.

## Agent instruction sources

- `dot_brains/AGENTS.md`: personal tool, installation, shell, and writing preferences.
- `dot_brains/CRITICAL.md`: approval restrictions injected by supported agent integrations.
- `dot_brains/RTK.md`: output-filter guidance.
- `dot_brains/skills/`: shared on-demand workflows and their references.
- `features/agent-guidelines.md`: instruction routing, audit findings, sources, and evaluation
  cases. Read it when maintaining agent instructions, not for ordinary dotfile edits.

Edit these canonical sources rather than home-directory symlink targets or duplicated generated
rules. Keep always-loaded rules broadly applicable; put task-specific detail in skills or
references. Do not edit externally installed skills or vendor documentation merely to make wording
consistent.

Before editing, inspect `git status --short`. Preserve unrelated changes. Inspect the final diff and
report checks that passed, failed, or were not run. Do not commit, stage, or apply changes unless
explicitly requested.

## Scoped validation

Use `rtk pnpm exec lint-staged --diff="HEAD"` only with explicit staging approval: it can change the
index. Restrict its config to exact task paths when unrelated changes exist. Without approval,
report that the chain was skipped and run known read-only checks on exact paths; for Markdown, use
`rtk pnpm exec oxfmt --check --disable-nested-config <paths>`. Check untracked task files
separately. Check that validation leaves the index unchanged unless staging was authorized. See
`features/agent-guidelines.md` for the staging incident and validation limitations.

## Common Chezmoi Commands

Read-only inspection and previews are allowed. The apply, add, re-add, and edit commands below
change state and require explicit authorization for their effects. Prefer source-file edits for this
work.

```sh
# Apply dotfiles to home directory
chezmoi apply

# Preview what would change before applying
chezmoi diff

# Add/update a file from home directory into this repo
chezmoi add ~/.someconfig
chezmoi re-add ~/.someconfig   # update after editing the target file

# Edit a managed file (opens source, applies on save)
chezmoi edit ~/.someconfig

# Check managed file status
chezmoi status

# Run chezmoi with verbose output
chezmoi apply --verbose
```

## File Naming Conventions

Chezmoi uses filename prefixes to encode metadata:

| Prefix         | Meaning                                                |
| -------------- | ------------------------------------------------------ |
| `dot_`         | Maps to a dotfile (e.g., `dot_zshrc` → `~/.zshrc`)     |
| `private_`     | Restricts target permissions; does not encrypt content |
| `executable_`  | File should be executable (chmod +x)                   |
| `.tmpl` suffix | Chezmoi template — processed before applying           |

Directories follow the same pattern (e.g., `dot_config/` → `~/.config/`).

## Templating

Files ending in `.tmpl` use Go template syntax. The main conditional is OS detection:

```
{{ if eq .chezmoi.os "darwin" }}
# macOS-specific content
{{ else if eq .chezmoi.os "linux" }}
# Linux-specific content
{{ end }}
```

Key template files:

- `dot_zshrc.tmpl` — main shell config (Homebrew init on macOS)
- `dot_zsh/aliases.sh.tmpl` — shell aliases with OS-specific variants
- `private_dot_ssh/private_config.tmpl` — SSH config with OS-specific 1Password socket paths

## Architecture

### Shell Setup

- **Framework**: Prezto + zgen plugin manager
- **Prompt**: geometry-zsh/geometry
- **Load order**: `dot_zshenv` → `dot_zprofile` → `dot_zshrc.tmpl` → `dot_zlogin`
- Custom aliases live in `dot_zsh/aliases.sh.tmpl`
- Startup hooks in `dot_scripts/startup/` are sourced per-OS at the end of `.zshrc`

### Custom Scripts

Scripts in `dot_scripts/` are installed to `~/.scripts/` and added to PATH:

- `~/.scripts/bin/` — general utilities (`t`, `y`, `untilfail`, `cow-echo`, `oc`, `cc`)
- `~/.scripts/git/` — git subcommands (`git-wip`, `git-nuke`, `git-squash-feature`, `git-fetch-all`,
  `git-reset-remote`, `git-diff-origin`)

The `y` script auto-detects and delegates to yarn/npm/pnpm based on lockfile presence.

### Version/Package Managers

- **mise** — runtime version manager. Shims (`~/.local/share/mise/shims`) are on PATH via
  `dot_zshenv`/`dot_zprofile` so runtimes resolve in non-interactive shells (Claude Code, IDEs);
  interactive zsh additionally runs `mise activate` and generates completions in `dot_zshrc.tmpl`.
  Global versions are pinned in `dot_config/mise/config.toml`.
- **pnpm** — `PNPM_HOME=~/.local/share/pnpm`
- PATH order matters: mise shims, pnpm, `~/.local/bin`, custom scripts, `/usr/local/bin`

### Platform Differences

| Feature              | macOS                                               | Linux                     |
| -------------------- | --------------------------------------------------- | ------------------------- |
| Homebrew             | `/opt/homebrew`                                     | not used                  |
| 1Password SSH socket | `~/Library/Group Containers/.../agent.sock`         | `~/.1password/agent.sock` |
| PostgreSQL           | `/opt/homebrew/opt/postgresql@16/bin` added to PATH | not added                 |
| Karabiner            | configured                                          | not applicable            |
