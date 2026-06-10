# 06 — Networking

## Layers

```
WebService (ProjectContext)      # single HTTP wrapper; request/response plumbing,
                                 # auth token & client-version headers, logging
ISerializationHelper             # wire-format encode/decode (implementation detail —
                                 # keep the rest of the stack format-agnostic)
IRemoteHost                      # base-URL provider per environment
AbstractWebCommand               # one server endpoint = one command class
GenericWebRequestTask<TCommand>  # awaitable wrapper with timeout
NetworkChecker / PingService     # reachability + status-transition events
NetworkLogger(+Service)          # request/response + generic message logging
Socket transports (optional)     # realtime: connection/messaging transport interfaces,
                                 # health checks, long-polling controllers
```

## The Command pattern

One class per endpoint, suffix `WebCommand` (or `RequestCommand`), living in the
feature's `Network/` folder. The command:

1. builds the request DTO **from the model** (injected),
2. sends it through the web service,
3. applies the response to the model and cache **inside its success handler**,
4. surfaces success/failure via callbacks.

```csharp
public class WinStreakSyncRequestCommand : WebResponseCommand<bool>
{
    private readonly IWinStreakCacheHelper _cacheHelper;
    private readonly WinStreakModel _model;

    // base ctor carries the shared web-layer dependencies (see contract below)
    public WinStreakSyncRequestCommand(
        WebCommandDependencies deps,           // bundled base deps
        IWinStreakCacheHelper cacheHelper,
        WinStreakModel model) : base(deps)
    {
        _cacheHelper = cacheHelper;
        _model = model;
    }

    public override void Send(Action<bool> onSuccess = null,
        Action<WebFailure> onFail = null, WebCommandData data = null)
    {
        var request = new WinStreakSyncRequest
        {
            EventId = _model.EventId,
            Step = _model.CurrentStepIndex,
        };
        Log($"Requesting => {request.EventId}, current:{request.Step}");

        var webRequest = CreateWebRequest(request);
        WebService.Send<WinStreakSyncResponse>(webRequest, response =>
        {
            if (response.State.HasValue)
            {
                _model.UpdateFromNetwork(response.State.Value, _cacheHelper.GetLostState());
                _cacheHelper.SaveEvent();
            }
            onSuccess?.Invoke(true);
        }, failure => onFail?.Invoke(failure));
    }

    protected override string GetWebServicePath()
        => $"{RemoteHost.GetBaseURL()}/win-streak/sync";
}
```

Base class contract (`AbstractWebCommand` / `WebResponseCommand<TResponse>`):

- The base takes the shared web-layer dependencies (web service, serialization
  helper, `UserCredentialsModel` with token + client version, `IRemoteHost`) through
  its **constructor** and exposes them as `protected readonly` fields. Because that
  list is identical for every command, bundle it into one injected
  `WebCommandDependencies` object so derived commands chain `: base(deps)` instead of
  re-listing four parameters each time.
- `abstract void Send(onSuccess, onFail, WebCommandData data = null)`.
- `protected abstract string GetWebServicePath()`.
- `CreateWebRequest(dto)` helper stamps auth token and client version.
- `Log`/`LogError` helpers that prefix the class name.

> Bundling cross-cutting base dependencies into a single injected "dependencies"
> object is the standard way to keep constructor injection tidy when a base class
> needs several shared services. Don't fall back to `[Inject]` fields on a plain C#
> base just to avoid a long ctor — bundle instead.

## The Task wrapper

Callers never use commands directly; they await a **Task** class that converts the
callback pair into an awaitable with a timeout:

```csharp
// the whole file:
public class WinStreakSyncTask : GenericWebRequestTask<WinStreakSyncRequestCommand, bool> { }
```

`GenericWebRequestTask` semantics (keep these):

- completion source resolved by `onSuccess`/`onFail`,
- `Timeout` virtual property (default 15 s) raced via `WhenAny` against a delay,
- timeout or failure ⇒ `false`/`default`, never an exception to the caller,
- `Execute(WebCommandData data = null)` is the single entry point.

Custom tasks (multi-step, response shaping) follow the same shape: completion
source + timeout race, `TrySetResult` everywhere (never `SetResult`).

Both command and task are bound `AsSingle` in the installer, side by side:

```csharp
Container.Bind<WinStreakSyncRequestCommand>().AsSingle();
Container.Bind<WinStreakSyncTask>().AsSingle();
```

## Failure & error handling

- A single failure type (`WebFailure`) carries an error code/type plus optional
  typed payloads; `ErrorPayloadHelper` extracts feature payloads (e.g. team errors).
- The web service exposes `OnDisconnected` for server-forced disconnects;
  `ApplicationContext` translates that into the app-wide `DisconnectedSignal` and
  disables auth/sync until restart.
- User-facing connectivity problems go through `BadNetworkPopupController` — features
  do not show their own "no internet" UI.
- Network availability: inject `INetworkChecker`; subscribe to
  `OnConnectionStatusChangedFromTo(from, to)` and re-sync when transitioning **to**
  Connected:

```csharp
public void OnConnectionStatusChanged(NetworkStatus from, NetworkStatus to)
{
    if (from is not NetworkStatus.Connected && to is NetworkStatus.Connected)
        _networkController.TrySyncData().Forget();
}
```

## Sync strategy (offline-tolerant live-ops)

1. Local mutations set `model.IsDirty` and save to the local cache immediately.
2. A sync is scheduled fire-and-forget after each mutation (`Sync().Forget()`).
3. On reconnect, dirty models re-push.
4. Fetches prefer cache-then-network: apply cached payload (with elapsed-time
   correction), then refresh online (`OnEventFetched(evt, isFromCache, lastSaveDiff)`).
5. Server responses always win: `UpdateFromNetwork` clears `IsDirty`.

## Periodic & lifecycle fetches

- Recurring fetches (shop packages, config) live in `Periodic<X>FetchController`s
  driven by ticker services, bound `NonLazy` in Root, and implement `IAuthListener`
  so they (re)start after auth.
- Auth and player sync are themselves Command+Task pairs (`AuthWebCommand` /
  `PlayerAuthTask`, `SyncWebCommand` / `PlayerSyncTask`) orchestrated by
  `ApplicationAuthController` / `ApplicationSyncController` with delegates back to
  `ApplicationContext`.

## DTOs

Request/response DTO types are generated from the wire schema into a `Generated`
assembly. Treat them as read-only artifacts: never hand-edit, never leak them above
the Network/Model layers — models copy what they need.

## Starting without a backend (offline-first bring-up)

A fresh game usually has no server for weeks. Build the network layer's *shape* from
day one, but bind offline stand-ins so the game boots and ships playable builds
without one:

- `OfflineRemoteHost : IRemoteHost` — returns a placeholder URL; nothing calls out.
- `OfflineAuthCommand` / local `PlayerAuthTask` — "auth" succeeds instantly with a
  locally generated player id.
- Feature commands keep their real signatures but short-circuit:
  `onSuccess` with canned/local data, never `onFail`.
- The `IsDirty` + cache-helper flow stays fully active — local saves are the source
  of truth until a server exists.

Because everything behind `IRemoteHost`, commands, and tasks is interface- or
ctor-injected, switching to the real backend later is an installer change
(`BindOnline()` vs `BindOffline()`), not a refactor. Keep the offline bindings
compilable forever — they double as the test/demo configuration.
