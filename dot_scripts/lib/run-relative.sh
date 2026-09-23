#!/usr/bin/env bash
set -euo pipefail

exec_zx_relative_to_script() {
  if [ "$#" -lt 2 ]; then
    echo "usage: exec_zx_relative_to_script CALLER RELATIVE_PATH [ARG...]" >&2
    return 2
  fi

  local caller="$1"
  local relative_path="$2"
  local caller_dir target
  shift 2

  caller_dir=$(CDPATH='' cd -- "$(dirname -- "$caller")" && pwd)
  target="$caller_dir/$relative_path"

  # Run zx itself with the latest Node without putting that Node first in PATH.
  # Commands spawned by zx, including Git hooks, can then use the project's Node.
  exec mise exec node@latest -- zx "$target" "$@"
}
