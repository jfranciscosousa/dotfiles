# Lightpanda

The global mise configuration installs [Lightpanda](https://github.com/lightpanda-io/browser)
release 1.0.1 through mise's GitHub backend. It selects the binary for macOS or Linux and ARM64 or
x86-64, and names the executable `lightpanda`. Each platform asset uses the SHA-256 checksum
published with the release. The Linux x86-64 binary reports `1.0.1`; the other assets have not been
execution-tested here.

After applying the configuration, run `mise install github:lightpanda-io/browser`, then
`mise exec github:lightpanda-io/browser@1.0.1 -- lightpanda version` to verify the installation. To
upgrade, update the version and platform checksums from the release assets and test the new build.
Do not disable checksum verification.

The Pi `read-url` extension requires JSON Markdown extraction and private-network blocking. The
Linux x86-64 release passed a fetch with the extension's options and returned the expected JSON
fields. Verify other platform binaries with `mise exec -- lightpanda fetch --help` before using the
extension. `LIGHTPANDA_BIN` can select a temporary executable for tests without changing the managed
version.
