#!/usr/bin/env bash
set -euo pipefail

script_relative_path() {
  if [ "$#" -ne 2 ]; then
    echo "usage: script_relative_path CALLER RELATIVE_PATH" >&2
    return 2
  fi

  local caller="$1"
  local relative_path="$2"
  local caller_dir

  caller_dir=$(CDPATH='' cd -- "$(dirname -- "$caller")" && pwd)
  printf '%s\n' "$caller_dir/$relative_path"
}

exec_relative_to_script() {
  if [ "$#" -lt 3 ]; then
    echo "usage: exec_relative_to_script CALLER COMMAND RELATIVE_PATH [ARG...]" >&2
    return 2
  fi

  local caller="$1"
  local command="$2"
  local relative_path="$3"
  local target
  shift 3

  target=$(script_relative_path "$caller" "$relative_path")
  exec "$command" "$target" "$@"
}

exec_zx_relative_to_script() {
  if [ "$#" -lt 2 ]; then
    echo "usage: exec_zx_relative_to_script CALLER RELATIVE_PATH [ARG...]" >&2
    return 2
  fi

  local caller="$1"
  local relative_path="$2"
  local target
  shift 2

  target=$(script_relative_path "$caller" "$relative_path")
  exec mise x node@latest npm:zx@latest -- zx "$target" "$@"
}
