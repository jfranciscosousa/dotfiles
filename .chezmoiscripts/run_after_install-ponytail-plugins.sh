#!/usr/bin/env bash
set -euo pipefail

if command -v claude >/dev/null 2>&1; then
  if ! claude_plugins="$(claude plugin list 2>/dev/null)"; then
    printf 'warning: could not inspect Claude Code plugins; skipping Ponytail installation\n' >&2
  elif [[ $claude_plugins != *"ponytail@ponytail"* ]]; then
    if ! claude plugin marketplace add DietrichGebert/ponytail ||
      ! claude plugin install ponytail@ponytail --scope user --json; then
      printf 'warning: could not install Ponytail for Claude Code\n' >&2
    fi
  fi
fi

if command -v codex >/dev/null 2>&1; then
  if ! codex_plugins="$(codex plugin list --marketplace ponytail 2>/dev/null)"; then
    printf 'warning: could not inspect Codex plugins; skipping Ponytail installation\n' >&2
  elif ! grep -Eq '^ponytail@ponytail[[:space:]]+installed' <<<"$codex_plugins"; then
    if ! codex plugin marketplace add DietrichGebert/ponytail --json ||
      ! codex plugin add ponytail@ponytail --json; then
      printf 'warning: could not install Ponytail for Codex\n' >&2
    fi
  fi
fi
