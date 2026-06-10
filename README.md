# Bonfolit Standards

A structured set of architecture and coding guidelines for Unity mobile-game projects —
designed to be a **template for starting many games from scratch**. The standard is
designed to support a large production live-ops puzzle game with modularity in mind; it 
favors **testable, engine-decoupled game logic**, **strict layering enforced by assembly
definitions**, and **DI-driven composition**.

## How to use this in a new project (one-shot)

1. Create an empty Unity project (engine baseline: doc 12).
2. Copy this `Bonfolit-Standards/` folder to the project root (sibling of `Assets/`).
3. Copy `CLAUDE.template.md` → project root as `CLAUDE.md`; it routes Claude to the
   right document per task and pins the hard rules.
4. Tell Claude: **"Follow `Bonfolit-Standards/docs/00-new-project-bootstrap.md` top to
   bottom."** Phase 0 asks the few human decisions (game name, framework source,
   backend now/later); every later phase ends in a verifiable checkpoint.
5. Day-to-day work then uses the recipes ("add a feature", "add a popup") at the
   bottom of doc 00.

**Prerequisite to know about:** the standards reference shared framework types
(`BonfolitLogger`, ActionQueue, Popup system, `GenericWebRequestTask`, …). Either
import the Bonfolit framework package (Path A) or let the bootstrap scaffold the
minimal subset in-repo (Path B) — doc 00 Phase 0/5 covers both. After the first
Path-B game, extract its `Lib/` into a package so every later game is Path A.

**Versioning:** treat this folder as a versioned artifact. When a rule changes,
change it here first, note it below, and propagate to live games deliberately —
never fork the rules silently inside one game.

## Core stack

| Concern | Choice |
|---|---|
| Dependency injection | Zenject (Extenject) — `ProjectContext` → `Root` scene context → feature scene contexts |
| Async | UniTask (`Cysharp.Threading.Tasks`) + `System.Threading.Tasks` interop |
| UI animation/tweening | DOTween / PrimeTween behind an `AbstractAnimation` wrapper |
| Inspector tooling | Odin Inspector (Sirenix) |
| Asset delivery | Unity Addressables (popups, event themes, scenes) |
| HTTP | A single `WebService` wrapper around the HTTP client (Best HTTP or equivalent) |
| Logging | Central static `BonfolitLogger` writing to console + rolling files |
| Analytics | Firebase Analytics behind per-feature analytics classes |
| Tests | NUnit (EditMode), per-layer test assemblies |

## Documents

| # | File | Contents |
|---|---|---|
| 00 | [00-new-project-bootstrap.md](docs/00-new-project-bootstrap.md) | **Start here for a fresh project** — phased setup with checkpoints + everyday recipes (add feature/popup) |
| — | [CLAUDE.template.md](CLAUDE.template.md) | Copy to project root as `CLAUDE.md` — routing table + hard rules for Claude sessions |
| 01 | [01-architecture.md](docs/01-architecture.md) | Layered architecture, DI context hierarchy, app boot flow, how systems interact |
| 02 | [02-project-structure.md](docs/02-project-structure.md) | Folder layout, feature module anatomy, assembly definitions and asmref strategy, namespaces |
| 03 | [03-dependency-injection.md](docs/03-dependency-injection.md) | Installer conventions, binding patterns, container rules, signals |
| 04 | [04-controllers-and-lifecycle.md](docs/04-controllers-and-lifecycle.md) | Controller conventions, delegate/listener interfaces, app lifecycle broadcasting |
| 05 | [05-models-and-state.md](docs/05-models-and-state.md) | Model conventions, persistence, cache helpers, time handling |
| 06 | [06-networking.md](docs/06-networking.md) | WebCommand / WebTask pattern, error handling, reconnection sync |
| 07 | [07-ui-views-popups.md](docs/07-ui-views-popups.md) | View layer, view hierarchy tracking, popup system, panel manager |
| 08 | [08-async-and-queues.md](docs/08-async-and-queues.md) | UniTask conventions, task system, the ActionQueue (UI flow scheduling) |
| 09 | [09-logging-and-analytics.md](docs/09-logging-and-analytics.md) | Logger usage and tag conventions, analytics class pattern |
| 10 | [10-cheats-debug-testing.md](docs/10-cheats-debug-testing.md) | Dev cheat system, debug panels, unit test conventions |
| 11 | [11-coding-conventions.md](docs/11-coding-conventions.md) | C# style: naming, file layout, injection style, conditional compilation |
| 12 | [12-packages-and-project-settings.md](docs/12-packages-and-project-settings.md) | Plugins/SDKs to install, Unity packages, mobile player/quality/Addressables settings, stripping/link.xml |

## The ten rules that matter most

1. **Game logic lives in plain C# controllers** — the Controller assembly compiles with
   `noEngineReferences: true`. If a controller needs the engine, it talks to a View
   through an interface.
2. **Feature-first folders.** One feature = one self-contained folder with layer
   subfolders inside it (`Controller/`, `Model/`, `View/`, `Network/`, `Injection/`,
   optionally `Service/`, `Cheat/`, `Test/`). Never organize top-level folders by
   layer. Large features get their own assemblies; small ones join shared layer
   assemblies via `.asmref` — either way the folders stay feature-first.
3. **Everything is constructed by the DI container.** Non-Mono classes (controllers,
   models, services, network commands/tasks) take dependencies through their
   **constructor** — no reflection, cycles caught immediately. Only Mono classes
   (Views, installers) use `[Inject]`. Scene objects are wired with `[SerializeField]`
   + `FromInstance`.
4. **Respect the context hierarchy.** `ProjectContext` survives user switches — never
   let it depend on Root-scene bindings. Root and feature scenes may be torn down and
   rebuilt.
5. **All user-facing flow (popups, tutorials, tooltips) goes through the ActionQueue**,
   never shown directly. One queue context per screen; priorities come from a mapping
   asset.
6. **Networking is Command + Task.** A `WebCommand` builds and sends one request and
   applies the response to the model/cache; a `WebTask` wraps it into an awaitable call
   with a timeout. Callers only see the task.
7. **Models are the single source of truth** and are engine-free. They expose intent
   methods (`TryToIncreaseCurrentStep`, `LostProgress`), keep an `IsDirty` flag, and are
   persisted through cache helpers — never directly by controllers.
8. **Every class logs through `BonfolitLogger`** with a `[Feature][Class]` tag prefix
   via a private static `Log` helper. Verbose logs sit behind `BONFOLIT_LOG_VERBOSE`.
9. **Cheats and debug UI exist only under `BONFOLIT_DEV`** and in dedicated Cheat
   assemblies; controllers expose cheat operations via a dedicated `I<Feature>Cheat`
   interface compiled conditionally.
10. **Time never comes from `DateTime.Now`.** Use the unbiased time provider through
    `TimeModel` so countdowns survive device-clock tampering.
