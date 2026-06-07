# Dependency Injection (Zenject / Extenject)

Everything is wired with **Zenject (Extenject)**. No service is `new`-ed, no singleton is used for app
logic, and `FindObjectOfType` is not how objects find each other. If object A needs object B, A
declares it as a dependency and an **installer** binds B.

---

## Installers

An installer is the one place a feature/system declares its bindings.

Two forms are used:

### 1. `MonoInstaller` (when you need scene/prefab references)

Attached to a Zenject Context (Project / Scene). Can hold `[SerializeField]` references to scene
objects, prefabs and ScriptableObjects.

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

### 2. Static installer method (when you're composing into a parent container)

For features installed from another installer (no MonoBehaviour needed):

```csharp
public static class SeasonPassMainInstaller
{
    public static void Install(DiContainer container)
    {
        container.BindInterfacesTo<SeasonPassMainController>().AsSingle().NonLazy();
        container.Bind<SeasonPassMainModel>().AsSingle();
        container.BindInterfacesTo<SeasonPassNetworkController>().AsSingle();
        // ... all of the feature's bindings in one method
    }
}
```

Called from the parent: `SeasonPassMainInstaller.Install(Container);`

**Keep the big context installers (`RootInstaller`) readable** by grouping bindings into
`private void BindX()` methods (`BindPlayer()`, `BindShop()`, `BindAudio()`, …) and calling them in
order from `InstallBindings()`.

---

## Binding idioms (the vocabulary you'll actually use)

| Idiom | Meaning / when |
|---|---|
| `Container.Bind<T>().AsSingle()` | One shared instance of `T`. |
| `Container.BindInterfacesTo<T>().AsSingle()` | Bind `T`'s **interfaces only** (consumers depend on `IT`, not `T`). Default choice. |
| `Container.BindInterfacesAndSelfTo<T>().AsSingle()` | Bind interfaces **and** the concrete type (when something needs the concrete). |
| `.NonLazy()` | Create immediately at context start (needed for `IInitializable`, listeners, services that must boot). |
| `.FromInstance(obj)` | Use an existing object (scene ref, already-constructed). |
| `.FromScriptableObject(so)` | Bind a ScriptableObject config asset. |
| `.FromNewComponentOnNewGameObject()` | Create a MonoBehaviour on a fresh GameObject. |
| `.WithId("name")` | Named binding when two of the same type exist (`Bind<IX>().WithId("A")` / resolve with `[Inject(Id="A")]`). |
| `.WithArguments(x, y)` | Pass constructor args that aren't themselves bound. |
| `.WhenInjectedInto<TConsumer>()` | Scope a binding to a specific consumer. |
| `.OnInstantiated((ctx, obj) => …)` | Post-construct hook (e.g. SDK setup, or re-bind into parent — see below). |
| `Container.DeclareSignal<TSignal>()` | Register a SignalBus event type (see cross-system doc). |

Prefer **`BindInterfacesTo`** so consumers depend on abstractions. Reach for
`BindInterfacesAndSelfTo` only when a concrete reference is genuinely required.

---

## Injection styles

Both are used; pick per layer:

- **Constructor injection** (preferred for plain C# controllers/services — dependencies are explicit
  and the type is impossible to construct half-wired):

  ```csharp
  public WinStreakSceneController(IWinStreakSceneView view, SceneManager sceneManager, ...)
  { _view = view; _sceneManager = sceneManager; ... }
  ```

- **Field injection** (common for controllers with many dependencies, and required where constructor
  injection is awkward such as MonoBehaviours):

  ```csharp
  [Inject] private readonly IWinStreakNetworkController _networkController;
  [Inject] private readonly WinStreakModel _winStreakModel;
  ```

- **`LazyInject<T>`** breaks a circular dependency or defers creation:
  `[Inject] private readonly LazyInject<IItemTutorialController> _itemTutorial;` then
  `_itemTutorial.Value.OnLevelCompleted();`. Use sparingly — a cycle is usually a design smell, and
  **never** `LazyInject` a Root object from a Project object (it would dangle after account switch).

---

## Lifecycle interfaces

Zenject calls these automatically when you `BindInterfacesTo`/`AsSingle().NonLazy()`:

| Interface | Called | Use for |
|---|---|---|
| `IInitializable.Initialize()` | once, after all bindings resolved | subscribe to events, set delegates, first sync |
| `IDisposable.Dispose()` | on context teardown | unsubscribe, release |
| `ITickable.Tick()` | every frame | per-frame logic (use rarely; prefer events/async) |
| `ILateTickable`, `IFixedTickable` | late/fixed update | as needed |

```csharp
public class WinStreakMainController : IInitializable, IDisposable, IWinStreakMainController
{
    public void Initialize()
    {
        _winStreakIconController.SetDelegate(this);
        _networkChecker.OnConnectionStatusChangedFromTo += OnConnectionStatusChanged;
    }
    public void Dispose() => _networkChecker.OnConnectionStatusChangedFromTo -= OnConnectionStatusChanged;
}
```

---

## Execution order

When boot order matters, declare it explicitly instead of relying on luck:

```csharp
// Lower number = earlier; default is 0. Make Root's Initialize run last:
Container.BindExecutionOrder<RootController>(1);
Container.BindInitializableExecutionOrder<RootSceneAuthListener>(1000);
```

---

## Composing features into a context

In the big `RootInstaller`, each feature is one grouped call. The pattern that lets a sub-context
feature expose its long-lived controller to the parent (Root) scope is the `OnInstantiated` re-bind:

```csharp
container.BindInterfacesTo<SeasonPassMainController>().AsSingle()
    .OnInstantiated((_, obj) =>
        container.ParentContainers[0]
                 .BindInterfacesAndSelfTo<SeasonPassMainController>()
                 .FromInstance(obj).AsSingle().NonLazy())
    .NonLazy();
```

This keeps the feature's wiring inside its own installer while making its `MainController` resolvable
by the game's aggregators. (Treat it as a known idiom; don't overuse it — if everything needs
re-binding upward, the controller probably belongs in Root directly.)

---

## DI smells to avoid

- `new SomeService()` for anything with dependencies → bind it instead.
- Static singletons / `Instance` for app logic → inject an interface.
- `FindObjectOfType` / `GameObject.Find` to locate logic objects → inject them.
- Service locator (`Container.Resolve` inside business logic) → declare the dependency, don't pull it.
  (`Resolve` is acceptable inside installers/`OnInstantiated`, not inside controllers.)
- Binding a child-context object up into Project, or `LazyInject`-ing Root from Project → dangling refs
  after account switch.
