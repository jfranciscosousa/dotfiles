# AGENTS.md

A personal dotfiles repository managed by [chezmoi](https://www.chezmoi.io/). Chezmoi manages
dotfiles by maintaining a source directory (this repo) and applying them to the home directory.

## Key guidelines you must respect at all times

- Do not write to my home directory ever. You can read, but not write. All edits need to go through
  chezmoi
- Do not apply or test commands manually unless I give you permission. By default, never chezmoi
  apply and tell me to test things manually
- All changes you make to a config must be made on my dotfiles repo, not to me home directory
  directly, ever
- Standalone executable shell scripts must default to Bash for macOS/Linux portability: start with
  `#!/usr/bin/env bash` and `set -euo pipefail`, and stay compatible with macOS Bash 3.2 unless
  another non-shell runtime is explicitly required. zsh is only allowed for files sourced from zsh
  config files. POSIX sh is banned; use Bash instead.
- After any change, run `rtk pnpm run lint`

## Common Chezmoi Commands

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

| Prefix         | Meaning                                            |
| -------------- | -------------------------------------------------- |
| `dot_`         | Maps to a dotfile (e.g., `dot_zshrc` → `~/.zshrc`) |
| `private_`     | Encrypted/sensitive file                           |
| `executable_`  | File should be executable (chmod +x)               |
| `.tmpl` suffix | Chezmoi template — processed before applying       |

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
