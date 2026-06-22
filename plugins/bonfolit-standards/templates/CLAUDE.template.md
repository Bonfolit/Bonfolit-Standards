# <GameName> — Project Memory

<One-line description: genre, core loop, orientation, target platforms.>

This project follows **Bonfolit Standards**, served by the installed
**`bonfolit-standards`** Claude Code plugin — the plugin's `docs/` are the source of
truth for architecture and conventions. This file is the always-loaded layer: the hard
rules + project specifics. It does not replace the docs.

## Standards via the plugin

The **`bonfolit-standards`** skill auto-triggers on Bonfolit work and routes any
"where does X go / what's the convention for Y" question to the right doc (00–12).
Recipes are skills — **`add-feature`**, **`add-popup`**, **`add-endpoint`**,
**`core-system-bringup`**. Bootstrap a project with **`/bonfolit-standards:bootstrap`**,
gate work with **`/bonfolit-standards:release-check`**, and audit a diff with the
**`standards-auditor`** subagent. Guardrail hooks enforce rule 1 (engine-free layers)
and flag rule 8 (`DateTime.Now`).

If the plugin isn't installed: `/plugin marketplace add <Bonfolit-Standards repo>` then
`/plugin install bonfolit-standards@bonfolit`.

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
9. All logging via `BonLogger` with `[Feature][Class]` tags; analytics via
   `<Feature>Analytics` classes with const event names.
10. Cheats/debug only under `BONFOLIT_DEV` (verbose logs under
    `BONFOLIT_LOG_VERBOSE`); release profile must always compile.
11. New pure logic (model transitions, calculators, helpers) gets EditMode tests,
    named `Expectation_WhenCondition`.
12. SDKs are wrapped by `Service` classes bound in installers — feature code never
    references SDK namespaces.
13. **No `static` access to dynamic references.** Domain reload is **disabled** (doc 12),
    so statics persist across play sessions — reach singletons/services/models via **DI
    (rule 3)**, never a `static` field or `Instance` accessor. Only `const`/`readonly` data
    and pure helpers may be `static`; sanctioned core-lib façades (`BonLogger`) must reset
    their backing via `[RuntimeInitializeOnLoadMethod]`.

## Everyday recipes

- **Add a feature / popup / endpoint / core system:** use the matching plugin skill
  (`add-feature`, `add-popup`, `add-endpoint`, `core-system-bringup`).
- **Promote a feature to its own assemblies:** doc 02, Option A/B.

## Project specifics (filled at bootstrap — keep current)

- Unity version: `<x.y.z>`  · Render pipeline: `<built-in | URP 2D>`
- Framework source: `<Path A: imported package | Path B: scaffolded in-repo>`
- Backend: `<offline bindings | base URL per environment>`
- Target platforms & min OS: `<iOS 13+ / Android API 24+>`
- Defines per profile: dev `BONFOLIT_DEV;BONFOLIT_LOG_VERBOSE` · QA `BONFOLIT_DEV` · release none
- Editor: Enter Play Mode Options on, **Domain Reload disabled** (Scene Reload on) — every static façade must reset via `[RuntimeInitializeOnLoadMethod]` (hard rule 13)
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
