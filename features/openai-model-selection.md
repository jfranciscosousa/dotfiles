# OpenAI models in coding agents

Mise manages OpenCode v2 through the official `@opencode/cli` npm package. The version constraint
stays on major version `2`. Its postinstall script is allowed to install the platform binary.

On personal machines, OpenCode lists only `gpt-6.1-sol`, `gpt-6-luna`, and `gpt-6-astra` from
OpenAI. Its agents use these models.

On `Remote-` machines, OpenCode enables only the `litellm` provider and defaults to
`litellm/gpt-6-sol`, because the AI Gateway does not serve `gpt-6.1-sol`. `chezmoi apply` removes
stored OpenAI credentials and downloads the LiteLLM plugin from the Remote agent plugin marketplace
branch. It replaces the local copy, even if it changed. The plugin adds Remote's AI Gateway and
loads the models available to the connected key when OpenCode starts. On a fresh install, search for
`Other` in `/connect`, select it, then enter `litellm` as the provider ID and add the key. Searching
for `litellm` before adding the key returns no results. Restart OpenCode to refresh the model list.

Pi runs only on personal machines. Its model picker and cycling list the same three OpenAI models.
Pi uses `gpt-6.1-sol` by default. Its image-generation tool uses `gpt-6-astra`. Pi's `enabledModels`
setting controls selection in the UI, not explicit CLI model arguments.

On personal machines, Codex defaults to `gpt-6.1-sol`. Codex has no local model allowlist setting,
so users can select other models with `--model` or project configuration. Remote machines do not
install or configure Codex.

AI-enabled Git scripts use `gpt-6.1-sol` by default and `gpt-6-luna` for fast requests. On `Remote-`
machines, they use `litellm/gpt-6-sol` and `litellm/gpt-6-luna`.

## Claude models on Remote machines

On `Remote-` machines, Claude Code defaults to `claude-sonnet-5-5`. Its `availableModels` setting
lists only `claude-sonnet-5-5`, `claude-opus-5-5`, and `claude-fable-5-1`. T3 favorites these three
models and hides the other Claude Agent models.

## Claude reasoning effort

Claude Code sets the default effort per model with `modelSettings`: `claude-sonnet-5-5` uses `high`
and `claude-opus-5-5` uses `xhigh`. Other models use the top-level `effortLevel` (`xhigh`). On
`Remote-` machines, the top-level value and the `modelSettings` entries for the three available
models are `medium`. `CLAUDE_CODE_EFFORT_LEVEL` overrides these values, so do not set it.

T3 has no per-model default. Its server `defaultModelSelection` sets one model and effort:
`claude-opus-5-5` with `xhigh` (`medium` on `Remote-` machines) and a 1M context window. T3 sends
the effort with each session, so `modelSettings` does not apply there. To use another model in T3,
choose its effort in the model picker. T3 text generation uses `claude-sonnet-5-5` with `high`
effort and a 1M context window. Source-control text uses the T3 default.

On `Remote-` machines, T3 lists `litellm/gpt-6.1-sol` as an OpenCode custom model. T3 drops gateway
models from its OpenCode 2 catalog
([t3code#15155](https://github.com/pingdotgg/t3code/issues/15155)). Remove the custom model when a
T3 release fixes this issue.
