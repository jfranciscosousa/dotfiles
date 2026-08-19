---
name: orchestrate-review
description: Review a GitLab merge request in a lightweight worktree with an agent and Hunk.
---

# Orchestrate Review

Use this skill only for GitLab merge requests. Keep the checkout lightweight and the review local.

## Resolve the merge request

1. Run the cmux check from `orchestrate-create`. If the caller is not in cmux, stop as that skill
   requires.
2. Use the authenticated `glab` CLI to read the merge request. Resolve its target project, IID,
   title, source branch, target branch, web URL, clone URL, and head SHA. Do not use a browser. Do
   not modify the merge request or post comments to GitLab.
3. Search the current Git repository and its nested Git repositories for a remote that matches the
   merge request's target project. Do not search outside this tree.

## Prepare the worktree

Never use a repository worktree script for reviews.

Use `${TMPDIR:-/tmp}/orchestrate/reviews/` for review worktrees and bare repository caches. If no
matching local repository exists, create a bare clone there:

```bash
review_root="${TMPDIR:-/tmp}/orchestrate/reviews"
repo_cache="$review_root/repos/<project-slug>.git"
mkdir -p "$review_root/repos" "$review_root/worktrees" "$review_root/plans"
git clone --bare "<clone-url>" "$repo_cache"
```

Fetch both of these refs from the matching remote:

```bash
git -C "<repo>" fetch "<remote>" \
  "+refs/merge-requests/<iid>/head:refs/remotes/<remote>/merge-requests/<iid>/head" \
  "+refs/heads/<target-branch>:refs/remotes/<remote>/<target-branch>"
```

The fetched merge-request ref is the only source of truth for the review head. This also supports
merge requests from forks.

Search `git worktree list --porcelain` for one worktree whose checked-out branch matches the merge
request source branch. If more than one matches, ask the user which one to use and stop.

Before updating an existing matching worktree:

1. Run `git status --porcelain` in it. If it has tracked, staged, or untracked changes, stop and
   report them.
2. Compare its `HEAD` with the fetched merge-request ref. If it has any commit not in that ref, or
   the histories diverged, stop and report it.
3. If it is only behind, update it with a fast-forward merge. Never reset or force-update it:

```bash
git -C "<existing-worktree>" merge --ff-only \
  "refs/remotes/<remote>/merge-requests/<iid>/head"
```

If no matching worktree exists, check a same-named local source branch with the same commit safety
rules. Then create a dedicated worktree under the review root. Create the source branch from the
fetched merge-request ref when it does not exist. Never use the repository's primary checkout as a
substitute for creating the worktree.

If the safe same-named source branch exists, run:

```bash
git -C "<repo>" worktree add "<review-root>/worktrees/<project-slug>-mr-<iid>" \
  "<source-branch>"
git -C "<review-root>/worktrees/<project-slug>-mr-<iid>" merge --ff-only \
  "refs/remotes/<remote>/merge-requests/<iid>/head"
```

Otherwise, create it directly from the fetched merge-request ref:

```bash
git -C "<repo>" worktree add -b "<source-branch>" \
  "<review-root>/worktrees/<project-slug>-mr-<iid>" \
  "refs/remotes/<remote>/merge-requests/<iid>/head"
```

If the destination path exists, stop and report it. Do not delete or replace it.

Do not install dependencies. Do not compile. Do not run tests, linters, type checks, generators,
setup commands, or any repository task. Do not modify source files.

## Create the workspace

After all checkout safety checks pass, follow `orchestrate-create` with a synthesized request that
contains no URL:

```text
Review <project> !<iid>: <title>
```

Retain the returned workspace reference. The created default pane is the left pane.

Create one right split and retain its returned surface reference:

```bash
cmux new-split right --workspace "<workspace-ref>" --focus false
```

Start Hunk on the right with the merge request diff, visible agent notes, and automatic reload:

```bash
cmux send --surface "<right-surface-ref>" \
  "cd '<worktree-path>' && hunk diff '<remote>/<target-branch>...HEAD' --agent-notes --watch"
cmux send-key --surface "<right-surface-ref>" Enter
```

## Start the reviewer

Write a concise review prompt to a unique file under `${TMPDIR:-/tmp}/orchestrate/reviews/plans/`.
Include the merge request metadata, worktree path, target ref, and these rules:

- Start reviewing immediately. Do not wait for approval.
- Review the changed code and enough surrounding code to validate each finding.
- Look for correctness bugs, regressions, major architectural problems, security risks, performance
  problems, and unnecessary complexity with a materially simpler alternative.
- Do not report formatting, naming, or other style-only issues.
- Do not modify files or post to GitLab.
- Do not install dependencies or run builds, tests, linters, type checks, generators, setup
  commands, or repository tasks.
- Read the bundled skill at the path returned by `hunk skill path hunk-review`, then use its
  `hunk session` commands. Add confirmed findings as inline Hunk agent notes on exact changed lines.
  Keep the Hunk session open.
- Also report findings in the agent conversation, ordered by severity with file and line references.
  If there are no findings, say so and identify residual review risks.
- If the user later explicitly requests tests or another task that needs dependencies, first say:
  `This worktree was cloned lightly. I will install dependencies to run the requested tests.` Then
  perform only the minimum requested setup and task.

Use the command that matches the caller:

```text
Claude:   claude "$(cat '<review-prompt-file>')"
Codex:    codex "$(cat '<review-prompt-file>')"
OpenCode: opencode2 --prompt "$(cat '<review-prompt-file>')"
Pi:       pi "$(cat '<review-prompt-file>')"
```

Send the command to the left pane's default surface, then press Enter:

```bash
cmux send --workspace "<workspace-ref>" \
  "cd '<worktree-path>' && <reviewer-launch-command>"
cmux send-key --workspace "<workspace-ref>" Enter
```

Do not focus the workspace. Report that the review started in the background workspace with the
reviewer on the left and Hunk on the right.
