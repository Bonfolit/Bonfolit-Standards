# <Game> — Project Guide

> Template based on the **Bonfolit Unity architecture standard**. Keep this file short — it is loaded
> into context every session. Put long-form detail in `docs/` and link to it from here.
> Replace `<Game>` with the real game name and fill in the "Project-specific" section at the bottom.

## What this is

A Unity (C#) mobile game built on a **feature-based, dependency-injected** architecture. Engine:
Unity + Zenject (Extenject) for DI, UniTask for async.

## Golden rules (do not violate without discussion)

1. **No `new` on services, no singletons, no `FindObjectOfType` for app logic.** All dependencies come
   through Zenject. Construct objects by binding them in an installer and injecting them. See
   [`docs/dependency-injection.md`](docs/dependency-injection.md).
2. **Respect the layer direction.** `View → Controller → Model` and `Controller → Network/Service`.
   A `Model` never references a `Controller` or `View`. A `View` never talks to `Network`. See
   [`docs/layers.md`](docs/layers.md).
3. **Models are plain C# (POCO).** No `UnityEngine` types, no `MonoBehaviour`, no I/O. Just state +
   domain logic, unit-testable.
4. **Views are dumb `MonoBehaviour`s.** They render what they're told and raise callbacks through a
   listener interface; they hold no game logic.
5. **Every feature lives in one folder** with `Controller/ Model/ View/ Network/ Injection/` subfolders
   and is wired by exactly one installer — its `XxxSceneInstaller`, attached to the feature's own scene
   context. The feature's classes are bound there, never in a parent (Root) context; adding a feature
   should not require editing unrelated code. When a parent must reach a feature, expose an accessor
   interface from the parent and have the feature register itself upward — see
   [`docs/dependency-injection.md`](docs/dependency-injection.md#exposing-a-feature-to-a-parent-context).
6. **Async is UniTask**, not coroutines or `async void`. Fire-and-forget is explicit: `.Forget()`.
7. **Talk across features only through the sanctioned seams** (lifecycle listener interfaces, the
   SignalBus, delegate interfaces). Do not reach into another feature's controllers directly. See
   [`docs/cross-system-communication.md`](docs/cross-system-communication.md).
8. **Network calls use the Command + Task pattern.** See [`docs/networking.md`](docs/networking.md).

## Architecture map

Three assembly tiers (outer may depend on inner, never the reverse):

```
Bonfolit.Core.*          ← engine-agnostic infrastructure (audio, addressables, pooling,
                            networking primitives, panels, logging, task system, DI helpers)
Bonfolit.Features.*      ← reusable, game-agnostic features (leaderboard, missions, rewards, chest…)
Bonfolit.<Game>.*        ← THIS game: gameplay + game-specific features
```

Four nested Zenject DI contexts (child can resolve parent, never the reverse):

```
ProjectContext   → lives for whole app run, survives account switch (SDKs, network, persistence, time)
  RootContext    → per logged-in user; user-global services + accessor interfaces, NOT feature classes
    MainContext  → the main/home scene shell (header, footer, navigation)
    SceneContext → one per gameplay/feature scene; the feature (Model/controllers/View) is bound + torn
                   down here by its own installer
```

Layers inside a feature folder:

| Folder | Type | Role |
|---|---|---|
| `Model/` | POCO | State + domain logic. No Unity, no I/O. |
| `View/` | MonoBehaviour | Rendering + input callbacks via a listener interface. |
| `Controller/` | plain C# | Orchestration; owns the model, drives the view, calls network/services. |
| `Network/` | plain C# | `XxxCommand` (one request) + `XxxTask` (awaitable wrapper). |
| `Service/` | plain C# | Cross-cutting infrastructure shared by controllers. |
| `Injection/` | Installer | The single place the feature is wired into a DI context. |
| `Debug/` `Test/` | — | Cheats (behind a `#if BONFOLIT_DEV` guard) and unit tests. |

## Naming (see [`docs/conventions.md`](docs/conventions.md))

- Namespaces: `Bonfolit.<Game>.<Feature>.<Layer>` (e.g. `Bonfolit.<Game>.Shop.Controller`).
- One orchestrator per feature: `XxxMainController`. Scene logic: `XxxSceneController`.
- Network: `XxxRequestCommand` + `XxxTask`. Models: `XxxModel`. Installers: `XxxInstaller`.
- Controller roles get an interface each (`IXxxMainController`, `IXxxSceneController`, …); cross-system
  hooks are interfaces too (`ILevelResultListener`, `IConnectionStateListener`, …).
- Dev-only code is guarded by `#if BONFOLIT_DEV`. Logging goes through `BonfolitLogger` with a
  `[Feature][Class]` prefix.

## Where things go (quick lookup)

- New gameplay feature → new folder under `Bonfolit.<Game>/`, follow
  [`docs/feature-recipe.md`](docs/feature-recipe.md).
- New shared widget/util used by many features → `Bonfolit.Core.*` or a `Common` module, not inside a feature.
- New server call → a `Command` + `Task` in the feature's `Network/` folder.
- New global event other features react to → declare a Signal (see cross-system doc).
- New persistent state → a `Model` + cache helper in the feature; never `PlayerPrefs` directly from a controller.
- A parent context needs to reach a feature → an accessor interface in the parent + the feature
  registers itself upward; do **not** bind the feature's classes into Root (see DI doc).

## Reference docs
See [`docs/`](docs/) — architecture, DI, layers, cross-system communication, networking, the feature
recipe, conventions, and the tech stack. Read `docs/feature-recipe.md` before adding a feature.

---

## Project-specific (fill this in per game)

- **Game name / assembly prefix:** `Bonfolit.<Game>`
- **Dev define symbol:** `BONFOLIT_DEV` (set in Player Settings / build scripts)
- **Backend base URL / environments:** _TODO_
- **Key scenes and their context installers:** _TODO_
- **How to run / build:** _TODO_
- **Anything that deviates from the standard and why:** _TODO_
