---
description: Bonfolit "before claiming done" gate — release profile compiles, EditMode tests pass, bindings in the right installer, no debug leaks.
argument-hint: "[feature or area to focus on (optional)]"
allowed-tools: [Read, Grep, Glob, Bash]
---

# /bonfolit-standards:release-check

Run the Bonfolit completion gate before declaring any change done. Focus area (optional): $ARGUMENTS

Work through this checklist and report each item as ✅ / ⚠️ / ❌ with evidence:

1. **Release profile compiles.** Confirm the code compiles under the **release**
   define profile (defines: none — no `BONFOLIT_DEV`, no `BONFOLIT_LOG_VERBOSE`).
   - If a Unity MCP server is connected, read the editor console for compile errors
     and/or run the player/editor compile; otherwise inspect the relevant `.csproj`
     define constants and reason about `#if BONFOLIT_DEV` blocks.
   - Grep the diff for `BONFOLIT_DEV` / `BONFOLIT_LOG_VERBOSE` usage that isn't behind
     a conditional-compilation guard (debug/cheat code leaking into release).

2. **EditMode tests green.** Run the EditMode test suite (Unity MCP `run_tests` with
   EditMode if available, else `-runTests -testPlatform EditMode`) and report
   pass/fail counts. New pure logic must have `Expectation_WhenCondition` tests.

3. **Bindings in the narrowest installer.** For anything newly constructed by the
   container, confirm its binding lives in the owning feature/context installer —
   never bound into a parent container, never Root types lazy-injected into
   ProjectContext (hard rule #4).

4. **Hard-rule sweep.** Spot-check the diff against the 13 hard rules — especially
   engine-free `Controller/`/`Model/` (rule 1), `TimeModel.Now` not `DateTime.Now`
   (rule 8), popups via the ActionQueue not direct `Show()` (rule 5), and `BonLogger`
   tags (rule 9). For a deeper pass, delegate to the **standards-auditor** subagent.

5. **CLAUDE.md current.** If this work changed project facts (core-systems status,
   SDKs installed, build command, approved deviations), confirm the game's `CLAUDE.md`
   was updated.

End with a one-line verdict: **READY** only if 1–3 are ✅; otherwise list what blocks it.
