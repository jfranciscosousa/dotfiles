# Lightpanda

The global mise configuration installs [Lightpanda](https://github.com/lightpanda-io/browser)
through mise's GitHub backend. It selects the `nightly` binary for macOS or Linux and ARM64 or
x86-64, and names the executable `lightpanda`. Upstream currently publishes nightly binaries, not
the previously configured `1.0.0` release.

The configuration pins each platform asset by SHA-256 to the nightly uploads from 2026-10-05. The
tested Linux x86-64 binary reports `1.1.0-nightly.10071+3be033135`. Other platform assets are
checksum-pinned but have not been execution-tested here.

After applying the configuration, run `mise install github:lightpanda-io/browser`, then
`mise exec github:lightpanda-io/browser@nightly -- lightpanda version` to verify the installation.
Nightly URLs are mutable: if upstream replaces an asset, new installations fail checksum
verification rather than accept a different build. The pin does not preserve downloads that upstream
deletes. To upgrade, explicitly update the platform digests and test the new build before running
`mise install --force github:lightpanda-io/browser@nightly`. Never disable verification.

The Pi `read-url` extension requires newer CLI capabilities, including private-network blocking and
JSON Markdown extraction. Verify these with `mise exec -- lightpanda fetch --help` before using the
extension. `LIGHTPANDA_BIN` can select a temporary executable for tests without changing the managed
version.
