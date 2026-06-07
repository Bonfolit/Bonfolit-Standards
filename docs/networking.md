# Networking

Server communication follows a **Command + Task** pattern, layered on a shared web-service base. Each
server endpoint becomes a small, injectable, testable pair of classes.

> Wire format: the reference codebase serializes requests/responses with a binary schema and generates
> the request/response types. The **transport details and codec are out of scope** for this standard —
> what matters is the *shape* below. Swap in JSON/REST/gRPC behind the same `Command`/`Task` seam and
> nothing above it changes.

---

## The layers

```
Controller  ── awaits ──►  Task  ── wraps ──►  Command  ── uses ──►  WebService (Core)
 (decides when)          (timeout,           (one request:        (HTTP transport,
                          returns result)     build → send →        auth header, base URL)
                                              map onto Model)
```

### 1. `WebService` (Core, shared) — the transport

Bound once in `ProjectContext`. Owns the HTTP stack setup, logging level, base URL/host, and the
typed `Send<TResponse>(request, onSuccess, onFail)` call. Controllers never touch it directly.

### 2. `AbstractWebCommand` (Core, shared) — base for one request

Injects the shared plumbing and exposes helpers:

```csharp
public abstract class AbstractWebCommand
{
    [Inject] protected readonly IWebService     WebService;
    [Inject] protected readonly UserCredentials Credentials;   // token, client version
    [Inject] protected readonly IRemoteHost     RemoteHost;    // base URL per environment

    protected abstract string GetWebServicePath();
    protected WebRequest CreateWebRequest(object payload) =>
        WebUtil.CreateWebRequest(payload, GetWebServicePath(), Credentials.Token, Credentials.ClientVersion);
    protected void Log(string s, LogLevel lvl = LogLevel.Info) =>
        BonfolitLogger.Log($"[{GetType().Name}] {s}", lvl);
}

public abstract class WebResponseCommand<TResponse> : AbstractWebCommand
{
    public abstract void Send(Action<TResponse> onSuccess = null,
                              Action<WebFailure> onFail = null,
                              WebCommandData data = null);
}
```

### 3. A concrete `Command` — build, send, map onto the Model

One per endpoint. It builds the request from the Model, sends it, and writes the response **back into
the Model** (and the cache). It does **not** decide when to call — that's the controller's job.

```csharp
public class WinStreakSyncRequestCommand : WebResponseCommand<bool>
{
    [Inject] private readonly WinStreakModel _model;
    [Inject] private readonly IWinStreakCacheHelper _cache;

    public override void Send(Action<bool> onSuccess = null, Action<WebFailure> onFail = null, WebCommandData data = null)
    {
        var request = new WinStreakSyncRequest
        {
            EventId = _model.EventId,
            Step    = _model.CurrentStepIndex,
            MaxStep = _model.MaxSeenStepIndex,
        };

        WebService.Send<WinStreakSyncResponse>(CreateWebRequest(request),
            response =>
            {
                _model.UpdateFromNetwork(response.State, _cache.GetLostState());
                _cache.SaveEvent();
                onSuccess?.Invoke(true);
            },
            failure => onFail?.Invoke(failure));
    }

    protected override string GetWebServicePath() => $"{RemoteHost.GetBaseURL()}/win-streak/sync";
}
```

### 4. A `Task` — awaitable wrapper with timeout

Tasks turn the callback-style command into something you `await`, and add a timeout. Usually a
**one-liner** subclass of the generic base:

```csharp
public class WinStreakSyncTask : GenericWebRequestTask<WinStreakSyncRequestCommand, bool> { }
```

The generic base (Core):

```csharp
public class GenericWebRequestTask<TCommand, TResponse> where TCommand : WebResponseCommand<TResponse>
{
    [Inject] protected readonly TCommand Command;
    protected virtual float Timeout { get; set; } = 15f;

    public virtual async UniTask<TResponse> Execute(WebCommandData data = null)
    {
        var tcs = new UniTaskCompletionSource<TResponse>();
        Command.Send(onSuccess: r => tcs.TrySetResult(r),
                     onFail:    _ => tcs.TrySetResult(default),
                     data: data);

        var (hasResult, result) = await UniTask.WhenAny(tcs.Task, UniTask.Delay(TimeSpan.FromSeconds(Timeout)));
        return hasResult ? result : default;
    }
}
```

There's also a non-generic `GenericWebRequestTask<TCommand>` returning `bool` for fire-style calls.

### 5. The feature's `NetworkController` — decides *when*

A controller-layer class that owns sync policy: throttling, "sync after level", retry on reconnect,
enable/disable the network layer. It calls the Task and `.Forget()`s or awaits as appropriate.

```csharp
public async UniTask<bool> TrySyncData()
{
    if (!_networkChecker.IsConnected) return false;
    return await _syncTask.Execute();
}
```

---

## Binding networking in DI

In the feature's installer, bind the command and the task (and the cache helper):

```csharp
container.Bind<WinStreakSyncRequestCommand>().AsSingle();
container.Bind<WinStreakSyncTask>().AsSingle();
container.BindInterfacesTo<WinStreakCacheHelper>().AsSingle();
container.BindInterfacesTo<WinStreakNetworkController>().AsSingle();
```

---

## Conventions & rules

- **One Command per endpoint.** Name `XxxRequestCommand` (or `XxxWebCommand`). Path in
  `GetWebServicePath()`.
- **One Task per Command**, usually empty-bodied; override `Timeout` only when needed.
- **The Command maps the response onto the Model** and saves the cache; callers get a simple result.
- **Controllers own timing** (when to sync), not Commands/Tasks.
- **Offline-first:** features keep a `CacheHelper` so they can load from cache and reconcile on the
  next successful sync; on reconnect (`IConnectionStateListener`/`INetworkChecker`) trigger a re-sync.
- **Failures are values, not exceptions** at the call site: the Task returns `default`/`false` on
  timeout/failure; decide what to do (retry, ignore, show "bad network" popup).
- **Auth/credentials/host** come from the shared base — never hardcode tokens or URLs in a Command.
- **Log with a class-tagged prefix** via `BonfolitLogger` so request/response traces are filterable.
