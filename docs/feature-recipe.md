# Feature Recipe — adding a complete feature

The step-by-step playbook for adding a new feature the standard way. Follow it top to bottom; by the
end the feature is fully wired, testable, and hooked into the game through sanctioned seams only.

Example used throughout: a fictional **`DailyQuest`** live-ops feature with its own scene, an icon on
the home screen, server sync, and a reward claim.

---

## 0. Decide tier & scope

- Will other games reuse it? → put it in **`Bonfolit.Features.DailyQuest.*`** with per-layer
  `.asmdef`s (strategy A).
- Only this game? → put it under **`Bonfolit.<Game>/DailyQuest/`** and use `.asmref`s into the shared
  per-layer assemblies (strategy B). *(Most game features are B.)*

See [`assemblies-and-namespaces.md`](assemblies-and-namespaces.md).

---

## 1. Create the folder skeleton

```
DailyQuest/
  Model/
    DailyQuestModel.cs
    DailyQuestConstants.cs
    Cell/DailyQuestCellViewModel.cs        (if it has a list UI)
  View/
    DailyQuestSceneView.cs
    DailyQuestIconView.cs
    Cells/DailyQuestCell.cs
  Controller/
    DailyQuestMainController.cs
    DailyQuestSceneController.cs
    DailyQuestOpenController.cs
    DailyQuestIconController.cs
    DailyQuestNetworkController.cs
    DailyQuestRewardClaimController.cs
    DailyQuestAnalytics.cs
  Network/
    DailyQuestSyncRequestCommand.cs
    DailyQuestSyncTask.cs
    DailyQuestCacheHelper.cs
  Injection/
    DailyQuestSceneInstaller.cs            (MonoInstaller on the scene context — binds the whole feature)
    IDailyQuestAccess.cs                   (optional: accessor interface, only if a parent must reach in)
  Debug/
    DailyQuestCheatView.cs                 (#if BONFOLIT_DEV)
  Test/
    DailyQuestModelTests.cs
```

For **strategy B**, drop one `.asmref` into each subfolder pointing at the matching
`Bonfolit.<Game>.<Layer>` assembly. For **strategy A**, add a `.asmdef` per layer.

---

## 2. Model first (POCO, testable)

Write the state and rules with **no Unity types**. Include the assets the feature needs.

```csharp
namespace Bonfolit.<Game>.DailyQuest.Model
{
    public class DailyQuestModel : EventModelBase   // or your own base
    {
        public int CurrentStep { get; private set; }
        public bool IsActive => /* ... */;

        public bool TryAdvance() { /* domain logic */ }
        public override List<string> RequiredAssetKeys() =>
            new() { DailyQuestConstants.SceneAssetKey, DailyQuestConstants.ThemeKey };
    }
}
```

Write `DailyQuestModelTests` now while the logic is fresh (see [`conventions.md`](conventions.md#testing)).

---

## 3. Network (Command + Task)

One command per endpoint, a one-line task, a cache helper. See [`networking.md`](networking.md).

```csharp
public class DailyQuestSyncRequestCommand : WebResponseCommand<bool> { /* build, send, map onto model */ }
public class DailyQuestSyncTask : GenericWebRequestTask<DailyQuestSyncRequestCommand, bool> { }
```

---

## 4. View (dumb MonoBehaviour + interfaces)

Define the view interface the controller calls, and the listener interface the view calls back.

```csharp
public interface IDailyQuestSceneView
{
    void SetListener(IDailyQuestSceneListener listener);
    UniTask GenerateAsync(IReadOnlyList<DailyQuestCellViewModel> cells);
    UniTask PlayShowAsync();
}

public interface IDailyQuestSceneListener   // controller implements this
{
    void OnCloseClicked();
    void OnClaimClicked(int step);
}
```

The `DailyQuestSceneView : MonoBehaviour, IDailyQuestSceneView` renders and raises
`_listener.OnClaimClicked(step)` — nothing more.

---

## 5. Controllers (the brain)

- **`DailyQuestMainController`** — the feature's orchestrator, bound in the feature's **own context**
  (not Root). Implements its role interfaces + Zenject lifecycle + the cross-system hooks the feature
  reacts to (level results, connection state, event fetched, open-location). Owns the model, coordinates
  sub-controllers. If a parent must reach it, it registers itself upward through an accessor interface
  (§6) instead of being bound into the parent.
- **`DailyQuestSceneController`** — created when the scene opens; sets itself as the view's listener,
  registers with the MainController, builds/tears down the scene.
- Split the rest by job: `Open`, `Icon`, `Network`, `RewardClaim`, `Analytics`.

```csharp
public class DailyQuestMainController :
    IInitializable, IDisposable,
    IDailyQuestMainController,
    ILevelResultListener, IConnectionStateListener   // <-- seams into the game
{
    [Inject] private readonly DailyQuestModel _model;
    [Inject] private readonly IDailyQuestNetworkController _network;
    [Inject] private readonly IDailyQuestIconController _icon;

    public void Initialize() { _icon.SetDelegate(this); /* subscribe to signals/connection */ }
    public void Dispose()    { /* unsubscribe */ }

    public void OnLevelCompleted(LevelData data)
    {
        if (_model.IsActive && _model.TryAdvance())
            _network.TrySync().Forget();
    }
}
```

---

## 6. Injection (wire it in one place)

One **`DailyQuestSceneInstaller`** (a MonoInstaller on the feature scene's Zenject context) binds the
whole feature into its **own SceneContext** — model, every controller, network, and the view. Nothing
is bound into Root, so adding the feature touches no parent installer; you just attach this installer to
the scene's context in the Editor.

```csharp
public class DailyQuestSceneInstaller : MonoInstaller
{
    [SerializeField] private DailyQuestSceneView _sceneView;

    public override void InstallBindings()
    {
        // Orchestrator + state
        Container.BindInterfacesTo<DailyQuestMainController>().AsSingle().NonLazy();
        Container.Bind<DailyQuestModel>().AsSingle();

        // Sub-controllers
        Container.BindInterfacesTo<DailyQuestNetworkController>().AsSingle();
        Container.BindInterfacesTo<DailyQuestIconController>().AsSingle();
        Container.BindInterfacesTo<DailyQuestOpenController>().AsSingle();
        Container.Bind<DailyQuestRewardClaimController>().AsSingle();
        Container.BindInterfacesAndSelfTo<DailyQuestAnalytics>().AsSingle();

        // Network plumbing
        Container.BindInterfacesTo<DailyQuestCacheHelper>().AsSingle();
        Container.Bind<DailyQuestSyncRequestCommand>().AsSingle();
        Container.Bind<DailyQuestSyncTask>().AsSingle();

        // Scene-bound view + per-scene controller
        Container.Bind<IDailyQuestSceneView>().FromInstance(_sceneView).AsSingle();
        Container.BindInterfacesTo<DailyQuestSceneController>().AsSingle().NonLazy();
    }
}
```

**Exposing the feature to a parent (only if needed).** Don't bind the feature's classes into Root so the
game can reach them. Instead the **parent** declares an accessor interface and binds a holder for it; the
feature **registers itself upward** from its own lifecycle:

```csharp
// In the parent (e.g. Root) container — an interface the parent owns + a holder it binds:
public interface IDailyQuestAccess
{
    IDailyQuestMainController Controller { get; }   // null while the feature isn't open
    void SetController(IDailyQuestMainController controller);
    void ClearController(IDailyQuestMainController controller);
}
// RootInstaller: Container.BindInterfacesTo<DailyQuestAccess>().AsSingle();

// The feature registers upward from its own Initialize/Dispose:
public class DailyQuestMainController : IInitializable, IDisposable, IDailyQuestMainController
{
    [Inject] private readonly IDailyQuestAccess _access;
    public void Initialize() => _access.SetController(this);
    public void Dispose()    => _access.ClearController(this);
}
```

The parent depends only on `IDailyQuestAccess` (which it owns); the feature's concrete classes stay in
its container, and the handle is valid exactly while the feature is alive. Reach for this only when a
parent genuinely needs the feature — most features talk *outward* through the seams in §7, not by being
reached into.

> **Cross-scene feature?** If a feature must keep working while its *own* scene is closed — a permanent
> home-screen icon, or reacting to level results fired from the gameplay scene — those long-lived pieces
> can't live in a transient SceneContext. Bind just those pieces (the `IconController`, the long-lived
> `MainController`/`Model`) in the context that actually spans that lifetime (the home shell or Root),
> still from the feature's own installer, and keep the per-scene pieces in the scene. Everything else
> below is unchanged: the scene controller registers up, and the game reaches the feature through
> interfaces.

---

## 7. Hook into the game (the only edits outside the feature folder)

This is the whole point of the architecture — integration is a handful of explicit lines:

1. **Install the feature** — attach its `DailyQuestSceneInstaller` to its scene's Zenject context in the
   Editor. No `RootInstaller` edit (the feature lives in its own context). The one exception is a
   cross-scene feature exposing a long-lived piece upward: bind its accessor holder in `RootInstaller`
   (one line) so the feature can register into it.
2. **Level lifecycle** — make the feature react to level events through the central
   `CoreGameLevelResultListener`. A cross-scene feature registers its level listener into the aggregator
   (via the aggregator's register interface); the aggregator fans out in the order you choose. See
   [`cross-system-communication.md`](cross-system-communication.md#3-aggregator--mediator-ordered-fan-out).
3. **Home icon / footer** — register the feature's icon with the home/footer system (delegate pattern).
4. **Scene routing** — add the scene to the scene enum + the action-queue context so it can be opened.
5. **Signals** — `DeclareSignal<DailyQuestEndSignal>()` if other systems must react; fire/subscribe as needed.

> If integrating a feature touches more than these seams, that's a smell — push the coupling back
> behind an interface instead of editing core code.

---

## 8. Debug & tests

- Add a `DailyQuestCheatView` under `Debug/`, guarded by `#if BONFOLIT_DEV`, to force-advance / reset
  the feature from the in-game cheat panel.
- Cover the Model (and any tricky Controller logic) with NUnit tests + dummies.

---

## Checklist (paste into your PR)

- [ ] Feature is one folder with `Model/ View/ Controller/ Network/ Injection/` (+ `Debug/ Test/`).
- [ ] Model is POCO (no `UnityEngine`), has `RequiredAssetKeys()`, and has tests.
- [ ] View is a dumb MonoBehaviour with `IXxxView` + `IXxxSceneListener`.
- [ ] Each server call = `XxxRequestCommand` + `XxxTask`; controller owns timing; cache helper exists.
- [ ] `XxxMainController` implements only narrow role interfaces + needed cross-system hooks.
- [ ] All wiring is in `XxxSceneInstaller`; the feature's classes are bound in the feature's own context.
- [ ] Nothing feature-specific is bound into Root. A parent reaches the feature only through an accessor
      interface the feature registers itself into (cross-scene pieces excepted, per §6).
- [ ] Integration is limited to: attaching the scene installer, level-aggregator registration, icon
      registration, scene routing, signals.
- [ ] Dev tools are behind `#if BONFOLIT_DEV` in the `Debug`/`Cheat` assembly.
- [ ] Namespaces mirror folders; assemblies follow the tier's strategy (A or B).
