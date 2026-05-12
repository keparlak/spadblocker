# Changelog

All notable changes to Spadblocker are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.2.0] — 2026-05-13

This release rewrites the blocking core to match [rxri/spicetify-extensions/adblock](https://github.com/rxri/spicetify-extensions/tree/main/adblock), the reference implementation that actually works against current Spotify builds. The previous core was effectively a no-op: it mutated a `Cosmo.ProductState` cache object Spotify does not read from, disabled three AdManagers (`audio`/`video`/`display`) that no longer exist by those names, and patched `Array.prototype.push` so aggressively that it broke Spotify's own auth-token refresh — manifesting as "Token is currently unavailable" and a 7-8 second playback stall mid-track.

### Added
- **Real product-state override** via `Platform.UserAPI._product_state.putOverridesValues({ ads:"0", catalogue:"premium", product:"premium", type:"premium" })` — the actual Esperanto API, not the cached object.
- **All six current AdManagers disabled**: `audio`, `billboard`, `leaderboard`, `sponsoredPlaylist`, `inStreamApi`, `vto.manager` (plus `audio.isNewAdsNpvEnabled = false` and `vto.isNewAdsNpvEnabled = false`).
- **Slot subscription**: subscribes to every known ad slot via `audio.inStreamApi.adsCoreConnector.subscribeToSlot` and clears each one as it arrives. Per-slot settings are pinned to `http://localhost/no/thanks` via the Esperanto settings client. Live diagnostic counts 13 slot subscriptions on modern Spotify (`stream`, `preroll`, `podcast-{preroll,midroll-1..5,postroll}`, `billboard`, `sponsored-playlist`, `stream-user-actions`, `embedded-npv`).
- **Auto re-override on state change**: subscribes to `productState.subValues({ keys:["ads","catalogue","product","type"] }, …)` so the override re-applies whenever Spotify pushes a new state. Replaces the brittle `setInterval(overrideProductState, 60_000)`.
- **Spicetify experimental flags**: toggles `hideUpgradeCTA=true`, `enableInAppMessaging=false`, `enablePremiumUserForMiniPlayer=true`, `enableEsperantoMigration=true` via `localStorage` + `Platform.RemoteConfigDebugAPI.setOverride`.
- **Event-driven init**: `Spicetify.Events.platformLoaded` + `webpackLoaded` are awaited before module setup. Init no longer finishes in 5 ms with empty `AdManagers`.
- **`audioDiagnostics`** exposed on `window.Spadblocker.getStatus()` — reports `productStateOverride`, `adManagersDisabled`, `adManagersMissing`, `slotSubscriptions`, `experimentalFeaturesApplied`, plus a `bindToSlots` breakdown.
- **`spicetify` introspection** exposed on `getStatus()` — `adManagerKeys`, `productStateApi`, `productStateOverrides`, `events`.
- **`Spadblocker[boot]` and `Spadblocker[AudioAdBlocker]` boot logs** — independent of `debugMode`, so first-run visibility no longer requires toggling a flag.
- **Pattern Manager → blocker wiring**: enabled UI patterns merge into the active CSS at boot; enabled audio/script patterns merge into `blockedScripts`. Add/delete/toggle dispatches `window:spadblocker:patterns-changed` and the blocker live-reloads.
- **Element Inspector flow** (🔍) — already existed but is now functional and documented; UI patterns auto-generated from clicked elements (`id`, class list, `data-testid`).
- **CHANGELOG.md** (this file). README's Version History section is trimmed to a pointer.

### Changed
- **Build script ordering**: `window.{ConfigValidator,PatternStorage,PatternValidator,PatternSubmissionInterface}` assignments now run **before** the main extension IIFE. When Spotify's document is already loaded, the main IIFE runs synchronously; in the prior order it read undefined globals and the Pattern system silently failed to initialise.
- **`WebpackIntegration.loadModules`** rewritten around rxri's `webpackChunkclient_web.push([[Symbol()], {}, re => re])` pattern. The previous `extractModules()` tried `window.webpackChunk(0)` and `__webpack_require__.cache` — neither exists on current Spotify.
- **`WebpackIntegration.get{Settings,Slots,Testing}Client`** accept `transport` (sourced from `productState.transport`) and recognise both current and legacy `SERVICE_ID`s. `getSettingsClient` also checks the module cache for an already-built `settingsClient`.
- **`AudioAdBlocker.setupAdClients`** resolves `productState` before instantiating any service client so the right transport is in scope.
- **`Spadblocker.#waitForPlatform`** waits for `Spicetify.Events.platformLoaded` and `webpackLoaded` first; the polling fallback also waits for `AdManagers` to actually populate rather than for the Spicetify globals to exist.
- **`window.Spadblocker.version`** is now injected from `package.json` at build time via a `SPADBLOCKER_VERSION` constant. The three call sites that previously had hardcoded `'1.0.0'`/`'1.1.2'` literals now read it via typeof-guarded reference.
- **`getStatus()` return shape**: gains `audioDiagnostics`, `spicetify`, `patternSystem`, `patternCount`; loses `fallbacks`; `config` shrinks to the seven remaining keys.
- **README.md** restructured to reflect actual behaviour. Old "Script Blocking / Fetch Interception" claims removed; Pattern Manager Topbar button + Element Inspector documented; obsolete doc links removed.

### Removed
- **`document.createElement`, `window.fetch`, `Array.prototype.push` monkey-patches** — global, irreversible, and the `Array.prototype.push` patch interfered with Spotify's auth refresh queue (root cause of the 7-8 s playback stall).
- **`window.googletag` stub** — Spotify's current ad delivery does not depend on Google Publisher Tag inside the desktop client.
- **`FallbackManager` class + `src/FallbackManager.test.js`** (~440 lines). Three-tier design (primary/secondary/fallback per feature) had stub `return true` primaries that always "succeeded" so the real fallback CSS never ran. With the rxri-aligned core there is no minimal CSS rule that salvages a failed init anyway.
- **`PremiumFeatures` body**: `Cosmo.ProductState` mutation and `Player._state` tampering removed. The class is now a stub kept for orchestrator lifecycle parity (init/destroy/status). UI-side "looks premium" comes from the Spicetify experimental flags above.
- **Dead CONFIG keys**: `hideUpgradeButtons`, `debounceMs`, `useWeakRef`, `premiumOverrideIntervalMs`, `blockedScripts`, `adSelectors` (six total). Each was either never branched on or its sole consumer was deleted.
- **Inline 35-line `validateConfig()`** in the bootstrap — replaced with `new ConfigValidator().validate(CONFIG)` (the schema validator was already bundled but never invoked).
- **Stale hardcoded `changelog` array** in `dist/version.json` (frozen at v1.0.3, drifted from README). `dist/version.json` now carries `version`, `buildTime`, `buildDate`, `buildHash`, `files` only.

### Fixed
- **`PatternValidator.#checkForDuplicates` tautology** — `existing.id === pattern.id && existing.id !== pattern.id` always evaluated false; duplicate-ID detection was dead code. Corrected.
- **`PatternSubmissionInterface.refreshPatternList()`** was an undefined method called from the Element Inspector flow; replaced with the real `#loadPatternsList()`.
- **`initializePatternSystem` double-init**: two back-to-back `new PatternStorage()` / `new PatternValidator()` constructions on every boot — collapsed to a single re-entry-guarded path.
- **`Spadblocker.#isInitialized = true`** was never assigned on the success path, so `getStatus().initialized` always reported `false` even when every module was up. Now flipped on init success.
- **`Spadblocker[boot]` diagnostic** was added in 1.1.x but reported wrong `adManagerKeys` because it ran before webpack populated `AdManagers`. The new event-driven `#waitForPlatform` fixes this.
- **`failed to reset testing playtime` log spam** — modern Spotify removed `sp://ads/v1/testing/playtime`. The CosmosAsync fallback error is now gated behind `debugMode`.

### Notes
- **Bundle**: 112 KB built / 84 KB minified (down from ~125 KB in 1.1.2). Hash visible via `npm run version`.
- **`PremiumFeatures.modules.premiumFeatures: true`** in `getStatus()` is now informational only — the class is a stub. Toggling `CONFIG.enablePremiumFeatures` has no observable effect.
- **Tests** (`AudioAdBlocker.test.js`, `PerformanceMonitor.test.js`) still test inline mock classes rather than the real bundle. Tracked for a follow-up refactor; not blocking this release because they pass and the real code is independently verified via the in-Spotify `getStatus()` diagnostic.

---

## [1.1.2] — 2026-03-08 — User Pattern Submission Interface
- Implemented comprehensive `PatternSubmissionInterface` class.
- Created modal UI with form validation and pattern management.
- Added real-time pattern add/delete/toggle functionality.
- Built pattern list display with enable/disable controls.
- Designed responsive interface with Spotify theme and backdrop blur.
- Integrated pattern submission into main extension flow.

## [1.1.1] — 2026-03-08 — Pattern Validation Framework
- Implemented comprehensive `PatternValidator` class.
- Added type-specific validation rules for audio/ui/script patterns.
- Enhanced pattern syntax validation and security checks.
- Created duplicate detection and effectiveness validation.
- Built pattern sanitization and error reporting system.

## [1.1.0] — 2026-03-08 — Adaptive Pattern Storage
- Implemented comprehensive `PatternStorage` class.
- Added localStorage-based pattern persistence.
- Created pattern validation and management system.
- Added pattern effectiveness tracking.
- Built import/export functionality for patterns.

## [1.0.4] — 2026-03-08 — Advanced Audio Ad Blocking
- Enhanced audio ad script blocking.
- Added script content filtering.
- Improved fetch request blocking.
- Enhanced performance monitoring.

## [1.0.3] — 2026-03-08 — Generic Banner Ad Blocking
- Added generic class pattern matching.
- Enhanced CSS selectors.
- Improved pattern detection.
- Fixed double initialization.

## [1.0.2] — 2026-03-08 — Double Loading Fix
- Fixed double initialization issue.
- Added initialization guard.
- Improved error handling.
- Enhanced startup performance.

## [1.0.1] — 2026-03-08 — Enhanced Ad Blocking
- Added Google DoubleClick/GPT blocking.
- Added HPTO ad container blocking.
- Enhanced script blocking.
- Improved CSS selectors.

## [1.0.0] — 2026-03-07 — Initial Release
- Initial release with modern ES2023+ architecture.
- Audio ad blocking functionality.
- UI ad removal with real-time monitoring.
- Premium features unlocking.
- Single-file architecture for easy maintenance.
- Performance monitoring and metrics.
- Comprehensive error handling.
- Version management system.

[1.2.0]: https://github.com/keparlak/spadblocker/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/keparlak/spadblocker/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/keparlak/spadblocker/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/keparlak/spadblocker/compare/v1.0.4...v1.1.0
[1.0.4]: https://github.com/keparlak/spadblocker/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/keparlak/spadblocker/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/keparlak/spadblocker/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/keparlak/spadblocker/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/keparlak/spadblocker/releases/tag/v1.0.0
