# OmaSwitch — Francisco's clone

This is Francisco Sousa's clone of OmaSwitch, based on original work by Piyush Mehta in
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
- List rows show the app name and workspace number, using desktop entries with readable app-ID
  fallbacks. Special workspaces show their name instead of an internal negative number. Window
  titles remain searchable but are not displayed. Live previews distinguish windows from the same
  app.
- JavaScript and JSON files use this repository's standard formatting.

The files are regular chezmoi-managed files, not a Git clone. Do not use
`omarchy plugin update francisco.omaswitch`; review and vendor upstream updates manually as
described in `AGENTS.md`.

Vendored upstream files:

- `LICENSE`
- `manifest.json`
- `Model.js`
- `Switcher.qml`
