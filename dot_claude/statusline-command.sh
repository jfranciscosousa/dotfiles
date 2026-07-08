#!/usr/bin/env bash
set -euo pipefail

input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
cost=$(echo "$input" | jq -r '.cost.total_cost_usd // empty')
plan_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
plan_resets_at=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
repo=""
if [ -n "$repo_root" ]; then
  repo=$(basename "$repo_root")
fi

git_info=""
if [ -n "$branch" ] && [ -n "$repo" ]; then
  git_info="  ${repo}:${branch}"
fi

cost_str=""
if [ -n "$cost" ]; then
  cost_str=$(printf "  \$%.4f" "$cost")
fi

plan_str=""
if [ -n "$plan_pct" ]; then
  if [ -n "$plan_resets_at" ]; then
    now=$(date +%s)
    remaining=$((plan_resets_at - now))
    if [ "$remaining" -gt 0 ]; then
      h=$((remaining / 3600))
      m=$(((remaining % 3600) / 60))
      plan_str=$(printf "  plan: %d%% ↻%dh%dm" "$plan_pct" "$h" "$m")
    else
      plan_str=$(printf "  plan: %d%%" "$plan_pct")
    fi
  else
    plan_str=$(printf "  plan: %d%%" "$plan_pct")
  fi
fi

if [ -n "$used" ]; then
  filled=$(printf "%.0f" "$(echo "$used * 10 / 100" | bc -l)")
  empty=$((10 - filled))
  bar=""
  for ((i = 0; i < filled; i++)); do bar="${bar}█"; done
  for ((i = 0; i < empty; i++)); do bar="${bar}░"; done
  printf "%s  [%s] %.0f%%%s%s%s" "$model" "$bar" "$used" "$git_info" "$cost_str" "$plan_str"
else
  printf "%s  [░░░░░░░░░░] -%s%s%s" "$model" "$git_info" "$cost_str" "$plan_str"
fi
