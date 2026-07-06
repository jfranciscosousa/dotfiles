#!/usr/bin/env bash
set -euo pipefail

PATH="$PWD/node_modules/.bin:$PATH"
root="$(pwd -P)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 127
  fi
}

run_if_any() {
  local cmd=()

  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    cmd+=("$1")
    shift
  done

  shift

  if [ "$#" -eq 0 ]; then
    return 0
  fi

  printf '\n==> %s %s\n' "${cmd[*]}" "$*"
  "${cmd[@]}" "$@"
}

relpath() {
  local file="$1"
  case "$file" in
    "$root"/*) printf '%s\n' "${file#"$root"/}" ;;
    *) printf '%s\n' "$file" ;;
  esac
}

first_line() {
  IFS= read -r line <"$1" || true
  printf '%s\n' "$line"
}

oxfmt_files=()
toml_files=()
js_files=()
bash_files=()
zsh_files=()
ruby_files=()

for input in "$@"; do
  file="$(relpath "$input")"

  if [ ! -f "$file" ]; then
    continue
  fi

  case "$file" in
    *.tmpl) continue ;;
  esac

  case "$file" in
    *.js|*.mjs|*.cjs|*.jsx|*.ts|*.mts|*.cts|*.tsx)
      js_files+=("$file")
      oxfmt_files+=("$file")
      ;;
    *.md|*.mdx)
      oxfmt_files+=("$file")
      ;;
    *.toml)
      toml_files+=("$file")
      oxfmt_files+=("$file")
      ;;
    *.json|*.jsonc|*.json5|*.yaml|*.yml|*.html|*.css|*.scss|*.less|*.graphql|*.gql|*.vue)
      oxfmt_files+=("$file")
      ;;
  esac

  shebang="$(first_line "$file")"
  case "$shebang" in
    '#!'*bash*) bash_files+=("$file") ;;
    '#!'*zsh*) zsh_files+=("$file") ;;
    '#!'*ruby*) ruby_files+=("$file") ;;
  esac

  case "$file" in
    *.rb) ruby_files+=("$file") ;;
    dot_zlogin|dot_zpreztorc|dot_zprofile|dot_zshenv|dot_zsh/*)
      zsh_files+=("$file")
      ;;
    *.sh)
      if [[ "$shebang" != '#!'*bash* && "$shebang" != '#!'*zsh* && "$shebang" != '#!'*ruby* ]]; then
        bash_files+=("$file")
      fi
      ;;
  esac
done

if [ "${#oxfmt_files[@]}" -gt 0 ]; then
  require_command oxfmt
fi

if [ "${#toml_files[@]}" -gt 0 ]; then
  require_command taplo
fi

if [ "${#js_files[@]}" -gt 0 ]; then
  require_command oxlint
fi

if [ "${#bash_files[@]}" -gt 0 ]; then
  require_command shellcheck
fi

if [ "${#zsh_files[@]}" -gt 0 ]; then
  require_command zsh
fi

if [ "${#ruby_files[@]}" -gt 0 ]; then
  require_command bundle
fi

run_if_any oxfmt --check --disable-nested-config -- "${oxfmt_files[@]}"
run_if_any taplo check -- "${toml_files[@]}"
run_if_any oxlint -- "${js_files[@]}"
run_if_any shellcheck --shell=bash -- "${bash_files[@]}"

for file in "${zsh_files[@]}"; do
  printf '\n==> zsh -n %s\n' "$file"
  zsh -n "$file"
done

run_if_any bundle exec rubocop -- "${ruby_files[@]}"
