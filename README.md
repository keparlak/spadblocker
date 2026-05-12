# Spadblocker

Modern Spotify adblocker extension with ES2023+ features that eliminates ads and unlocks premium features for free users.

## Features

- 🎵 **Audio Ad Blocking** - Blocks audio ads between songs
- 🖼️ **UI Ad Removal** - Hides upgrade buttons, banners, and premium prompts
- ⭐ **Premium Features** - Unlocks shuffle, queue, high quality, and more
- 🚀 **Modern Architecture** - Built with ES2023+ features and performance monitoring
- 📦 **Version Management** - Automatic version tracking and deployment system
- 🛡️ **Advanced Protection** - Blocks Google DoubleClick, HPTO, and generic ad patterns
- 🎯 **Pattern Manager** - User-friendly interface for adding custom ad blocking patterns
- 🔍 **Pattern Validation** - Real-time validation and security checks for user patterns
- 💾 **Pattern Storage** - Persistent storage for user-submitted patterns

## Installation

### Prerequisites

- [Spicetify](https://spicetify.app/) installed and configured
- Spotify desktop client

### Quick Install

1. **Download the latest release** from the [dist](dist/) folder:
   - `spadblocker.js` - Main extension file

2. **Copy to Spicetify Extensions folder**:
   ```bash
   # Windows
   copy spadblocker.js "%appdata%\spicetify\Extensions\"
   
   # Linux/macOS
   cp spadblocker.js ~/.config/spicetify/Extensions/
   ```

3. **Register with Spicetify**:
   ```bash
   spicetify config extensions spadblocker.js
   spicetify apply
   ```

4. **Restart Spotify** completely

### Build from Source

```bash
# Clone the repository
git clone https://github.com/keparlak/spadblocker.git
cd spadblocker

# Install dependencies
npm install

# Build the extension
npm run build

# Deploy
npm run version:deploy
spicetify apply
```

### Version Management

```bash
# Check current version
npm run version

# Deploy current version
npm run version:deploy

# Build with version bump
npm run build
```

## Verification

Open Spotify's developer console (F12) and check for:
```
Spadblocker: Extension loaded
Spadblocker: Successfully initialized
```

You can also check the status:
```javascript
window.Spadblocker?.getStatus()
```

Expected response (abbreviated):
```json
{
  "initialized": true,
  "modules": {
    "audioAdBlocker": true,
    "uiAdRemover": true,
    "premiumFeatures": true
  },
  "audioDiagnostics": {
    "productStateOverride": true,
    "adManagersDisabled": ["audio", "billboard", "leaderboard",
                          "sponsoredPlaylist", "inStreamApi", "vto"],
    "slotSubscriptions": 13,
    "experimentalFeaturesApplied": true
  },
  "patternSystem": true,
  "patternCount": 4,
  "uptime": 12345.67
}
```

The `audioDiagnostics` block reports whether each blocking primitive
engaged. `productStateOverride: true` and a non-empty `adManagersDisabled`
array are the markers that the core is working.

## Features in Detail

### Audio Ad Blocking
- Disables all six `Spicetify.Platform.AdManagers` streams Spotify exposes:
  `audio`, `billboard`, `leaderboard`, `sponsoredPlaylist`, `inStreamApi`,
  `vto` (plus `audio.isNewAdsNpvEnabled = false`).
- Overrides the Esperanto product-state service via
  `productState.putOverridesValues({ ads: "0", catalogue: "premium",
  product: "premium", type: "premium" })` — the real API, not the
  legacy `Cosmo.ProductState` cache.
- Subscribes to product-state changes so the override re-applies
  automatically whenever Spotify pushes new state.
- Subscribes to every ad slot via
  `audio.inStreamApi.adsCoreConnector.subscribeToSlot` and clears each
  one as it arrives (`clearSlot`, `slotsClient.clearAllAds`,
  `updateAdServerEndpoint("http://localhost/no/thanks")`).

### UI Ad Removal
- Static CSS block hides upgrade buttons, premium-promo containers,
  podcast sponsor cards, HPTO containers, and Google ad iframes.
- `MutationObserver` on `document.body` catches ad nodes inserted at
  runtime; processed nodes are tracked in a `WeakSet` for free GC.
- A second observer drops `.main-upgradeModal` / `.main-premiumModal`
  on insertion.
- Enabled UI patterns from the Pattern Manager are merged into the
  CSS at boot and live-reload on add/remove via the
  `spadblocker:patterns-changed` event.

### Premium Features
The historical Premium "unlocker" path is now a no-op shell — the
`Cosmo.ProductState` cache mutations it performed were dead writes on
modern Spotify, and the real premium-equivalent state comes from the
product-state override above plus the experimental feature flags
listed under Advanced Protection.

### Advanced Protection
- **Spicetify experimental flags**: at boot we toggle
  `hideUpgradeCTA=true`, `enableInAppMessaging=false`,
  `enablePremiumUserForMiniPlayer=true`, and
  `enableEsperantoMigration=true` via `localStorage` and
  `Platform.RemoteConfigDebugAPI.setOverride` so upsells and in-app
  messages stop firing.
- **Per-slot settings**: `settingsClient.updateSlotEnabled(false)` plus
  ad-server URL redirected to localhost for each known slot.
- **No DOM/network monkey-patches**: earlier versions monkey-patched
  `document.createElement`, `window.fetch`, and
  `Array.prototype.push`. They were removed in 1.2.0 because they
  interfered with Spotify's own auth-token refresh queue, surfacing as
  "Token is currently unavailable" mid-playback.

## Development

### Documentation

Read [src/spadblocker.js](src/spadblocker.js) — the codebase is single-file and intentionally compact. Spicetify reference: <https://spicetify.app/docs/development/api-wrapper>.

### Project Structure

```
spadblocker/
├── src/
│   ├── spadblocker.js          # Main runtime (IIFE) — orchestrator,
│   │                            # AudioAdBlocker, UIAdRemover,
│   │                            # PremiumFeatures, WebpackIntegration,
│   │                            # PerformanceMonitor
│   ├── ConfigValidator.js      # Schema-based CONFIG validator
│   ├── PatternStorage.js       # localStorage-backed CRUD for patterns
│   ├── PatternValidator.js     # Type-aware pattern validation
│   ├── PatternSubmissionInterface.js  # Pattern Manager DOM modal +
│   │                                   # Element Inspector overlay
│   ├── setupTests.js           # Jest globals + Spicetify mocks
│   └── *.test.js               # Jest unit tests
├── scripts/
│   ├── build.cjs               # Concatenator + minifier + packager
│   ├── version.cjs             # Show/deploy current build
│   ├── dev.js                  # Watch + rebuild
│   ├── test.cjs                # Syntax/structure smoke tests
│   ├── jest-runner.cjs         # Jest wrapper
│   └── analyze-bundle.cjs      # Bundle-size report
├── dist/                       # Generated (gitignored)
│   ├── spadblocker.js          # Built extension
│   ├── spadblocker.min.js      # Minified
│   ├── package/                # Installation package
│   └── version.json            # Build metadata (version + hash)
├── CHANGELOG.md                # Release notes
├── eslint.config.js            # ESLint flat config
├── .prettierrc                 # Prettier config
├── jest.config.json            # Jest config
└── package.json                # Project metadata + npm scripts
```

### Available Scripts

```bash
npm run build           # Build the extension (dist/)
npm run version         # Show current build version + hash
npm run version:deploy  # Copy dist/package/spadblocker.js to temp/extensions/
npm run dev             # Initial build + watch src/ and rebuild on change
npm test                # Smoke tests (syntax + structure)
npm run test:unit       # Jest unit tests
npm run test:watch      # Jest watch mode
npm run test:coverage   # Jest with coverage
npm run lint            # ESLint over src/ and scripts/
npm run format          # Prettier over src/ and scripts/
npm run size            # Bundle-size report
npm run security        # npm audit
```

### Architecture

The extension is built as a single concatenated IIFE bundle. Source
classes live in separate files under `src/` and `scripts/build.cjs`
joins them in dependency order. Highlights:

- **ES2023+ idioms**: private class fields (`#field`), `WeakSet` for
  DOM tracking, `AbortController` for cancelable lifecycles,
  event-driven init via `Spicetify.Events.{platformLoaded,webpackLoaded}`.
- **rxri/adblock-aligned core**: ad blocking uses Spotify's own
  Esperanto services (productState `putOverridesValues`, all six
  `AdManagers`, slot subscription via `adsCoreConnector`) rather than
  fragile DOM/network monkey-patches.
- **Pattern Manager**: a `localStorage`-backed CRUD system with a
  modal UI and click-to-pick Element Inspector; user patterns merge
  into the active blocklist live.
- **Self-instrumentation**: `window.Spadblocker.getStatus()` returns
  the boot diagnostic so users can audit which primitives engaged.

## Configuration

Behaviour is controlled by the `CONFIG` object in [src/spadblocker.js](src/spadblocker.js):

```javascript
const CONFIG = {
  blockAudioAds: true,                // Audio ad pipeline disabled
  blockUIAds: true,                   // CSS + MutationObserver UI cleanup
  enablePremiumFeatures: true,        // No-op shell on modern Spotify;
                                      //   premium-equivalent state comes
                                      //   from the productState override
                                      //   in AudioAdBlocker
  debugMode: false,                   // Verbose console logs
  maintenanceIntervalMs: 30000,       // Maintenance pass cadence (ms)
  enablePerformanceMonitoring: true,  // Periodic getMetrics() log gate
  maxRetries: 3                       // Per-feature retry budget
};
```

A schema-based validator (`ConfigValidator`) runs at boot. Unknown
keys or out-of-range numerics surface as console warnings.

## Using the Pattern Manager

### Accessing the Interface

The Pattern Manager mounts a button in Spotify's top bar via
`Spicetify.Topbar.Button` (label "Pattern Manager"). If the Topbar
API is unavailable, a floating 🎯 button appears in the upper-right
corner as a fallback. Either button toggles the manager modal.

### Adding New Patterns

You can add patterns two ways:

**1) Manually via the form**

1. Open the Pattern Manager
2. Fill in:
   - **Pattern ID**: Unique identifier (e.g. `custom-audio-ad-1`)
   - **Type**: Audio Ad, UI Ad, or Script
   - **Pattern**: substring (audio/script) or CSS selector (ui),
     e.g. `ad-`, `.ad-banner`
   - **CSS Selector** (optional, required for UI patterns)
   - **Effectiveness**: 0.0–1.0 self-reported confidence
3. Click **Add Pattern**

**2) Visually via the Element Inspector (🔍)**

1. Click the **🔍 Inspect** button in the modal header
2. Hover any DOM element — it highlights green
3. Click to capture it. A UI pattern is auto-generated from the
   element's `id`, class list, or `data-testid` and added to storage
4. Press **Esc** to cancel without picking

New / toggled / deleted patterns dispatch the
`spadblocker:patterns-changed` event so the active blocklist
reloads without restarting Spotify.

### Managing Patterns

The Pattern Manager shows all existing patterns with:
- **Pattern ID** and **type**
- **Pattern string** and **effectiveness**
- **Enable/Disable** toggle buttons
- **Delete** button for removal

### Pattern Types

- **Audio Ad**: Targets audio ad scripts and URLs
- **UI Ad**: Targets visual ad elements with CSS selectors
- **Script**: Blocks script loading and execution

### Best Practices

- **Be Specific**: Use precise patterns for better blocking
- **Test Effectiveness**: Monitor pattern success rate
- **Avoid Overly Broad**: Don't block legitimate content
- **Regular Updates**: Update patterns as Spotify changes

### Pattern Examples

```javascript
// Audio ad pattern
{
  id: "audio-ad-blocker-v2",
  type: "audio",
  pattern: "ad-",
  effectiveness: 0.9
}

// UI ad pattern
{
  id: "ui-banner-remover",
  type: "ui",
  pattern: ".ad-banner",
  selector: ".ad-banner",
  effectiveness: 0.85
}

// Script pattern
{
  id: "script-blocker",
  type: "script",
  pattern: "doubleclick",
  effectiveness: 0.95
}
```

## Version History

Full release notes live in [CHANGELOG.md](CHANGELOG.md).

Latest: **1.2.0** — rxri/adblock-aligned core (real `productState` override,
6 AdManagers, slot subscription, experimental flags). Removes the
DOM/network monkey-patches that previously broke Spotify's auth refresh.

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Ensure Spicetify is properly installed
   - Check file permissions
   - Run `spicetify apply` again
   - Check version status with `npm run version`

2. **Ads still appearing**
   - Restart Spotify completely
   - Check console for blocked script logs
   - Verify status with `window.Spadblocker?.getStatus()`
   - Report new ad patterns for inclusion

3. **Performance issues**
   - Enable debug mode to see metrics
   - Check for memory leaks
   - Monitor event listener cleanup
   - Optimize CSS selectors

4. **Version conflicts**
   - Check current deployed version
   - Use `npm run version` to compare
   - Deploy latest version with `npm run version:deploy`

### Debug Mode

Enable debug mode by setting `debugMode: true` in the CONFIG object to see detailed logging.

### Getting Help

- **Console**: Check DevTools console for errors
- **Logs**: Look for `🚫 Spadblocker blocked` messages
- **Status**: Use `window.Spadblocker?.getStatus()` for health check
- **Issues**: Report bugs on GitHub Issues
- **Community**: Join Discord/Reddit communities

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Use ESLint for code formatting
- Follow existing naming conventions
- Add JSDoc comments for functions
- Write clear, descriptive commit messages
- Test with different Spotify versions

### Testing Requirements

- Test all major functionality
- Verify with different Spotify versions
- Check performance impact
- Ensure backward compatibility
- Report version changes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Based on [spicetify-extensions/adblock](https://github.com/rxri/spicetify-extensions/tree/main/adblock)
- Built with modern JavaScript best practices
- Compatible with latest Spotify client versions
- Enhanced with advanced ad blocking patterns

---

## Resources

### Official Documentation
- [Spicetify Docs](https://spicetify.app/docs/)
- [API Reference](https://spicetify.app/docs/development/api-wrapper)
- [Extension Guide](https://spicetify.app/docs/development/extensions)
- [Spicetify Creator](https://spicetify.app/docs/development/spicetify-creator)

### Community
- [Spicetify Discord](https://discord.gg/VnyqWzAqAz)
- [r/spicetify](https://reddit.com/r/spicetify)
- [GitHub Discussions](https://github.com/spicetify/spicetify-cli/discussions)

---

**Enjoy ad-free Spotify!** 🎵
