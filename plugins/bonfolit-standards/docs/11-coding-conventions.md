# 11 — C# Coding Conventions

## Naming

| Element | Convention | Example |
|---|---|---|
| Namespace | `Bonfolit.<Tier>.<Feature>.<Layer>` | `Bonfolit.<Game>.WinStreak.Controller` |
| Class | PascalCase, role-suffixed | `WinStreakIconController`, `DailyBonusPopup` |
| Interface | `I` + capability | `IWinStreakCacheHelper`, `IPopupProvider` |
| Delegate interface | `I<X>Delegate` / `I<X>ControllerDelegate` | `IDailyBonusPopupControllerDelegate` |
| Listener interface | `I<Event>Listener` | `IConnectionStateListener` |
| Private field | `_camelCase` | `_winStreakModel` |
| Dependency (non-Mono) | constructor param → `private readonly _camelCase` field | `public WinStreakController(WinStreakModel model)` |
| Dependency (Mono only) | `[Inject] private readonly` field or `[Inject]` method | `[Inject] private readonly IQueueController _queueController;` |
| Protected base dependency | constructor param → `protected readonly` PascalCase | `protected readonly IWebService WebService;` |
| Serialized field | `[SerializeField] private` + `_camelCase` | `[SerializeField] private PanelSettings _panelSettings;` |
| Const | PascalCase, `Key` suffix for persistence keys | `WinStreakLoopLostKey`, `PopupKey` |
| Method | PascalCase verbs; `Try…` returns bool; `On…` handles events | `TryToIncreaseCurrentStep`, `OnLevelCompleted` |
| Async fire-and-forget call sites | `.Forget()` (UniTask) / `.RunSilent()` (Task) | `Sync().Forget();` |
| Class-role suffixes | `Controller`, `Model`, `View`, `Service`, `Task`, `WebCommand`/`RequestCommand`, `Helper`, `Provider`, `Listener`, `Installer`, `Analytics`, `Resolver`, `Applier`, `Handler` | |

## File layout

- One primary type per file; small companion interfaces/enums/delegates may share
  the file, declared **above** the class:

```csharp
public interface IDailyBonusPopupController { … }
public interface IDailyBonusPopupControllerDelegate { … }

public class DailyBonusPopupController : IDailyBonusPopupDelegate, IDailyBonusPopupController
{
    private const string PopupKey = …;

    private readonly IQueueController _queueController;            // ctor-injected deps
    private readonly IPopupProvider _popupProvider;

    private IDailyBonusPopup _popup;                              // state fields

    public DailyBonusPopupController(
        IQueueController queueController, IPopupProvider popupProvider)
    {
        _queueController = queueController;
        _popupProvider = popupProvider;
    }

    // public API → event handlers → private helpers → Log helper
}
```

> A **View** (Mono) version of the same class would instead carry
> `[SerializeField] private …` scene refs and `[Inject]` its dependencies, since
> Unity constructs it.

- Member order: consts → readonly dependency fields → (Mono only) serialized fields →
  constructor → public properties/events → private state → lifecycle
  (`Initialize`/`Dispose` or Unity messages) → public methods → handlers → private
  helpers → `Log` helper at the bottom → cheat region last.
- `#region CHEAT` + `#if BONFOLIT_DEV` for cheat members; regions otherwise used
  sparingly (grouping query overloads is fine).

## Language usage

- Modern C# is welcome: pattern matching (`from is not NetworkStatus.Connected`),
  target-typed `new()`, tuples/deconstruction from `WhenAny`, `??=`, index-from-end
  (`steps[^1]`), `var` when the type is evident.
- Prefer `readonly` everywhere it compiles; collections exposed as `IReadOnly…` or
  get-only properties initialized inline (`public List<X> Steps { get; } = new();`).
- String building in hot/log paths uses `StringBuilder` (or ZString); interpolation
  is fine for one-off logs.
- Culture: app sets invariant default culture at boot; any user-facing or persisted
  formatting passes `CultureInfo.InvariantCulture` explicitly.
- Exceptions are for programmer error; flows return `bool`/null-objects and log.
  Task runners wrap `Execute()` in try/catch and log + complete on failure.

## Comments

- Comment **why**, not what: invariants, hazards, server quirks.
- Loud banner comments are acceptable for container-level hazards (installer rules).
- Mark debt explicitly with `//TODO` (+ short reason); enum members get short
  meaning comments where names can't carry it
  (`Previous, // timer expired but unclaimed rewards`).

## Dependency hygiene

- Constructors only **capture dependencies** (assign params to `readonly` fields);
  no behavior. Classes wake up and do real work in `Initialize()`. Don't run logic,
  subscribe to events, or touch other systems from a constructor or field
  initializer beyond trivial defaults — that keeps construction order irrelevant and
  cycles detectable.
- Never `new` a dependency that has a binding; `new` is reserved for data objects,
  builders, completion sources, and queue/popup tasks.
- Views never resolve from the container; they get everything via injection at
  bind-time or `Init(...)` calls.
- Static state is reserved for true façades (`BonLogger`, `MainAudioController`,
  `TimeModel.Now`); everything else is instance state owned by the container.

## Conditional compilation

- Platform: `#if UNITY_IOS || UNITY_ANDROID` around mobile-only bindings/usings, with
  dummy fallbacks bound in `#else`.
- Dev: `BONFOLIT_DEV`; verbose logs: `BONFOLIT_LOG_VERBOSE`.
- Keep `#if` at binding/declaration granularity — avoid sprinkling defines through
  method bodies.

## Asset & address conventions

- Addressable keys and queue context names are string consts in `<X>Type` /
  `<X>Constants` classes, never inline literals.
- ScriptableObject configs are named `<Thing>Config` / `<Thing>Data` /
  `<Thing>Mapping` and live next to the feature that consumes them.
- Generated code (`Generated/` folders and assemblies) is never edited by hand.
