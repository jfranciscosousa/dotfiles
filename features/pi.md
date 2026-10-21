# Pi

The global mise configuration installs Pi on all machines. Chezmoi manages one of two Pi
configurations. A work laptop is any machine whose hostname starts with `Remote-`.

| Source tree        | Target            | Machines     |
| ------------------ | ----------------- | ------------ |
| `dot_pi-work/`     | `~/.pi-work/`     | Work laptops |
| `dot_pi-personal/` | `~/.pi-personal/` | Other        |

`~/.pi` is a symlink to the active target. Pi uses `~/.pi/agent`, so sessions, `auth.json`, and
packages stay in the active target. Chezmoi ignores the other tree. Before an apply, a script moves
a real `~/.pi` directory to the active target. It stops the apply if both exist.

Both configurations share the MCP template in `.chezmoitemplates/pi-mcp.tmpl`, the global agent
instructions and skills, and the VCC and Ponytail packages. The work tree includes the shared `rtk`,
`quiet-tools`, and `read-url` extensions from the personal tree.

## Personal configuration

Pi uses the `openai-codex` provider and an OpenRouter DeepSeek model. It loads all extensions in
`dot_pi-personal/agent/extensions/`, including web search, image generation, SearXNG, and voice
mode. The `tooling-update` command opens an interactive Pi session when `pi` is available.

## Work configuration

Pi uses only the `litellm` provider for Remote's AI Gateway. `models.json` lists `gpt-6.1-sol`,
`gpt-6-luna`, and `gpt-6-astra`. Pi reads the API key from the OpenCode `/connect` entry in
`$XDG_DATA_HOME/opencode/auth.json` (default `~/.local/share/opencode/auth.json`). Connect the key
in OpenCode first. See [OpenAI models](openai-model-selection.md).

Pi installs the
[Remote agent plugin marketplace](https://gitlab.com/remote-com/tools/agent-plugin-marketplace) as a
git package over SSH. The package loads no resources itself. The `skills` setting loads every skill
under its `plugins/` directory. Other `skills` entries, such as entries that `pi config` writes,
remain. Run `pi update --extensions` to update the marketplace clone.

AI-enabled Git scripts still use OpenCode on work laptops.

Run `chezmoi apply` after changing a machine hostname so the configuration for the new machine class
takes effect.

## Web search

The personal `openai-web-search` Pi extension accepts one query or a batch of up to four independent
queries. It sends the batch in one Responses request, uses low search context, limits generated
output to 1,200 tokens, and returns no more than eight sources. Cited pages take priority over other
search results. Use a single query when research needs depth.

## Read source pages

The `read-url` extension uses Lightpanda to extract Markdown after JavaScript execution. It works
with any Pi model. Search first, then read relevant sources when exact wording or code matters.

- Output defaults to 6,000 Unicode characters per call and cannot exceed 12,000 characters.
- Use `find` for a text window or `selector` for a CSS element. `find` matches literal Markdown,
  including formatting. URL fragments do not select sections.
- Use `nextOffset` with the same URL and selector to continue. Four page snapshots remain in memory
  for five minutes. Expired or evicted snapshots require a new call with offset zero.
- Extraction stops at 256 KiB. `extractionCapped` reports incomplete snapshots. Use a narrower
  selector when this limit is reached.
- Each process has a 20-second timeout and bounded stdout. Lightpanda limits individual HTTP
  responses to 5 MiB and the JavaScript heap to 128 MiB. These are not a total process-memory limit.
- Private-network requests are blocked after DNS resolution, including redirects and subrequests.
  The tool obeys robots.txt, rejects HTTP errors, uses no saved cookies, and disables telemetry.
- Page text is untrusted data. Output limits and labeling do not prevent prompt injection.
- Extraction waits up to 1.5 seconds. Dynamic pages can return loading placeholders. Longer waits do
  not guarantee compatibility; use a full browser when needed.

The executable must support `--json`, `--strip-mode`, `--dump-max-bytes`, and
`--block-private-networks`. Unsupported versions fail without a less-restricted fallback.
`LIGHTPANDA_BIN` can select an executable for temporary testing.
