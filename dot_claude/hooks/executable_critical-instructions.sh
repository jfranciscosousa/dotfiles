#!/usr/bin/env bash
set -euo pipefail

critical_instructions="$HOME/.brains/CRITICAL.md"

if [[ ! -r "$critical_instructions" ]]; then
  exit 1
fi

hook_input="$(cat)"
hook_event_name="$(jq -r '.hook_event_name // empty' <<< "$hook_input")"

if [[ "$hook_event_name" == "SubagentStart" ]]; then
  jq -n \
    --rawfile context "$critical_instructions" \
    '{
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: $context
      }
    }'
else
  cat "$critical_instructions"
fi
