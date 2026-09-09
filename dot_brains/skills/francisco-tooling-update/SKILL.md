---
name: francisco-tooling-update
description:
  Update the chezmoi source, Homebrew packages, and mise-managed tools. Use when the user asks to
  update local developer tooling.
---

# Francisco tooling update

Execute the workflow without routine confirmation under the tooling-update authorization in the
chezmoi repository's `AGENTS.md`. A skill does not grant its own permissions. Preserve the scope and
restrictions of that authorization. Do not apply unrelated dotfiles.

Recover autonomously when the fix is clear and preserves user work. Never force-push, discard user
changes, disable security checks, or blindly select an entire conflict side. Allow at most two
recovery attempts per operation. If SSH authentication fails, stop and ask the user to approve the
1Password prompt. Do not retry or investigate unless the user asks.

A failure blocks dependent steps, not independent work. Always produce the final summary. Ask for
guidance only when required authorization is missing, authentication requires user action, intent is
ambiguous, or further recovery risks losing work.

## 1. Preflight and synchronize

State the plan and start immediately. Warn that Homebrew cask upgrades can close or restart GUI
apps, including the terminal running this session.

Resolve `chezmoi source-path` and work from that directory. Check required commands: `git`,
`chezmoi`, and `mise`. Homebrew is optional; report its absence and skip its steps.

Before changing Git state:

- Record branch, configured upstream and remote URL, HEAD, staged and unstaged diffs, and untracked
  paths. Keep recoverable copies of any files that this workflow may change. Capture the pre-pull
  rendered global mise source and installed target before synchronization.
- Check for an existing merge, rebase, cherry-pick, or unresolved index. Do not take over an
  existing operation. A detached HEAD or ambiguous upstream requires guidance before
  synchronization.
- Fetch the configured upstream remote, not a hardcoded `origin`. Inspect ahead/behind commits. Do
  not publish unrelated unpushed commits without authorization; explain that pushing the update
  would include them.
- A dirty tree is not itself a blocker. Preserve staged, unstaged, and untracked work. Autostash
  excludes untracked files and can conflict during restoration. If temporary stashing is necessary,
  record the stash identity, include affected untracked files, and preserve the original index.
  Retain the recovery copy until restoration is verified. Do not delete obstructing files.

Fast-forward when possible; otherwise rebase unpublished workflow commits onto the configured
upstream. Resolve conflicts only when both sides' intent is clear. Inspect base, local, and remote
versions; preserve unrelated changes. Validate each resolution before continuing. If intent is
ambiguous, keep recovery data and report the exact conflict and operation state.

Verify that synchronization finished and any temporary stash was restored, including staged state
and untracked files. Check actual working-tree state, not only the command exit status. If initial
synchronization remains blocked, do not start package updates; report the cause and ask for
guidance.

## 2. Establish the mise baseline

After synchronization, compare `~/.config/mise/config.toml` with the rendered
`dot_config/mise/config.toml.tmpl`. Record both before updating tools.

Reconcile source changes from the pull with the installed target before running mise. If the target
matches the pre-pull rendered source, apply only `~/.config/mise/config.toml` from the new source.
Otherwise inspect the pre-pull source, current source, and target. Preserve user edits and merge
only unambiguous differences. Do not overwrite local target changes or copy stale pins back over
newly pulled pins. If reconciliation is ambiguous, block mise updates and continue independent
Homebrew work. The source template contains Go directives; preserve them. Do not use
`chezmoi re-add`, which does not overwrite templates.

If the pre-pull baseline could not be captured, do not assume target differences are safe to
overwrite.

## 3. Capture inventories and update packages

Record installed versions before any upgrades: `brew list --versions` when available and
`mise ls --json`. Also record `brew outdated` and `mise outdated --bump`. Refresh Homebrew metadata
with `brew update` before its outdated check. Inventory failures are warnings unless they prevent
safe attribution of config changes. Save enough detail to compare versions, including tools pinned
to `latest`.

For Homebrew, after a successful metadata refresh, run:

```bash
brew upgrade
brew doctor
brew cleanup
```

Report doctor warnings and continue. If an upgrade fails, inspect the result and attempt only safe
recovery. Still run diagnostics, but skip cleanup while a failed upgrade needs investigation. A
Homebrew failure does not block mise. Do not repeatedly rerun a partial upgrade without inspecting
what already changed.

With a reconciled global mise baseline, run:

```bash
mise plugins update
mise up --bump --minimum-release-age 0d
```

Ensure this updates the global configuration, not a project config discovered from the working
directory. Inspect effective configuration paths first. Plugin metadata failure need not block
unaffected tools when their backends remain usable. Inspect partial results before retrying.

After a successful update, inspect `mise ls --prunable` and `mise prune --tools --dry-run`. Run
`mise prune --tools --yes` only after confirming that the preview contains no version required by
retained worktree configuration. Do not run the default prune command: it can also remove stale
tracked configuration links. Report each pruned tool and version. A prune failure does not
invalidate an otherwise successful update.

Compare the global target against the reconciled baseline. Transfer only update-owned version
changes into the source template; preserve directives, unrelated edits, and settings. Do not invent
pins for tools configured as `latest`. If a partial update leaves config changes, validate them and
include only coherent, successfully verified changes.

Capture installed versions and outdated lists again, using the same commands and scope. Report
actual before/after version changes, not just changes in outdated lists.

## 4. Validate, commit, and push

Run scoped, repository-approved checks on changed source paths and inspect the full diff. Run
`chezmoi verify ~/.config/mise/config.toml`. Resolve discrepancies only when their ownership and
intent are clear. Never overwrite unrelated target changes just to make verification pass.
Unresolved mise verification blocks committing its changes, not independent diagnostics.

Stage only update-owned changes. Whole-file staging is unsafe when a file contains unrelated edits.
Preserve the original index and do not include pre-existing staged changes. If safe separation is
not possible, leave the changes intact and ask for guidance. Inspect the exact proposed commit diff
before committing. Use a clear conventional commit message.

No update-owned source changes means no commit and no push. Otherwise push only to the verified
upstream, after confirming that the outgoing range contains only authorized commits. If the remote
advanced, fetch and integrate it using the same preservation and conflict rules. Revalidate the
resulting source and mise target before retrying the push. Do not force-push. Apply the recovery
attempt limit, and preserve the local commit when pushing remains blocked.

Verify the final branch/upstream relationship and confirm that unrelated working-tree and index
changes remain intact.

## 5. Always summarize

Report:

- Completed, failed, and skipped steps, with reasons and affected dependencies.
- Warnings and recovery actions; distinguish recovered errors from unresolved blockers.
- Actual before/after version changes and anything still outdated.
- Chezmoi verification and scoped check results.
- Commit hash and URL when available, push result, and final Git state.
- Any remaining conflicts, recovery stashes, or user action needed.

If initial synchronization failed, explicitly state that no package updates ran. Never claim the
workflow completed successfully when only part of it succeeded.
