# Ponytail agent plugins

Ponytail is enabled globally for Claude Code and OpenCode. It is also enabled for Codex on personal
machines.

- OpenCode loads `@dietrichgebert/ponytail` from its managed global configuration.
- After each `chezmoi apply`, chezmoi adds the Ponytail marketplace and installs the user-scoped
  plugin for each available Claude Code or Codex CLI when it is missing.
- If a harness CLI is not available during apply, the script skips that harness. A later apply
  installs the plugin after the CLI becomes available.
- A network or marketplace failure reports a warning but does not block unrelated dotfile changes.

`tooling-update` updates already-installed user-scoped plugins for Pi, Codex, OpenCode, Claude Code,
and Cursor editor extensions through supported non-interactive commands. It preserves pins, local
edits, scopes, and enabled states. Missing harnesses and unsupported update mechanisms are reported
as skipped. A Codex marketplace refresh is reported separately from installed-plugin updates. Cursor
agent plugins are separate from editor extensions and require their own supported updater.

Restart an active harness after installation or an update. In Codex, open `/hooks` once after a new
installation and approve Ponytail's lifecycle hooks.
