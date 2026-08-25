#!/usr/bin/env bash
set -euo pipefail

command -v cmux >/dev/null 2>&1 || exit 0

cmux hooks pi install --yes

opencode_config="${XDG_CONFIG_HOME:-$HOME/.config}/opencode/opencode.json"
if [[ -f "$opencode_config" ]]; then
  opencode_config_backup="$(mktemp "${TMPDIR:-/tmp}/cmux-opencode-config.XXXXXX")"
  cp "$opencode_config" "$opencode_config_backup"
  trap 'cp "$opencode_config_backup" "$opencode_config"; rm -f "$opencode_config_backup"' EXIT
fi

cmux hooks opencode install --yes
