# Open Omarchy webapp links in the default browser

## Purpose

Omarchy launches webapps in a Chromium `--app` window. Chromium opens external links in Chromium,
even when another application is the system browser.

This feature sends external links from Chromium app windows to the system browser. On the current
Omarchy setup, the system browser is Zen.

## Scope

Chezmoi deploys this feature only when all these conditions are true:

- The operating system is Linux.
- The `omarchy` command exists.

The `features/` directory is repository documentation. Chezmoi must not copy it to the home
directory.

## Behavior

- A same-origin HTTP or HTTPS link stays in the webapp.
- A cross-origin HTTP or HTTPS link opens through `omarchy launch browser`.
- A normal Chromium window is not affected.
- A modified click, such as `Ctrl+click`, keeps Chromium's standard behavior.
- A failed native-host request falls back to navigation in the app window.

The first version handles direct anchor clicks only. It does not replace programmatic
`window.open()` calls. This limit reduces the risk of breaking sign-in flows.

## Runtime flow

```text
cross-origin link click
  content.js
    worker.js
      verify that window.type is "app"
      send URL through native messaging
        chromium-open-webapp-link-host
          validate HTTP or HTTPS URL
          omarchy launch browser URL
```

## Files

- `dot_config/chromium/extensions/open-webapp-links/manifest.json` defines the Chromium extension
  and its stable ID.
- `dot_config/chromium/extensions/open-webapp-links/content.js` intercepts eligible link clicks.
- `dot_config/chromium/extensions/open-webapp-links/worker.js` verifies app-window context and calls
  the native host.
- `dot_config/chromium/NativeMessagingHosts/com.jfranciscosousa.open_webapp_link.json.tmpl`
  registers the native host for the extension.
- `dot_scripts/bin/executable_chromium-open-webapp-link-host` validates the URL and calls the
  Omarchy browser launcher.
- `.chezmoiscripts/run_after_configure-chromium-webapp-links.sh.tmpl` adds the extension directory
  to Chromium's existing `--load-extension` flag.
- `.chezmoiignore` excludes all deployed files when Omarchy is unavailable and always excludes this
  documentation directory.

## Apply

Run:

```bash
chezmoi apply
```

Close all Chromium processes and reopen an Omarchy webapp. Chromium reads extension flags only when
the browser process starts.

## Removal

Delete the feature sources and add their deployed targets to `.chezmoiremove` before applying.

## Security

The extension has a fixed public key and stable extension ID. The native-messaging manifest allows
only that extension ID.

The native host accepts only HTTP and HTTPS URLs. It passes the URL as one quoted argument and does
not evaluate it as shell code.
