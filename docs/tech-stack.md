# Tech Stack

The third-party libraries the standard assumes, grouped by purpose. You don't need *all* of them for a
fresh project — the **architecturally load-bearing** ones are marked ★. The rest are swappable; keep
them behind the interfaces/seams the standard already defines so swapping one doesn't ripple.

---

## Architecturally load-bearing ★

| Library | Purpose | Notes |
|---|---|---|
| **Zenject / Extenject** ★ | Dependency injection | The backbone. Contexts, installers, `SignalBus`, lifecycle (`IInitializable`/`IDisposable`/`ITickable`). Everything in [`dependency-injection.md`](dependency-injection.md) is Zenject. |
| **UniTask** ★ | Allocation-free async/await for Unity | All async is `UniTask`. `Cysharp.Threading.Tasks`. See [`conventions.md`](conventions.md#async--unitask-not-coroutines). |
| **Addressables** ★ | Async asset & scene loading | Feature models declare `RequiredAssetKeys()`; asset controllers load/release. Unity package. |
| **Unity Test Framework** ★ | NUnit-based testing | Powers the `…Test` assemblies. |

If you keep only these four you still get the architecture. The rest are implementation choices.

---

## Networking

| Library | Purpose |
|---|---|
| **BestHTTP** | HTTP/2 + websocket transport under the `WebService`. Set up once in Project context. |
| *(serialization codec)* | The reference project uses a generated **binary schema** for request/response types. **Intentionally out of scope** for this standard — hide it behind the `Command`/`Task` seam ([`networking.md`](networking.md)) and use JSON/REST/gRPC if you prefer. |

## UI / rendering / animation

| Library | Purpose |
|---|---|
| **DOTween / DOTween Pro** | Tweening (legacy/most code). |
| **PrimeTween** | Newer allocation-free tweening; prefer for new code where the team has adopted it. |
| **Spine (spine-unity)** | 2D skeletal character animation. |
| **TextMeshPro** | Text rendering (Unity). |
| **Coffee UIEffect / MeshEffect (TMP)** | UI shaders/effects (blur, shadow, gradient) incl. on TMP text. |
| **ShinyEffectForUGUI** | Animated "shine" sweep on UI. |
| **Kyub EmojiSearch** | Emoji support in text input. |

## Input

| Library | Purpose |
|---|---|
| **Lean Touch (+ Lean Common / CW.Common)** | Touch/gesture input (swipe, drag), wrapped by an input manager bound in DI. |

## Haptics / feel

| Library | Purpose |
|---|---|
| **Lofelt NiceVibrations** + **FatMachines TapticFeedback** | Cross-platform haptics. |

## Editor / tooling

| Library | Purpose |
|---|---|
| **Odin Inspector (Sirenix)** | Richer inspectors / serialization for designer-facing configs. |
| **ZString** | Zero-allocation string building on hot paths/logging. |

## Live services / SDKs (wrap each behind an interface + Dummy)

| Library | Purpose |
|---|---|
| **Firebase** (App, Analytics, Crashlytics) | Analytics + crash reporting. |
| **AppsFlyer** | Attribution / install tracking / deep links. |
| **OneSignal** | Push notifications. |
| **Facebook SDK** | Social login / account linking. |
| **Unity IAP** (via the Purchase module) | In-app purchases, behind `Bonfolit.Core.Purchase`. |
| **CodeStage AntiCheat** | Obscured values / tamper detection for sensitive client state. |
| **UnbiasedTime** | Wall-clock time resistant to device clock changes (used by the time model). |

> **SDK rule:** never call an SDK directly from a controller. Each SDK sits behind a `Bonfolit.Core.*`
> or `Service` wrapper with an interface, bound in the right context, with a `Dummy` for platforms/tests
> where it's unavailable ([`conventions.md`](conventions.md#the-dummy-pattern)). This keeps the SDK
> swappable and the game code platform-agnostic.

---

## Core modules the standard expects to exist

These are first-party infrastructure modules (`Bonfolit.Core.*`) the patterns lean on. Stand up the
ones you need:

`ActionQueue` (sequenced UI/event presentation with priorities) · `Addressable` (asset manager) ·
`Animation` · `Audio` · `Cache` (memory + disk) · `Extension`(s) · `ImageRepo` (remote image
fetch+cache) · `InGameNotification` · `Log` (`BonfolitLogger`) · `Network` (web service primitives) ·
`ObjectPoolSystem` · `Panel`/`Popups` (UI screen/popup framework) · `PriorityQueue` · `Purchase` ·
`TaskSystem` (chainable tasks) · `UnbiasedTime` · `ViewHierarchy` (layered canvas/overlay management) ·
`Util`.

The **ActionQueue** is worth calling out: time-boxed/live-ops popups and auto-opens are pushed onto
per-context queues (Home, Shop, Game, each scene…) with priorities, so competing "show this popup now"
requests are serialized instead of fighting. New features that auto-open content register a queue
context and enqueue through it rather than opening UI directly.
