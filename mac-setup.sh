#!/usr/bin/env bash
#
# mac-setup.sh - Bootstrap a fresh macOS machine for these dotfiles.
#
# Installs Homebrew, every CLI tool / GUI app / runtime the dotfiles expect,
# the zsh plugin manager, and the standalone installers (Claude, pnpm).
# It does NOT run `chezmoi apply` - it only prepares the machine. The final
# section prints the exact command to deploy the configs.
#
# Safe to re-run: every step checks before installing (idempotent).
#
# Usage:
#   ./mac-setup.sh            # full setup
#   ./mac-setup.sh --no-casks # skip GUI apps (headless / CI)
#
set -euo pipefail

# ----------------------------------------------------------------------------
# Config (edit these to taste)
# ----------------------------------------------------------------------------

# mise runtime versions set globally so the shell + ruby git-scripts work.
# These are also pinned in dot_config/mise/config.toml (the global mise config),
# which takes effect on `chezmoi apply`. Project mise.toml / .tool-versions
# files override them per-repo.
RUBY_VERSION="${RUBY_VERSION:-4.0.5}"
NODE_VERSION="${NODE_VERSION:-26.3.0}"

# Other runtimes the dotfiles use (erlang, elixir, postgres, yarn) install on
# demand from project configs - mise resolves their backends automatically, so
# no plugin registration is needed.

# Homebrew formulae (mirror of `brew leaves` on the reference machine).
FORMULAE=(
  # core CLI used directly by the shell + scripts
  chezmoi git gh glab mise direnv tmux neovim bat jq rtk
  coreutils gawk curl pkgconf
  # build deps for mise-built runtimes (erlang/ruby/node native extensions)
  autoconf openssl@3 readline libyaml libxslt zlib ossp-uuid wxwidgets gcc
  # containers (colima provides the docker daemon on macOS)
  colima docker docker-compose
  # project doc/PDF toolchain (tiger): weasyprint + friends
  fop poppler weasyprint
)

# GUI apps. The dotfiles ship configs for all of these.
CASKS=(
  1password
  1password-cli
  ghostty
  karabiner-elements
  cmux
  opencode-desktop
  zed
  font-fira-mono
  font-fira-code
)

# Optional GUI apps: configs exist (VISUAL=code, dot_cursor/) but they were not
# installed on the reference machine. Move into CASKS if you want them.
OPTIONAL_CASKS=(
  visual-studio-code
  cursor
)

INSTALL_CASKS=1
[[ "${1:-}" == "--no-casks" ]] && INSTALL_CASKS=0

# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  ! %s\033[0m\n' "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }

# ----------------------------------------------------------------------------
# 0. Preflight
# ----------------------------------------------------------------------------

[[ "$(uname -s)" == "Darwin" ]] || { warn "This script is macOS only."; exit 1; }
[[ "$EUID" -ne 0 ]] || { warn "Do not run as root."; exit 1; }

if [[ "$(uname -m)" != "arm64" ]]; then
  warn "Not Apple Silicon. The dotfiles hardcode /opt/homebrew (dot_zshrc.tmpl)."
  warn "On Intel, Homebrew lives in /usr/local and you'll need to adjust that file."
fi

# ----------------------------------------------------------------------------
# 1. Xcode Command Line Tools (git, compilers)
# ----------------------------------------------------------------------------

log "Xcode Command Line Tools"
if xcode-select -p >/dev/null 2>&1; then
  ok "already installed"
else
  xcode-select --install || true
  warn "Finish the CLT GUI installer, then re-run this script."
  exit 1
fi

# ----------------------------------------------------------------------------
# 2. Homebrew
# ----------------------------------------------------------------------------

log "Homebrew"
if have brew; then
  ok "already installed ($(command -v brew))"
else
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Load brew into THIS shell so subsequent steps can use it.
if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
elif [[ -x /usr/local/bin/brew ]]; then
  eval "$(/usr/local/bin/brew shellenv)"
fi
have brew || { warn "brew not on PATH after install"; exit 1; }

# ----------------------------------------------------------------------------
# 3. Brew formulae
# ----------------------------------------------------------------------------

log "Brew formulae"
brew install "${FORMULAE[@]}"
ok "formulae installed"

# ----------------------------------------------------------------------------
# 4. Brew casks (GUI apps)
# ----------------------------------------------------------------------------

if [[ "$INSTALL_CASKS" -eq 1 ]]; then
  log "Brew casks (GUI apps)"
  # Install one at a time so a single already-present app doesn't abort the run.
  for cask in "${CASKS[@]}"; do
    if brew list --cask "$cask" >/dev/null 2>&1; then
      ok "$cask (already installed)"
    else
      brew install --cask "$cask" || warn "failed to install cask: $cask (skipping)"
    fi
  done
  bold "  optional casks (not installed automatically): ${OPTIONAL_CASKS[*]}"
else
  log "Skipping casks (--no-casks)"
fi

# ----------------------------------------------------------------------------
# 5. AI CLIs (official installers)
# ----------------------------------------------------------------------------
# opencode -> ~/.opencode/bin (already first on PATH via dot_zshenv)
# claude   -> ~/.local/bin

log "opencode CLI"
if have opencode; then
  ok "already installed ($(command -v opencode))"
else
  curl -fsSL https://opencode.ai/install | bash
fi

log "Claude Code"
if have claude; then
  ok "already installed ($(command -v claude))"
else
  curl -fsSL https://claude.ai/install.sh | bash
fi

# ----------------------------------------------------------------------------
# 6. zsh plugin manager (zgen) - prezto + geometry self-install on first shell
# ----------------------------------------------------------------------------

log "zgen (zsh plugin manager)"
if [[ -d "$HOME/.zgen" ]]; then
  ok "already cloned"
else
  git clone https://github.com/tarjoilija/zgen.git "$HOME/.zgen"
  ok "cloned (prezto + geometry-zsh install on first shell start)"
fi

# ----------------------------------------------------------------------------
# 7. mise runtimes (node, ruby, erlang, elixir, postgres, yarn)
# ----------------------------------------------------------------------------

log "mise runtimes"
if ! have mise; then
  warn "mise not found (brew step should have installed it); skipping runtimes"
else
  # Install the globals up front (ruby is required by the git-* scripts; node by
  # the JS toolchain). The pins live in dot_config/mise/config.toml and become
  # the global defaults once `chezmoi apply` deploys it.
  log "mise: ruby ${RUBY_VERSION}, node ${NODE_VERSION}"
  mise install "ruby@${RUBY_VERSION}" "node@${NODE_VERSION}" || warn "mise runtime install failed"
fi

# ----------------------------------------------------------------------------
# 8. pnpm (standalone installer -> ~/.local/share/pnpm, matches PNPM_HOME)
# ----------------------------------------------------------------------------

log "pnpm"
if have pnpm; then
  ok "already installed ($(command -v pnpm))"
else
  curl -fsSL https://get.pnpm.io/install.sh | sh -
  ok "pnpm installed (PATH wired by dot_zshenv after apply)"
fi

# ----------------------------------------------------------------------------
# Done - next steps
# ----------------------------------------------------------------------------

echo
bold "✅ Tooling installed."
echo
bold "Next steps (deploy the dotfiles - run yourself, this script never applies):"
cat <<'EOF'

  # If this repo is not yet your chezmoi source:
  chezmoi init --apply <your-dotfiles-repo>

  # If it already is (cloned at ~/.local/share/chezmoi):
  chezmoi diff      # review what will change
  chezmoi apply     # deploy configs

  # Then open a fresh shell (zgen pulls prezto + geometry on first start):
  exec zsh

Notes:
  • Docker: start the colima engine once -> `colima start`
    (or `brew services start colima` to auto-start it on login).
  • 1Password SSH agent: enable it in 1Password ▸ Settings ▸ Developer.
  • rtk: verify the token-killer is the right binary -> `rtk gain`
    (name collision with reachingforthejack/rtk; see ~/.brains/RTK.md).
  • opencode/Claude auth: run `opencode auth login` / `claude` once to sign in.
EOF
