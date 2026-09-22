# Ponytail agent plugins

Ponytail is enabled globally for Claude Code, Codex, and OpenCode.

- OpenCode loads `@dietrichgebert/ponytail` from its managed global configuration.
- After each `chezmoi apply`, chezmoi adds the Ponytail marketplace and installs the user-scoped
  plugin for Claude Code and Codex when it is missing.
- If a harness CLI is not available during apply, the script skips that harness. A later apply
  installs the plugin after the CLI becomes available.
- A network or marketplace failure reports a warning but does not block unrelated dotfile changes.

Restart an active harness after installation or an update. In Codex, open `/hooks` once after a new
installation and approve Ponytail's lifecycle hooks.
