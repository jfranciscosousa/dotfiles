# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A personal dotfiles repository managed by [chezmoi](https://www.chezmoi.io/). Chezmoi manages dotfiles by maintaining a source directory (this repo) and applying them to the home directory.

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

| Prefix | Meaning |
|--------|---------|
| `dot_` | Maps to a dotfile (e.g., `dot_zshrc` → `~/.zshrc`) |
| `private_` | Encrypted/sensitive file |
| `executable_` | File should be executable (chmod +x) |
| `.tmpl` suffix | Chezmoi template — processed before applying |

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
- Machine-local (untracked) overrides can go in `~/.zsh/custom.sh`
- Startup hooks in `dot_scripts/startup/` are sourced per-OS at the end of `.zshrc`

### Custom Scripts

Scripts in `dot_scripts/` are installed to `~/.scripts/` and added to PATH:

- `~/.scripts/bin/` — general utilities (`t`, `y`, `untilfail`, `cow-echo`)
- `~/.scripts/git/` — git subcommands (`git-wip`, `git-nuke`, `git-squash-feature`, `git-fetch-all`, `git-reset-remote`, `git-diff-origin`)

The `y` script auto-detects and delegates to yarn/npm/pnpm based on lockfile presence.

### Version/Package Managers

- **asdf** — runtime version manager (completions auto-generated on shell start)
- **pnpm** — `PNPM_HOME=~/.local/share/pnpm`
- PATH order matters: asdf shims, pnpm, `~/.local/bin`, custom scripts, `/usr/local/bin`

### Platform Differences

| Feature | macOS | Linux |
|---------|-------|-------|
| Homebrew | `/opt/homebrew` | not used |
| 1Password SSH socket | `~/Library/Group Containers/.../agent.sock` | `~/.1password/agent.sock` |
| PostgreSQL | `/opt/homebrew/opt/postgresql@16/bin` added to PATH | not added |
| Karabiner | configured | not applicable |
