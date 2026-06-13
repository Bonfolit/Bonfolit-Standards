# 08 — Async, Tasks & the ActionQueue

## Async conventions

- **UniTask first.** Public async APIs return `UniTask`/`UniTask<T>`;
  `System.Threading.Tasks.Task` appears at interop edges (older base classes,
  completion sources bridging callbacks).
- **Fire-and-forget is explicit.** Never leave a task dangling:
  - `something.Forget()` for UniTask,
  - `something.RunSilent()` (extension that observes faults and logs) for `Task`.
- Callback → async bridging uses completion sources with **`TrySetResult`**
  (never `SetResult` — flows can race or cancel).
- Timeouts are `UniTask.WhenAny(work, UniTask.Delay(timeout))`; on timeout resolve
  the source with a fallback value so awaiting callers always complete.
- Long boot flows live in a single `private async Task Run()` started from
  `Initialize()` with `.RunSilent()`, logging each step's duration.
- `CoroutineStarter` and `IThreadDispatcher` (main-thread dispatch) are bound in
  ProjectContext for code that must hop threads (socket callbacks → main thread).

## The task system (core lib)

Small composable units used by boot and flows:

| Type | Purpose |
|---|---|
| `BaseTask` / `BaseTask<T>` | unit of work with `OnStarted`/`OnCompleted`, `Run()` wraps `Execute()` in try/catch + logs |
| `ActionTask` | wrap a lambda |
| `WaitTask` | delay |
| `IChainTask` / `BaseChainTask` | sequential chains |
| `SerialTaskRunner` / `HardCapSerialListTaskRunner` | run lists serially (optionally time-capped) |
| `TaskFactory` | assemble common chains |

Feature flow steps that aren't network calls also live as injectable task classes
(`SwitchPlayerTask`, `InitialScenesWarmUpTask`, `UpdateHeaderTask`) — prefer a task
class over a private method when the step is reused, ordered, or needs DI.

## The ActionQueue — UI flow scheduling

The ActionQueue serializes user-facing flow (popups, tutorials, tooltips, reward
ceremonies) so only one thing happens at a time per screen.

### Concepts

```
QueueController (singleton, Root)        # owns contexts, runs at most ONE active item
 ├─ QueueContext "Home"                  # one per panel/screen
 ├─ QueueContext "Shop"
 ├─ QueueContext "Game"
 └─ QueueContext "<FeatureScene>" …
QueueItem                                # enqueued entry: id + type + QueueTask
QueueTask                                # async unit: Execute() … Complete()
 ├─ PopupTask                            # create→show→await dismiss (see 07)
 ├─ ConditionalPopupTask                 # popup gated by a predicate at run time
 ├─ ReusableQueueTask / ManualCompleteTask
QueuePriorityResolver + IQueuePriorityMapping   # priority ordering from a
                                                # ScriptableObject mapping asset
```

### Setup

Contexts are registered when the controller is created, in the Root installer's
`OnInstantiated` hook; context names are string consts in a `QueueContextType`
class (extend with a `<Game>QueueContextType` for game-specific screens). The list
of contexts that correspond to swipeable panels is bound with id
`"PanelContextTypes"`.

### Behavior contract

- Exactly **one active item** across the controller; when it completes, the current
  context dequeues the next.
- `SwitchContext(type)` deactivates everything, then activates the new context —
  called by panel/scene transitions, not by features.
- `Enqueue(contextType, itemType, task, identifier)` inserts by priority;
  `AddToFirst`/`AddToLast` bypass priority. Features mostly use `AddToFirst` for
  user-initiated popups and `Enqueue` for scheduled content.
- Items are removable (`TryRemove`), cancelable (`CancelActiveItem`), and queryable
  (`IsTaskInQueueOrActive`) — controllers keep their `QueueItem` for dedup.
- `Start()`/`Stop()` gate the whole system (e.g. during scene transitions);
  `ClearQueueContext` wipes a screen's pending flow; `OnQueueCleaned` lets features
  react.
- Every operation logs with `[QueueController]` tags; missing contexts are errors,
  not silent no-ops.

### Rules for feature authors

1. Anything that takes over the screen goes through the queue. No direct
   `popup.Show()` outside a `QueueTask`.
2. Pick the correct context — content belongs to the screen it appears on.
3. Always dedup with your stored `QueueItem` before enqueueing.
4. Auto-open content (post-level ceremonies, event intros) is enqueued from
   `IHomeAutoOpenRequestListener` / level-complete listeners with mapped priorities,
   so designers control ordering via the mapping asset, not code.
5. Tutorials use the same queue: a tutorial step is a queue item in the relevant
   context, which is what makes tutorials and popups mutually exclusive for free.
