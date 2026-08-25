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

## Uninstall

Use a source-driven uninstall. Deleting the source files alone does not delete their existing target
files. Adding files to `.chezmoiignore` also does not uninstall files that Chezmoi applied earlier.

1. Delete these feature sources:

   - `dot_config/chromium/extensions/open-webapp-links/`
   - `dot_config/chromium/NativeMessagingHosts/com.jfranciscosousa.open_webapp_link.json.tmpl`
   - `dot_scripts/bin/executable_chromium-open-webapp-link-host`
   - `.chezmoiscripts/run_after_configure-chromium-webapp-links.sh.tmpl`

2. Remove the three feature-specific target rules from the conditional block in `.chezmoiignore`.
   Keep the unconditional `features/` rule if this documentation must remain repository-only.
3. Temporarily add these target paths to `.chezmoiremove`:

   ```text
   .config/chromium/extensions/open-webapp-links
   .config/chromium/NativeMessagingHosts/com.jfranciscosousa.open_webapp_link.json
   .scripts/bin/chromium-open-webapp-link-host
   ```

4. Add a temporary `.chezmoiscripts/run_once_remove-chromium-webapp-links.sh` script. It must remove
   only this extension from Chromium's comma-separated flag:

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail

   flags_file="$HOME/.config/chromium-flags.conf"
   extension_dir="$HOME/.config/chromium/extensions/open-webapp-links"

   [[ -f $flags_file ]] || exit 0

   temporary_file=$(mktemp)
   trap 'rm -f "$temporary_file"' EXIT

   awk -v remove="$extension_dir" '
     BEGIN { prefix = "--load-extension=" }
     index($0, prefix) == 1 {
       count = split(substr($0, length(prefix) + 1), paths, ",")
       value = ""
       for (i = 1; i <= count; i++) {
         if (paths[i] == remove) continue
         value = value (value == "" ? "" : ",") paths[i]
       }
       if (value != "") print prefix value
       next
     }
     { print }
   ' "$flags_file" >"$temporary_file"

   cat "$temporary_file" >"$flags_file"
   ```

5. Preview and apply the removal:

   ```bash
   chezmoi diff
   chezmoi apply
   ```

6. Close all Chromium processes. Reopen a webapp and confirm that external links stay in Chromium.
7. Remove the temporary cleanup script and the three `.chezmoiremove` entries from the source after
   the successful apply. Keep this document for future review if necessary.

To verify cleanup, confirm that these commands produce no output:

```bash
grep -F 'open-webapp-links' ~/.config/chromium-flags.conf
chezmoi managed | grep -E 'open-webapp-links|open_webapp_link|chromium-open-webapp-link-host'
```

## Security

The extension has a fixed public key and stable extension ID. The native-messaging manifest allows
only that extension ID.

The native host accepts only HTTP and HTTPS URLs. It passes the URL as one quoted argument and does
not evaluate it as shell code.
