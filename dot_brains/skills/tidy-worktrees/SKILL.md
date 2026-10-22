---
name: tidy-worktrees
description:
  Move git worktrees from scattered locations into ~/.worktrees/<repo>/<name>, including worktrees
  of nested repositories. Use when asked to tidy, migrate, or consolidate worktrees on a machine.
---

# Tidy worktrees

Target layout: `~/.worktrees/<repo>/<name>`. Do not touch worktrees that a tool manages, such as
`~/.t3/worktrees`, or worktrees that are already under `~/.worktrees/`.

## Steps

1. Find the main checkouts. Scan `~/Projects`, or the paths the user gives:
   - Run `find <root> -maxdepth 5 -name .git -not -path '*/node_modules/*'`.
   - A `.git` directory marks a main checkout. A `.git` file marks a linked worktree: run
     `git -C <dir> rev-parse --path-format=absolute --git-common-dir` and add the main checkout that
     it names, even when it is outside the scan root.
   - Repositories can be nested inside other repositories, for example `workspace/tiger`. Treat each
     one as its own main checkout. The parent repository has its own worktree list.
2. For each main checkout, run `git worktree list --porcelain`. Select each worktree that is not the
   main checkout. Select it wherever it is: next to the repository, inside the repository
   (`.claude/worktrees/`, `.worktrees/`), in a `<repo>-worktrees/` folder, or elsewhere.
3. Check each selected worktree:
   - Skip a locked worktree. Skip a worktree that contains submodules, because `git worktree move`
     refuses them.
   - Report a prunable worktree (missing directory). Do not move it. Offer `git worktree prune`.
   - Mark a worktree with uncommitted changes (`git -C <path> status --porcelain`) as dirty in the
     plan. Move it anyway: `git worktree move` keeps all changes.
4. Build the new path: `~/.worktrees/<repo>/<name>`.
   - `<repo>` is the main checkout's directory name. If two main checkouts have the same directory
     name, use `<parent>-<repo>` for both, for example
     `employ_workspace-claude-code-plugin-marketplace`.
   - `<name>` is the old directory name without a leading `<repo>-`. For a worktree in a
     `<repo>-worktrees/fs/` folder, use the last path part.
   - If two worktrees get the same path, ask the user for a name.
5. Show the plan as a table: old path, new path, branch, action (move or skip, with the reason).
   Wait for the user to confirm.
6. Move the confirmed rows. Move the deepest paths first, so a worktree that sits inside another
   worktree moves before its parent. For each row, create `~/.worktrees/<repo>` and run
   `git -C <main> worktree move <old> <new>`. Do not use `--force`. Do not rename branches.
7. Run `git worktree repair` and `git worktree list` in each repo. Remove old container directories
   that are now empty, such as `<repo>-worktrees/`, `<repo>-worktrees/fs/`, and
   `.claude/worktrees/`. A leftover `.DS_Store` is safe to delete with `rm -f`. Use `rmdir` for the
   rest, so a folder with content stays.
8. Run the scan from step 1 and step 2 again. Expect zero selected worktrees except the skipped
   ones.
9. Report the result for each worktree: moved, skipped, or failed.

## Report

Tell the user to reopen shells, editors, and agent sessions that use an old path, especially for
dirty worktrees. Tell the user that path-bound state does not follow a move: run `mise trust` or
`direnv allow` in the new path when the tool asks, and reinstall dependencies when a tool reports
the old path. Do not delete worktrees or branches. Leave skipped worktrees for the user to handle.
