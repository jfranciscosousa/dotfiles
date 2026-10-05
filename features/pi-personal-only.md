# Pi on personal machines

Pi is available only on personal machines. A work laptop is any machine whose hostname starts with
`Remote-`.

On personal machines, the global mise configuration installs Pi and chezmoi manages its files under
`~/.pi/`. The `tooling-update` command opens an interactive Pi session when `pi` is available and
starts the update prompt. Otherwise, it runs OpenCode. It disables the mise versions host for that
run to avoid rate limits from the shared version cache.

On work laptops, chezmoi:

- configures AI-enabled Git scripts to use OpenCode instead of Pi;
- omits Pi from the global mise configuration;
- ignores all Pi configuration;
- does not install the cmux Pi hook;
- uninstalls all mise-managed Pi versions, including old npm backend copies;
- removes leftover Pi mise install directories and caches;
- rebuilds mise shims to remove the Pi launcher; and
- removes `~/.pi/`, including sessions, packages, extensions, and symlinks.

Run `chezmoi apply` after changing a machine hostname so the policy for the new machine class takes
effect.

## Web search

The `openai-web-search` Pi extension accepts one query or a batch of up to four independent queries.
It sends the batch in one Responses request, uses low search context, limits generated output to
1,200 tokens, and returns no more than eight sources. Cited pages take priority over other search
results. Use a single query when research needs depth.

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

Run `node scripts/check-read-url.mjs` for deterministic checks. Add `--live` and set
`LIGHTPANDA_BIN` to test public documentation and authenticated OpenAI search. This uses read-only
Pi credentials and the active `PI_PROVIDER` and `PI_MODEL` values. Add `--read-only` to skip search.
Latency, output bytes, and simple factual checks are written to a temporary directory. These checks
are a small diagnostic sample, not a general search-quality benchmark.
