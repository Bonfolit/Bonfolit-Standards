# bonfolit-standards (Claude Code plugin)

The single source of truth for building Bonfolit Unity mobile games with Claude.
Install this plugin in a game repo instead of copying `Bonfolit-Standards/` into it —
the standards live here and here only, so they can never silently fork.

## What's inside

| Piece | Path | What it does |
|---|---|---|
| **13 standards docs** | `docs/00…12` | Architecture & conventions — the source of truth. **Sole source**: not copied into games. |
| **Router skill** | `skills/bonfolit-standards/` | Auto-triggers on Bonfolit work; routes to the right doc and carries the 12 hard rules. |
| **Recipe skills** | `skills/{add-feature,add-popup,add-endpoint,core-system-bringup}/` | The everyday one-shots, mirroring the doc-00 recipes. |
| **/bonfolit-standards:bootstrap** | `commands/bootstrap.md` | Drives a new project through doc-00 Phase 0 → 6. |
| **/bonfolit-standards:release-check** | `commands/release-check.md` | The "before claiming done" gate. |
| **standards-auditor** | `agents/standards-auditor.md` | Read-only subagent that audits a diff against the 12 rules. |
| **Guardrail hook** | `hooks/` | PreToolUse: blocks `UnityEngine` in engine-free layers (rule 1), flags `DateTime.Now` (rule 8). |
| **Unity MCP** | `.mcp.json` | Bundles the **MCP for Unity** *server* (uvx `mcp-for-unity`). Each game also needs the Unity-side **bridge** package `com.coplaydev.unity-mcp` installed — see [Notes & gotchas](#notes--gotchas). |
| **CLAUDE template** | `templates/CLAUDE.template.md` | Stamped into each new game by `/bonfolit-standards:bootstrap`. |

## Install

```
# From the marketplace repo (this folder's parent's parent):
/plugin marketplace add "C:/Users/<you>/Documents/Projects/Bonfolit-Standards"
/plugin install bonfolit-standards@bonfolit
```

Enable it **per game repo** (it carries a Unity MCP server and Unity-specific
guardrails — you don't want those active in non-Unity projects). Once published to a
git host, point `/plugin marketplace add` at the repo URL instead of the local path.

## Using it day to day

- Just work — the **bonfolit-standards** skill triggers on Bonfolit code and routes you
  to the right doc. Say *"add a coins feature"* and the **add-feature** skill takes over.
- Gate your work with `/bonfolit-standards:release-check` before declaring done.
- Ask Claude to *"audit this diff with the standards-auditor"* before a PR.

## Notes & gotchas

- **Docs path.** Skills read the docs by relative path (`../../docs/NN-*.md`). Keep the
  `docs/`, `skills/`, `commands/`, `agents/`, `hooks/` folders siblings under the plugin root.
- **Hooks load at session start.** After editing `hooks/hooks.json` or the hook script,
  restart Claude Code; use `claude --debug` to see hook registration, and `/hooks` to
  list active hooks. The hook is Node-based (no `jq` dependency) and **fails open** —
  a malformed payload never blocks a tool.
- **Unity MCP is two halves — install both.** Driving the editor from Claude Code
  (create scenes/prefabs/contexts, read the console, run EditMode tests) needs
  CoplayDev's **MCP for Unity**:
  1. **Server (Claude side)** — bundled here in `.mcp.json`:
     `uvx --from mcpforunityserver==9.7.1 mcp-for-unity`. Requires `uvx` on PATH (else
     set an absolute path to it).
  2. **Unity-side bridge (per game)** — add the package via *Window → Package Manager →
     `+` → Add package from git URL*:

     ```
     https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main
     ```

     or add to the game's `Packages/manifest.json`:

     ```json
     "com.coplaydev.unity-mcp": "https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main"
     ```

  Keep the bridge version aligned with the server pin in `.mcp.json` (`9.7.x`). After it
  imports, run *Window → MCP for Unity → Configure All Detected Clients* so the editor
  registers with Claude Code. **Without the bridge the server has nothing to talk to**
  and reports *"No Unity Editor instances found."* It's editor tooling, not shipped game
  code — never reference it from a game asmdef.
- **Versioning.** Bump `version` in `.claude-plugin/plugin.json` when rules change; this
  is the artifact that propagates to every game — never edit rules inside a game repo.
