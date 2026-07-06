#!/usr/bin/env bash
set -euo pipefail

PATH="$PWD/node_modules/.bin:$PATH"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 127
  fi
}

run() {
  printf '\n==> %s\n' "$*"
  "$@"
}

bash_files=(
  dot_claude/statusline-command.sh
  dot_scripts/bin/executable_arch-update
  dot_scripts/bin/executable_cc
  dot_scripts/bin/executable_chezmoi-update
  dot_scripts/bin/executable_dragon-dev
  dot_scripts/bin/executable_oc
  dot_scripts/bin/executable_t
  dot_scripts/bin/executable_tiger-dev
  dot_scripts/bin/executable_tooling-update
  dot_scripts/bin/executable_untilfail
  dot_scripts/bin/executable_y
  dot_scripts/lib/tmux-session.sh
  mac-setup.sh
  scripts/format-dotfiles.sh
  scripts/lint-dotfiles.sh
  scripts/lint-staged-dotfiles.sh
)

zsh_files=(
  dot_claude/executable_shell-init.sh
  dot_scripts/git/executable_git-diff-origin
  dot_scripts/git/executable_git-nuke
  dot_scripts/git/executable_git-reset-remote
  dot_scripts/git/executable_git-squash-feature
  dot_scripts/startup/executable_linux.sh
  dot_scripts/startup/executable_macos.sh
  dot_zlogin
  dot_zpreztorc
  dot_zprofile
  dot_zsh/completions/_octmux
  dot_zsh/personal.sh
  dot_zsh/remote.sh
  dot_zshenv
)

ruby_files=(
  dot_scripts/bin/executable_ai-costs
  dot_scripts/git/executable_git-better-branch
  dot_scripts/git/executable_git-mr
  dot_scripts/git/executable_git-pr
  dot_scripts/git/executable_git-wip
  dot_scripts/git/utils.rb
)

require_command oxfmt
require_command shellcheck
require_command taplo
require_command oxlint
require_command zsh
require_command bundle

run oxfmt --check --disable-nested-config .
run taplo check dot_config/mise/config.toml
run oxlint dot_config/opencode/plugins/zed-bell.js
run shellcheck --shell=bash "${bash_files[@]}"

for file in "${zsh_files[@]}"; do
  run zsh -n "$file"
done

run bundle exec rubocop "${ruby_files[@]}"
