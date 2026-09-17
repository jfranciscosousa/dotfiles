# Pi on personal machines

Pi is available only on personal machines. A work laptop is any machine whose hostname starts with
`Remote-`.

On personal machines, the global mise configuration installs Pi and chezmoi manages its files under
`~/.pi/`.

On work laptops, chezmoi:

- omits Pi from the global mise configuration;
- ignores all Pi configuration;
- does not install the cmux Pi hook;
- uninstalls all mise-managed Pi versions, including old npm backend copies;
- removes leftover Pi mise install directories and caches;
- rebuilds mise shims to remove the Pi launcher; and
- removes `~/.pi/`, including sessions, packages, extensions, and symlinks.

Run `chezmoi apply` after changing a machine hostname so the policy for the new machine class takes
effect.
