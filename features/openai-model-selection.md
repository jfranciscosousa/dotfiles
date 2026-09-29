# OpenAI models in coding agents

OpenCode lists only `gpt-6-sol`, `gpt-6-luna`, and `gpt-6-astra` from OpenAI on personal and work
machines. Its agents use these models.

On `Remote-` machines, `chezmoi apply` downloads the LiteLLM plugin from the Remote agent plugin
marketplace branch and replaces the local copy, even if it changed. The plugin adds Remote's AI
Gateway and loads the models available to the connected key when OpenCode starts. On a fresh
install, search for `Other` in `/connect`, select it, then enter `litellm` as the provider ID and
add the key. Searching for `litellm` before adding the key returns no results. Restart OpenCode to
refresh the model list.

Pi runs only on personal machines. Its model picker and cycling list the same three OpenAI models.
Pi uses `gpt-6-sol` by default, and its image-generation tool uses the same model. Pi's
`enabledModels` setting controls selection in the UI, not explicit CLI model arguments.

Codex defaults to `gpt-6-sol`. Codex has no local model allowlist setting, so users can select other
models with `--model` or project configuration.

T3 favorites include these three models. AI-enabled Git scripts use `gpt-6-sol` by default and
`gpt-6-luna` for fast requests.

## Claude models on Remote machines

On `Remote-` machines, Claude Code defaults to `claude-sonnet-5-5`. Its `availableModels` setting
lists only `claude-sonnet-5-5`, `claude-opus-5-5`, and `claude-fable-5-1`. T3 favorites these three
models and hides the other Claude Agent models.
