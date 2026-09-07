# Omarchy customization

## Local changes and live testing

- The user prefers to test changes immediately. When the current prompt authorizes deployment, apply
  only the changed Omarchy files with `chezmoi apply <target-paths>`. Do not apply unrelated
  dotfiles.
- After shell or plugin code changes, run `omarchy restart shell`. Plugin hot reload has retained
  old JavaScript and QML code even after a successful apply. Do not use `omarchy refresh shell`: it
  resets config.
- Verify that deployed files match the source and that the affected component responds after
  restart.
- Repository approval rules still apply. This preference does not grant future home-directory write
  permission. If deployment is not authorized, state that changes remain source-only.
