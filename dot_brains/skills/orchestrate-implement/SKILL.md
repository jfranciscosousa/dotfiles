---
name: orchestrate-implement
description: Start an approved implementation session in a background cmux workspace and worktree.
---

# Orchestrate Implement

## Create the workspace

First, follow the `orchestrate-create` skill with the user's full request. Retain its retrieved
context, title, and returned workspace reference. If it stops or fails, stop this workflow too.

## Prepare the worktree

1. Identify the target Git repository. Use the explicitly targeted repository or subrepository.
   Otherwise, use the current repository. If no target can be identified unambiguously, ask the user
   and stop.
2. Identify the caller as Claude, Codex, OpenCode, or Pi from the current agent runtime. If this is
   ambiguous, ask the user and stop.
3. Read the target repository instructions. If they document an exact worktree command, use it. The
   documented local command and its behavior always override the default process.
4. Otherwise, use a short kebab-case task slug and run these commands. Use `origin/master` unless
   the prompt specifies another base. If the path or branch exists, ask the user and stop. Do not
   select another path or branch.

```bash
worktree_root="${TMPDIR:-/tmp}/orchestrate"
worktree_path="$worktree_root/<repo>-<task-slug>"
branch="orchestrate/<task-slug>"
mkdir -p "$worktree_root"
git -C "<target-repo>" fetch origin master
git -C "<target-repo>" worktree add -b "$branch" "$worktree_path" origin/master
```

Replace `master` in both commands when the prompt specifies another base.

## Prepare the plan

Write a small plan to a unique file under `${TMPDIR:-/tmp}/orchestrate/plans/`. Include the original
request, retrieved context, worktree path, objective, and a short ordered plan. End it with:

```text
Before you do any work, respond: "I'm about to work on <X>, doing <Y>. Can I proceed?"
Then stop and wait. Do not modify files or perform the task until the user explicitly confirms.
After confirmation, continue in this session and execute the plan.
```

## Start the child agent

Use the command that matches the caller:

```text
Claude:   claude "$(cat '<plan-file>')"
Codex:    codex "$(cat '<plan-file>')"
OpenCode: opencode2 --prompt "$(cat '<plan-file>')"
Pi:       pi "$(cat '<plan-file>')"
```

Send one command to the created workspace's default tab, then press Enter:

```bash
cmux send --workspace "<workspace-ref>" "cd '<worktree-path>' && <launch-command>"
cmux send-key --workspace "<workspace-ref>" Enter
```

Do not focus the workspace. Do not execute the plan in the parent session. Report that the child
agent is waiting in the background workspace for plan approval.
