# Dotfiles repository

This is the **chezmoi source repository**, not the live home-directory configuration. Edit source
files here; `chezmoi apply` deploys them to the home directory.

## Instruction scope

- This file contains repository-specific rules only.
- Read `dot_brains/AGENTS.md` for shared coding and tool rules used across agent harnesses.
- `dot_brains/RTK.md` contains output-filter guidance; `dot_brains/skills/` contains shared
  workflows.
- Edit shared guidelines in `dot_brains/` and harness routing in its source configuration, not
  deployed symlink targets or generated copies. Keep task-specific procedures in skills or
  references, not always-loaded rules.

## Source and deployment boundaries

- Make changes in this repository. Do not write to home-directory targets unless the current prompt
  explicitly permits the specific paths and actions. Source edits do not authorize deployment.
- `chezmoi diff` and `chezmoi status` are read-only. `apply`, `add`, `re-add`, and `edit` require
  explicit approval for their effects; prefer editing source files directly.
- On `chezmoi apply` conflicts (target changed since chezmoi last wrote it), skip the conflicting
  file and report it. Never use `apply --force`.
- When removing a managed file or feature, update `.chezmoiremove` so a later apply removes the
  deployed targets too.
- Do not edit externally installed skills or vendor documentation as part of local rule cleanup.

## Repository map

| Path                                                  | Purpose                                           |
| ----------------------------------------------------- | ------------------------------------------------- |
| `dot_brains/`                                         | Shared agent guidelines, RTK guidance, and skills |
| `dot_claude/`, `dot_codex/`, `dot_cursor/`, `dot_pi/` | Harness-specific configuration and routing        |
| `dot_config/`                                         | Application config, including mise and OpenCode   |
| `dot_zsh*`, `dot_zprofile`, `dot_zlogin`              | Shell configuration                               |
| `dot_scripts/`                                        | Custom commands deployed to `~/.scripts/`         |
| `private_dot_ssh/`                                    | SSH configuration                                 |
| `features/`                                           | Living documentation of implemented features      |

Chezmoi names encode deployment: `dot_` → `.`, `private_` → restricted permissions (not encryption),
`executable_` → executable file, and `.tmpl` → Go template. Directories use the same prefixes.
Preserve macOS/Linux branches in templates.

## Workflow and checks

- Before editing, inspect `git status --short`. Preserve unrelated changes.
- Use this existing checkout. Do not create a branch or worktree unless the user explicitly asks.
- Read relevant `features/` docs before changing a feature. Update them in the same change when
  behavior, configuration, or usage changes. Document the current implementation, not audit logs or
  completed work. Remove obsolete documentation; add a feature doc only when it provides useful
  context beyond the code.
- Do not stage, commit, push, or apply unless explicitly requested.
- Automatically lint and format task files with the repository tools. Restrict automatic fixes to
  task paths and preserve unrelated changes. Include untracked task files in checks.
- Repository-wide read-only checks, including typechecking, are allowed. Do not run repository-wide
  formatting or automatic fixes unless explicitly requested.
- For Markdown, run `rtk pnpm exec oxfmt --disable-nested-config <paths>`, then rerun with
  `--check`.
- When a commit is authorized, run all configured commit hooks, including `pnpm lint:staged` and its
  repository-wide typecheck. Commit approval includes hook checks and updates to task files in the
  index. Do not disable or bypass hooks unless explicitly requested for those commits.
- Fix check failures in task files before committing. If a failure requires unrelated changes,
  report the blocker and ask for approval. Do not skip a failed check to complete a commit.
- Outside an authorized commit, do not run lint-staged without explicit staging approval. It can
  change the index even with check-only tasks. Use direct checks on task paths instead.
- Inspect automatic fixes and the final staged diff before committing. Verify the final diff and
  index after checks and commits. Report checks that passed, failed, or were skipped. Formatting
  does not verify that harnesses load instructions; do not claim deployment or reload without
  testing it.

## Tooling-update exception

Explicit invocation of `francisco-tooling-update` (including `tooling-update`) authorizes its
package upgrades, updates to already-installed user-scoped harness plugins and editor extensions,
chezmoi synchronization, global mise config changes, full conflict-safe chezmoi apply (including
managed targets unrelated to upgrades and apply scripts), and commit/push of workflow-owned changes.
Run without further confirmation unless blocked. Preserve unrelated work; authentication and
destructive-action restrictions still apply.
