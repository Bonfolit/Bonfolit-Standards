# 12 — Packages, Plugins & Mobile Project Settings

What to install and how to configure a fresh Unity project for a mobile
(iOS/Android) game on this standard. The bootstrap guide
([00-new-project-bootstrap.md](00-new-project-bootstrap.md)) tells you *when* to do
each step; this document is the *what*.

## Engine baseline

| Setting | Value |
|---|---|
| Unity version | Latest LTS (pin the exact patch in `ProjectVersion.txt`; whole team + CI on the same patch) |
| Render pipeline | 2D/UI games: Built-in or URP 2D Renderer — pick once, record in CLAUDE.md |
| Color space | Linear if URP/3D; Gamma acceptable for pure-UI 2D (decide once) |
| API compatibility | .NET Standard 2.1 |

## Unity packages (Package Manager / `manifest.json`)

| Package | Why | Notes |
|---|---|---|
| `com.unity.addressables` | popups, event themes, remote content | required by the popup system |
| `com.unity.ugui` (+ TextMeshPro) | UI | TMP for all text; never legacy Text |
| `com.unity.test-framework` | NUnit EditMode tests | see doc 10 |
| `com.unity.mobile.notifications` | local notifications | wrapped by `LocalNotificationService` |
| `com.unity.2d.sprite` (+ atlas) | sprites, SpriteAtlas V2 | avatar/icon atlases |
| `com.unity.inputsystem` | input (if not using a touch plugin) | optional; pick one input path |

## Third-party plugins

Install order matters only for the dependency resolver (EDM4U first if using
mobile SDKs).

### Core architecture (required)

| Plugin | Source | Role in the standard |
|---|---|---|
| **Zenject/Extenject** | OpenUPM / asset store | the DI container (doc 03). Pin the version; it is mature but slow-moving — vet any replacement (e.g. VContainer) as a deliberate standards revision, not per game |
| **UniTask** | git UPM (`Cysharp/UniTask`) | all async (doc 08) |
| **ZString** | git UPM (`Cysharp/ZString`) | zero-alloc string building in log/analytics hot paths |
| **A tween library** (PrimeTween or DOTween) | asset store | behind `AbstractAnimation` wrappers — game code never calls the tween API directly, so the choice is swappable |

### Tooling (strongly recommended)

| Plugin | Role |
|---|---|
| Odin Inspector | designer-facing inspectors (`[BoxGroup]` etc., doc 07/11) |
| An HTTP client (Best HTTP or `UnityWebRequest` wrapper) | hidden entirely behind `WebService` (doc 06) — only the wrapper assembly references it |
| Haptics plugin (e.g. Nice Vibrations) | wrapped by a `Service` |
| Spine runtime | only if art uses Spine |

### Live-ops SDKs (add when the game goes live, not day one)

| SDK | Wrapped by | Notes |
|---|---|---|
| External Dependency Manager (EDM4U) | — | required by the SDKs below; enable Android auto-resolve |
| Firebase App + Analytics + Crashlytics | `AnalyticsBase` / `FirebaseController` (doc 09) | init through `FirebaseInitController` in ProjectContext |
| AppsFlyer (attribution) | `AppsFlyerService` + credential-sync controller | |
| OneSignal (push) | `OneSignalService` + permission helper | |
| Facebook SDK | `FacebookSDKService` (connect/switch flows) | |
| Store purchasing (Unity IAP or store SDKs) | `PurchaseService`/`PurchaseController` | server-side receipt verification via `PurchaseVerificationCommand` |

**Rule:** every SDK gets a `Service` wrapper and is bound in an installer; feature
code never references SDK namespaces (doc 09 "Providers"). This is what lets a
template game compile before any SDK is imported — bind the `Dummy…` implementation
until the real one is installed.

## Scripting define symbols

Configure per build profile (Player Settings → Scripting Define Symbols, or build
profiles/CI):

| Profile | Defines |
|---|---|
| Editor & dev device builds | `BONFOLIT_DEV;BONFOLIT_LOG_VERBOSE` |
| QA/staging builds | `BONFOLIT_DEV` |
| Release | *(none of the above)* |

CI must compile the Release profile on every PR — that's what catches code leaking
outside `#if BONFOLIT_DEV`.

## Player settings (mobile optimization)

### Both platforms

| Setting | Value | Why |
|---|---|---|
| Scripting backend | IL2CPP | required for iOS, faster on Android |
| C++ compiler config | Release (Master for store builds) | |
| Managed stripping | Medium (High only after link.xml audit) | smaller binary; see link.xml below |
| Incremental GC | On | avoids GC spikes |
| Texture compression | ASTC | best quality/size on modern mobiles |
| Accelerometer frequency | Disabled (if unused) | saves battery |
| Optimized frame pacing (Android) | On | |
| `Application.targetFrameRate` | set explicitly (60) in boot code, not left default | mobile defaults to 30 |
| `Screen.sleepTimeout` | NeverSleep during gameplay (set in boot service) | |

### Android

| Setting | Value |
|---|---|
| Min API | 24+ (re-evaluate yearly) |
| Target API | latest required by Play Store |
| Architecture | ARM64 (+ARMv7 only if metrics justify) |
| Build type | App Bundle (AAB), R8/minify on for release |
| Graphics APIs | Vulkan + GLES3 fallback (validate on low-end; GLES3-only is acceptable) |

### iOS

| Setting | Value |
|---|---|
| Min iOS version | 13+ (re-evaluate yearly) |
| Graphics API | Metal only |
| `Camera` usage etc. | fill every privacy-usage description the SDKs require |
| App Tracking Transparency | via `RequestIdfaPermissionTask` (doc 01 boot flow) |

### Stripping & link.xml

IL2CPP stripping breaks reflection users: serializers, SDK callbacks, and any
binary-deserialized save types. Maintain one `link.xml` at the project root
preserving:

- the persistence/serialization assemblies and your persisted model types,
- SDK assemblies that document a link.xml requirement,
- the Generated DTO assembly.

Add an entry the moment a "type was stripped" runtime error appears on device —
and add a device smoke test to CI so they appear before release.

## Quality & rendering

- **One quality level** for mobile. Delete the unused tiers; per-tier divergence is
  a bug farm.
- Shadows off (or hard, one cascade) for 2D/UI games; AA off when UI-only;
  pixel-perfect handled by canvas scaler, not MSAA.
- VSync: Don't Sync (mobile ignores it; pacing comes from target frame rate).
- Physics: if the game doesn't simulate, set Physics/Physics2D auto-simulation off
  and strip the modules in the Package Manager; otherwise minimize the layer
  collision matrix and raise fixed timestep to what gameplay actually needs.
- Audio: Vorbis compressed, **Compressed In Memory** for SFX-sized clips, Streaming
  for music; force mono where stereo adds nothing; DSP buffer "Good latency".

## Addressables configuration

- Groups: `Local-Static` (ships in build: core popups, common UI),
  `Remote-<EventTheme>` per live-ops theme (downloaded on demand — this is what
  `RequiredAssetKeys()` / asset controllers pull, doc 05/07).
- Compression LZ4; remote catalog enabled only when a CDN exists (offline-first
  games start all-local and flip later).
- Popup addressable address == popup key const (doc 07) — enforce 1:1.
- Build Addressables as part of the player build script, never by hand.

## Editor & iteration settings

- **Enter Play Mode Options: domain reload may be disabled for speed** — but then
  every static (logger, audio façade, `TimeModel`) must reset via
  `[RuntimeInitializeOnLoadMethod]`. The core lib statics expose
  `PrepareForReuse()` for exactly this; wire it before disabling domain reload.
- Asset Pipeline v2 with an Accelerator if the team is >2 people.
- Sprite Atlas V2; include atlases in CI build to catch misses.

## Version control hygiene

- `.gitignore`: `Library/`, `Temp/`, `Logs/`, `Obj/`, `Build/`, `UserSettings/`.
- Force-text serialization + Visible Meta Files (Editor settings).
- Commit `Packages/manifest.json` **and** `packages-lock.json`.
- LFS for binary assets (psd, png, fbx, wav, mp4) from day one.
