# shellcheck shell=bash

_octmux_quote_arg() {
  local arg="$1"
  printf "'%s'" "${arg//\'/\'\\\'\'}"
}

_octmux_shell_command() {
  local command="$1"
  shift

  local arg
  for arg in "$@"; do
    command+=" $(_octmux_quote_arg "$arg")"
  done

  printf '%s' "$command"
}

_octmux_main() {
  local TOOL="$1"
  local TOOL_SHORT="$2"
  shift 2

  local TOOL_BIN="${TOOL%% *}"
  if ! command -v "$TOOL_BIN" >/dev/null 2>&1; then
    echo "${TOOL_SHORT}: error: '$TOOL_BIN' not found in PATH" >&2
    return 1
  fi

  if ! command -v tmux >/dev/null 2>&1; then
    echo "${TOOL_SHORT}: error: tmux not found in PATH" >&2
    return 1
  fi

  local delete=0
  local delete_all=0
  local list=0
  if [ "${1:-}" = "-d" ]; then
    delete=1
    shift
  elif [ "${1:-}" = "-da" ]; then
    delete_all=1
    shift
  elif [ "${1:-}" = "-l" ]; then
    list=1
    shift
  fi

  local pathkey
  pathkey="$(echo "$PWD" | tr -cs 'a-zA-Z0-9-' '-' | sed 's/^-//;s/-$//')"
  [ -z "$pathkey" ] && pathkey="root"

  local prefix="${TOOL_SHORT}--${pathkey}"

  if [ "$list" -eq 1 ]; then
    tmux list-sessions -F '#S' 2>/dev/null | while IFS= read -r s; do
      if [[ "$s" == "${prefix}_"* ]]; then
        echo "${s#${prefix}_}"
      fi
    done
    return 0
  fi

  if [ "$delete_all" -eq 1 ]; then
    local killed=0
    local s
    while IFS= read -r s; do
      if [[ "$s" == "${prefix}_"* ]]; then
        tmux kill-session -t "=${s}" 2>/dev/null && killed=$((killed + 1))
      fi
    done < <(tmux list-sessions -F '#S' 2>/dev/null)
    if [ "$killed" -gt 0 ]; then
      echo "${TOOL_SHORT}: killed ${killed} session(s) for this folder"
      return 0
    fi
    echo "${TOOL_SHORT}: no sessions for this folder" >&2
    return 1
  fi

  if [ "$delete" -eq 0 ] && [ -n "${TMUX:-}" ]; then
    echo "${TOOL_SHORT}: looks like you're already inside tmux." >&2
    echo "To switch to an existing session, run:" >&2
    echo "    tmux switch-client -t \"=<session-name>\"" >&2
    echo "To list sessions: tmux list-sessions" >&2
    return 1
  fi

  local name="default"
  if [ -n "${1:-}" ] && [ "${1:0:1}" != "-" ]; then
    name="$(echo "$1" | tr -cs 'a-zA-Z0-9-' '-' | sed 's/^-//;s/-$//')"
    [ -z "$name" ] && name="default"
    shift
  fi

  local session="${prefix}_${name}"
  local label="$name"
  local status_left='[#{?#{==:#{@octmux_label},},#S,#{@octmux_label}}]'

  if [ "$delete" -eq 1 ]; then
    if tmux has-session -t "=${session}" 2>/dev/null; then
      tmux kill-session -t "=${session}"
      echo "${TOOL_SHORT}: killed session '${label}'"
      return 0
    fi
    echo "${TOOL_SHORT}: no session named '${label}'" >&2
    return 1
  fi

  tmux set-option -gq status-left "${status_left}"
  tmux set-option -gq status-right ""
  tmux set-option -gq status-left-length 50

  if tmux has-session -t "=${session}" 2>/dev/null; then
    tmux set-option -t "${session}" -q @octmux_label "${label}"
    exec tmux attach-session -t "=${session}"
  fi

  local shell_command
  shell_command="$(_octmux_shell_command "$TOOL" "$@")"

  tmux new-session -d -s "${session}" -c "$PWD" "${shell_command}"
  tmux set-option -t "${session}" -q @octmux_label "${label}"
  exec tmux attach-session -t "=${session}"
}
