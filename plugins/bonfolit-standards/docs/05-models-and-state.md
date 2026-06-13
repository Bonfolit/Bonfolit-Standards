# 05 — Models, State & Persistence

## Model conventions

Models are plain C# singletons (bound `AsSingle`) holding the authoritative state of
a feature. They are **not** DTOs: they own their transition rules.

- Expose state as read-only where possible: `public int CurrentStepIndex { get; private set; }`.
- Mutate through **intent methods**, never property soup:
  `TryToIncreaseCurrentStep()`, `LostProgress()`, `MarkAsFinished()`, `Reset()`,
  `UpdateFromNetwork(...)`, `AllStepsDidShown()`.
- Derived state is computed properties (`NextRewardStep`, `CanOpenEvent()`),
  not cached fields.
- Keep an **`IsDirty`** flag: set it on any local mutation, clear it when a server
  sync round-trips. Reconnection logic uses it to decide whether to push.
- Provide a meaningful `ToString()` (StringBuilder) dumping the key fields — sync
  and cache code logs models constantly.
- Live-ops event models derive from a shared `EventModelBase` providing
  `EventId`, `EndDate`, `UnlockingLevel`, `IsPreview`, `IsEventExpired`,
  `AreAssetsReady`, `IsEventActiveForMe()`, `RequiredAssetKeys()`.
- Event state machines are small enums with comments:

```csharp
public enum WinStreakEventState
{
    None,
    Previous, // timer expired but the user has unclaimed rewards
    Active,
    Finished  // timer expired and all rewards claimed
}
```

- Cheat-only mutators sit at the bottom of the model inside `#if BONFOLIT_DEV`.

## Persistence stack

Layered, all bound in `ProjectInstaller`:

```
IBasicDataPersistence            # typed key-value API (int/long/float/string/bool/DateTime/object)
  └─ PlayerPrefsDataPersistence  # default impl over engine prefs
  └─ DataPersistenceWithDeletionList
                                 # adds bulk-delete bookkeeping for user switch/reset
ISerializer → BinarySerializer   # object payloads; BackwardCompatibilityBinder maps
                                 # renamed/moved types so old saves keep deserializing
IFileSystem / FileSystemManager  # larger blobs on disk
DiskCache / MemoryCache<T>       # size- and TTL-bounded caches (e.g. remote images)
```

Rules:

- **Controllers never call the persistence API directly for feature state.** Each
  feature has a **CacheHelper** in its Network folder that owns its keys:

```csharp
public interface IWinStreakCacheHelper
{
    void SaveEvent();
    void SaveLostState();
    bool GetLostState();
    void Reset();
}

public class WinStreakCacheHelper : IWinStreakCacheHelper
{
    private const string WinStreakLoopLostKey = "WinStreakLoopLostKey";
    // keys are private consts, prefixed by feature name

    private readonly IDataPersistenceWithDeletionList _persistence;
    private readonly WinStreakModel _model;

    public WinStreakCacheHelper(
        IDataPersistenceWithDeletionList persistence, WinStreakModel model)
    {
        _persistence = persistence;
        _model = model;
    }
}
```

- Keys: `private const string`, feature-prefixed, never shared across classes.
- Every cache helper implements `Reset()` so user-switch can wipe feature state via
  the deletion list.
- Cached server responses go through a dedicated response-cache loader so features
  can boot from cache before the network answers (cache-then-network).

## Client state sync

Small client-side counters/flags that must survive reinstalls are mirrored to the
server through a dedicated **ClientState** system (`ClientStateController` +
read/sync commands and tasks). Use it instead of inventing per-feature endpoints for
trivial scalar state. It participates in the auth listener chain so state is read
after every successful auth.

## Time

- Never use raw system time for game logic. Inject/use the **unbiased time**
  provider chain: `UnbiasedTimeProvider : ITimeProvider` → `TimeModel.Now`.
  It cross-checks device clock tampering; countdowns (event end dates, life refill,
  hourly bonus) all compute from `TimeModel.Now`.
- `TimeService` (Root scope) layers game-facing helpers on top; bind the provider
  `WhenInjectedInto(typeof(TimeModel), typeof(TimeService))` so nothing else touches
  the raw provider.
- Persisted `DateTime` goes through the persistence API's DateTime methods, not
  string formats invented per call site.
- Server-relative durations: store `EndDate = TimeModel.Now.AddSeconds(serverSeconds - timeDiff)`
  on fetch; recompute state from `EndDate` afterwards.

## Configuration

- **Static config**: `ScriptableObject`s (`FeatureConfig`, `EconomyData`,
  queue-priority mappings) serialized on installers and bound
  `FromScriptableObject`.
- **Remote config / A-B**: a `RemoteConfigController` fetches a config payload;
  individual **`Remote<X>ConfigHandler`** classes (one per concern) parse their
  slice and push values into models. Add a handler per new remote value; never
  parse remote config inline in feature code.
- Client-side A/B assignment lives in its own controller (`ClientAbController`,
  `LocalAbSystem`) and is reported with auth params.

## Player & economy

- `PlayerModel` is the root user state; updates flow through a `PlayerModelUpdater`
  that others subscribe to rather than polling.
- Currency/economy changes go through `GameEconomyProvider`/`GameEconomyApplier` and
  reward application through a `PlayerRewardApplier` + `RewardResponseHelper`, so
  server reward payloads are applied uniformly (single choke point for analytics,
  floating text, and persistence).
