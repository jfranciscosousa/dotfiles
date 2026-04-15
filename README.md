# dotfiles

Personal dotfiles managed with [chezmoi](https://www.chezmoi.io/).

## Shell Keybindings

Vi mode is enabled at the prompt (`bindkey -v`).

### Navigation

| Key | Action |
|-----|--------|
| `Home` / `End` | Beginning / end of line |
| `Ctrl+Left` / `Ctrl+Right` | Move backward / forward by word |
| `Left` / `Right` | Move backward / forward by character |

### Editing

| Key | Action |
|-----|--------|
| `Backspace` | Delete character backward |
| `Delete` | Delete character forward |
| `Insert` | Toggle overwrite mode |
| `Ctrl+L` | Clear screen |
| `Ctrl+X Ctrl+E` | Edit current command in `$EDITOR` |
| `Ctrl+X Ctrl+S` | Prepend `sudo` to current command |
| `Ctrl+Q` / `Esc+q` | Push current line aside (`push-line-or-edit`) |
| `Ctrl+Space` | Expand all aliases (including global) |

### History

| Key | Action |
|-----|--------|
| `Space` | Magic space — expands history (`!!`, etc.) |
| `/` (vicmd) | Search history forward |
| `?` (vicmd) | Search history backward |

### Vi Normal Mode (vicmd)

| Key | Action |
|-----|--------|
| `u` | Undo |
| `Ctrl+R` | Redo |
| `#` | Toggle comment at start of line |

### Completion

| Key | Action |
|-----|--------|
| `Tab` | Complete / expand |
| `Shift+Tab` | Reverse menu complete |
