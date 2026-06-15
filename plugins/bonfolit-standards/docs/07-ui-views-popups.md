# 07 — UI: Views, Popups, Panels

## View layer rules

- Views are MonoBehaviours in the View assembly; a view **renders state and plays
  results** the controller hands it, and forwards discrete UI events (e.g. a button
  tap) to a delegate. **No game decisions in views** — they call a delegate interface
  and let the controller decide. (Continuous/gameplay input is its own flow — see
  *Passive views & the input flow* below.)
- Views are reached from controllers only through interfaces
  (`IWinStreakSceneView`), bound `FromInstance` in the scene installer:

```csharp
public class WinStreakSceneInstaller : MonoInstaller
{
    [SerializeField] private WinStreakSceneView _sceneView;

    public override void InstallBindings()
    {
        Container.BindInterfacesTo<WinStreakSceneController>().AsSingle();
        Container.Bind<IWinStreakSceneView>().FromInstance(_sceneView).AsSingle();
    }
}
```

- Serialized fields: `[SerializeField] private Type _name;` — never public fields.
- Odin attributes (`[BoxGroup]`, presets) are encouraged for designer-facing
  inspectors.
- Reusable widgets (countdown timer, progress bar, ribbon, tooltip, floating text,
  loading circle, avatar) live in the framework's shared View assemblies — check
  there before writing a new one.

## Passive views & the input flow

A rendering view is **passive**: it renders a snapshot of state and plays the results
the controller hands it (`Render(snapshot)`, `ApplyMove(result)`, …). It does **not**
poll input, run a game loop, or decide anything.

- **Gameplay input is its own flow, never a rendering view's `Update`.** Use a
  dedicated input handler — a plain class ticked by Zenject (`ITickable`) — that reads
  the pointer / raycasts and reports *intents* to the controller through a delegate
  interface (the child→parent pattern in
  [04-controllers-and-lifecycle.md](04-controllers-and-lifecycle.md)). The controller
  then mutates the model and directs the view. This avoids the anti-pattern of a view
  that raises an action **and** receives the result of that same action — a
  view→controller→view cycle. Control is strictly one-way:
  **input → controller → model → view**.
- **Don't build gameplay geometry inside the view.** Runtime gameplay visuals (cards,
  tiles, board pieces) are **prefabs** instantiated through a factory/provider
  interface (e.g. `IBoardElementFactory`) that loads them via **Addressables** — the
  same mechanism popups use. The view only positions, tints and animates what the
  factory returns; it never `CreatePrimitive`s production content. The factory is the
  single swap point for art, addressable loading and pooling, and keeps the view free
  of asset-loading concerns.

## View hierarchy tracking

All meaningful views derive from **`ViewBehaviour`** (core lib), which registers
itself with the `ViewHierarchyManager` on `Start`/`OnDestroy` and on re-enable:

- gives the app a live tree of open views (used by tutorials/tooltips to anchor,
  by analytics to know what's on screen, by debugging to dump UI state),
- verbose open/close logging behind `BONFOLIT_LOG_VERBOSE`.

Derive popups, panels, and screen-level views from `ViewBehaviour`; tiny child
widgets can stay plain MonoBehaviours.

## Popup system

Popups are addressable prefabs implementing `IPopup`, with a base `Popup` class:

```
IPopup: Show(overlay) / Hide() / Dismiss() / DismissInstantly()
        GetShowAwaiter() / GetDismissAwaiter() / GetDataSetAwaiter()
        SetData(IPopupData) / Init(IPopupCanvas)
```

- `Popup` handles canvas-group alpha, show/hide animations (`AbstractAnimation`
  serialized refs), overlay dimming, completion sources for show/dismiss/data.
- `ReusablePopup` instances are cached by `PopupProvider`; one-shot popups are
  released back to Addressables on dismiss.
- `PopupProvider.Create(address, token)` instantiates (or reuses) under the popup
  canvas; it guards against cancellation and races (double-create destroys the
  duplicate).
- Popup keys are string consts grouped in a `<Game>PopupType` constants class; the
  key doubles as the addressable address.
- Popup data goes in as an `IPopupData` record; the controller passes itself inside
  the data as the popup's delegate.

### Showing a popup — always through the queue

Popups are **never** shown directly. The controller wraps the popup in a `PopupTask`
and enqueues it on the ActionQueue (see [08-async-and-queues.md](08-async-and-queues.md)):

```csharp
public async Task Show(long amount, IDailyBonusPopupControllerDelegate del,
    Action<bool> onQueueAdded = null)
{
    if (_queueController.IsTaskInQueueOrActive(_queueItem, QueueContextType.Home))
    {
        onQueueAdded?.Invoke(false);
        Log("Already in queue or active. Ignoring.");
        return;
    }

    var data = new DailyBonusPopupData(this, amount);
    var popupTask = new PopupTask(_popupProvider, PopupKey, data);
    _queueItem = _queueController.AddToFirst(QueueContextType.Home, popupTask);
    onQueueAdded?.Invoke(true);
    _popup = await popupTask.GetPopup<IDailyBonusPopup>();
}
```

The dedup guard (`IsTaskInQueueOrActive` on the stored `QueueItem`) is mandatory —
every popup controller keeps its last `QueueItem` and checks it before enqueueing.

`PopupTask.Execute` is the lifecycle: create → `SetData` → `await Show()` →
`await GetDismissAwaiter()` → `Complete()`. Cancel dismisses instantly.

## Panels (main screen)

> The swipeable panel strip is a **pattern, not a mandate** — it fits meta-heavy
> games with several side-by-side screens. A game with a single hub screen keeps
> `PanelManager` with one panel (or skips it) — but keeps one ActionQueue context
> per logical screen regardless, since the queue, not the panel strip, is what the
> rest of the architecture depends on.

The Main scene is a strip of **camera panels** (`CameraPanel`/`PanelBase`) — Home,
Shop, Leaderboard, Team, … — managed by `PanelManager` (ProjectContext):

- panels register/unregister themselves; the manager positions them, drives swipe
  gestures (`ISwipeManager`), transitions (`TransitionToPanel`), and disables
  off-screen panels,
- swipe blocking is first-class: `AddBlocker(string)/RemoveBlocker(string)` —
  tutorials, popups, and scene overlays push named blockers instead of toggling
  booleans,
- panel boot is part of app boot: `InitParallel()` is awaited by the root flow,
  then panels-ready listeners fire,
- each panel maps to one ActionQueue context; the queue context list bound as
  `"PanelContextTypes"` keeps panel switching and queue switching in sync.

Scaling/layout helpers (camera-size adjuster, canvas-to-camera matchers, safe-area
scalers) come from the core lib `Panel/UI` — use them rather than per-scene scripts.

## Icons (feature entry points)

Home-screen feature icons follow a shared mini-framework: `MainIconController` +
per-feature `I<Feature>IconController` handling unlock state, countdown badge
(`IconTimer`/`IconTimerService`), relocation, score fly animations, and tap →
`OpenController`. New features implement the icon controller interface instead of
hand-rolling icon logic.

## Audio, haptics, effects

- Sound: `MainAudioController` static façade over a pooled `MainAudioService`;
  user settings cached via `UserSettingsCache`; core audio routed by an injected
  `CoreAudioController`.
- One-shot UI effects (floating text, generic particles, shiny sweeps) have shared
  controllers/services in the framework — enqueue/show through them.
