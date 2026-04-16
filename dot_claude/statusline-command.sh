#!/usr/bin/env bash
input=$(cat)

model=$(echo "$input" | jq -r '.model.display_name // "Unknown"')
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')

# Git info
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
repo=$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null)
git_info=""
if [ -n "$branch" ] && [ -n "$repo" ]; then
  git_info="  ${repo}:${branch}"
fi

if [ -n "$used" ]; then
  filled=$(printf "%.0f" "$(echo "$used * 10 / 100" | bc -l)")
  empty=$((10 - filled))
  bar=""
  for i in $(seq 1 "$filled"); do bar="${bar}█"; done
  for i in $(seq 1 "$empty"); do bar="${bar}░"; done
  printf "%s  [%s] %.0f%%%s" "$model" "$bar" "$used" "$git_info"
else
  printf "%s  [░░░░░░░░░░] -%s" "$model" "$git_info"
fi
