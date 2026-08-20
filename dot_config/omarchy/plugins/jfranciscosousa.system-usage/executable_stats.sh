#!/usr/bin/env bash
set -euo pipefail

awk '
  NR == 1 {
    idle = $5 + $6
    total = 0
    for (i = 2; i <= NF; i++) total += $i
    printf "cpu\t%.0f\t%.0f\n", idle, total
  }
' /proc/stat

awk '
  /^MemTotal:/ { total = $2 * 1024 }
  /^MemAvailable:/ { available = $2 * 1024 }
  END {
    used = total - available
    percent = total > 0 ? used * 100 / total : 0
    printf "memory\t%.0f\t%.0f\t%.1f\n", used, total, percent
  }
' /proc/meminfo

df -P -B1 / | awk '
  NR == 2 {
    gsub(/%/, "", $5)
    printf "disk\t%s\t%s\t%s\n", $3, $2, $5
  }
'

awk -F '[: ]+' '
  $2 != "lo" && $2 != "face" && NF >= 11 {
    rx += $3
    tx += $11
    interfaces++
  }
  END { printf "network\t%.0f\t%.0f\t%d\n", rx, tx, interfaces }
' /proc/net/dev

if command -v nvidia-smi >/dev/null 2>&1; then
  gpu_name=$(timeout 2 nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | awk 'NR == 1 { print; exit }' || true)
  gpu_stats=$(timeout 2 nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null | awk 'NR == 1 { print; exit }' || true)
  if [[ -n "$gpu_stats" ]]; then
    awk -F ',' -v name="$gpu_name" '
      {
        for (i = 1; i <= NF; i++) {
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", $i)
        }
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", name)
        printf "gpu\t%s\t%s\t%s\t%s\t%s\n", $1, $2, $3, $4, name
      }
    ' <<< "$gpu_stats"
  fi
fi
