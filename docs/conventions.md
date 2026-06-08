# Conventions

Naming, async, logging, configuration, dev tooling, and testing. These are the small rules that keep
the codebase consistent enough to navigate by guessing.

---

## Naming

### Namespaces
`Bonfolit.<Tier>.<Feature>.<Layer>` — the namespace **mirrors the folder path**, always. See
[`assemblies-and-namespaces.md`](assemblies-and-namespaces.md).

### Types
| Thing | Pattern | Example |
|---|---|---|
| Feature orchestrator | `XxxMainController` | `ShopMainController` |
| Scene logic | `XxxSceneController` | `WinStreakSceneController` |
| Sub-controllers (one job each) | `Xxx<Job>Controller` | `WinStreakIconController`, `WinStreakRewardClaimController` |
| Analytics | `XxxAnalytics` | `SeasonPassAnalytics` |
| Model | `XxxModel`, `XxxStepModel` | `WinStreakModel` |
| Per-cell view model | `XxxCellViewModel` | `SeasonPassProgressCellViewModel` |
| Constants | `XxxConstants` | `WinStreakConstants` |
| View (MonoBehaviour) | `XxxView`, `XxxSceneView`, `XxxCell` | `MainHeaderView` |
| Server request | `XxxRequestCommand` / `XxxWebCommand` | `WinStreakSyncRequestCommand` |
| Awaitable request wrapper | `XxxTask` | `WinStreakSyncTask` |
| Offline cache | `XxxCacheHelper`, `XxxCacheStateCreator` | `WinStreakCacheHelper` |
| Service | `XxxService` | `PurchaseService` |
| Installer | `XxxSceneInstaller` (feature, one per feature); context installers `ProjectInstaller`/`RootInstaller`/`MainInstaller` | `WinStreakSceneInstaller` |
| Signal | `XxxSignal` (struct) | `AuthSuccessSignal` |
| Cheat/dev view | `XxxCheatView` | `WinStreakCheatView` |

### Interfaces
- `I` prefix.
- **One interface per role.** A controller often implements several small interfaces, each the slice a
  particular caller may use (`IXxxMainController`, `IXxxSceneController`, `IXxxWarmUpController`, …).
  Consumers inject the **narrow** interface, never the fat concrete class.
- Cross-system hooks are interfaces too: `ILevelResultListener`, `IConnectionStateListener`,
  `IXxxProvider` (read surfaces), `IXxxDelegate` (callback surfaces), `IXxxAccess` /
  `IXxxMainControllerRegister` (parent-owned surfaces a feature registers itself into).

### Fields
- Private fields `_camelCase`. Injected fields `[Inject] private readonly IFoo _foo;`.

---

## Async — UniTask, not coroutines

- Use **UniTask** (`Cysharp.Threading.Tasks`) for all async; avoid `IEnumerator` coroutines and
  `async void`.
- Method returns `UniTask` / `UniTask<T>` (or `Task` at boundaries that require it).
- **Fire-and-forget is explicit:** `SomeAsync().Forget();` — never leave a dangling un-awaited task.
  There's also a `RunSilent()`-style helper for "run, swallow result, log errors."
- Add timeouts to anything that can hang (the network `Task` base already does — 15s default).
- Don't block (`.Result`, `.Wait()`); `await`.

---

## Logging

- Go through the central logger (`BonfolitLogger`), not `Debug.Log`.
- **Tag every message** with a `[Feature][Class]` prefix so logs are filterable:

  ```csharp
  private static void Log(string m, LogLevel l = LogLevel.Info)
      => BonfolitLogger.Log($"[WinStreak][MainController]{m}", l);
  ```

- Web commands log with `[{GetType().Name}]` automatically via the base class.
- Levels: `Info` for flow, `Error` for genuine problems. Keep hot-path spam behind verbose flags.

---

## Configuration & data

- **Tunables live in `ScriptableObject` configs**, injected via `FromScriptableObject(...)`
  (`FeatureConfig`, `EconomyData`, asset-atlas caches, priority mappings). Don't hardcode balance
  numbers in controllers.
- **Remote config / A-B**: features read overridable values through a remote-config/AB layer rather
  than baking them in, so live-ops can tune without a build.
- **Persistence** goes through the persistence/serialization services bound in Project context — never
  call `PlayerPrefs` / file I/O directly from a controller; use a `CacheHelper` that uses those
  services.
- **Asset loading** is via **Addressables**. Models declare `RequiredAssetKeys()`; an
  `XxxAssetController` warms them up before a scene opens and releases them after.

---

## Dev tooling & conditional compilation

- Editor/dev-only code is guarded by a define symbol — **`BONFOLIT_DEV`**:

  ```csharp
  #if BONFOLIT_DEV
      public void CheatAdvance(int n) { /* ... */ }
  #endif
  ```

- Cheats live in `Debug/` and compile into a separate `…Debug`/`…Cheat` assembly so they **cannot**
  ship in release.
- Platform-specific code uses the usual `#if UNITY_IOS` / `#if UNITY_ANDROID` guards (e.g. local
  notifications, IDFA), with a `Dummy…` implementation bound on other platforms so the rest of the code
  is platform-agnostic.

---

## The "Dummy" pattern

For platform/optional services, provide a `DummyXxx` implementing the same interface, bound when the
real one isn't available (other platform, tests, feature off). Callers depend only on the interface and
never branch on platform.

```csharp
#if UNITY_IOS || UNITY_ANDROID
    Container.BindInterfacesTo<LocalNotificationService>().AsSingle();
#else
    Container.BindInterfacesTo<DummyLocalNotificationService>().AsSingle();
#endif
```

---

## Testing

- **Unit tests** (NUnit, Unity Test Framework) live in `Test/` and compile into a `…Test` assembly.
- Focus on **Models** (pure logic — easy, high value) and tricky **Controllers**.
- Use **dummy implementations** of dependency interfaces (`XxxDummy`) and a **test DI installer**
  (`TestEnvironmentInstaller`) to assemble the unit under test with fakes.
- Because Models are POCO and Controllers depend on interfaces, most logic is testable headless — keep
  it that way (don't sneak Unity types into Models/Controllers).

---

## File & PR hygiene

- One top-level type per file; filename = type name.
- Keep controllers small and single-purpose; if a `MainController` grows past coordinating, split out a
  sub-controller.
- A new feature should not require editing unrelated files — only its installer plus the few documented
  integration seams ([`feature-recipe.md`](feature-recipe.md#7-hook-into-the-game-the-only-edits-outside-the-feature-folder)).
