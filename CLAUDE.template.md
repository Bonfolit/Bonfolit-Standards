# <GameName> — Project Memory

<One-line description: genre, core loop, orientation, target platforms.>

This project follows **Bonfolit Standards** (`Bonfolit-Standards/`). Those documents
are the source of truth for architecture and conventions; this file is a router plus
the hard rules — it does not replace them. When a task touches an area below, read
the referenced document **before** writing code.

## Routing table

| Task involves… | Read first |
|---|---|
| Setting up this project from scratch / new systems bring-up | `Bonfolit-Standards/docs/00-new-project-bootstrap.md` |
| Big-picture "where does this go / who calls whom" | `01-architecture.md` |
| New feature, folders, asmdef/asmref | `02-project-structure.md` (+ feature recipe in `00`) |
| Bindings, installers, signals, injection style | `03-dependency-injection.md` |
| Controllers, lifecycle, listener interfaces | `04-controllers-and-lifecycle.md` |
| Models, saving/loading, time, remote config | `05-models-and-state.md` |
| Server calls, offline mode | `06-networking.md` |
| UI, views, popups, panels | `07-ui-views-popups.md` |
| Async code, UI flow scheduling (ActionQueue) | `08-async-and-queues.md` |
| Logging, analytics events | `09-logging-and-analytics.md` |
| Cheats, debug panels, writing tests | `10-cheats-debug-testing.md` |
| Naming/style questions | `11-coding-conventions.md` |
| Installing packages/SDKs, player settings | `12-packages-and-project-settings.md` |

## Hard rules (never violate; full rationale in the docs)

1. Controllers/Models are engine-free plain C# — the Controller assembly has
   `noEngineReferences: true`. Engine code goes in View or Service.
2. Folders are **feature-first**: one feature = one folder containing its own
   `Controller/ Model/ View/ Network/ Injection/…`. Never group top-level folders
   by layer.
3. **Constructor injection** for all non-Mono classes; `[Inject]` only on
   MonoBehaviours/installers. Constructors only capture dependencies — work starts
   in `Initialize()`.
4. Every binding lives in the narrowest context's installer. Never bind into a
   parent container; never lazy-inject Root types into ProjectContext classes.
5. Every popup/tutorial/tooltip goes through the **ActionQueue** with the dedup
   guard — never a direct `Show()`.
6. Server calls are **Command + Task** pairs in the feature's `Network/` folder;
   callers await the Task only.
7. Models mutate via intent methods, keep `IsDirty`, and persist only through
   their **CacheHelper**.
8. Game-logic time comes from `TimeModel.Now` (unbiased), never `DateTime.Now`.
9. All logging via `BonfolitLogger` with `[Feature][Class]` tags; analytics via
   `<Feature>Analytics` classes with const event names.
10. Cheats/debug only under `BONFOLIT_DEV` (verbose logs under
    `BONFOLIT_LOG_VERBOSE`); release profile must always compile.
11. New pure logic (model transitions, calculators, helpers) gets EditMode tests,
    named `Expectation_WhenCondition`.
12. SDKs are wrapped by `Service` classes bound in installers — feature code never
    references SDK namespaces.

## Everyday recipes

- **Add a feature / popup / endpoint:** follow the recipes at the bottom of
  `Bonfolit-Standards/docs/00-new-project-bootstrap.md`.
- **Promote a feature to its own assemblies:** doc 02, Option A/B.

## Project specifics (filled at bootstrap — keep current)

- Unity version: `<x.y.z>`  · Render pipeline: `<built-in | URP 2D>`
- Framework source: `<Path A: imported package | Path B: scaffolded in-repo>`
- Backend: `<offline bindings | base URL per environment>`
- Target platforms & min OS: `<iOS 13+ / Android API 24+>`
- Defines per profile: dev `BONFOLIT_DEV;BONFOLIT_LOG_VERBOSE` · QA `BONFOLIT_DEV` · release none
- Run tests: Unity Test Runner, EditMode (CLI: `-runTests -testPlatform EditMode`)
- Build: `<command / CI job name>`
- Installed SDKs so far: `<list, or "dummies only">`

## Session conduct

- Before claiming done: code compiles for the **release** define profile, tests
  pass, and new bindings are in the correct installer.
- When a standards doc and this file disagree, the doc wins — and flag the
  discrepancy instead of silently picking one.
- When a rule must be broken, say so explicitly in the response and record the
  exception here under "Approved deviations".

## Approved deviations

*(none yet)*
