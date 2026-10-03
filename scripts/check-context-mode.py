#!/usr/bin/env python3
"""Check Context Mode templates without deploying files or installing packages."""

import json
import os
from pathlib import Path
import subprocess
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)


def render(path, hostname="personal-test", system="darwin", stdin=""):
    data = {"chezmoi": {"hostname": hostname, "os": system, "arch": "arm64"}}
    return subprocess.check_output(
        ["chezmoi", "execute-template", "--override-data", json.dumps(data),
         "--with-stdin", "--file", str(path)],
        input=stdin, text=True,
    )


for system in ("darwin", "linux"):
    for hostname in ("personal-test", "Remote-test"):
        work = hostname.startswith("Remote-")
        config = json.loads(render("dot_config/opencode/opencode.json.tmpl", hostname, system))
        servers = config["mcp"]["servers"]
        assert servers["context-mode"]["command"][0].endswith("/.scripts/bin/context-mode-mcp")
        assert not any("context-mode" in plugin for plugin in config["plugin"])
        assert ("linear" in servers) == work
        tools = tomllib.loads(render("dot_config/mise/config.toml.tmpl", hostname, system))["tools"]
        assert tools["npm:context-mode"]["version"] == "1.0.169"
        assert ("pi" in tools) != work
        assert ("codex" in tools) != work
        ignored = render(".chezmoiignore", hostname, system)
        assert (".pi/**" in ignored) == work
        assert (".codex/**" in ignored) == work
        installer = render(".chezmoiscripts/run_after_install-context-mode.sh.tmpl", hostname, system)
        assert ("codex plugin add" in installer) != work

cursor = json.loads(render("dot_cursor/modify_mcp.json", stdin='{"mcpServers":{"existing":{"url":"https://example.com/mcp"}}}'))
assert "existing" in cursor["mcpServers"]
codex = tomllib.loads(render("dot_codex/modify_private_config.toml", stdin='[features]\nexisting = true\n'))
assert codex["features"] == {"existing": True, "hooks": True, "plugin_hooks": True}
pi = json.loads(render("dot_pi/agent/modify_mcp.json", stdin='{"mcpServers":{"existing":{"command":"existing"}}}'))
assert "existing" in pi["mcpServers"]
assert pi["mcpServers"]["context-mode"]["env"]["CONTEXT_MODE_PLATFORM"] == "pi"

with tempfile.TemporaryDirectory(prefix="context-mode-installer-") as directory:
    root = Path(directory)
    mock = root / "codex"
    mock.write_text('''#!/usr/bin/env bash
set -euo pipefail
if [[ "$*" == "plugin list --marketplace context-mode" ]]; then
  if [[ -f "$HOME/installed" ]]; then
    printf 'context-mode@context-mode installed enabled\n'
  fi
else
  printf '%s\\n' "$*" >> "$HOME/calls"
  if [[ "$*" == "plugin add context-mode@context-mode --json" ]]; then
    touch "$HOME/installed"
  fi
fi
''')
    mock.chmod(0o755)
    env = {**os.environ, "HOME": directory, "PATH": f"{directory}:/usr/bin:/bin"}
    script = render(".chezmoiscripts/run_after_install-context-mode.sh.tmpl")
    subprocess.run(["bash"], input=script, text=True, env=env, check=True)
    calls = (root / "calls").read_text()
    assert calls.splitlines() == ["plugin marketplace add mksglu/context-mode --json", "plugin add context-mode@context-mode --json"]
    subprocess.run(["bash"], input=script, text=True, env=env, check=True)
    assert (root / "calls").read_text() == calls
    subprocess.run(["bash"], input=render(".chezmoiscripts/run_after_install-context-mode.sh.tmpl", "Remote-test"), text=True, env=env, check=True)
    assert (root / "calls").read_text() == calls

print("PASS: macOS/Linux personal/work templates, config merges, installer idempotency")
