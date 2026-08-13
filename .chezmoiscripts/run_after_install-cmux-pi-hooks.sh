#!/usr/bin/env bash
set -euo pipefail

command -v cmux >/dev/null 2>&1 || exit 0

cmux hooks pi install --yes
