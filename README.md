# dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Agent guidelines

Shared instructions and skills live in `dot_brains/`. Edit the chezmoi sources, not their deployed
home-directory targets. See [agent guideline maintenance](features/agent-guidelines.md) for routing,
review findings, official references, and behavioral evaluation cases. Changes are not active in
installed agents until separately applied and reloaded as required by each host.

## Linting

Install repo-local tooling with `pnpm install`. `pnpm install` also installs the Husky pre-commit
hook.

- `pnpm lint` checks Oxfmt-managed formatting, TOML, JavaScript/TypeScript, Bash, and Zsh syntax.
- `pnpm lint:staged` runs the project type check, then checks staged files through lint-staged.
- The agent check is `rtk pnpm exec lint-staged --diff="HEAD"`, scoped to task changes. It can stage
  files, including with `--fail-on-changes`. Without explicit staging approval, use known read-only
  checks on exact paths instead; see `AGENTS.md`. Check new untracked files too. Agents must not run
  either full-project script above.
- `pnpm fmt` runs Oxfmt on supported non-template files.

Oxfmt manages Markdown formatting and prose wrapping at the configured print width, plus
JSON/JSONC/YAML/TOML/HTML/CSS/JS/TS-style files. This repo excludes `*.tmpl` files from Oxfmt
because chezmoi's Go template syntax is embedded inside otherwise-normal file formats.

## Shell Keybindings

Vi mode is enabled at the prompt (`bindkey -v`).

### Navigation

| Key                        | Action                               |
| -------------------------- | ------------------------------------ |
| `Home` / `End`             | Beginning / end of line              |
| `Ctrl+Left` / `Ctrl+Right` | Move backward / forward by word      |
| `Left` / `Right`           | Move backward / forward by character |

### Editing

| Key                | Action                                        |
| ------------------ | --------------------------------------------- |
| `Backspace`        | Delete character backward                     |
| `Delete`           | Delete character forward                      |
| `Insert`           | Toggle overwrite mode                         |
| `Ctrl+L`           | Clear screen                                  |
| `Ctrl+X Ctrl+E`    | Edit current command in `$EDITOR`             |
| `Ctrl+X Ctrl+S`    | Prepend `sudo` to current command             |
| `Ctrl+Q` / `Esc+q` | Push current line aside (`push-line-or-edit`) |
| `Ctrl+Space`       | Expand all aliases (including global)         |

### History

| Key         | Action                                     |
| ----------- | ------------------------------------------ |
| `Space`     | Magic space — expands history (`!!`, etc.) |
| `/` (vicmd) | Search history forward                     |
| `?` (vicmd) | Search history backward                    |

### Vi Normal Mode (vicmd)

| Key      | Action                          |
| -------- | ------------------------------- |
| `u`      | Undo                            |
| `Ctrl+R` | Redo                            |
| `#`      | Toggle comment at start of line |

### Completion

| Key         | Action                |
| ----------- | --------------------- |
| `Tab`       | Complete / expand     |
| `Shift+Tab` | Reverse menu complete |
