# OpenAI models in coding agents

OpenCode lists only `gpt-6-sol`, `gpt-6-luna`, and `gpt-6-astra` from OpenAI on personal and work
machines. Its agents use these models.

Pi runs only on personal machines. Its model picker and cycling list the same three OpenAI models.
Pi uses `gpt-6-sol` by default, and its image-generation tool uses the same model. Pi's
`enabledModels` setting controls selection in the UI, not explicit CLI model arguments.

Codex defaults to `gpt-6-sol`. Codex has no local model allowlist setting, so users can select other
models with `--model` or project configuration.

T3 favorites include these three models. AI-enabled Git scripts use `gpt-6-sol` by default and
`gpt-6-luna` for fast requests.
