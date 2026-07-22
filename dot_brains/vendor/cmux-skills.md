# Vendored cmux skills

Source: https://github.com/manaflow-ai/cmux

License: GPL-3.0-or-later

Imported with `skills` on 2026-07-22 and adapted for the shared `~/.brains/skills` directory used by
Claude Code, OpenCode, and pi.

| Skill                     | Upstream folder hash                       |
| ------------------------- | ------------------------------------------ |
| `cmux`                    | `d7b4a428df22553048a6830f4b5f3733fe1f9393` |
| `cmux-browser`            | `28865e4b535b1f62896bec4243c2661a9cce50d4` |
| `cmux-customization`      | `47bb4ea3d247fe634734674ec3d39e1224aed0e1` |
| `cmux-diagnostics`        | `bbcedcd6e38891c7a2c0493e397d2c3ddf3d8633` |
| `cmux-keyboard-shortcuts` | `2e647bed07b05ac0245997f89e4dfe4d2d8aff99` |
| `cmux-settings`           | `0ccd427f4a2ee93ce3bffcd56ee3a138f386db0a` |

Local adaptations:

- Resolve bundled helpers through `~/.brains/skills` instead of agent-specific directories.
- Remove links to cmux skills that are not part of the curated set.
- Keep helper discovery independent of a cmux source checkout and Git.
