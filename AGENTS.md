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
- Read relevant `features/` docs before changing a feature. Update them in the same change when
  behavior, configuration, or usage changes. Document the current implementation, not audit logs or
  completed work. Remove obsolete documentation; add a feature doc only when it provides useful
  context beyond the code.
- Do not stage, commit, push, or apply unless explicitly requested.
- Validate only task paths. Never run full-project lint or the `lint:staged` package script.
- For Markdown, run `rtk pnpm exec oxfmt --check --disable-nested-config <paths>`.
- `lint-staged --diff="HEAD"` can change the index, even with check-only tasks. Use it only with
  explicit staging approval and restrict it to task paths. Otherwise skip it and use known read-only
  checks. Check untracked task files separately.
- Inspect the final diff and verify that checks left the index unchanged unless staging was
  authorized. Report checks that passed, failed, or were skipped. Formatting does not verify that
  harnesses load instructions; do not claim deployment or reload without testing it.

## Tooling-update exception

Explicit invocation of `francisco-tooling-update` (including `tooling-update`) authorizes its
package upgrades, chezmoi synchronization, global mise config changes, scoped apply, and commit/push
of workflow-owned changes. Run without further confirmation unless blocked. Preserve unrelated work;
authentication and destructive-action restrictions still apply.
