# Remote agent marketplace

On machines whose hostname starts with `Remote-`, `chezmoi apply` registers the
[Remote agent plugin marketplace](https://gitlab.com/remote-com/tools/agent-plugin-marketplace) for
Claude Code and Codex. It also installs the OpenCode marketplace manager from the same repository.
The installer keeps OpenCode's local mirror and plugin state outside chezmoi.

Registration does not install any catalogue plugins. Install only the plugins you need through each
harness. OpenCode provides `/remote-plugin list` and `/remote-plugin install <name>` after a
restart. Its manager checks for marketplace updates when OpenCode starts.

The post-apply script skips a harness when its CLI is unavailable. A later apply registers the
marketplace when that CLI becomes available. It leaves existing marketplace registrations and
OpenCode pins intact. If GitLab SSH authentication fails, approve the 1Password prompt before
retrying the apply.
