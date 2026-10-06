# agent-browser Chromium

On macOS machines whose hostname starts with `Remote-`, chezmoi deploys
`~/.agent-browser/config.json`. The file sets `executablePath` to `/Applications/Chromium.app`, so
agent-browser uses open-source Chromium instead of the IT-managed Google Chrome.

The file does not set a global `profile`. Each session launches its own Chromium process, and
Chromium permits only one process per profile directory. A shared profile makes a second concurrent
session fail with a `SingletonLock` error. Each session therefore uses a temporary profile.

To keep logins, use one of these:

- `--session <name> --restore` saves and restores cookies and storage per session key.
- `state save <file>` and `--state <file>` share auth state between sessions without a lock.
- `--profile ~/.agent-browser/chromium-profile` uses a persistent profile. Only one session at a
  time can use a given profile directory.

Chromium comes from the `ungoogled-chromium` Homebrew cask. The plain `chromium` cask is disabled
because it fails the macOS Gatekeeper check. Install the cask manually:
`brew install --cask ungoogled-chromium`. If the install fails with `Permission denied`, enable App
Management for the terminal in System Settings → Privacy & Security.

The global mise configuration includes `conda:ffmpeg` for video recording. The FFmpeg package also
provides `ffprobe` for video inspection. After deploying the configuration, run
`mise install conda:ffmpeg`. Recording requires `ffmpeg` on PATH with the `libvpx` and `libx264`
encoders. Screenshots do not require FFmpeg.

Run `agent-browser doctor` to check the selected browser and recording dependencies.
