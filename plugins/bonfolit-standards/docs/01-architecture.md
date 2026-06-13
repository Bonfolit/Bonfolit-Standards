# 01 — Architecture

## Overview

The codebase is split into three tiers, each with its own assemblies:

```
┌─────────────────────────────────────────────────────────────┐
│ Game project        Bonfolit.<Game>.*                       │
│   Feature modules (Shop, DailyBonus, WinStreak, League, …)  │
│   Root / Project / Core (gameplay) composition              │
├─────────────────────────────────────────────────────────────┤
│ Feature library     Bonfolit.FeatureLib.*                   │
│   Reusable live-ops features (Leaderboard, Missions, Chest, │
│   Rewards, Tutorial, …) + shared Controller/Model/Network/  │
│   View building blocks (events, icons, timers, analytics)   │
├─────────────────────────────────────────────────────────────┤
│ Core library        Bonfolit.Lib.*                          │
│   Engine-level systems: ActionQueue, TaskSystem, Panel,     │
│   Popups, ViewHierarchy, Network (web/socket), Persistence, │
│   Log, Audio, Addressables, ObjectPool, UnbiasedTime, …     │
└─────────────────────────────────────────────────────────────┘
```

Dependencies point strictly downward. The core library knows nothing about features;
the feature library knows nothing about a specific game.

## Layered MVC + Services

Within every tier the code is layered. Each layer is a separate assembly (see
[02-project-structure.md](02-project-structure.md)):

| Layer | Role | Engine access |
|---|---|---|
| **Model** | State + domain rules. Plain C# classes bound `AsSingle`. | none (by convention) |
| **Controller** | Orchestration, feature logic, reacting to lifecycle events. | **forbidden** (`noEngineReferences: true`) |
| **View** | MonoBehaviours: scenes, popups, widgets, animations. | full |
| **Network** | `WebCommand` + `WebTask` pairs, cache helpers. | none |
| **Service** | Wrappers for platform/SDKs (audio, notifications, screen capture, store). | as needed |
| **Injection** | Zenject installers only. | scene refs only |
| **Cheat / Debug** | Dev-only panels and cheat hooks. | full, dev builds only |
| **Test** | NUnit tests, dummies, test installers. | editor only |

Controllers talk to Views exclusively through interfaces (`IWinStreakSceneView`),
and Views call back through delegate interfaces (`I<X>ControllerDelegate`) or events.
Because the Controller assembly cannot reference the engine, this rule is enforced by
the compiler, not by review.

## DI context hierarchy

Three Zenject context levels compose the app:

```
ProjectContext  (ProjectInstaller)        — lives for the whole process
   └── Root scene context (RootInstaller) — lives for one "user session"
          └── Feature scene contexts (XSceneInstaller) — live per additive scene
```

- **ProjectContext** owns process-wide services: HTTP/web service, serialization,
  persistence, scene loader/mediator, panel manager, signal bus, session/analytics
  managers, SDK services (attribution, push), touch input, culture setup, time model.
- **Root scene context** owns the per-user world: auth, player model and economy,
  remote config / A-B systems, purchase + shop, the ActionQueue, audio, tutorials,
  local notifications, feature main controllers, image/avatar caches.
- **Feature scene contexts** bind only what that scene needs: the scene controller and
  the scene view instance.

Two hard rules fall out of the user-switch flow (the Root scene is destroyed and
rebuilt when the account changes; ProjectContext is not):

1. **Never bind into the parent container from a child installer.**
2. **Never `LazyInject` Root-scene types into ProjectContext classes** — after a user
   switch they would point at destroyed objects.

## Boot flow

`RootController` (bound `IInitializable`, execution order pushed late so it runs after
all other initializables) drives startup as one measured async sequence:

```
RootController.Initialize()
 ├─ clean caches, start Addressables init (fire-and-forget)
 ├─ init client-side A/B groups
 ├─ await remote config from cache
 ├─ await ApplicationContext.Init()
 │    ├─ load local player (fresh-install aware)
 │    ├─ init network checker
 │    └─ start auth (awaited only on fresh install, else fire-and-forget)
 ├─ await ad-tracking / IDFA consent
 ├─ notify IRootPlayerInitListener
 ├─ load Main scene additively + warm up panel scenes in parallel
 ├─ notify scenes-ready + panels-ready listeners, open first scene
 └─ ApplicationContext.OnAppReady() — flush buffered auth/sync results
```

Every step logs its duration through a stopwatch helper; total launch time is reported
to the network logger. Keep this pattern: **boot is observable by construction**.

`ApplicationContext` is the façade for app-level state transitions (init, restart,
auth success/error, offline launch, server-forced disconnect). Results that arrive
before the UI is ready are buffered in a response buffer and flushed in `OnAppReady`.

## How systems interact (typical feature flow)

Using a streak-style live-ops event as the canonical example:

```
Server sync ──► <Feature>SyncRequestCommand ──► <Feature>Model.UpdateFromNetwork()
                                              └─► <Feature>CacheHelper.SaveEvent()
Level ends ──► I LevelStateListener.OnLevelCompleted() on <Feature>MainController
                ├─ model.TryToIncreaseCurrentStep()  (model mutates itself)
                ├─ analytics.StreakStep(...)         (feature analytics class)
                ├─ networkController.TrySyncData()   (fire-and-forget WebTask)
                └─ iconController.Update()           (home-screen icon refresh)
User taps icon ──► OpenController enqueues a PopupTask / scene switch
                   on the ActionQueue (Home context) ──► popup instantiated
                   from Addressables by PopupProvider ──► controller awaits
                   GetPopup<T>() and acts as the popup's delegate
Connection restored ──► INetworkChecker.OnConnectionStatusChangedFromTo
                        ──► main controller re-syncs dirty model state
```

The recurring shape:

- A **MainController** per feature implements the feature's public interface plus
  every lifecycle listener interface it cares about, and fans work out to focused
  sub-controllers (icon, open, tutorial, reward-claim, network, asset, data).
- **Cross-feature communication is interface-based**, resolved by DI — features
  publish capabilities (`IGameEventMainControllerNotifier`, `IEventWarmUp`,
  `IOpenLocationHandler`) and infrastructure discovers them via bound interfaces.
- **Zenject signals** are reserved for app-wide announcements (auth success,
  disconnect, app shutdown required, store open, season end) — not for chatty
  feature-to-feature messaging.

## Scene & panel model

- The app uses additive scenes: a Root scene (composition + overlays), a Main scene
  hosting swipeable camera **panels** (Home, Shop, Leaderboard, Team, …) managed by
  `PanelManager`, and per-feature scenes loaded on demand.
- `SceneLoader`/`SceneMediator` (ProjectContext) wrap engine scene management;
  switching between major scenes goes through dedicated `SwitchBetweenSceneTask`s so
  transitions (loading view, queue context switch, disposal listeners) stay uniform.
- Each panel/screen owns an ActionQueue context; switching panels switches the active
  queue context (see [08-async-and-queues.md](08-async-and-queues.md)).
