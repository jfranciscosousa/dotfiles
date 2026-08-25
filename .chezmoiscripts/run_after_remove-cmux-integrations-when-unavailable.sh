#!/usr/bin/env bash
set -euo pipefail

command -v cmux >/dev/null 2>&1 && exit 0

rm -f \
  "${XDG_CONFIG_HOME:-$HOME/.config}/cmux/cmux.json" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/opencode/plugins/cmux-session.js" \
  "$HOME/.pi/agent/extensions/cmux-session.ts"

rm -rf \
  "$HOME/.brains/skills/cmux" \
  "$HOME/.brains/skills/cmux-browser" \
  "$HOME/.brains/skills/cmux-customization" \
  "$HOME/.brains/skills/cmux-diagnostics" \
  "$HOME/.brains/skills/cmux-keyboard-shortcuts" \
  "$HOME/.brains/skills/cmux-settings"
