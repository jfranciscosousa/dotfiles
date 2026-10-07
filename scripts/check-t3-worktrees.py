#!/usr/bin/env python3
"""Check T3 workspace settings without deployment."""

import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def render(path, hostname, system, stdin=""):
    return subprocess.check_output(
        [
            "chezmoi", "execute-template", "--override-data",
            json.dumps({"chezmoi": {"hostname": hostname, "os": system}}),
            "--with-stdin", "--file", str(ROOT / path),
        ],
        input=stdin, text=True, cwd=ROOT,
    )


for system in ("darwin", "linux"):
    for hostname in ("personal-test", "t3code", "REMOTE", "Remote-work"):
        existing = {"unmanaged": {"keep": True}, "projectSettingsFolded": True}
        settings = json.loads(render(
            "dot_t3/userdata/modify_settings.json", hostname, system, json.dumps(existing),
        ))
        expected = "local" if hostname.startswith("Remote-") else "worktree"
        assert settings["defaultThreadEnvMode"] == expected
        assert settings["branchNamePrefix"] == "fs"
        assert settings["unmanaged"] == existing["unmanaged"]
        assert settings["projectSettingsFolded"] is True
        assert json.loads(render(
            "dot_t3/userdata/modify_settings.json", hostname, system, json.dumps(settings),
        )) == settings
        ignored = render(".chezmoiignore", hostname, system).splitlines()
        assert ".t3/**" not in ignored
        assert "t3.json" in ignored

assert json.loads((ROOT / "t3.json").read_text())["defaultThreadEnvMode"] == "local"
print("PASS: personal/server/work defaults, prefix, merge preservation, idempotency, chezmoi exception")
