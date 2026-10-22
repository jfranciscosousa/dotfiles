---
name: tidy-worktrees
description:
  Move git worktrees from scattered locations into ~/.worktrees/<repo>/<name>. Use when asked to
  tidy, migrate, or consolidate worktrees on a machine.
---

# Tidy worktrees

Target layout: `~/.worktrees/<repo>/<name>`. Do not touch worktrees that a tool manages, such as
`~/.t3/worktrees`.

## Steps

1. Find the main checkouts. Scan `~/Projects`, or the paths the user gives. A main checkout is a
   directory whose `.git` is a directory.
2. For each main checkout, run `git worktree list --porcelain`. Select each worktree that is not the
   main checkout and is not already under `~/.worktrees/<repo>/`.
3. Check each selected worktree with `git -C <path> status --porcelain` and
   `git worktree list --porcelain`:
   - Skip a worktree with uncommitted or untracked changes.
   - Skip a locked worktree.
   - Report a prunable worktree. Do not move it.
4. Build the new path: `~/.worktrees/<repo>/<name>`. Use the old directory name as `<name>`. Remove
   a leading `<repo>-` from it. If two worktrees get the same path, ask the user for a name.
5. Show the plan as a table: old path, new path, branch, action (move or skip, with the reason).
   Wait for the user to confirm.
6. Create `~/.worktrees/<repo>` and run `git worktree move <old> <new>` for each confirmed row. Do
   not use `--force`. Do not rename branches.
7. Run `git worktree repair` and `git worktree list` in each repo. Report the result for each
   worktree: moved, skipped, or failed.

## Report

Tell the user to reopen shells and editors that use an old path. Do not delete worktrees or
branches. Leave skipped worktrees for the user to handle.
