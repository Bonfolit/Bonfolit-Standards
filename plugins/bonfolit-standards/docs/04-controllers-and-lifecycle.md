# 04 — Controllers & Lifecycle

## Controller principles

- Controllers are **plain C# classes** (the Controller assembly has no engine
  references). They are bound `AsSingle` in an installer and constructed by DI.
- Lifecycle comes from Zenject interfaces:
  - `IInitializable.Initialize()` — subscribe to events, wire delegates.
  - `IDisposable.Dispose()` — unsubscribe everything you subscribed.
  - `ITickable` — only for genuinely frame-based logic (timers use dedicated
    ticker services instead).
- A controller that subscribes in `Initialize` **must** implement `IDisposable` and
  mirror every `+=` with a `-=`.

## The feature controller family

A non-trivial feature is decomposed into focused controllers, all bound `AsSingle`,
with one **MainController** as the orchestrator and public face:

```
<Feature>MainController        — implements the public interface + lifecycle listeners
<Feature>OpenController        — decides when/how content opens (icon tap, auto-open, deeplink)
<Feature>IconController        — home-screen icon state/timer/unlock
<Feature>NetworkController     — owns sync scheduling, wraps the WebTasks
<Feature>EventDataController   — applies fetched event payloads to the model
<Feature>AssetController       — addressable warm-up/caching for the feature
<Feature>TutorialController    — feature-specific tutorial steps
<Feature>RewardClaimController — claim flow
<Feature>SceneController       — bound in the feature scene's installer; registers
                                 itself on the MainController at scene load
```

The MainController declares its surface as a composed interface:

```csharp
public interface IWinStreakMainController : ILevelStateListener, IWinStreakRewardClaimer,
    IGameEventMainControllerNotifier, IOpenLocationHandler,
    IHomeAutoOpenRequestListener, IConnectionStateListener
{
    UniTask<bool> Sync();
    void MarkAsCompleted();
    IWinStreakAnalytics Analytics { get; }
}
```

…and the class implements that plus internal delegate interfaces:

```csharp
public class WinStreakMainController : IInitializable, IWinStreakMainController, IDisposable,
    IWinStreakMainControllerRegister, IWinStreakWarmUpController,
    IWinStreakIconControllerDelegate, IWinStreakOpenControllerDelegate
#if BONFOLIT_DEV
    , IWinStreakCheat
#endif
{ … }
```

Bind with `BindInterfacesAndSelfTo` (or `BindInterfacesTo`) so each consumer injects
only the interface slice it needs.

## Interface conventions

- **Public capability**: `I<Feature>MainController` — what other systems may call.
- **Delegate**: `I<X>ControllerDelegate` / `I<X>Delegate` — callbacks from a
  sub-controller or view up to its owner. The owner passes itself:
  `_iconController.SetDelegate(this);`
- **Registration**: `I<X>Register` — lets late-created objects (scene controllers)
  attach: `RegisterSceneController(IWinStreakSceneController sc)`.
- **Listener**: `I<Event>Listener` — implemented by anything wanting lifecycle
  notifications (below).
- **Cheat**: `I<Feature>Cheat` — compiled only under `BONFOLIT_DEV`.

Interfaces live **in the same file** as their primary implementation when small, above
the class. One concept per file otherwise.

## Lifecycle broadcasting (listener pattern)

App-level events fan out through *aggregator listeners* bound `NonLazy` in the Root
installer. The aggregator injects every interested controller and notifies them in an
explicit, ordered list — order is visible in code, not left to the container:

```csharp
public class RootSceneAuthListener : BaseAuthListener
{
    protected override string LogTag => "Root";

    private readonly IRemoteConfigController _remoteConfigController;
    private readonly IClientStateController _clientStateController;
    // ... (constructor injection — it's a plain C# class)

    public RootSceneAuthListener(
        IRemoteConfigController remoteConfigController,
        IClientStateController clientStateController /* … */)
    {
        _remoteConfigController = remoteConfigController;
        _clientStateController = clientStateController;
    }

    protected override void SubscribeListeners()
    {
        AuthListeners.Add(_firebaseIdController);
        AuthListeners.Add(_remoteConfigController);
        AuthListeners.Add(_clientStateController);
        // explicit order!
    }

    protected override void SubscribePostListeners()
    {
        AuthListeners.Add(_rootConnectionStateListener); // always last
    }
}
```

Standard listener interfaces to define in a new project:

| Interface | Fired when |
|---|---|
| `IAuthListener` | server auth succeeds / connection drops |
| `IConnectionStateListener` | network status transitions (`OnConnectionStatusChanged(from, to)`) |
| `ILevelStateListener` (`= ILevelStartAndFailListener + ILevelCompleteListener`) | gameplay level starts / fails / completes |
| `IRootPlayerInitListener` | local player loaded during boot |
| `IHomeAutoOpenRequestListener` | home screen asks features to auto-open content |
| `IEventWarmUp` (`CanWarmUp()` / `WarmUp()`) | boot-time asset warm-up window |
| `IOpenLocationHandler` | deeplink/notification routing into a feature |
| `IPeriodicCheckListener` | periodic ticker (timers, icon refresh) |

When a feature implements one of these, the behavior is always **guard first**:
check preview state, asset readiness, and event activity before doing work:

```csharp
public void OnLevelCompleted()
{
    if (_model.IsPreview || !_model.AreAssetsReady) return;
    // ... mutate model, fire analytics, schedule sync, refresh icon
}
```

## App-level façades

- **`ApplicationContext`** — owns init/restart and brokers auth/sync results.
  Errors surface through `IApplicationContextErrorDelegate`; results arriving before
  the UI exists are buffered and flushed on `OnAppReady()`.
- **`RootController`** — the boot orchestrator (see
  [01-architecture.md](01-architecture.md)); the only `IInitializable` allowed to
  kick off a long async chain from `Initialize()`.
- **Switch/restart tasks** — user switch, app restart, and scene switches are
  modeled as injectable Task classes (`SwitchPlayerTask`, `RestartAppFromRootTask`,
  `SwitchBetweenSceneTask`), not ad-hoc method calls, so flows are reusable and
  observable.

## Sub-controller communication rules

1. Parent → child: direct method calls (the parent injected the child).
2. Child → parent: delegate interface set at `Initialize` time.
3. Sibling → sibling: through the parent, or through the model they share.
4. Feature → other feature: only via published interfaces or signals — never inject
   another feature's concrete controller.
5. Anything → View: interface implemented by the view; views never reach into
   controllers except through their delegate.
6. Input → controller: gameplay input is its **own flow** — a dedicated handler
   (a plain `ITickable`, *not* a view `Update`) reads the device and reports intents
   up via a delegate interface; the controller then updates the model and directs the
   view. Control is **one-way** (input → controller → model → view): a view must never
   receive the result of an action it itself raised (no view→controller→view cycle).
   Runtime gameplay visuals are prefabs from an element factory, not geometry the view
   builds — see [07-ui-views-popups.md](07-ui-views-popups.md).
