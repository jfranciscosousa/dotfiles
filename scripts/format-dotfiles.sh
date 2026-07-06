#!/usr/bin/env bash
set -euo pipefail

PATH="$PWD/node_modules/.bin:$PATH"

if ! command -v oxfmt >/dev/null 2>&1; then
  printf 'missing required command: oxfmt\n' >&2
  exit 127
fi

oxfmt --write --disable-nested-config .
