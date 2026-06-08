# Architecture Overview

This is a **feature-based, dependency-injected** Unity architecture. Two ideas organize everything:

1. **Tiers & layers** decide *where code lives and what it may depend on*.
2. **DI contexts** decide *when objects exist and how they are wired*.

Get these two right and the rest of the standard follows.

---

## 1. The three assembly tiers

Code is divided into three tiers. An outer tier may depend on an inner tier; **never the reverse**.

```
┌─────────────────────────────────────────────────────────────┐
│ Bonfolit.<Game>.*   — the game                                │  ← gameplay + game features
│   ┌─────────────────────────────────────────────────────────┐│
│   │ Bonfolit.Features.*  — reusable feature library          ││  ← leaderboard, missions, rewards,
│   │   ┌─────────────────────────────────────────────────────┐││     chest, hang-challenge, …
│   │   │ Bonfolit.Core.*  — engine-agnostic infrastructure    │││  ← audio, addressables, pooling,
│   │   │                                                       │││     networking, panels/UI, logging,
│   │   └─────────────────────────────────────────────────────┘││     task system, time, DI helpers
│   └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

- **Core (`Bonfolit.Core.*`)** — the foundation. Self-contained modules with no knowledge of any game:
  ActionQueue, Addressable, Animation, Audio, Cache, Extension(s), ImageRepo, Network, ObjectPool,
  Panel, Popups, PriorityQueue, Purchase, TaskSystem, UnbiasedTime, ViewHierarchy, Log, Util, plus
  thin wrappers over SDKs (analytics, push, attribution). Each module is its own assembly.
- **Feature library (`Bonfolit.Features.*`)** — complete, game-agnostic features (e.g. a leaderboard,
  a missions system, a rewards/chest system). Each feature is split into per-layer assemblies so
  another game can pull in just the layers it needs.
- **Game (`Bonfolit.<Game>.*`)** — the actual game: the core gameplay loop plus game-specific features
  (shop, season pass, daily bonus, win streak, etc.). This tier *consumes* the two below it.

> The original codebase calls these tiers `…Lib` (core) and `…FeatureLib` (features). Under the
> Bonfolit standard prefer `Bonfolit.Core.*` and `Bonfolit.Features.*` for clarity.

See [`assemblies-and-namespaces.md`](assemblies-and-namespaces.md) for the concrete `.asmdef`/`.asmref`
mechanics — the two tiers actually use **different** assembly strategies on purpose.

---

## 2. Layers inside a feature

Every feature — in any tier — is a folder split into layers. Each layer has one job and a strict
dependency direction:

```
        View  ──calls──►  Controller  ──owns──►  Model
         ▲   callbacks        │  │
         └────(listener)──────┘  ├──►  Network   (server I/O)
                                 └──►  Service   (cross-cutting infra)
```

| Layer | Kind | May depend on | Must NOT depend on |
|---|---|---|---|
| **Model** | POCO | other models, Core utils | Controller, View, Network, Unity |
| **View** | MonoBehaviour | Model (read-only view-models), Core UI | Controller (except via listener iface), Network, Service |
| **Controller** | plain C# | Model, Network, Service, View *interfaces* | concrete Views |
| **Network** | plain C# | Model, Core.Network | View, Controller |
| **Service** | plain C# | Model, Core | View |
| **Injection** | Installer | everything in the feature | — |

Details and rules per layer: [`layers.md`](layers.md).

---

## 3. The four DI contexts (runtime scopes)

Objects live inside **nested Zenject contexts**. A child context can resolve anything from its
parents; a parent can never resolve from a child. This gives objects the right lifetime automatically.

```
ProjectContext   (whole app run; survives user/account switch)
│   SDK init, HTTP/network stack, persistence, serialization, time, the SignalBus,
│   attribution/push services, global config (ScriptableObjects)
│
└── RootContext  (per logged-in user; rebuilt on account switch)
    │   user-global state + services shared across features: player model, economy,
    │   auth/sync, audio, action queue, analytics — plus the accessor interfaces that
    │   features register themselves into. NOT individual features' controllers/models.
    │
    ├── MainContext   (the main/home scene shell)
    │       header, footer, navigation, loading screen
    │
    └── SceneContext  (one per gameplay or feature scene)
            the feature itself: its Model, controllers, and View(s) — bound by the
            feature's own installer, created and destroyed with the scene
```

Rules of thumb for **which context to bind in** — bind each thing in the *shallowest* context whose
lifetime it actually needs, and always from the owner's own installer:

- Survives account switch / one-time SDK setup → **Project**.
- Genuinely user-global state/services shared across features (player model, economy, audio) → **Root**.
- Belongs to the home shell → **Main**.
- A **feature** — its `Model`, controllers, and `View` → the feature's **own context** (normally its
  **Scene**), wired by its one `XxxSceneInstaller`. Don't bind a feature's classes into Root.

> When a parent context needs to reach a feature, don't relocate the feature's bindings upward. Expose
> an **accessor/register interface** from the parent and have the feature register itself into it (§4).
> The one exception is a feature that must keep running while its *own* scene is closed (a home-screen
> icon, cross-scene level hooks): only those long-lived pieces belong in a parent context, and they're
> still composed there by the feature's own installer and reached through interfaces — never by binding
> the feature's concrete types into core code.

> Critical Project-context rule observed in the codebase: anything bound in `ProjectContext` must be
> safe across an account switch (the Root scene is destroyed and rebuilt on switch). Don't `LazyInject`
> Root objects from Project objects, and don't bind child-container objects up into Project — those
> references would dangle after a switch.

Full binding idioms, lifecycle interfaces, and execution ordering: [`dependency-injection.md`](dependency-injection.md).

---

## 4. Scene flow & feature lifecycle

- A central **scene-switch task** moves between scenes (`Home`, gameplay, each feature scene), driven by
  a `SceneManager` + a switch params struct (`from`, `to`, whether to release the old scene, etc.).
- Scenes are loaded/released via **Addressables**; each feature declares its `RequiredAssetKeys()` on
  its model and a `XxxAssetController` warms them up before the scene opens.
- A feature is owned by its **own context** (normally its `SceneContext`): one `XxxSceneInstaller` binds
  its `Model`, the `MainController` orchestrator, and the `SceneController` together, all disposed when
  the scene closes. The `SceneController` registers with the feature's `MainController` on open.
- When a **parent** context needs a handle to the feature, the feature **registers itself upward** rather
  than being bound into the parent: the parent declares an accessor interface (e.g.
  `IXxxMainControllerRegister`) and binds a holder for it; the feature injects that interface and calls
  `SetXxxMainController(this)` in `Initialize()`, clearing it in `Dispose()`. The parent depends only on
  its own interface — never on the feature's concrete classes — and the handle is valid exactly while the
  feature is alive.

---

## 5. How a feature plugs into the game (the seams)

A feature never edits the game's core loop. Instead it *implements interfaces the game already calls*:

- **Lifecycle listeners** — e.g. `ILevelResultListener` / a feature's `OnLevelStarted/Completed/Failed`.
  A central aggregator collects every feature's listener (always-alive ones injected directly,
  own-context features registering themselves in) and fans out level events in a deterministic order.
- **SignalBus** — Zenject's pub/sub for decoupled global events (`AuthSuccessSignal`,
  `DisconnectedSignal`, `<Feature>EndSignal`, …).
- **Delegate interfaces** — direct 1:1 wiring (a View's `SetListener`, an icon controller's
  `SetDelegate`, a SceneController registering with its MainController).
- **DI itself** — most cross-feature reads are just an injected interface (`IPlayerModelProvider`,
  `IGameEconomyProvider`, `INetworkChecker`, …).

The full menu, with when to use which: [`cross-system-communication.md`](cross-system-communication.md).

---

## Why this shape

- **Testable core** — Models and Controllers are plain C#; gameplay logic is unit-tested without Unity.
- **Swap/disable features cheaply** — a feature is one folder + one installer line; turning it off is a
  one-line change, and it can't leak into others because the only links are explicit interfaces.
- **Right lifetimes for free** — the context nesting means you rarely manage object lifetime by hand;
  bind in the correct context and Zenject creates/destroys at the right time.
- **Parallel work** — teams own feature folders; the layer/tier rules keep merge conflicts and
  accidental coupling down.
