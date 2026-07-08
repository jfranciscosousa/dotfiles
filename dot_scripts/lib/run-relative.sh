#!/usr/bin/env bash
set -euo pipefail

exec_relative_to_script() {
  if [ "$#" -lt 3 ]; then
    echo "usage: exec_relative_to_script CALLER COMMAND RELATIVE_PATH [ARG...]" >&2
    return 2
  fi

  local caller="$1"
  local command="$2"
  local relative_path="$3"
  shift 3

  local caller_dir
  caller_dir=$(CDPATH='' cd -- "$(dirname -- "$caller")" && pwd)

  exec "$command" "$caller_dir/$relative_path" "$@"
}
