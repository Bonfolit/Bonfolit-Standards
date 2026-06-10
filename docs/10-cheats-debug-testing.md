# 10 — Cheats, Debug & Testing

## Dev/release separation

Two scripting defines gate non-production code:

| Define | Gates |
|---|---|
| `BONFOLIT_DEV` | cheats, cheat UI, dev shortcuts, fake providers |
| `BONFOLIT_LOG_VERBOSE` | high-frequency diagnostic logging |

Release builds define neither; CI verifies the player still compiles with both off.

## Cheat system

### Cheat interfaces on controllers

A feature's cheat surface is a dedicated interface, declared next to the main
controller and compiled conditionally — the controller implements it the same way:

```csharp
#if BONFOLIT_DEV
public interface IWinStreakCheat
{
    void UpdateStep(int delta);
    string GetCurrentStep();
}
#endif

public class WinStreakMainController : IInitializable, IWinStreakMainController
#if BONFOLIT_DEV
    , IWinStreakCheat
#endif
{
    #region CHEAT
#if BONFOLIT_DEV
    public void UpdateStep(int delta) { /* mutate model via cheat methods, save, sync */ }
#endif
    #endregion
}
```

- Cheat implementations call **cheat-specific model methods**
  (`CheatIncreaseStep`, `CheatResetProgress`) kept at the bottom of the model under
  the same define — cheats go through the model like everything else, so they
  exercise real code paths (save, sync, icon refresh).
- Because the controller is bound `BindInterfacesAndSelfTo`, the cheat panel resolves
  `IWinStreakCheat` without extra bindings.

### Cheat UI

- Cheat panels/views are MonoBehaviours in `Cheat`/`Debug` folders compiled into the
  dedicated Cheat/Debug assemblies (`<Game>.Cheat`, `<Game>.Debug` + per-feature
  `.asmref`).
- A central `CheatPanel` (game scope) hosts per-feature sections
  (`DailyBonusCheat`, `EnvironmentCheat`, inventory/goal panels…); scene-level
  panels exist for Root (environment switch, feedback dump) and gameplay.
- Hidden activation gestures (long-press with visual feedback) guard panels that
  ship in dev builds.
- Environment switching (dev/staging/prod hosts) is a cheat-panel feature backed by
  the `IRemoteHost` binding.

## Testing

### Frameworks & placement

- NUnit EditMode tests; per-area `Test/` folders joined to test assemblies
  (`<Game>.Test` via `.asmref`, plus framework `*.Tests` asmdefs).
- Pure-logic tests dominate: models, calculators, helpers, queue logic. This is the
  payoff of engine-free Controller/Model assemblies — most game logic tests run
  without play mode.

### Conventions

- File: `<TypeUnderTest>Test.cs` (or `…Tests.cs`), class named the same.
- Method naming: `Expectation_WhenCondition`:

```csharp
[Test]
public void ReturnsHighestEventLevel_WhenMultipleEventsAbovePlayerLevel() { … }

[Test]
public void ReturnsZero_WhenEventListIsEmpty() { … }
```

- Arrange-act-assert with blank-line separation; `const` for scenario inputs;
  classic `Assert.AreEqual(expected, actual)`.
- Hand-written **Dummy** test doubles in `Test/Dummy/` (`GoalControllerDummy`,
  `CubeAbControllerDummy`) implementing the controller interfaces — no mocking
  framework.
- Shared scenario data in `…TestDataProvider` classes.
- Container-dependent tests compose a **test environment installer**
  (`<X>TestEnvironmentInstaller`) that binds dummies + real systems under test;
  persistence is faked with the `FakeDataPersistenceProvider`.

### What must be covered

1. Model transition rules (step/streak/state machines, reward claim eligibility).
2. Pure calculators and helpers (sorting, limits, id utilities).
3. Cache/response helpers (round-trip, backward compatibility).
4. Queue/scheduling logic edge cases.

UI, scene flow, and SDK wrappers are exercised via dev builds + cheat panels rather
than automated tests.
