# Cross-System Communication

How features and systems talk to each other **without** hard-wiring themselves together. There are
**four** sanctioned mechanisms. Pick the lightest one that fits; don't reach into another feature's
internals.

| # | Mechanism | Coupling | Ordering control | Use when |
|---|---|---|---|---|
| 1 | **DI-injected interface** | low | n/a | A needs to *read/ask* B (queries, providers). |
| 2 | **SignalBus (pub/sub)** | lowest | none | A *announces* something; 0..N others may care. |
| 3 | **Aggregator / mediator** | medium | **explicit** | The game must call many features in a defined order. |
| 4 | **Delegate / listener interface** | direct 1:1 | n/a | Two specific objects (View↔Controller, parent↔child). |

---

## 1. DI-injected interfaces (the default)

Most "A talks to B" is just A injecting an interface that B implements. The injected interface is
**narrow** — only the slice A is allowed to use.

```csharp
[Inject] private readonly IPlayerModelProvider _player;     // read player state
[Inject] private readonly IGameEconomyProvider _economy;    // read costs/rewards
[Inject] private readonly INetworkChecker _network;         // ask connection status
```

Providers (`IXxxProvider`) are the idiomatic "let other systems read my state" surface. Expose a
provider interface from the owning system; consumers inject it. No events needed for pull-style reads.

---

## 2. SignalBus — decoupled global events

Zenject's `SignalBus` is the pub/sub for "something happened, whoever cares can react." The publisher
doesn't know the subscribers.

A **signal** is a tiny struct/class:

```csharp
public struct SeasonPassEndSignal { }
public struct AuthSuccessSignal { public string UserId; }
```

**Declare** it in an installer (usually the context that owns the event):

```csharp
Container.DeclareSignal<AuthSuccessSignal>();
Container.DeclareSignal<DisconnectedSignal>();
Container.DeclareSignal<SeasonPassEndSignal>();
```

**Fire** it:

```csharp
[Inject] private readonly SignalBus _signalBus;
_signalBus.Fire(new SeasonPassEndSignal());
```

**Subscribe / unsubscribe** (subscribe in `Initialize`, unsubscribe in `Dispose`):

```csharp
public void Initialize() => _signalBus.Subscribe<AuthSuccessSignal>(OnAuthSuccess);
public void Dispose()    => _signalBus.Unsubscribe<AuthSuccessSignal>(OnAuthSuccess);
```

Use signals for: auth/connection state, account switch, app shut-down requests, "event ended",
store/review prompts — anything where the set of listeners is open-ended.

> Don't use a signal when you need a guaranteed order of reactions, or a return value — use #3 or #1.

---

## 3. Aggregator / mediator (ordered fan-out)

When the game must notify **every** feature of a core event **in a deterministic order** (e.g. level
results, where economy must apply before UI reacts), use an explicit aggregator instead of a signal.

- Define a shared hook interface the features implement:

```csharp
public interface ILevelResultListener
{
    void OnLevelStarted(LevelData data);
    void OnLevelCompleted(LevelData data);
    void OnLevelFailed(LevelData data);
}
```

- A central listener gathers every participating feature's level listener and fans out **in the order
  you choose**. Always-alive participants (player, economy) are injected directly as below; a feature
  that lives in its own context **registers** its listener into the aggregator when it comes alive
  (through a register interface), so the aggregator never depends on the feature's concrete type:

```csharp
public class CoreGameLevelResultListener : ILevelResultListener
{
    [Inject] private readonly IPlayerLevelLifecycleController _player;
    [Inject] private readonly IGameEconomyApplier _economy;
    [Inject] private readonly IWinStreakMainController _winStreak;
    [Inject] private readonly ISeasonPassMainController _seasonPass;
    [Inject] private readonly IMissionsMainController _missions;
    // ...every feature that reacts to level results

    public void OnLevelCompleted(LevelData data)
    {
        _player.OnLevelCompleted(...);     // order is intentional and reviewable
        _economy.OnLevelCompleted();
        _winStreak.OnLevelCompleted();
        _seasonPass.OnLevelCompleted();
        _missions.OnLevelCompleted();
    }
}
```

- A small **provider** can pick the right aggregator per situation (e.g. different level types):
  `ILevelResultListenerProvider.GetLevelResultListener(levelType)` returns the matching listener.

Trade-off: this listener lists every participant explicitly (it's the one file that "knows everyone").
That's the **cost you pay for guaranteed ordering and one obvious place to read the level-end flow.**
Keep it to the few truly cross-cutting moments (level start/complete/fail/quit, app foreground, sync).

---

## 4. Delegate / listener interfaces (direct 1:1)

For two specific collaborators, wire them directly with an interface — no bus, no aggregator.

- **View → Controller:** the View calls back through a listener the Controller implements.

  ```csharp
  // installer/init: view.SetListener(controller);
  // view raises:    _listener.OnCloseButtonClicked();
  ```

- **Sub-controller → owner:** a controller exposes `SetDelegate(IXxxDelegate)` and calls the delegate
  for decisions/notifications (e.g. an icon controller asking its owner "icon clicked", "timer
  expired").

  ```csharp
  _winStreakIconController.SetDelegate(this);   // 'this' implements IWinStreakIconControllerDelegate
  ```

- **Child registering with parent:** a `SceneController` registers itself with its feature's
  `MainController` on construction, so the orchestrator can drive the scene while it's open. The **same
  register-interface seam** is how a feature exposes its orchestrator *upward to a parent context*: the
  parent owns the register interface, the feature registers itself into it on `Initialize` and clears it
  on `Dispose` (see
  [`dependency-injection.md`](dependency-injection.md#exposing-a-feature-to-a-parent-context)). This is
  what keeps the feature's classes out of the parent container.

  ```csharp
  public WinStreakSceneController(IWinStreakMainControllerRegister register, ...)
      => register.RegisterSceneController(this);
  ```

---

## Choosing — a quick decision tree

```
Do I just need to read/ask B's state?            → inject B's provider interface (#1)
Am I announcing something many might react to?    → SignalBus (#2)
Must the game call many features in a set order?  → aggregator/mediator (#3)
Is it exactly two objects wired together?         → delegate/listener interface (#4)
```

## Anti-patterns

- A feature directly `Resolve`-ing or referencing another feature's **concrete** controller.
- Using a Signal where order matters (flaky, order-dependent bugs).
- Putting cross-cutting fan-out logic inside a feature instead of the central aggregator.
- Static events / `Action` fields on singletons for global state — use the SignalBus.
