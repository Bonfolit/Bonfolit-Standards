# Layers

Every feature is split into layers. Each has one responsibility and a strict allowed-dependency
direction. This page is the contract for each.

```
        View  ──calls methods──►  Controller  ──owns/mutates──►  Model
         ▲                            │  │
         └──raises callbacks──────────┘  ├──►  Network   (server requests)
            (via listener interface)     └──►  Service   (cross-cutting infra)
```

The golden direction: **`View → Controller → Model`**, and **`Controller → Network/Service`**.
Anything pointing the other way is wrong; fix it with an interface, not a back-reference.

---

## Model — pure state + domain logic

- **Plain C# (POCO).** No `MonoBehaviour`, no `UnityEngine` types, no I/O, no DI of services.
- Holds state and the rules that operate on it; deterministic and **unit-testable** in isolation.
- May expose a clear API (`TryToIncreaseCurrentStep()`, `UpdateEventState()`, computed properties)
  and override `ToString()` for debug logging.
- Can declare what assets it needs for Addressables: `List<string> RequiredAssetKeys()`.
- Shared base classes are fine (e.g. an `EventModelBase` for time-boxed live-ops features).

```csharp
public class WinStreakModel : EventModelBase
{
    public int CurrentStepIndex { get; private set; }
    public bool IsEventActive => EventState == WinStreakEventState.Active;

    public bool TryToIncreaseCurrentStep() { /* domain logic only */ }
    public override List<string> RequiredAssetKeys() => new() { SceneAssetKey, ThemeKey };
}
```

> If you're tempted to put a `Time.deltaTime`, a `Transform`, or a web call in a Model — stop. That
> belongs in a Controller/Service. Models stay clean so the logic can be tested without Unity.

---

## View — dumb MonoBehaviour

- A `MonoBehaviour` that **renders what it's told** and **forwards input** — no game logic, no
  decisions, no network, no model mutation.
- Exposes an interface (`IXxxView`) that the controller calls: `GenerateSceneAsync(...)`,
  `PlayAnimationsAsync(...)`, `SetData(viewModel)`.
- Raises user/UI events **back to the controller through a listener interface**, set via
  `SetListener(IXxxSceneListener)`. The controller implements that listener.

```csharp
public interface IWinStreakSceneView
{
    void SetListener(IWinStreakSceneListener listener);
    UniTask GenerateSceneAsync(IReadOnlyList<WinStreakStepModel> steps, string theme, bool introPlayed);
}
// View raises: listener.OnCloseButtonClicked();  listener.ClaimRewards();
```

- Views are bound `FromInstance(_serializedView)` in the scene installer.
- Lists/grids use the project's recycling list/adapter; cells are small Views bound to per-cell
  view-models (`XxxCellViewModel`).
- Pure presentation helpers (tween wrappers, particle sources, header binders) live alongside the View.

---

## Controller — the brain

- **Plain C#** (not a MonoBehaviour). Orchestrates: owns the Model, drives the View (through its
  interface), calls Network/Service, reacts to lifecycle and signals.
- One **`XxxMainController`** per feature is the orchestrator/facade and is the type other systems
  inject. It implements:
  - the feature's own role interfaces (`IXxxMainController`, `IXxxWarmUpController`, …),
  - Zenject lifecycle (`IInitializable`, `IDisposable`),
  - the **cross-system hook interfaces** it cares about (`ILevelResultListener`-style methods,
    `IConnectionStateListener`, an event-fetched notifier, an open-location handler, …).
- A **`XxxSceneController`** handles one scene: builds the scene via the View, handles the View's
  listener callbacks, registers itself with the MainController on construction, tears the scene down.
- Split further by responsibility, one class each (each tiny and testable):
  `XxxNetworkController`, `XxxOpenController`, `XxxIconController`, `XxxRewardClaimController`,
  `XxxTutorialController`, `XxxAssetController`, `XxxLevelResultController`, `XxxAnalytics`,
  `XxxEventDataController`.

```csharp
public class WinStreakMainController :
    IInitializable, IDisposable, IWinStreakMainController,   // own roles
    ILevelStateListener, IConnectionStateListener           // cross-system hooks
{
    [Inject] private readonly WinStreakModel _model;
    [Inject] private readonly IWinStreakNetworkController _network;
    [Inject] private readonly IWinStreakIconController _icon;

    public void Initialize() { _icon.SetDelegate(this); /* subscribe */ }

    public void OnLevelCompleted()       // called by the game's level aggregator
    {
        _model.UpdateEventState();
        if (_model.IsEventActive && _model.TryToIncreaseCurrentStep())
            Sync().Forget();
    }
}
```

**Interface-segregation principle here:** a controller implements *many small interfaces*, each
representing the slice a particular caller is allowed to use. Callers inject the narrow interface, not
the fat concrete class.

---

## Network — server I/O

Two-class pattern per request (full details in [`networking.md`](networking.md)):

- **`XxxRequestCommand`** — builds one request, sends it, maps the response onto the Model. Extends a
  `WebResponseCommand<TResponse>` base that injects the web service, credentials, host.
- **`XxxTask`** — a thin awaitable wrapper (`GenericWebRequestTask<TCommand, TResult>`) that adds a
  timeout and returns a result you can `await`.
- Plus a **`XxxCacheHelper`** / `XxxCacheStateCreator` for offline cache and a `XxxNetworkController`
  in the Controller layer that decides *when* to sync.

---

## Service — cross-cutting infrastructure

- Plain C# providers of infrastructure used by multiple controllers: caches, schedulers, platform
  wrappers, persistence helpers, config loaders.
- Bound `AsSingle()` in the appropriate context. Exposed via interface.
- Distinction from Controller: a **Service** is reusable plumbing with no feature-flow opinion; a
  **Controller** owns a feature's flow and state. If two features need it, it's probably a Service (or
  belongs in `Bonfolit.Core`/`Common`).

---

## Injection — the wiring

- One installer per feature; the only place the feature's classes are bound. See
  [`dependency-injection.md`](dependency-injection.md).

---

## Debug / Test

- **Debug/** — cheats and dev tools (`XxxCheatView`), wrapped in `#if BONFOLIT_DEV` and compiled into a
  separate `…Debug`/`…Cheat` assembly so they never ship.
- **Test/** — NUnit tests for Models and Controllers, plus dummy implementations of interfaces and a
  test DI installer to assemble the unit under test. See [`conventions.md`](conventions.md#testing).
