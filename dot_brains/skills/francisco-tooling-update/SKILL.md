---
name: francisco-tooling-update
description:
  Update the chezmoi source, Homebrew packages, and mise-managed tools. Use when the user asks to
  update local developer tooling.
---

# Francisco tooling update

This workflow changes local packages and the chezmoi Git repository. When invoked, execute the full
workflow without asking for confirmation. Treat the invocation as authorization. Stop only for a
clear blocker, such as a failed Git operation, unavailable required command, or failed update.

1. State the plan, including that `brew upgrade` can update GUI casks and can close or restart
   running apps. Start immediately after the plan.
2. Confirm that `git`, `chezmoi`, and `mise` are available. Homebrew is optional. Work from the
   chezmoi source directory:

   ```bash
   source_dir=$(chezmoi source-path)
   cd "$source_dir"
   ```

3. Update the chezmoi source first with `git pull --ff-only`.
   - If it succeeds, continue.
   - If it fails, do not run the remaining updates. Report the complete Git error output. Explain
     the likely cause when the output identifies one, such as local changes, a non-fast-forward
     branch, network access, or authentication.
   - If SSH authentication fails, ask the user to approve the 1Password prompt. Do not retry or
     investigate unless the user asks.
   - Ask the user for guidance before continuing.

4. If Homebrew is available, run these commands in order. Continue after `brew doctor` warnings, but
   report them.

   ```bash
   brew update
   brew upgrade
   brew doctor
   brew cleanup
   ```

5. Update mise plugins and bump the global mise tool versions without a release-age delay.

   ```bash
   mise plugins update
   mise up --bump --minimum-release-age 0d
   ```

   `mise up --bump` changes `~/.config/mise/config.toml`. That target is rendered from
   `dot_config/mise/config.toml.tmpl`. Inspect the target diff, then update only the changed tool
   versions in the source template. Preserve its Go template directives. Do not use `chezmoi re-add`
   for this file because it does not overwrite templates.

6. Validate the changed source files and inspect their diff. If the update changed the chezmoi
   source, commit only the files changed by this workflow, then push that new commit. Do not include
   unrelated changes. If commit or push fails, report the Git output, explain the likely cause, and
   ask for guidance. For SSH authentication failures, ask the user to approve the 1Password prompt.
   Do not retry or investigate unless the user asks.

7. Report each completed step and any warnings or failures. State which versions changed, whether a
   commit and push occurred, and that no package updates ran if the chezmoi pull failed.
