---
name: add-endpoint
description: This skill should be used when adding or wiring a server call / network request in a Bonfolit Unity game — e.g. "add an endpoint", "call the <X> API", "sync <X> with the server", "add a WebCommand/WebTask", or handling offline mode and reconnection sync. Enforces the Command + Task pattern in the feature's Network/ folder.
version: 0.1.0
---

# Recipe: add a server endpoint

Full rules: `../../docs/06-networking.md`. Networking is always a **Command + Task**
pair living in the feature's `Network/` folder; callers await the Task only.

1. **Command** — `<X>RequestCommand : WebResponseCommand<TResponse>`: builds and sends
   the one request and applies the response to the model/cache. Mutations go through
   the model's intent methods + CacheHelper (hard rule #7) — the command never writes
   persistence directly.
2. **Task** — `<X>Task : GenericWebRequestTask<…>`: wraps the command into an awaitable
   call with a timeout. This is the only thing callers see.
3. **Offline** — if there is no backend yet, stub the task with offline bindings
   (doc 06 "Starting without a backend") so callers compile and run unchanged.
4. **Sync** — schedule fire-and-forget after a mutation (`Sync().Forget()`); handle
   reconnection sync per doc 06.
5. **Bindings** — bind the command/task in the owning feature installer (narrowest
   context, hard rule #4).

## Notes

- Feature code never references the HTTP SDK directly — it goes through the
  `WebService` wrapper (hard rule #12).
- Errors and timeouts are handled in the Task per doc 06; don't swallow them in callers.

## Before claiming done

Run **/bonfolit-standards:release-check**; confirm offline mode still boots if the backend is stubbed.
