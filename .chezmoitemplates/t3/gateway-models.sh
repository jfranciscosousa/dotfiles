#!/usr/bin/env bash
# Print the AI Gateway chat models as `litellm/<id>`, one per line.
# Print nothing when the key or the network is unavailable.
set -euo pipefail

auth="${XDG_DATA_HOME:-$HOME/.local/share}/opencode/auth.json"
key="$(jq -r '.litellm.key // empty' "$auth" 2>/dev/null || true)"
[ -n "$key" ] || exit 0

# Send the key on stdin so it does not appear in the process list.
printf 'Authorization: Bearer %s' "$key" |
  curl -fsS --max-time 5 -H @- https://ai-gateway-internal.eu-west-1.remote.com/v1/models 2>/dev/null |
  jq -r '.data[].id | select(test("realtime|embed|tts|whisper|transcribe|moderation|image"; "i") | not) | "litellm/" + .' ||
  true
