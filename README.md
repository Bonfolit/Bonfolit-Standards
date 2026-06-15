# Bonfolit Standards

Architecture and coding standards for Unity mobile-game projects — built to start many
games from scratch. Favors **testable, engine-decoupled game logic**, **strict layering
enforced by assembly definitions**, and **DI-driven composition**.

This repository is a **Claude Code marketplace**. The standards, recipes, and guardrails
ship as the **`bonfolit-standards` plugin** ([`plugins/bonfolit-standards/`](plugins/bonfolit-standards/README.md))
— you *install* it into a game repo rather than copying a folder in. That makes this
repo the single source of truth: rules can never silently fork inside a game.

## Install into a game

Inside Claude Code, add this marketplace and install the plugin. Adding by **git URL**
is preferred — you then pick up rule changes with a plugin update instead of re-cloning:

```
/plugin marketplace add https://github.com/Bonfolit/Bonfolit-Standards
/plugin install bonfolit-standards@bonfolit
```

Or, if you have the repo cloned locally, point at your own clone path:

```
/plugin marketplace add "C:/Users/<you>/Documents/Projects/Bonfolit-Standards"
/plugin install bonfolit-standards@bonfolit
```

Enable it per Unity game repo. Then start a fresh project with
`/bonfolit-standards:bootstrap`, and gate work with `/bonfolit-standards:release-check`.
Full plugin docs: [`plugins/bonfolit-standards/README.md`](plugins/bonfolit-standards/README.md).

## For collaborators (someone shared this repo with you)

This repo is **not** a Unity project or a library you drop into your game — it's a
Claude Code marketplace that ships one plugin, `bonfolit-standards`. You install that
plugin into Claude Code, then use it from inside *your own* Unity game repos.

Prerequisites:

- **Claude Code** — the skills, `/commands`, hooks, and the `standards-auditor`
  subagent are Claude Code constructs and only work there.
- **The marketplace source** — either the git URL above (nothing to clone) or a local
  `git clone` of this repo if you prefer the local-path install.
- **Unity MCP server** (optional) — only needed for the bundled `.mcp.json` Unity
  integration; the docs, skills, and commands all work without it.
- **The Bonfolit framework, or Path B** — the standards reference shared framework
  types (`BonLogger`, ActionQueue, the Popup system, `GenericWebRequestTask`, …). If you
  don't have the Bonfolit framework package, follow **Path B** in
  [`docs/00-new-project-bootstrap.md`](plugins/bonfolit-standards/docs/00-new-project-bootstrap.md),
  which scaffolds a minimal subset in-repo. Without either, the recipes reference types
  you don't have.

Once installed and enabled in a game repo, you get `/bonfolit-standards:bootstrap`,
`/bonfolit-standards:release-check`, the `add-feature` / `add-popup` / `add-endpoint` /
`core-system-bringup` recipe skills, the `standards-auditor` subagent, and the
rule-enforcement hooks — see [What's inside the plugin](#whats-inside-the-plugin) below.

> **Migrating from the old copy-paste flow:** games used to copy `Bonfolit-Standards/`
> to their root and point `CLAUDE.md` at `Bonfolit-Standards/docs/…`. With the plugin,
> docs are sole-source here and reached through the plugin's skills — a game's `CLAUDE.md`
> keeps only the hard rules + project specifics and routes to the plugin. Delete the
> in-repo `Bonfolit-Standards/` copy once the plugin is installed and verified.

## What's inside the plugin

- **13 standards docs** — [`plugins/bonfolit-standards/docs/`](plugins/bonfolit-standards/docs/) (start at `00-new-project-bootstrap.md`).
- **Skills** — a router skill + `add-feature` / `add-popup` / `add-endpoint` / `core-system-bringup` recipes.
- **Commands** — `/bonfolit-standards:bootstrap`, `/bonfolit-standards:release-check`.
- **Subagent** — `standards-auditor` (read-only diff audit against the 12 rules).
- **Hooks** — PreToolUse guardrails for the engine-free-layer and unbiased-time rules.
- **Unity MCP** — bundled `.mcp.json`.
- **CLAUDE template** — [`templates/CLAUDE.template.md`](plugins/bonfolit-standards/templates/CLAUDE.template.md).

## Core stack

| Concern | Choice |
|---|---|
| Dependency injection | Zenject (Extenject) — `ProjectContext` → `Root` scene context → feature scene contexts |
| Async | UniTask (`Cysharp.Threading.Tasks`) + `System.Threading.Tasks` interop |
| UI animation/tweening | DOTween / PrimeTween behind an `AbstractAnimation` wrapper |
| Inspector tooling | Odin Inspector (Sirenix) |
| Asset delivery | Unity Addressables (popups, event themes, scenes) |
| HTTP | A single `WebService` wrapper around the HTTP client (Best HTTP or equivalent) |
| Logging | Central static `BonLogger` writing to console + rolling files |
| Analytics | Firebase Analytics behind per-feature analytics classes |
| Tests | NUnit (EditMode), per-layer test assemblies |

## Framework prerequisite

The standards reference shared framework types (`BonLogger`, ActionQueue, Popup system,
`GenericWebRequestTask`, …). Either import the Bonfolit framework package (**Path A**) or
let the bootstrap scaffold the minimal subset in-repo (**Path B**) — doc 00 Phase 0/5
covers both. After the first Path-B game, extract its `Lib/` into a package so every
later game is Path A.

## Versioning

This repo is the versioned artifact. When a rule changes, change it here, bump
`version` in `plugins/bonfolit-standards/.claude-plugin/plugin.json`, and let games pick
it up by updating the plugin — never fork the rules inside a game.
