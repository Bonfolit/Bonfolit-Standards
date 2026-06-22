# 00 — New Project Bootstrap (one-shot guide)

This document turns an **empty Unity project** into a Bonfolit-Standards skeleton.
It is written to be executed top-to-bottom in one session by Claude (or a human).
Each phase ends with a verifiable checkpoint — do not continue past a failing
checkpoint.

> Conventions used below: `<Game>` = PascalCase game codename (e.g. `BlockParty`).
> Replace everywhere, including asmdef names and namespaces.

---

## Phase 0 — Decisions (ask the human once, record in CLAUDE.md)

Collect these before touching files; every later step depends on them:

1. **Game codename** (`<Game>`) and company prefix (default `Bonfolit`).
2. **Unity version / render pipeline** (see doc 12 baseline).
3. **Framework source — the critical decision:**
   - **Path A (preferred):** the shared Bonfolit framework package
     (`Bonfolit.Lib` + `Bonfolit.FeatureLib`) exists as a Unity package — import
     it. All types referenced by these standards (logger, ActionQueue, Popups,
     ViewBehaviour, TaskSystem, persistence, `GenericWebRequestTask`, …) come from
     there.
   - **Path B:** no package yet — scaffold the **minimal core subset** (Phase 5
     lists it). The first game built this way *becomes* the package: extract
     `Lib/` into a package repo afterwards so the next game uses Path A.
4. **Backend now or later?** If later, bind the offline implementations
   (doc 06 §"Starting without a backend").
5. **Orientation, min OS versions, initial scene flow** (most games: Boot/Root →
   Main).

✅ **Checkpoint:** answers recorded in the project's `CLAUDE.md` (Phase 1).

---

## Phase 1 — Standards & project memory

1. Copy `Bonfolit-Standards/` to the project root (sibling of `Assets/`).
2. Copy `Bonfolit-Standards/CLAUDE.template.md` → `<project root>/CLAUDE.md`.
3. Fill every `<…>` placeholder in `CLAUDE.md` with the Phase 0 answers.

> The template is named `CLAUDE.template.md` deliberately: Claude Code auto-loads
> any `CLAUDE.md` in working directories, and the standards folder must not
> double-load as a second memory file.

✅ **Checkpoint:** `CLAUDE.md` exists at root, no placeholders left.

---

## Phase 2 — Packages & settings

Apply [12-packages-and-project-settings.md](12-packages-and-project-settings.md):

1. `manifest.json`: Unity packages table (Addressables, TMP, Test Framework,
   Mobile Notifications, 2D Sprite).
2. Core plugins: DI container, UniTask, ZString, tween library. Live-ops SDKs are
   **deferred** — bind dummies (doc 12 SDK rule).
3. Player settings: both-platforms table + the target platform's table.
4. Scripting defines: dev profile `BONFOLIT_DEV;BONFOLIT_LOG_VERBOSE`.
5. Editor iteration: enable **Enter Play Mode Options with Domain Reload disabled** (doc 12);
   ensure every core-lib static façade resets via `[RuntimeInitializeOnLoadMethod]` (hard rule 13).
6. Version-control hygiene block (gitignore, force-text, LFS).

✅ **Checkpoint:** empty project compiles on the target platform with zero errors,
defines visible in Player Settings.

---

## Phase 3 — Folder & assembly skeleton

Create (feature-first — see doc 02):

```
Assets/Scripts/<Game>/
  Asmdefs/{Model,Controller,Network,View,Service,Injection,Cheat,Test}/
  Project/{Controller,Model,Service,View,Injection}/
  Root/{Controller,Model,Service,View,Injection,Cheat}/
  Game/                      # gameplay sub-features added later
  Common/{Controller,Model,View}/
  Generated/
```

In each `Asmdefs/<Layer>/` create `<Game>.<Layer>.asmdef`. The Controller one is
the template that matters (the others differ only by name/references):

```json
{
    "name": "<Game>.Controller",
    "rootNamespace": "Bonfolit",
    "references": [ "<Game>.Model", "<Game>.Network", "<Game>.Service" ],
    "overrideReferences": true,
    "precompiledReferences": [ "Zenject-usage.dll" ],
    "autoReferenced": true,
    "noEngineReferences": true
}
```

Reference rules per layer: the matrix in doc 02. Then drop a
`<Game>.<Layer>.asmref` into each `Project/`, `Root/`, `Common/` layer subfolder:

```json
{ "reference": "<Game>.Injection" }
```

✅ **Checkpoint:** project compiles; a test script with `using UnityEngine;` placed
in any `Controller/` folder **fails** to compile (proves `noEngineReferences`),
then delete it.

---

## Phase 4 — Contexts, scenes & installers

1. **Scenes** (add to Build Settings in this order):
   - `Root.unity` — entry scene; holds the `SceneContext` with `RootInstaller`.
   - `Main.unity` — loaded additively by the root flow.
2. **ProjectContext**: create `Assets/Resources/ProjectContext.prefab` with a
   `ProjectContext` component + `ProjectInstaller`.
3. **Installer skeletons** (constructor injection everywhere — doc 03):

`Project/Injection/ProjectInstaller.cs`:

```csharp
namespace Bonfolit.<Game>.Project.Injection
{
    public class ProjectInstaller : MonoInstaller
    {
        // NEVER bind Root-scene objects here; ProjectContext survives user switch.
        public override void InstallBindings()
        {
            SignalBusInstaller.Install(Container);
            BindPersistence();
            BindTime();
            BindSceneFlow();    // SceneLoader, PanelManager (doc 07)
            BindWebServices();  // offline bindings first (doc 06)
        }
        // private BindXyz() groups…
    }
}
```

`Root/Injection/RootInstaller.cs`:

```csharp
namespace Bonfolit.<Game>.Root.Injection
{
    public class RootInstaller : MonoInstaller
    {
        public override void InstallBindings()
        {
            Container.BindExecutionOrder<RootController>(1); // boot runs last
            Container.BindInterfacesAndSelfTo<RootController>().AsSingle();
            BindActionQueue();   // contexts registered OnInstantiated (doc 08)
            BindPlayer();
            BindAnalytics();     // dummy provider until SDKs land
        }
    }
}
```

4. **RootController** — minimal boot orchestrator (doc 01 flow), logging each
   step's duration; for now it only loads `Main` additively and logs "app ready".

✅ **Checkpoint:** entering Play in `Root.unity` logs the boot sequence with
timings and loads `Main` — no exceptions.

---

## Phase 5 — Core systems bring-up (Path B only)

Path A imports all of this. Path B scaffolds the **minimal subset, in this order**
(each step compiles + has at least one EditMode test before the next):

| # | System | Minimal contents |
|---|---|---|
| 1 | `BonLogger` | static façade → console + file writer; `LogSettings`; tag convention (doc 09) |
| 2 | Persistence | `IBasicDataPersistence` + prefs impl + deletion list (doc 05) |
| 3 | Time | `ITimeProvider`, `UnbiasedTimeProvider`, `TimeModel` (doc 05) |
| 4 | TaskSystem | `BaseTask`, `ActionTask`, `WaitTask`, serial runner (doc 08) |
| 5 | ActionQueue | `QueueController`, `QueueContext`, `QueueItem`, `QueueTask`, priority resolver + mapping SO (doc 08) |
| 6 | ViewHierarchy | `ViewBehaviour` + `ViewHierarchyManager` (doc 07) |
| 7 | Popups | `IPopup`, `Popup`, `PopupProvider` (addressables), `PopupTask` (doc 07) |
| 8 | Network shape | `IWebService`, `IRemoteHost`, `AbstractWebCommand`, `WebResponseCommand<T>`, `GenericWebRequestTask`, `WebFailure`, **`WebCommandDependencies`** (bundle: web service, serialization helper, credentials model, remote host) |
| 9 | Analytics shape | `AnalyticsBase`, **`AnalyticsDependencies`** (provider + player context), `AnalyticsEvent`/`AnalyticsParam` const classes, dummy provider |

The two `…Dependencies` bundles are plain classes with ctor-injected members,
bound `AsSingle` — they exist so command/analytics subclasses chain one `base(deps)`
parameter (docs 06/09).

✅ **Checkpoint:** all nine compile, tests green, and a throwaway popup enqueued on
the Home queue context shows and dismisses in Play mode.

---

## Phase 6 — First feature + verification

Scaffold one real feature end-to-end using the recipe below (a `DailyBonus`-sized
feature is ideal). Then run the full verification list:

- [ ] Release defines profile compiles (no `BONFOLIT_DEV` leaks).
- [ ] EditMode tests green.
- [ ] Play from `Root.unity`: boot timings logged, popup flows through the queue.
- [ ] Device build (one platform) installs and boots.
- [ ] `CLAUDE.md` placeholders all resolved; decisions recorded.

---

## Recipe: adding a feature (the everyday one-shot)

For feature `<Feature>` in game `<Game>`:

1. **Folders:** `Scripts/<Game>/<Feature>/{Controller,Model,View,Network,Injection}`
   (+ `Cheat`, `Test` when needed) with the layer `.asmref`s (Option B, doc 02).
2. **Model:** `<Feature>Model` — state + intent methods + `IsDirty` (doc 05).
3. **Cache helper:** `I<Feature>CacheHelper` + impl in `Network/` owning its keys.
4. **Controller(s):** `<Feature>MainController : IInitializable, IDisposable` +
   the listener interfaces it needs (doc 04); ctor injection; sub-controllers only
   when a concern is real.
5. **Network (if any):** `<X>RequestCommand : WebResponseCommand<T>` +
   `<X>Task : GenericWebRequestTask<…>` (doc 06) — offline-stubbed if no backend.
6. **Views/popups:** views behind interfaces; popups via `PopupTask` on the right
   queue context with the dedup guard (doc 07).
7. **Analytics:** `<Feature>Analytics : AnalyticsBase` with const event names (doc 09).
8. **Bindings:** a `Bind<Feature>()` group in the owning context installer;
   scene-scoped pieces in `<Feature>SceneInstaller`.
9. **Cheat:** `I<Feature>Cheat` under `BONFOLIT_DEV` + a cheat-panel section (doc 10).
10. **Tests:** model transition tests minimum (doc 10 naming).

## Recipe: adding a popup

1. Prefab deriving `Popup` (or `ReusablePopup`), addressable address = key const
   added to `<Game>PopupType`.
2. `I<X>Popup` interface + `I<X>PopupControllerDelegate`.
3. `<X>PopupController` with the queue dedup guard (doc 07 example) — never a
   direct `Show()`.
4. Show/hide `AbstractAnimation`s serialized on the prefab.
