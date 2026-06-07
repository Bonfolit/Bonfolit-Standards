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
    DailyQuestMainInstaller.cs             (static Install(DiContainer))
    DailyQuestSceneInstaller.cs            (MonoInstaller, holds the SceneView ref)
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

- **`DailyQuestMainController`** — long-lived (Root). Implements its role interfaces + Zenject
  lifecycle + the cross-system hooks the feature reacts to (level results, connection state, event
  fetched, open-location). Owns the model, coordinates sub-controllers.
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

**Main installer** (static) — binds the long-lived pieces; called from the game's `RootInstaller`:

```csharp
public static class DailyQuestMainInstaller
{
    public static void Install(DiContainer c)
    {
        c.BindInterfacesTo<DailyQuestMainController>().AsSingle().NonLazy();
        c.Bind<DailyQuestModel>().AsSingle();
        c.BindInterfacesTo<DailyQuestNetworkController>().AsSingle();
        c.BindInterfacesTo<DailyQuestIconController>().AsSingle();
        c.BindInterfacesTo<DailyQuestOpenController>().AsSingle();
        c.Bind<DailyQuestRewardClaimController>().AsSingle();
        c.BindInterfacesAndSelfTo<DailyQuestAnalytics>().AsSingle();
        c.BindInterfacesTo<DailyQuestCacheHelper>().AsSingle();
        c.Bind<DailyQuestSyncRequestCommand>().AsSingle();
        c.Bind<DailyQuestSyncTask>().AsSingle();
    }
}
```

**Scene installer** (MonoInstaller on the scene's Zenject context) — binds the scene-scoped pieces:

```csharp
public class DailyQuestSceneInstaller : MonoInstaller
{
    [SerializeField] private DailyQuestSceneView _sceneView;
    public override void InstallBindings()
    {
        Container.BindInterfacesTo<DailyQuestSceneController>().AsSingle();
        Container.Bind<IDailyQuestSceneView>().FromInstance(_sceneView).AsSingle();
    }
}
```

---

## 7. Hook into the game (the only edits outside the feature folder)

This is the whole point of the architecture — integration is a handful of explicit lines:

1. **Install the feature** — add one line to `RootInstaller` (`DailyQuestMainInstaller.Install(Container);`).
2. **Level lifecycle** — add the feature's `MainController` to the central
   `CoreGameLevelResultListener` fan-out (one inject + one call per level event). See
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
- [ ] All wiring is in `XxxMainInstaller` / `XxxSceneInstaller`.
- [ ] Bound in the correct DI context (long-lived → Root; scene-scoped → Scene).
- [ ] Integration is limited to: install line, level-aggregator entry, icon registration, scene
      routing, signals.
- [ ] Dev tools are behind `#if BONFOLIT_DEV` in the `Debug`/`Cheat` assembly.
- [ ] Namespaces mirror folders; assemblies follow the tier's strategy (A or B).
