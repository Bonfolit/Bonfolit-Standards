---
name: bonfolit-standards
description: This skill should be used for ANY work in a Bonfolit Unity game (Bonfolit.* namespaces, Zenject/Extenject installers, controllers/models/views, ActionQueue, BonLogger, TimeModel, WebCommand/WebTask). It is the router to the 13 Bonfolit Standards docs — invoke it when the task touches architecture, project/folder structure, dependency injection, controllers & lifecycle, models/state/persistence/time, networking/offline, UI/views/popups/panels, async/queues, logging/analytics, cheats/debug/testing, coding conventions, or packages/project settings, OR whenever the user asks "where does X go / which doc covers Y / what's the convention for Z".
version: 0.1.0
---

# Bonfolit Standards — router

The Bonfolit Standards are the source of truth for architecture and conventions in
every Bonfolit Unity game. The full docs ship **inside this plugin** (sole source —
they are no longer copied into each game repo). Read the relevant doc **before**
writing code for that area.

## Where the docs are

The 13 docs live next to this skill, two levels up, in `docs/`:

```
<this skill>/../../docs/00-new-project-bootstrap.md   ... 12-packages-and-project-settings.md
```

When a task matches a row below, open that doc (relative to this skill file:
`../../docs/<file>`) and follow it.

## Routing table

| Task involves… | Read |
|---|---|
| New project from scratch / systems bring-up | `docs/00-new-project-bootstrap.md` |
| Big-picture "where does this go / who calls whom" | `docs/01-architecture.md` |
| New feature, folders, asmdef/asmref | `docs/02-project-structure.md` (+ the **add-feature** skill) |
| Bindings, installers, signals, injection style | `docs/03-dependency-injection.md` |
| Controllers, lifecycle, listener interfaces | `docs/04-controllers-and-lifecycle.md` |
| Models, saving/loading, time, remote config | `docs/05-models-and-state.md` |
| Server calls, offline mode | `docs/06-networking.md` (+ the **add-endpoint** skill) |
| UI, views, popups, panels | `docs/07-ui-views-popups.md` (+ the **add-popup** skill) |
| Async code, UI flow scheduling (ActionQueue) | `docs/08-async-and-queues.md` |
| Logging, analytics events | `docs/09-logging-and-analytics.md` |
| Cheats, debug panels, writing tests | `docs/10-cheats-debug-testing.md` |
| Naming/style questions | `docs/11-coding-conventions.md` |
| Installing packages/SDKs, player settings | `docs/12-packages-and-project-settings.md` |

## Hard rules (never violate — full rationale in the docs)

1. Controllers/Models are engine-free plain C# (`noEngineReferences: true`). Engine
   code goes in View or Service. *(Enforced by the PreToolUse guardrail hook.)*
2. Folders are **feature-first**: one feature = one folder with its own
   `Controller/ Model/ View/ Network/ Injection/…`. Never group top-level by layer.
3. **Constructor injection** for non-Mono classes; `[Inject]` only on
   MonoBehaviours/installers. Constructors capture deps only — work starts in `Initialize()`.
4. Every binding lives in the narrowest context's installer. Never bind into a parent
   container; never lazy-inject Root types into ProjectContext classes.
5. Every popup/tutorial/tooltip goes through the **ActionQueue** with the dedup guard —
   never a direct `Show()`.
6. Server calls are **Command + Task** pairs in the feature's `Network/` folder;
   callers await the Task only.
7. Models mutate via intent methods, keep `IsDirty`, and persist only through their
   **CacheHelper**.
8. Game-logic time comes from `TimeModel.Now` (unbiased), never `DateTime.Now`.
   *(Flagged by the PreToolUse guardrail hook.)*
9. All logging via `BonLogger` with `[Feature][Class]` tags; analytics via
   `<Feature>Analytics` classes with const event names.
10. Cheats/debug only under `BONFOLIT_DEV` (verbose logs under `BONFOLIT_LOG_VERBOSE`);
    the release profile must always compile.
11. New pure logic gets EditMode tests, named `Expectation_WhenCondition`.
12. SDKs are wrapped by `Service` classes bound in installers — feature code never
    references SDK namespaces.
13. **No `static` access to dynamic references.** Domain reload is **disabled** (doc 12),
    so statics persist across play sessions — reach singletons/services/models via **DI
    (rule 3)**, never a `static` field or `Instance` accessor. Only `const`/`readonly` data
    and pure helpers may be `static`; sanctioned core-lib façades (`BonLogger`) must reset
    their backing via `[RuntimeInitializeOnLoadMethod]`.

## Conduct

- When a standards doc and a game's `CLAUDE.md` disagree, **the doc wins** — flag the
  discrepancy rather than silently picking one.
- When a rule must be broken, say so explicitly and record it under the game's
  "Approved deviations".
- Before claiming done, run the **/bonfolit-standards:release-check** gate (release profile
  compiles, tests pass, bindings in the right installer).
