# Bonfolit Unity Architecture Standards

A reusable, opinionated standard for building **feature-based, dependency-injected Unity games**,
distilled from a large production codebase. Drop this set of docs into any fresh project to get a
consistent architecture, naming scheme, and "how to add a feature" playbook from day one.

> Naming note: throughout these docs, **`Bonfolit`** is the framework/company root namespace and
> **`<Game>`** is a placeholder for the per-project game name (e.g. `Match3`, `PuzzleGame`).
> Replace `<Game>` with your actual game name.

---

## How to use this in a fresh project

1. **Copy `CLAUDE.md` to your project root.** Claude Code auto-loads it into context every session,
   so it stays a *short, high-signal* summary of the rules. Fill in the `<Game>` placeholder and the
   "Project-specific" section.
2. **Copy the `docs/` folder** somewhere in the repo (e.g. `docs/architecture/`). These are the
   detailed references; `CLAUDE.md` links to them and they are read on demand, not every session.
3. Stand up the three assembly tiers and the four DI contexts described in
   [`docs/architecture.md`](docs/architecture.md) before writing gameplay code.
4. Add every new feature with the playbook in [`docs/feature-recipe.md`](docs/feature-recipe.md).

---

## Should this be `CLAUDE.md` or regular docs? (the recommendation)

**Use both — a thin `CLAUDE.md` at the root plus a `docs/` reference set.** Here is the reasoning so
you can adapt it:

| Concern | Goes in `CLAUDE.md` (root) | Goes in `docs/*.md` |
|---|---|---|
| Loaded into the AI's context | **Every session, automatically** | Only when explicitly opened/linked |
| Ideal length | Short (≈1 page). It costs context budget on every turn. | As long as needed |
| Content | The non-negotiable rules, the map, naming, "where does X go", pointers | Deep dives, recipes, rationale, examples |
| Audience | Both humans skimming and the AI assistant | Humans onboarding + AI when it needs detail |

Why not one giant `CLAUDE.md`? Because everything in `CLAUDE.md` is re-read on every interaction; a
2,000-line file wastes budget and buries the rules that matter. Why not *only* `docs/`? Because the
assistant won't reliably discover them unless something always-loaded points to them — that pointer is
`CLAUDE.md`.

So: `CLAUDE.md` = the always-on "constitution + index". `docs/` = the "library" it cites.

If you are **not** using Claude Code at all, the same split still works: rename `CLAUDE.md` to
`ARCHITECTURE.md` / `CONTRIBUTING.md` at the root and keep `docs/` as-is. Nothing here depends on the
tool — `CLAUDE.md` is just a conventional filename that happens to be auto-loaded.

---

## Document index

| File | What it covers |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The root template: stack, golden rules, layout map, naming, index. Copy to project root. |
| [`docs/architecture.md`](docs/architecture.md) | The big picture: 3 assembly tiers, 4 DI contexts, scene flow, the layer model. |
| [`docs/assemblies-and-namespaces.md`](docs/assemblies-and-namespaces.md) | Assembly-definition strategy (`.asmdef` vs `.asmref`), namespace rules, what may reference what. |
| [`docs/dependency-injection.md`](docs/dependency-injection.md) | Zenject/Extenject conventions: installers, binding idioms, lifecycle, execution order. |
| [`docs/layers.md`](docs/layers.md) | Responsibilities and rules for Controller / Model / View / Service / Network / Injection. |
| [`docs/cross-system-communication.md`](docs/cross-system-communication.md) | The four ways systems talk: DI, SignalBus, aggregator/mediator listeners, delegate interfaces. |
| [`docs/networking.md`](docs/networking.md) | The Command + Task request pattern, caching, sync, retries/timeouts. |
| [`docs/feature-recipe.md`](docs/feature-recipe.md) | **Start here when building.** Step-by-step playbook to add a complete feature. |
| [`docs/conventions.md`](docs/conventions.md) | Naming, async (UniTask), logging, config (ScriptableObjects), debug/cheats, tests. |
| [`docs/tech-stack.md`](docs/tech-stack.md) | The third-party libraries used and what each one is for. |

---

## The architecture in three sentences

1. The code is split into **three assembly tiers** — an engine-agnostic **Core library**, a reusable
   **Feature library**, and the **Game** — and into **layers** (Controller / Model / View / Service /
   Network / Injection) within each feature.
2. Everything is wired with **Zenject** across **four nested DI contexts** (Project → Root → Main →
   Scene), so objects never `new` their dependencies or use singletons/`FindObjectOfType`.
3. Features are self-contained folders that hook into the game through a few well-defined seams
   (lifecycle listener interfaces, a SignalBus, and delegate interfaces), so you can add or remove a
   whole feature by touching one installer.
