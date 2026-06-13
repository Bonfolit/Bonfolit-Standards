# 02 — Project Structure & Assemblies

## The organizing principle: feature-first, layer-second

**Folders are organized by feature (module) first, and by layer (Controller, Model,
View…) only *inside* each feature.** A large feature must live in a single,
self-contained folder — never scatter one feature's code across top-level layer
folders.

```
✅ CORRECT — feature-first              ❌ WRONG — layer-first
Game/                                   Game/
  Level/                                  Controller/
    Controller/                             LevelController.cs
    Model/                                  BlockerController.cs
    View/                                 Model/
  Blocker/                                  LevelModel.cs
    Controller/                             BlockerModel.cs
    Model/                                View/
    View/                                   LevelView.cs
                                            BlockerView.cs
```

Why this is non-negotiable:

- A feature is an **easily separable module** — you can read it, move it, delete it,
  or extract it into the framework package by relocating one folder.
- Ownership and blast radius are obvious: everything `Blocker` is under `Blocker/`.
- It is the precondition for promoting a feature to its own set of assemblies
  (see below) without reshuffling files.

The same rule nests: a very large area (e.g. the core gameplay) is itself a folder
containing sub-feature folders, each with its own layer subdirectories.

## Top-level layout

```
Assets/
  Scripts/<Game>/                 # game code — one folder per feature/module
    Project/                      # process-lifetime composition (ProjectContext)
    Root/                         # user-session composition (Root scene)
    Game/                         # core gameplay; contains sub-feature folders:
      Level/  Blocker/  Goal/ …     each with Controller/ Model/ View/ …
    Main/                         # main scene module
    Home/                         # home panel module
    Common/                       # code shared by 2+ features of this game
    DailyBonus/  Shop/  League/   # each a self-contained feature folder
      WinStreak/  Missions/ …
    Generated/                    # generated network DTOs (do not edit)
    Asmdefs/                      # assembly-definition stubs only (see below)
    Tests/                        # game-wide tests
  CoreFramework/                  # shared package (core lib + feature lib)
    Runtime/
      Lib/                        # Bonfolit.Lib core systems
      Common/                     # Bonfolit.FeatureLib shared blocks
      <Feature>/                  # reusable features (Leaderboard, Missions, Chest…)
```

Note that `Project/`, `Root/`, `Game/`, `Home/`, each live-ops feature — all are
**modules** at the same level. None of them is a layer; the layers appear one level
down, inside each.

## Feature module anatomy

Every feature folder follows the same shape — layer subfolders. Not every subfolder
is mandatory; create them when content exists:

```
<Feature>/
  Controller/     # main controller + focused sub-controllers (pure C#)
  Model/          # state, constants, enums, step/config models
  Network/        # <X>RequestCommand, <X>Task, <Feature>CacheHelper
  Service/        # platform/SDK wrappers if the feature needs them
  View/           # MonoBehaviours: scene views, popups, cells, progress bars
  Injection/      # <Feature>SceneInstaller (and .asmref files, see below)
  Cheat/ Debug/   # dev-only cheat panels/views
  Test/           # NUnit tests + dummies for this feature
```

Reusable features in the framework package also carry their own `Prefabs/`,
`Sprites/`, `Animations/`, `Scenes/` next to `Scripts/` so the whole feature can be
dropped into another game by copying one folder.

## Assembly definition strategy

Assemblies follow the same layered split, but the **`.asmdef`/`.asmref` files live
inside the feature's own layer subfolders** — the physical hierarchy stays
feature-first regardless of which option you pick. The `Asmdefs/` top-level folder
holds only the layer asmdef *definition stubs*; no game code lives there.

Pick per feature based on how separable it needs to be:

### Option A — per-feature(-per-layer) assemblies (preferred for large/separable features)

A genuinely separable feature defines its own assemblies,
`Bonfolit.<Feature>.<Layer>` (`…WinStreak.Controller`, `…WinStreak.Model`, …), in its
own folder. This is what every framework-package feature does
(`Bonfolit.FeatureLib.Leaderboard.Controller`), and it is what makes a feature an
independently compilable, liftable module. Use it for large features and anything you
might extract or ship standalone.

### Option B — shared layer assemblies + asmref (lightweight, for small game features)

Small game-specific features can avoid an assembly explosion by compiling into shared
per-layer game assemblies and joining them with an **`.asmref`** placed in the
feature's layer subfolder:

```
WinStreak/Controller/<Game>.Controller.asmref   → compiles into <Game>.Controller
WinStreak/Injection/<Game>.Injection.asmref      → compiles into <Game>.Injection
```

The shared layer assemblies are:

```
<Game>.Model   <Game>.Controller   <Game>.Network   <Game>.View
<Game>.Service <Game>.Injection    <Game>.Cheat     <Game>.Debug   <Game>.Test
```

Trade-off: fewer assemblies and faster iteration, but the feature's code is not a
separable unit at the assembly level. Because the folders are still feature-first,
you can promote an Option-B feature to Option-A later by swapping its `.asmref`
stubs for `.asmdef`s — no files move.

**Default for a new game: start every game-specific feature on Option B.** Promote
a feature to Option A when any of these become true: it grows past roughly 30
scripts, it needs its own test assembly, another feature must depend on only a
slice of it, or it is a candidate for extraction into the framework package. Don't
debate this per feature at creation time — B first, promote on evidence.

The framework package always uses Option A: its reusable features ship as
`Bonfolit.FeatureLib.<Feature>.<Layer>` assemblies (`…Leaderboard.Controller`,
`…Leaderboard.Model`, …) so a game references exactly the feature slices it uses.

### Critical asmdef settings

- `<Game>.Controller` sets **`"noEngineReferences": true`** — controllers cannot
  touch `UnityEngine`. This is the single most important structural rule; never relax
  it. Anything engine-bound belongs in View or Service.
- `rootNamespace` is set to the company prefix (`Bonfolit`).
- View/Controller assemblies list third-party `precompiledReferences` explicitly
  (DI runtime dll, analytics, tween engine) with `overrideReferences: true` on the
  Controller assembly to keep its dependency surface intentional.
- Test assemblies reference only the layers they exercise plus NUnit.

### Layer reference matrix

Allowed references (→ means "may reference"):

```
Injection  → everything (it composes)
Controller → Model, Network, Service, Lib/FeatureLib (no engine!)
View       → Model, Lib view systems (popups, view hierarchy, animation)
Network    → Model, Lib network, Generated DTOs
Service    → Model, Lib
Model      → Lib utilities, Generated DTOs only
Cheat/Debug→ anything (dev builds only)
Test       → layer under test + dummies
```

Views and Controllers never reference each other's concrete types — only interfaces
that live beside the implementing class (see
[04-controllers-and-lifecycle.md](04-controllers-and-lifecycle.md)).

## Namespaces

Namespace mirrors folder path with the company prefix:

```
Bonfolit.<Game>.<Feature>.<Layer>[.<Sub>]
Bonfolit.<Game>.WinStreak.Controller
Bonfolit.<Game>.Common.Controller.Analytics
Bonfolit.FeatureLib.Common.Network.Tasks
Bonfolit.Lib.ActionQueue.Tasks
```

- `Common/` namespaces host cross-feature game code (auth listeners, player,
  purchase, analytics constants).
- Generated network DTO namespaces live under `…Generated.Web.*` and are never
  edited by hand.

## Where things go — quick decision table

| You are writing… | It goes in… |
|---|---|
| Feature decision logic, lifecycle reactions | `<Feature>/Controller` |
| A new popup prefab script | `<Feature>/View` + addressable key in popup type constants |
| A server call | `<Feature>/Network` as Command + Task pair |
| Persisted feature state access | `<Feature>/Network/<Feature>CacheHelper` (or `Model` if pure keys) |
| A binding | The installer for the narrowest context that needs it |
| An SDK wrapper | `<Feature>/Service` or `Project/Service` |
| A cheat | `<Feature>/Cheat` or the central cheat panel, behind `BONFOLIT_DEV` |
| A pure-logic test | `<Feature>/Test` |
| Code used by 2+ features of this game | `Common/<Layer>` |
| Code useful to any game | the framework package (`FeatureLib`/`Lib`) |
