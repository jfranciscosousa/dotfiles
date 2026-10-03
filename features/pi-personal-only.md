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
1,200 tokens, and returns no more than eight sources. Use a single query when research needs depth.
