# 03 — Dependency Injection (Zenject)

## Installers

One `MonoInstaller` per context. Prefer the conventional installer hierarchy
(ProjectContext → Root → feature scenes) over loose helper installers:

| Installer | Context | Binds |
|---|---|---|
| `ProjectInstaller` | ProjectContext prefab | process-wide services |
| `RootInstaller` | Root scene | per-user world |
| `MainInstaller` | Main scene | main-scene controllers/views |
| `<Feature>SceneInstaller` | feature scene | scene controller + scene view |

### Keep static helper installers to a minimum

A static `SomeInstaller.Install(Container)` helper (an installer that isn't a
context's own `MonoInstaller`, called imperatively from a parent installer) is an
escape hatch, not a pattern. It hides bindings from the context that owns them and
makes the dependency surface of a context harder to read.

- **Default:** put a sub-system's bindings in a private `BindXyz()` method on the
  context installer that owns them.
- **Only** reach for a static/sub-installer when a cohesive sub-system is genuinely
  reused by more than one context, or is shipped as a self-contained framework
  module that several games install. Even then, prefer a real `Installer` /
  `MonoInstaller` added through `Container.Install<T>()` / sub-container binding over
  an ad-hoc static method.
- Never let a static helper bind into a different context than the caller's.

### Installer file conventions

- `InstallBindings()` reads like a table of contents: a flat list of one-liners plus
  calls to private `BindXyz()` methods grouped by sub-system:

```csharp
public override void InstallBindings()
{
    InitExecutionOrder();

    Container.BindInterfacesAndSelfTo<RootController>().AsSingle();
    Container.Bind<ViewHierarchyManager>().AsSingle().NonLazy();

    BindSession();
    BindAudio();
    BindActionQueue();
    BindAnalytics();
    BindAuthentication();
    BindPlayer();
    // ...
}
```

- Scene objects come in as `[SerializeField]` fields and are bound with
  `FromInstance` / `FromScriptableObject`:

```csharp
[SerializeField] private PanelSettings _panelSettings;
Container.Bind<PanelSettings>().FromScriptableObject(_panelSettings).AsSingle();
```

- Document container-level hazards loudly at the top of the installer (the original
  uses an unmissable banner comment). The two standing hazards:
  - ProjectContext bindings outlive a user switch — never let them capture
    Root-scene objects, and never use lazy injection from ProjectContext classes
    to Root types.
  - Never bind into `Container.ParentContainers` from a child installer.

## Binding patterns

| Pattern | When |
|---|---|
| `Container.BindInterfacesTo<T>().AsSingle()` | default for controllers/services consumed only via interfaces |
| `Container.BindInterfacesAndSelfTo<T>().AsSingle()` | the concrete type is also injected somewhere (models, controllers with cheat hooks) |
| `Container.Bind<T>().AsSingle()` | plain models, tasks, commands consumed concretely |
| `.NonLazy()` | anything that must exist at startup: lifecycle listeners, SDK init, periodic checkers, controllers that only subscribe to events |
| `.FromInstance(x)` | scene/serialized objects |
| `.WithId("Name")` | multiple bindings of one interface (e.g. two countdown services, named containers) |
| `.WithArguments(...)` | small config values instead of a config class |
| `.WhenInjectedInto<T>()` | scoping primitive/config values to one consumer |
| `.OnInstantiated((ctx, o) => …)` | post-construction setup that needs the instance (HTTP manager setup, queue context registration) |
| `Container.BindExecutionOrder<T>(n)` / `BindInitializableExecutionOrder<T>(n)` | order `IInitializable`s; default 0, lower = earlier. Root orchestrator runs last (e.g. 1) and late listeners at e.g. 1000 |

Constants for magic numbers: declare `private const int LateInitExecutionOrder = 1000;`
in the installer rather than inlining.

### Injection style — constructor for non-Mono, attribute for Mono

This is the single most important DI rule, and a deliberate upgrade over attribute
field injection:

**Non-Mono classes (controllers, services, models, network commands/tasks,
analytics, cache helpers) use constructor injection.** Zenject fully owns their
lifecycle, so it can build them through their constructor:

```csharp
public class WinStreakMainController : IInitializable, IDisposable
{
    private readonly IWinStreakCacheHelper _cacheHelper;
    private readonly WinStreakModel _winStreakModel;
    private readonly INetworkChecker _networkChecker;

    public WinStreakMainController(
        IWinStreakCacheHelper cacheHelper,
        WinStreakModel winStreakModel,
        INetworkChecker networkChecker)
    {
        _cacheHelper = cacheHelper;
        _winStreakModel = winStreakModel;
        _networkChecker = networkChecker;
    }
}
```

Why constructor injection is the standard:

- **No reflection** at inject time — dependencies are passed to a normal constructor.
- **Circular dependencies are compile/throw-time detectable** — a true cycle can't
  even be constructed, so it surfaces immediately instead of silently half-wiring
  fields.
- Dependencies are **`readonly` and guaranteed non-null** after construction; there
  is no "injected later" window.
- The constructor signature is the **explicit, reviewable contract** of what the
  class needs — long constructors are a visible smell pushing you to split the class.

Base classes take their dependencies through their constructor and expose them as
`protected readonly` fields, with derived classes chaining `: base(...)`.

**Mono classes (Views, MonoBehaviours, every `MonoInstaller`) use attribute
injection** — Unity, not Zenject, instantiates them, so there is no constructor for
the container to call:

```csharp
public class WinStreakSceneView : ViewBehaviour
{
    [Inject] private readonly IWinStreakSceneController _controller;   // field, or…

    [Inject]
    private void Construct(IWinStreakSceneController controller) { … }  // method inject
}
```

- MonoBehaviours are bound `FromInstance`/`FromComponentIn…` and injected by the
  container, or handed their dependencies through an explicit `Init(...)` call from
  their controller (preferred for pooled/instantiated views).
- Reserve `[Inject]` for Mono types. Seeing `[Inject]` on a field in a plain C#
  class is a sign it should be a constructor parameter instead.

## Signals

- Install the signal bus once, in `ProjectInstaller`:
  `SignalBusInstaller.Install(Container);`
- Declare signals next to the sub-system that owns them:
  `Container.DeclareSignal<AuthSuccessSignal>();`
- Use signals only for **app-wide announcements**: auth success, server disconnect,
  app shutdown required, open store, season ended.
- For feature-to-feature or framework-to-feature contracts prefer **bound listener
  interfaces** (see [04-controllers-and-lifecycle.md](04-controllers-and-lifecycle.md));
  they are discoverable, typed, and order-controllable.

## Platform-conditional bindings

Wrap platform bindings in defines and always bind a dummy fallback so consumers never
null-check:

```csharp
#if UNITY_IOS || UNITY_ANDROID
    Container.BindInterfacesTo<LocalNotificationScheduler>().AsSingle().NonLazy();
#else
    Container.BindInterfacesAndSelfTo<DummyLocalNotificationService>().AsSingle().NonLazy();
#endif
```

The same applies to dev vs. release implementations (dummy analytics caches, fake
persistence in tests).

## Container access

- Only installers and a tiny set of factories touch `DiContainer` directly. If a class
  genuinely needs the container (e.g. spawning per-context objects), bind the container
  itself with an id: `Container.Bind<DiContainer>().WithId("RootContainer").FromInstance(Container)`.
- Never service-locate from arbitrary code.
