# 09 — Logging & Analytics

## Logging

### The logger

A single static façade, `BonLogger`, over an `ILogger` implementation that
writes to the console and rolling log files:

```csharp
BonLogger.Info(message);
BonLogger.Warn(message);
BonLogger.Error(message);
BonLogger.Log(message, LogLevel level);
```

- Initialized once at app start with `LogSettings` (console on/off, file retention);
  disabled in batch mode; `ReadLogs()` powers the in-app feedback/report flow.
- Log files can be cleared, read back, and subscribed to (`Subscribe(Action<string>)`)
  for in-game console overlays.

### Tagging convention

Every class logs through a private helper that prefixes a stable tag — `[Feature]`
plus `[Class/Role]`:

```csharp
private static void Log(string msg, LogLevel logLevel = LogLevel.Info)
{
    BonLogger.Log($"[WinStreak][MainController]{msg}", logLevel);
}
```

- Infrastructure logs tag the system: `[QueueController]`, `[PopupProvider]`.
- Base classes provide `Log`/`LogError` that prefix `GetType().Name` automatically
  (network commands do this).
- Log **state transitions and decisions**, with values:
  `Log($"OnLevelCompleted Previous Step:{prevStep}, CurrentStep: {model.CurrentStepIndex}");`
- Failed lookups and broken invariants are `Error`; expected-but-notable skips are
  `Warn` or `Info` ("Save Skipped", "Already in queue").

### Verbosity

High-frequency logs (view hierarchy open/close, queue context registration) compile
out unless `BONFOLIT_LOG_VERBOSE` is defined:

```csharp
#if BONFOLIT_LOG_VERBOSE
    BonLogger.Info($"[ViewHierarchy] {Name} - {Id} open");
#endif
```

### Remote diagnostics

`NetworkLogger`/`INetworkLoggerService` ships key metrics and generic messages to the
backend (e.g. `LogGenericMessage("LaunchTime-MS", duration, "")`). Use it for
launch timing, payment anomalies, and rare client states you need fleet visibility on.

## Analytics

### Per-feature analytics classes

Each feature gets one analytics class, `<Feature>Analytics`, in
`Common/Controller/Analytics`, deriving from a shared `AnalyticsBase` that provides
the provider call (`LogEvent`), player context (`CurrentLevel`, `LastPlayedLevel`)
and a dev logger:

```csharp
public class WinStreakAnalytics : AnalyticsBase, IWinStreakAnalytics
{
    private readonly WinStreakModel _model;

    public WinStreakAnalytics(AnalyticsDependencies deps, WinStreakModel model)
        : base(deps)
    {
        _model = model;
    }

    public void StreakStep(bool isLose)
    {
        int level = isLose ? CurrentLevel : LastPlayedLevel;
        var parameters = new Parameter[]
        {
            new(AnalyticsParam.Level, level),
            new(AnalyticsParam.EventId, _model.EventId),
            new(AnalyticsParam.Step, _model.CurrentStepIndex),
        };
        LogEvent(AnalyticsEvent.WinStreakStreakStep, parameters);
        LogDev($"[StreakStep] level: {level}, step: {_model.CurrentStepIndex}");
    }
}
```

Rules:

- **Event and parameter names are consts** in central `AnalyticsEvent` /
  `AnalyticsParam` constants classes — no string literals at call sites.
- The analytics class reads models itself (injected); callers pass only what the
  model can't know (e.g. `isLose`).
- Every tracked event mirrors to a human-readable `LogDev` line listing all params.
- Controllers expose the feature's analytics via the main controller
  (`IWinStreakAnalytics Analytics { get; }`) when views/scenes must trigger events.
- Cross-cutting trackers (session, popup, economy, monetization, notification,
  tutorial) are their own classes bound in Root — extend those rather than logging
  app-level events from features.

### Builders for composite events

For events with many optional fields use the fluent `BaseAnalyticsBuilder`:
`Extend(key, value)` accumulates `Parameter`s and a log string; `Build()` returns
the array, `Log()` the readable form. Subclass per event family.

### Providers

The provider (Firebase) hides behind `IFirebaseAnalyticsProvider`/`AnalyticsBase` —
features never call the SDK directly. Attribution (AppsFlyer-style), push
(OneSignal-style), and crash reporting follow the same wrapper rule with their own
`Service`/`Controller` pairs and credential-sync controllers that report ids to the
backend after auth.
