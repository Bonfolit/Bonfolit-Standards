---
name: add-feature
description: This skill should be used when adding a new gameplay or meta feature to a Bonfolit Unity game — e.g. the user says "add a <X> feature", "scaffold <X>", "create a new feature for daily bonus / coins / leaderboard / shop", or asks how to wire a feature's controller, model, cache, network, views, analytics, bindings and tests. Drives the feature-first scaffold end to end.
version: 0.1.0
---

# Recipe: add a feature (the everyday one-shot)

The canonical recipe lives in `../../docs/00-new-project-bootstrap.md` ("Recipe:
adding a feature"). Read the referenced docs for the layer you touch; this skill is
the ordered checklist. For feature `<Feature>` in game `<Game>`:

1. **Folders** — `Scripts/<Game>/<Feature>/{Controller,Model,View,Network,Injection}`
   (+ `Cheat`, `Test` when needed) with the layer `.asmref`s (Option B). → `docs/02`.
2. **Model** — `<Feature>Model`: state + intent methods + `IsDirty`. Engine-free. → `docs/05`.
3. **Cache helper** — `I<Feature>CacheHelper` + impl in `Network/`, owning its keys. → `docs/05`.
4. **Controller(s)** — `<Feature>MainController : IInitializable, IDisposable` plus the
   listener interfaces it needs; **constructor injection**; work starts in `Initialize()`.
   Sub-controllers only when a concern is real. → `docs/04`.
5. **Network (if any)** — `<X>RequestCommand : WebResponseCommand<T>` + `<X>Task :
   GenericWebRequestTask<…>`; offline-stubbed if no backend. → `docs/06` (or **add-endpoint** skill).
6. **Views/popups** — views behind interfaces and **passive** (render state + play
   results, no input polling). Gameplay input is its own `ITickable` flow reporting
   intents to the controller via a delegate (one-way: input → controller → model →
   view); runtime gameplay visuals come from prefabs via an element factory
   (Addressables), not geometry built in the view. Popups via `PopupTask` on the right
   ActionQueue context with the dedup guard — never a direct `Show()`. → `docs/07` (or **add-popup** skill).
7. **Analytics** — `<Feature>Analytics : AnalyticsBase` with const event names. → `docs/09`.
8. **Bindings** — a `Bind<Feature>()` group in the owning context installer;
   scene-scoped pieces in `<Feature>SceneInstaller`. Narrowest context only. → `docs/03`.
9. **Cheat** — `I<Feature>Cheat` under `BONFOLIT_DEV` + a cheat-panel section. → `docs/10`.
10. **Tests** — model-transition EditMode tests minimum, named
    `Expectation_WhenCondition`. → `docs/10`.

## Before claiming done

- Engine-free layers (`Controller/`, `Model/`) reference no `UnityEngine`
  (the guardrail hook blocks this; respect it rather than working around it).
- Run **/bonfolit-standards:release-check**: release profile compiles, EditMode tests green,
  new bindings in the correct installer.
- Optionally hand the diff to the **standards-auditor** subagent for a rule sweep.
