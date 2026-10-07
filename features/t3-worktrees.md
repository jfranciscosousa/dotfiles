# T3 Code worktree defaults

On non-work hosts, T3 Code starts new threads in worktrees and uses `fs/` branch names. This
includes personal servers accessed through a remote connection. A hostname that starts with
`Remote-` identifies a work device, not a remote connection. Work devices keep the local-checkout
default.

`dot_t3/userdata/modify_settings.json` manages `defaultThreadEnvMode` and `branchNamePrefix`.
Chezmoi manages T3 settings on both personal and work hosts. The prefix value is `fs`; T3 adds the
slash when it creates branch names.

The repository-root `t3.json` keeps chezmoi threads in the existing source checkout. It is a
repository configuration file and must not be deployed to the home directory. T3 project overrides
can supersede it. Set the chezmoi project's workspace to local on each environment, especially when
`projectSettingsFolded` disables repository settings.

`dot_brains/AGENTS.md` authorizes automatic task worktree creation only for T3 Code on non-work
devices. Agents must reuse an existing task worktree and must use T3 workspace tools to preserve
thread bindings. Chezmoi always requires an explicit request to create a branch or worktree.

Defaults do not prevent explicit workspace overrides. Existing threads do not move automatically.
Deploy the source settings and instructions with an approved `chezmoi apply` on each device. The
settings are environment-local; one server cannot update other devices through its settings API.

Run `python3 scripts/check-t3-worktrees.py` to check macOS/Linux host classification, settings merge
preservation, prefix, and the chezmoi exception without deployment.
