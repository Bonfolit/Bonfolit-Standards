# Assemblies & Namespaces

Unity compiles C# into assemblies defined by `.asmdef` files. This standard uses **two different
assembly strategies** depending on the tier, plus `.asmref` files to keep feature folders tidy.

---

## Two strategies, on purpose

### A) Library tiers (`Bonfolit.Core.*`, `Bonfolit.Features.*`) → one assembly per feature-per-layer

Reusable code gets **hard assembly boundaries**. Each module/feature defines its own `.asmdef` per
layer:

```
Bonfolit.Features.Missions.Controller   (.asmdef)
Bonfolit.Features.Missions.Model        (.asmdef)
Bonfolit.Features.Missions.View         (.asmdef)
Bonfolit.Features.Missions.Network      (.asmdef)
Bonfolit.Features.Missions.Injection    (.asmdef)
```

Why: another game must be able to depend on *exactly* `Bonfolit.Features.Missions.Model` without
dragging in the whole game. Strong boundaries = real reusability + the compiler enforces the layer
direction.

### B) The game tier (`Bonfolit.<Game>.*`) → one shared assembly per layer, joined via `.asmref`

The game itself does **not** create a new `.asmdef` for every feature. Instead it defines ~9 central
per-layer assemblies once:

```
Bonfolit.<Game>.Controller
Bonfolit.<Game>.Model
Bonfolit.<Game>.View
Bonfolit.<Game>.Service
Bonfolit.<Game>.Network
Bonfolit.<Game>.Injection
Bonfolit.<Game>.Cheat
Bonfolit.<Game>.Debug
Bonfolit.<Game>.Test
```

Then **each feature folder drops a tiny `.asmref`** that points its `Controller/` files at
`Bonfolit.<Game>.Controller`, its `Model/` files at `Bonfolit.<Game>.Model`, and so on. An `.asmref`
is a one-line file:

```json
{ "reference": "GUID:<the Bonfolit.<Game>.Controller asmdef guid>" }
```

So all `Controller` code across all game features compiles into a single `Bonfolit.<Game>.Controller`
assembly; all `Model` code into `Bonfolit.<Game>.Model`; etc.

Why: inside one game, features change together and reference each other freely (the game's
level-result aggregator injects every feature's controller). Per-feature game assemblies would mean
constant `.asmdef` edits and a tangle of inter-assembly references. The shared-per-layer scheme keeps
the **layer** boundary enforced by the compiler (Model still can't see Controller) while making
"add a feature" a zero-asmdef operation.

> Rule of thumb: **shipping a feature to other games? per-feature `.asmdef`s (strategy A). Feature only
> for this game? `.asmref` into the shared per-layer assembly (strategy B).**

---

## Folder layout that produces this

Game feature (strategy B):

```
Bonfolit.<Game>/
  WinStreak/
    Controller/   WinStreakMainController.cs, ...   + Bonfolit.<Game>.Controller.asmref
    Model/        WinStreakModel.cs, ...            + Bonfolit.<Game>.Model.asmref
    View/         WinStreakSceneView.cs, ...        + Bonfolit.<Game>.View.asmref
    Network/      WinStreakSyncCommand.cs, ...      + Bonfolit.<Game>.Network.asmref
    Injection/    WinStreakSceneInstaller.cs        + Bonfolit.<Game>.Injection.asmref
    Debug/        WinStreakCheatView.cs             + Bonfolit.<Game>.Debug.asmref
  Asmdefs/        ← the 9 central .asmdef files live here, defined once
    Controller/   Bonfolit.<Game>.Controller.asmdef
    Model/        Bonfolit.<Game>.Model.asmdef
    ...
```

Library feature (strategy A):

```
Bonfolit.Features/
  Missions/
    Controller/   ...  + Bonfolit.Features.Missions.Controller.asmdef
    Model/        ...  + Bonfolit.Features.Missions.Model.asmdef
    ...
```

---

## Assembly settings used

From the central game asmdefs (apply the same to yours):

- `"rootNamespace": "Bonfolit"` — so new files default to the right namespace root.
- `Model` assembly has **engine references on** but stays POCO by convention; **prefer
  `"noEngineReferences": true`** for Model where possible to make "no Unity in models" a compile error.
- `Controller`/`Injection` set `"noEngineReferences": true` where they are pure logic, and list
  `precompiledReferences` (DLLs like DOTween, analytics SDKs, Facebook) explicitly with
  `"overrideReferences": true`.
- `Test` assemblies reference the Unity Test Framework + the assemblies under test + a test DI installer.

---

## Namespace rules

Mirror the folder path. The namespace is **`Bonfolit.<Tier>.<Feature>.<Layer>`**:

| Tier | Namespace pattern | Example |
|---|---|---|
| Core infra | `Bonfolit.Core.<Module>` | `Bonfolit.Core.Audio`, `Bonfolit.Core.Network.Web` |
| Feature library | `Bonfolit.Features.<Feature>.<Layer>` | `Bonfolit.Features.Missions.Controller` |
| Game | `Bonfolit.<Game>.<Feature>.<Layer>` | `Bonfolit.<Game>.Shop.Model` |

Conventions:

- **Namespace = folder path.** If a file is in `Shop/Controller/`, it's in
  `Bonfolit.<Game>.Shop.Controller`. No exceptions; it makes files greppable and keeps `using`s honest.
- Keep one root (`Bonfolit`) — don't introduce parallel roots. (The source codebase had a stray
  `CoreFramework.Runtime.*` root alongside the main one; that inconsistency is a thing to avoid, not
  copy.)
- Generated/serialized data-model namespaces (FlatBuffers, etc.) are out of scope for this standard;
  keep them isolated under their own generated namespace and never hand-edit them.

---

## Dependency direction is the real contract

The assembly graph is what *enforces* the architecture. When you wire references, allow only:

```
Bonfolit.<Game>.*  ──►  Bonfolit.Features.*  ──►  Bonfolit.Core.*
        (and within a feature)  View ──► Controller ──► Model
                                Controller ──► Network/Service
```

If you find yourself wanting to add a reference that goes the wrong way (Model → Controller, Core →
Game, …), that's the signal to introduce an **interface** in the inner tier and inject the
implementation from the outer one — not to add the reference.
