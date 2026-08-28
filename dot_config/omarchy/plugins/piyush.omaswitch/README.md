# OmaSwitch

This directory vendors the runtime files from
[piyush97/omaswitch](https://github.com/piyush97/omaswitch).

Vendored revision:
[`0afaa7fe83a93db16df5dcee1dd0ca8015a37d6b`](https://github.com/piyush97/omaswitch/commit/0afaa7fe83a93db16df5dcee1dd0ca8015a37d6b)
(version 1.1.1), with the local changes documented below.

## Local changes

- The complete switcher uses fixed card, list, pane, and preview-frame dimensions. The preview is
  rendered into explicit bounds instead of its source-dependent implicit size. Switching capture
  sources cannot resize the layout while the next frame loads.
- Windows are grouped by workspace number from 1 through N. Within each workspace, windows are
  ordered spatially from left to right, with vertical position and compositor order as tie-breakers.
  The first cycle invocation selects the active window. Additional Tab presses or arrow keys move
  the selection. Ordering does not use focus history or MRU ranks.
- JavaScript and JSON files use this repository's standard formatting.

The files are regular chezmoi-managed files, not a Git clone. Do not use
`omarchy plugin update piyush.omaswitch`; review and vendor upstream updates manually as described
in `AGENTS.md`.

Vendored upstream files:

- `LICENSE`
- `manifest.json`
- `Model.js`
- `Switcher.qml`
