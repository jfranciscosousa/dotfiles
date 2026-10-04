# agent-browser Chromium

On macOS machines whose hostname starts with `Remote-`, chezmoi deploys
`~/.agent-browser/config.json`. The file sets `executablePath` to `/Applications/Chromium.app`, so
agent-browser uses open-source Chromium instead of the IT-managed Google Chrome.

The file also sets `profile` to `~/.agent-browser/chromium-profile`. Cookies, logins, and storage
persist across browser restarts. Pass `--profile <path>` to use a different profile for one command.

Chromium comes from the `ungoogled-chromium` Homebrew cask. The plain `chromium` cask is disabled
because it fails the macOS Gatekeeper check. Install the cask manually:
`brew install --cask ungoogled-chromium`. If the install fails with `Permission denied`, enable App
Management for the terminal in System Settings → Privacy & Security.

The global mise configuration includes `conda:ffmpeg` for video recording. The FFmpeg package also
provides `ffprobe` for video inspection. After deploying the configuration, run
`mise install conda:ffmpeg`. Recording requires `ffmpeg` on PATH with the `libvpx` and `libx264`
encoders. Screenshots do not require FFmpeg.

Run `agent-browser doctor` to check the selected browser and recording dependencies.
