# Lightpanda

The global mise configuration installs [Lightpanda](https://github.com/lightpanda-io/browser)
through mise's GitHub backend. It selects the `1.0.0` binary for macOS or Linux and ARM64 or x86-64,
and names the executable `lightpanda`.

After applying the configuration, run `mise install github:lightpanda-io/browser`, then
`lightpanda version` to verify the installation. The stable version is pinned to avoid checksum
drift from mutable nightly releases.
