---
name: add-popup
description: This skill should be used when adding a popup, modal, dialog, tutorial, or tooltip to a Bonfolit Unity game — e.g. "add a <X> popup", "show a confirmation dialog", "create a reward popup", or any UI that must be scheduled rather than shown directly. Enforces the ActionQueue + dedup-guard path (never a direct Show()).
version: 0.1.0
---

# Recipe: add a popup

Canonical recipe: `../../docs/00-new-project-bootstrap.md` ("Recipe: adding a popup");
full UI/queue rules: `../../docs/07-ui-views-popups.md` and `../../docs/08-async-and-queues.md`.

1. **Prefab** deriving `Popup` (or `ReusablePopup`); its Addressable address = a key
   const added to `<Game>PopupType`.
2. **Interfaces** — `I<X>Popup` + `I<X>PopupControllerDelegate`.
3. **Controller** — `<X>PopupController` shown via a `PopupTask` on the correct
   ActionQueue context, **with the dedup guard**. Never call `Show()` directly
   (hard rule #5).
4. **Animations** — show/hide `AbstractAnimation`s serialized on the prefab (no direct
   tween-library calls; wrap behind `AbstractAnimation`).

## Notes

- One ActionQueue context per logical screen; priorities come from the mapping asset.
- Use `EnqueueFront`/`Enqueue` appropriately (user-initiated vs scheduled content).
- The popup's controller is engine-free where possible; the View behind `I<X>Popup`
  owns the MonoBehaviour/engine code.

## Before claiming done

Run **/bonfolit-standards:release-check** and confirm the popup flows through the queue (it
appears via the ActionQueue, not a direct call).
