---
name: francisco-tooling-update
description:
  Update the chezmoi source, Homebrew packages, mise-managed tools, and installed harness plugins.
  Should be manually invoked.
---

# Francisco tooling update

Execute the workflow without routine confirmation under the tooling-update authorization in the
chezmoi repository's `AGENTS.md`. Explicit invocation authorizes the complete workflow, including
full conflict-safe chezmoi apply of managed targets unrelated to upgrades and apply scripts. Do not
ask for separate apply approval. A skill does not grant its own permissions; preserve the scope and
restrictions of the repository authorization.

Recover autonomously when the fix is clear and preserves user work. Never force-push, discard user
changes, disable security checks, or blindly select an entire conflict side. Allow at most two
recovery attempts per operation. If SSH authentication fails, stop and ask the user to approve the
1Password prompt. Do not retry or investigate unless the user asks.

A failure blocks dependent steps, not independent work. Always produce the final summary. Ask for
guidance only when required authorization is missing, authentication requires user action, intent is
ambiguous, or further recovery risks losing work.

Run the complete workflow non-interactively. Use each command's native assume-yes or no-TTY option
for every update, upgrade, cleanup, prune, apply, and recovery operation. Redirect standard input
from `/dev/null` when a command has no explicit non-interactive option. Never open a selector, wait
for a `y` response, or pipe `yes` into a command. If a command cannot continue safely without user
input, let it fail and report the blocker instead of switching to an interactive mode.
Authentication that requires user action remains subject to the restrictions above.

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
env NONINTERACTIVE=1 brew upgrade </dev/null
env NONINTERACTIVE=1 brew doctor </dev/null
env NONINTERACTIVE=1 brew cleanup </dev/null
```

Report doctor warnings and continue. If an upgrade fails, inspect the result and attempt only safe
recovery. Still run diagnostics, but skip cleanup while a failed upgrade needs investigation. A
Homebrew failure does not block mise. Do not repeatedly rerun a partial upgrade without inspecting
what already changed.

With a reconciled global mise baseline, run:

```bash
mise plugins update --yes </dev/null
mise up --yes --bump --minimum-release-age 0d </dev/null
```

Ensure this updates the global configuration, not a project config discovered from the working
directory. Inspect effective configuration paths first. Plugin metadata failure need not block
unaffected tools when their backends remain usable. Inspect partial results before retrying.

After a successful update, inspect `mise ls --prunable` and `mise prune --dry-run`. Run
`mise prune --yes` only after confirming that the preview contains no version required by retained
worktree configuration. The default prune removes unused tool versions and stale tracked
configuration links that point to nonexistent configurations. Report each pruned tool, version, and
configuration link. A prune failure does not invalidate an otherwise successful update.

Compare the global target against the reconciled baseline. Transfer only update-owned version
changes into the source template; preserve directives, unrelated edits, and settings. Do not invent
pins for tools configured as `latest`. If a partial update leaves config changes, validate them and
include only coherent, successfully verified changes.

Capture installed versions and outdated lists again, using the same commands and scope. Report
actual before/after version changes, not just changes in outdated lists.

## 4. Update installed harness plugins

Update user-scoped plugins for every installed harness: Pi, Codex, OpenCode, Cursor, and Claude
Code. Harness binaries remain owned by Homebrew or mise; do not run separate self-updaters. Run
plugin commands from `$HOME` to avoid repository-local configuration. Skip unavailable harnesses and
report them. A plugin failure does not block other harnesses or the remaining workflow.

Before each update, inspect the installed CLI's help and record installed plugin versions, sources,
scopes, and pins. Keep recoverable copies of affected configuration and lockfiles. Update only
already-installed plugins, including disabled plugins, without changing their enabled state. Do not
install new plugins, approve hooks, change project trust, or update project-scoped plugins. Preserve
exact versions, Git tags, commits, and local source edits. Report pinned or locally edited plugins
as skipped. Do not edit vendor code, remove caches, or uninstall/reinstall plugins to force updates.

Use the installed version's supported commands, not commands inferred from another release:

- **Pi:** Record `pi list`, then run `pi update --extensions --no-approve </dev/null`. This updates
  package resources, including extensions and skills, without updating the mise-owned Pi binary.
  Preserve source pins in `dot_pi/agent/modify_settings.json`.
- **Codex:** Record `codex plugin marketplace list` and `codex plugin list`, using JSON output when
  supported. Run `codex plugin marketplace upgrade --json </dev/null` to refresh configured Git
  marketplaces. Verify installed plugin versions separately: refreshing marketplace metadata does
  not prove that installed plugins changed. If the CLI provides a separate installed-plugin update
  command, use it. Otherwise report installed-plugin updates as unsupported; do not remove/add
  plugins or change their enabled state.
- **Claude Code:** Record `claude plugin list --json` and the marketplace inventory. Run
  `claude plugin marketplace update </dev/null`, then
  `claude plugin update <plugin@marketplace> --scope user </dev/null` for each installed, unpinned
  user plugin. Do not update other scopes.
- **OpenCode:** Inspect the global configuration's plugin entries and resolved package versions. Use
  a native plugin update command if supported. For versions that only provide
  `opencode plugin <module>`, refresh each already-configured, unpinned npm plugin with
  `opencode plugin <module> --global --force </dev/null` only when help confirms that `--force`
  replaces its installed version. Preserve the original configuration entry and all other entries.
  Local chezmoi-managed plugins update during apply, not through npm. For external marketplace
  managers, use their documented non-interactive update mechanism; otherwise report updates as
  deferred until startup or requiring user action. Do not start an AI session to issue slash
  commands.
- **Cursor:** Use the editor's `cursor` CLI, not the separate agent CLI. Record
  `cursor --list-extensions --show-versions`. Run `cursor --update-extensions </dev/null` only if
  its help advertises that option and extension pins can be preserved. Treat Cursor agent plugins
  separately from editor extensions: inspect their supported update mechanism and report them as
  unsupported if no safe non-interactive updater exists. Never substitute forced extension
  installation or GUI automation.

Capture the same inventories after updating. Report actual version changes, metadata-only refreshes,
failures, and skipped plugins per harness. If versions cannot be inspected, report them as
unverified. Include any update-owned source configuration changes in the scoped validation and
commit below; do not copy runtime caches, marketplace checkouts, or vendor packages into chezmoi.
Tell the user to restart active harnesses to load changed plugins. Do not restart the harness
running this workflow.

## 5. Validate, commit, and push

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

## 6. Apply chezmoi changes

At the end of the workflow, apply the complete chezmoi source state without prompting:

```bash
chezmoi apply --error-on-conflict --keep-going --no-tty
```

`--error-on-conflict` must prevent replacement of a target that changed since chezmoi last wrote it.
`--keep-going` must continue to unaffected targets. Capture the command output and exit status. A
conflict does not mean that all applies failed.

For each conflict, identify the target path and leave it unchanged. Do not retry the complete apply
with `--force`. Report every skipped target and suggest a specific safe resolution, such as
reviewing `chezmoi diff <target>` and then either preserving the target edit in the source or
applying that one target after approval.

The only exception is the global mise target, `~/.config/mise/config.toml`. If it is a reported
conflict, overwrite it non-interactively with:

```bash
chezmoi apply --force ~/.config/mise/config.toml
```

Apply this exception only to that exact global target. Never use it for a project-level mise config
or another conflicted target. Report that the global mise conflict was overwritten.

After applying, inspect `chezmoi status`. Confirm which targets applied, which were skipped, and
whether the global mise exception was used.

Then install the deployed global tools from the home directory. This prevents a project config from
changing the install scope:

```bash
(cd "$HOME" && mise install --yes </dev/null)
```

If the install fails, report it. Do not retry blindly.

## 7. Always summarize

Report:

- Completed, failed, and skipped steps, with reasons and affected dependencies.
- Warnings and recovery actions; distinguish recovered errors from unresolved blockers.
- Actual before/after tool and harness-plugin version changes and anything still outdated.
- Per-harness plugin results, including metadata-only refreshes, pins, unsupported updates, and
  required restarts.
- Chezmoi verification and scoped check results.
- Commit hash and URL when available, push result, and final Git state.
- Any remaining conflicts, recovery stashes, or user action needed.

If initial synchronization failed, explicitly state that no package updates ran. Never claim the
workflow completed successfully when only part of it succeeded.
