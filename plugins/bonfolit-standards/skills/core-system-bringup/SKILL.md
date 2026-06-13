---
name: core-system-bringup
description: This skill should be used when standing up one of the framework core systems during a Path-B (scaffolded-in-repo) Bonfolit project — logger, persistence, time/unbiased provider, TaskSystem, ActionQueue, ViewHierarchy, Popups, Network shape, or Analytics shape. Trigger on "bring up <core system>", "scaffold the ActionQueue / TaskSystem / popup system", "implement the unbiased time provider", or "Phase 5 core systems".
version: 0.1.0
---

# Recipe: core-system bring-up (Path B)

Path B scaffolds the minimal framework subset in-repo (`Assets/Lib`, assembly
`Bonfolit.Lib`) before extracting it into a package. Full sequence and checkpoints:
`../../docs/00-new-project-bootstrap.md` Phase 5.

Bring systems up **in this order**, each with EditMode tests before moving on:

1. **Logger** — `BonLogger` (`[Feature][Class]` tags, verbose behind `BONFOLIT_LOG_VERBOSE`). → `docs/09`.
2. **Persistence** — cache layer + per-model CacheHelper contract. → `docs/05`.
3. **Time** — `TimeModel` + the unbiased time provider (no `DateTime.Now`). → `docs/05`.
4. **TaskSystem** — UniTask conventions + main-thread dispatch. → `docs/08`.
5. **ActionQueue** — one context per screen, dedup guard, priority mapping. → `docs/08`, `docs/07`.
6. **ViewHierarchy** — view tracking. → `docs/07`.
7. **Popups** — `Popup`/`ReusablePopup`, `PopupTask`, `<Game>PopupType`. → `docs/07`.
8. **Network shape** — `WebService`, `WebResponseCommand<T>`, `GenericWebRequestTask`. → `docs/06`.
9. **Analytics shape** — `AnalyticsBase` + per-feature analytics classes. → `docs/09`.

## Notes

- Each system gets EditMode tests named `Expectation_WhenCondition` (hard rule #11)
  before it is considered up.
- Keep everything that will become framework code under `Assets/Lib` so it can be
  extracted into the Bonfolit package later (turning the next game into Path A).
- Update the game's `CLAUDE.md` "Phase 5 core-systems status" line as each lands.

## Before claiming done

Run **/bonfolit-standards:release-check** and confirm the release define profile compiles
with no `BONFOLIT_DEV` leaks.
