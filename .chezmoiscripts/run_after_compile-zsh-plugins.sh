#!/usr/bin/env bash
set -euo pipefail

zsh -f <<'ZSH'
# Antidote reads unset shell-version variables while it starts, so it cannot
# run with `set -u`. The Bash wrapper still enforces strict mode.
set -eo pipefail

zsh_plugins="${ZDOTDIR:-$HOME}/.zsh_plugins.txt"
antidote="${ZDOTDIR:-$HOME}/.antidote/antidote.zsh"
compiled_plugins="${zsh_plugins%.txt}.zsh"

[[ -r "$zsh_plugins" && -r "$antidote" ]] || exit 0

source "$antidote"
temporary_plugins="$(mktemp "${compiled_plugins}.XXXXXX")"
trap 'rm -f "$temporary_plugins"' EXIT

antidote bundle <"$zsh_plugins" >"$temporary_plugins"
mv -f "$temporary_plugins" "$compiled_plugins"
ZSH
