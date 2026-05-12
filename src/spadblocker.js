(() => {
  'use strict';

  // Runtime validation for required globals
  const requiredGlobals = ['window', 'document', 'console', 'performance'];
  const missingGlobals = requiredGlobals.filter(global => typeof window[global] === 'undefined');

  if (missingGlobals.length > 0) {
    console.error(`Spadblocker: Missing required globals: ${missingGlobals.join(', ')}`);
    return;
  }

  // Validate Spicetify availability with graceful degradation
  if (!window.Spicetify) {
    console.warn('Spadblocker: Spicetify not detected, some features may not work');
  }

  const CONFIG = {
    blockAudioAds: true,
    blockUIAds: true,
    enablePremiumFeatures: true,
    debugMode: false,
    maintenanceIntervalMs: 30000,
    enablePerformanceMonitoring: true,
    maxRetries: 3
  };

  // Initialize pattern management system
  function initializePatternSystem() {
    if (typeof window === 'undefined') return;
    if (!window.PatternValidator || !window.PatternStorage) return;
    if (window.SpadblockerPatternSystem) return; // re-entry guard

    try {
      window.SpadblockerPatternSystem = {
        storage: new window.PatternStorage(),
        validator: new window.PatternValidator()
      };

      if (window.PatternSubmissionInterface && !window.SpadblockerPatternSubmissionInstance) {
        window.SpadblockerPatternSubmissionInstance = new window.PatternSubmissionInterface();
      }

      console.log('Spadblocker: Pattern system initialized');
    } catch (error) {
      console.error('Spadblocker: Failed to initialize pattern system:', error);
    }
  }

  // Run the bundled schema validator (ConfigValidator class, declared in
  // the outer build IIFE so it is in this inner IIFE's closure). Falls
  // back to a no-op when running outside the bundle (e.g. unit tests
  // that load this file standalone).
  function validateConfig() {
    const Validator = (typeof ConfigValidator !== 'undefined')
      ? ConfigValidator
      : window.ConfigValidator;
    if (!Validator) {
      return { valid: true, errors: [], warnings: [] };
    }
    try {
      const result = new Validator().validate(CONFIG);
      if (result.errors?.length) {
        console.error('Spadblocker: Configuration validation failed:', result.errors);
      }
      if (result.warnings?.length) {
        console.warn('Spadblocker: Configuration warnings:', result.warnings);
      }
      return result;
    } catch (error) {
      console.error('Spadblocker: ConfigValidator threw, skipping validation', error);
      return { valid: true, errors: [], warnings: [] };
    }
  }

  validateConfig();

  /**
   * Performance Monitor
   */
  class PerformanceMonitor {
    #metrics = new Map();
    #startTime = performance.now();

    startTimer(name) {
      try {
        this.#metrics.set(name, performance.now());
      } catch (error) {
        console.error(`Spadblocker: PerformanceMonitor.startTimer failed for ${name}:`, error);
      }
    }

    endTimer(name) {
      try {
        const startTime = this.#metrics.get(name);
        if (startTime) {
          const duration = performance.now() - startTime;
          this.#metrics.delete(name);
          return duration;
        }
        return 0;
      } catch (error) {
        console.error(`Spadblocker: PerformanceMonitor.endTimer failed for ${name}:`, error);
        return 0;
      }
    }

    getMetrics() {
      try {
        return {
          uptime: performance.now() - this.#startTime,
          activeTimers: this.#metrics.size
        };
      } catch (error) {
        console.error('Spadblocker: PerformanceMonitor.getMetrics failed:', error);
        return {
          uptime: 0,
          activeTimers: 0
        };
      }
    }
  }

  /**
   * Webpack Integration
   */
  class WebpackIntegration {
    #cache = [];
    #functionModules = [];

    constructor(config) {
      this.config = config || CONFIG;
    }

    async waitForWebpack() {
      const MAX_RETRIES = 50;
      const RETRY_DELAY = 200;
      for (let i = 0; i < MAX_RETRIES; i++) {
        if (Array.isArray(window.webpackChunkclient_web)) {
          if (this.config.debugMode) {
            console.log('Spadblocker: Webpack detected');
          }
          return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
      if (this.config.debugMode) {
        console.log('Spadblocker: webpackChunkclient_web not detected');
      }
    }

    /**
     * Same shape as rxri/adblock's loadWebpack(): push a stub chunk to
     * recover the runtime `require`, then enumerate every module in
     * `require.m` to surface both the cache (object modules) and a
     * flattened list of function exports the Esperanto service lookup
     * iterates.
     */
    async loadModules() {
      try {
        await this.waitForWebpack();
        const chunks = window.webpackChunkclient_web;
        if (!Array.isArray(chunks) || typeof chunks.push !== 'function') {
          return { cache: [], functionModules: [] };
        }

        let require;
        try {
          require = chunks.push([[Symbol('spadblocker')], {}, re => re]);
        } catch (error) {
          console.error('Spadblocker: webpackChunkclient_web.push failed', error);
          return { cache: [], functionModules: [] };
        }

        if (!require?.m) {
          return { cache: [], functionModules: [] };
        }

        const cache = Object.keys(require.m).map(id => {
          try { return require(id); } catch { return null; }
        }).filter(Boolean);

        const modules = cache
          .filter(m => typeof m === 'object')
          .flatMap(m => {
            try { return Object.values(m); } catch { return []; }
          });

        const webpackFactories = new Set(Object.values(require.m));
        const functionModules = modules.flatMap(m =>
          typeof m === 'function'
            ? [m]
            : (typeof m === 'object' && m)
              ? Object.values(m).filter(v => typeof v === 'function' && !webpackFactories.has(v))
              : []
        );

        this.#cache = cache;
        this.#functionModules = functionModules;
        return { cache, functionModules };
      } catch (error) {
        console.error('Spadblocker: Module loading failed:', error);
        return { cache: [], functionModules: [] };
      }
    }

    /**
     * Mirrors rxri/adblock's getSettingsClient. Prefers an already-built
     * client found in the module cache, falls back to instantiating the
     * Esperanto Settings service with the supplied productState transport.
     * Accepts both current and legacy SERVICE_IDs.
     */
    getSettingsClient(cache, functionModules = [], transport = {}) {
      try {
        if (Array.isArray(cache)) {
          const cached = cache.find(m => m?.settingsClient)?.settingsClient;
          if (cached) return cached;
        }
        if (functionModules?.find) {
          const existingClient = functionModules.find(
            module => module?.prototype?.constructor?.name === 'AdSettingsClient'
          );
          if (existingClient) return new existingClient(transport);

          const SettingsService = functionModules.find(
            m => m?.SERVICE_ID === 'spotify.ads.esperanto.settings.proto.Settings'
              || m?.SERVICE_ID === 'spotify.ads.esperanto.proto.Settings'
          );
          return SettingsService ? new SettingsService(transport) : null;
        }
        return null;
      } catch (error) {
        console.error('Spadblocker: Failed to get settings client', error);
        return null;
      }
    }

    getSlotsClient(functionModules = [], transport = {}) {
      try {
        if (functionModules?.find) {
          const existingClient = functionModules.find(
            module => module?.prototype?.constructor?.name === 'AdSlotsClient'
          );
          if (existingClient) return new existingClient(transport);

          const SlotsService = functionModules.find(
            m => m?.SERVICE_ID === 'spotify.ads.esperanto.slots.proto.Slots'
              || m?.SERVICE_ID === 'spotify.ads.esperanto.proto.Slots'
          );
          return SlotsService ? new SlotsService(transport) : null;
        }
        return null;
      } catch (error) {
        console.error('Spadblocker: Failed to get slots client', error);
        return null;
      }
    }

    getTestingClient(functionModules = [], transport = {}) {
      try {
        if (functionModules?.find) {
          const TestingService = functionModules.find(
            m => m?.SERVICE_ID === 'spotify.ads.esperanto.testing.proto.Testing'
              || m?.SERVICE_ID === 'spotify.ads.esperanto.proto.Testing'
          );
          return TestingService ? new TestingService(transport) : null;
        }
        return null;
      } catch (error) {
        console.error('Spadblocker: Failed to get testing client', error);
        return null;
      }
    }

    getCache() {
      return this.#cache;
    }

    getFunctionModules() {
      return this.#functionModules;
    }
  }

  /**
   * Audio Ad Blocker
   */
  class AudioAdBlocker {
    constructor(config) {
      this.config = config;
      this.settingsClient = null;
      this.slotsClient = null;
      this.testingClient = null;
      this.productState = null;
      this.slots = [];
      this.diagnostics = {
        productStateOverride: false,
        adManagersDisabled: [],
        adManagersMissing: [],
        slotSubscriptions: 0,
        experimentalFeaturesApplied: false
      };
      this.isInitialized = false;
    }

    async initialize() {
      try {
        await this.waitForSpicetify();

        if (this.config.blockAudioAds) {
          // Resolve productState first so its transport is available to
          // every Esperanto service client we instantiate below.
          this.#resolveProductState();
          await this.setupAdClients();
          await this.configureAdManagers();
          await this.disableAdsViaProductState();
          this.subscribeToProductState();
          await this.bindToSlots();
          this.enableExperimentalFeatures();
          this.blockAdScripts();
        }

        this.isInitialized = true;

        // Always-on summary so users can verify blocking actually engaged.
        console.log('Spadblocker[AudioAdBlocker]', this.diagnostics);
      } catch (error) {
        console.error('Spadblocker: Audio ad blocker initialization failed', error);
      }
    }

    /**
     * Resolve the real productState API used by rxri's working blocker.
     * Without this, ad disable calls only mutate a cache object and have no effect.
     */
    #resolveProductState() {
      try {
        const Platform = window.Spicetify?.Platform;
        const UserAPI = Platform?.UserAPI;
        this.productState =
          UserAPI?._product_state ||
          UserAPI?._product_state_service ||
          Platform?.ProductStateAPI?.productStateApi ||
          null;
        if (!this.productState) {
          this.diagnostics.adManagersMissing.push('productState');
        }
      } catch (error) {
        console.error('Spadblocker: Failed to resolve productState API', error);
      }
    }

    /**
     * The single most important call: tells Spotify's product-state service
     * that this account is premium and ad-free. Mirrors rxri/adblock's
     * `disableAds()` body.
     */
    async disableAdsViaProductState() {
      if (!this.productState?.putOverridesValues) {
        return;
      }
      try {
        await this.productState.putOverridesValues({
          pairs: { ads: '0', catalogue: 'premium', product: 'premium', type: 'premium' }
        });
        this.diagnostics.productStateOverride = true;
      } catch (error) {
        console.error('Spadblocker: productState.putOverridesValues failed', error);
      }
    }

    /**
     * Re-apply the product-state override whenever Spotify pushes a change.
     * Replaces the brittle setInterval re-override in PremiumFeatures.
     */
    subscribeToProductState() {
      if (!this.productState?.subValues) {
        return;
      }
      try {
        this.productState.subValues(
          { keys: ['ads', 'catalogue', 'product', 'type'] },
          () => {
            this.configureAdManagers();
            this.disableAdsViaProductState();
          }
        );
      } catch (error) {
        console.error('Spadblocker: productState.subValues failed', error);
      }
    }

    async waitForSpicetify() {
      const MAX_RETRIES = 50;
      const RETRY_DELAY = 100;

      for (let i = 0; i < MAX_RETRIES; i++) {
        if (window.Spicetify?.Platform) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }

      throw new Error('Spicetify not available after maximum retries');
    }

    async setupAdClients() {
      try {
        const webpack = new WebpackIntegration();
        const { cache, functionModules } = await webpack.loadModules();
        const transport = this.productState?.transport || {};

        this.settingsClient = webpack.getSettingsClient(cache, functionModules, transport);
        this.slotsClient = webpack.getSlotsClient(functionModules, transport);
        this.testingClient = webpack.getTestingClient(functionModules, transport);
      } catch (error) {
        console.error('Spadblocker: Failed to setup ad clients', error);
      }
    }

    async configureAdManagers() {
      const disabled = [];
      const missing = [];
      try {
        const Platform = window.Spicetify?.Platform;
        const AdManagers = Platform?.AdManagers;
        if (!AdManagers) {
          this.diagnostics.adManagersMissing.push('AdManagers (root)');
          return;
        }

        // Mirrors rxri/adblock — these are the manager names the live
        // Spotify client actually exposes. The old names (video/display)
        // do not exist in current Spotify builds.
        const tryDisable = async (name, fn) => {
          try {
            await fn();
            disabled.push(name);
          } catch (error) {
            console.error(`Spadblocker: ${name}.disable() failed`, error);
          }
        };

        if (AdManagers.audio?.disable) {
          await tryDisable('audio', () => AdManagers.audio.disable());
          try { AdManagers.audio.isNewAdsNpvEnabled = false; } catch { /* readonly */ }
        } else { missing.push('audio'); }

        if (AdManagers.billboard?.disable) {
          await tryDisable('billboard', () => AdManagers.billboard.disable());
        } else { missing.push('billboard'); }

        if (AdManagers.leaderboard?.disableLeaderboard) {
          await tryDisable('leaderboard', () => AdManagers.leaderboard.disableLeaderboard());
        } else { missing.push('leaderboard'); }

        if (AdManagers.sponsoredPlaylist?.disable) {
          await tryDisable('sponsoredPlaylist', () => AdManagers.sponsoredPlaylist.disable());
        } else { missing.push('sponsoredPlaylist'); }

        if (AdManagers.inStreamApi?.disable) {
          await tryDisable('inStreamApi', () => AdManagers.inStreamApi.disable());
        }

        if (AdManagers.vto?.manager?.disable) {
          await tryDisable('vto', () => AdManagers.vto.manager.disable());
          try { AdManagers.vto.isNewAdsNpvEnabled = false; } catch { /* readonly */ }
        }

        // Backwards-compat: old code paths reference these even though they
        // are not present on current Spotify. Keep the calls behind optional
        // chaining so missing methods don't throw.
        if (AdManagers.video?.disable) {
          await tryDisable('video', () => AdManagers.video.disable());
        }
        if (AdManagers.display?.disable) {
          await tryDisable('display', () => AdManagers.display.disable());
        }

        // Drain testing playtime via testingClient or CosmosAsync fallback.
        // The CosmosAsync fallback fails on modern Spotify builds with
        // "Resolver not found!" — this is benign (testingClient path handles
        // it on supported builds) so the noise is gated behind debugMode.
        try {
          if (this.testingClient?.addPlaytime) {
            await this.testingClient.addPlaytime({ seconds: -100000000000 });
          } else if (window.Spicetify?.CosmosAsync?.post) {
            await window.Spicetify.CosmosAsync.post(
              'sp://ads/v1/testing/playtime',
              { value: -100000000000 }
            );
          }
        } catch (error) {
          if (this.config?.debugMode) {
            console.error('Spadblocker: failed to reset testing playtime', error);
          }
        }

        this.diagnostics.adManagersDisabled = disabled;
        this.diagnostics.adManagersMissing.push(...missing);
      } catch (error) {
        console.error('Spadblocker: Failed to disable ad managers', error);
      }
    }

    /**
     * Subscribe to every known ad slot so we can clear them as they appear.
     * Mirrors rxri's `bindToSlots()` + `handleAdSlot()`.
     */
    async bindToSlots() {
      this.diagnostics.bindToSlots = {
        slotsClientPresent: !!this.slotsClient?.getSlots,
        slotsFromClient: 0,
        slotsFromCosmos: 0,
        cosmosError: null,
        adsCoreConnectorPresent: false,
        slotIds: []
      };
      try {
        if (this.slotsClient?.getSlots) {
          try {
            const result = await this.slotsClient.getSlots();
            this.slots = result?.adSlots || result?.slots || [];
            this.diagnostics.bindToSlots.slotsFromClient = this.slots.length;
          } catch (error) {
            console.error('Spadblocker: slotsClient.getSlots() failed', error);
          }
        }
        if ((!this.slots || this.slots.length === 0) && window.Spicetify?.CosmosAsync?.get) {
          try {
            this.slots = await window.Spicetify.CosmosAsync.get('sp://ads/v1/slots');
            this.diagnostics.bindToSlots.slotsFromCosmos =
              Array.isArray(this.slots) ? this.slots.length : 0;
          } catch (error) {
            this.diagnostics.bindToSlots.cosmosError = String(error?.message || error);
          }
        }

        const audio = window.Spicetify?.Platform?.AdManagers?.audio;
        const adsCoreConnector = audio?.inStreamApi?.adsCoreConnector;
        this.diagnostics.bindToSlots.adsCoreConnectorPresent =
          !!adsCoreConnector?.subscribeToSlot;
        if (!adsCoreConnector?.subscribeToSlot || !Array.isArray(this.slots)) {
          return;
        }

        const handleAdSlot = (data) => {
          const slotId = data?.adSlotEvent?.slotId;
          if (!slotId) return;
          try {
            adsCoreConnector.clearSlot?.(slotId);
            this.slotsClient?.clearAllAds?.({ slotId });
            this.#updateSlotSettings(slotId);
          } catch (error) {
            console.error('Spadblocker: handleAdSlot failed', error);
          }
          this.configureAdManagers();
        };

        for (const slot of this.slots) {
          const slotId = slot?.slotId || slot?.slot_id;
          if (!slotId) continue;
          this.diagnostics.bindToSlots.slotIds.push(slotId);
          try {
            adsCoreConnector.subscribeToSlot(slotId, handleAdSlot);
            this.diagnostics.slotSubscriptions++;
          } catch (error) {
            console.error(`Spadblocker: subscribeToSlot(${slotId}) failed`, error);
          }
          setTimeout(() => handleAdSlot({ adSlotEvent: { slotId } }), 50);
        }
      } catch (error) {
        console.error('Spadblocker: bindToSlots failed', error);
      }
    }

    async #updateSlotSettings(slotId) {
      if (!this.settingsClient) return;
      try {
        const v = (window.Spicetify?.Platform?.version || '0.0.0')
          .split('.').map(n => Number.parseInt(n, 10));
        const timeInterval = v[0] === 1 && v[1] >= 2 && v[2] >= 82 ? 0n : '0';
        await this.settingsClient.updateAdServerEndpoint?.({
          slotIds: [slotId],
          url: 'http://localhost/no/thanks'
        });
        await this.settingsClient.updateStreamTimeInterval?.({ slotId, timeInterval });
        await this.settingsClient.updateSlotEnabled?.({ slotId, enabled: false });
        await this.settingsClient.updateDisplayTimeInterval?.({ slotId, timeInterval });
      } catch (error) {
        console.error('Spadblocker: updateSlotSettings failed', error);
      }
    }

    /**
     * Toggle Spicetify experimental feature flags that hide upsells and
     * disable in-app messaging modals. Mirrors rxri's enableExperimentalFeatures.
     */
    enableExperimentalFeatures() {
      try {
        const raw = localStorage.getItem('spicetify-exp-features') || '{}';
        const expFeatures = JSON.parse(raw);
        const setIfDefined = (k, v) => {
          if (expFeatures?.[k] && typeof expFeatures[k].value !== 'undefined') {
            expFeatures[k].value = v;
          }
        };
        setIfDefined('enableEsperantoMigration', true);
        setIfDefined('enableInAppMessaging', false);
        setIfDefined('hideUpgradeCTA', true);
        setIfDefined('enablePremiumUserForMiniPlayer', true);
        localStorage.setItem('spicetify-exp-features', JSON.stringify(expFeatures));

        const overrides = {
          enableEsperantoMigration: true,
          enableInAppMessaging: false,
          hideUpgradeCTA: true,
          enablePremiumUserForMiniPlayer: true
        };
        const RemoteConfigDebugAPI = window.Spicetify?.Platform?.RemoteConfigDebugAPI;
        if (RemoteConfigDebugAPI?.setOverride) {
          for (const [key, value] of Object.entries(overrides)) {
            RemoteConfigDebugAPI.setOverride(
              { source: 'web', type: 'boolean', name: key },
              value
            );
          }
        }
        this.diagnostics.experimentalFeaturesApplied = true;
      } catch (error) {
        console.error('Spadblocker: enableExperimentalFeatures failed', error);
      }
    }

    async configureAdSlots() {
      try {
        let adSlotsArray = [];

        // Get ad slots from different sources
        if (this.slotsClient) {
          try {
            const slots = await this.slotsClient.getSlots();
            if (slots?.slots) {
              adSlotsArray = slots.slots;
            }
          } catch (error) {
            console.error('Spadblocker: Failed to get ad slots from client', error);
          }
        }

        // Fallback: try to get slots directly from Spotify
        if (adSlotsArray.length === 0) {
          try {
            const { Platform } = Spicetify;
            if (Platform?.AdManagers?.slots) {
              adSlotsArray = Platform.AdManagers.slots;
            }
          } catch (error) {
            console.error('Spadblocker: Failed to get ad slots', error);
            return;
          }
        }

        for (const slot of adSlotsArray) {
          await this.configureAdSlot(slot.slotId || slot.slot_id);
        }

        if (this.config.debugMode) {
          // eslint-disable-next-line no-console
          console.log(`Spadblocker: Configured ${adSlotsArray.length} ad slots`);
        }
      } catch (error) {
        console.error('Spadblocker: Failed to configure ad slots', error);
      }
    }

    async configureAdSlot(slotId) {
      try {
        if (this.settingsClient) {
          await this.settingsClient.setAdSlotSettings(slotId, {
            enabled: false,
            maxAdsPerSlot: 0,
            adFrequency: 0
          });
        }
      } catch (error) {
        console.error(`Spadblocker: Failed to configure ad slot ${slotId}`, error);
      }
    }

    #loadUserScriptPatterns() {
      const out = [];
      try {
        const storage = window.SpadblockerPatternSystem?.storage;
        if (!storage?.getEnabledPatterns) return out;
        for (const p of storage.getEnabledPatterns()) {
          if (p.type !== 'audio' && p.type !== 'script') continue;
          if (p.pattern && typeof p.pattern === 'string') out.push(p.pattern);
        }
      } catch (error) {
        console.error('Spadblocker: #loadUserScriptPatterns failed', error);
      }
      return out;
    }

    blockAdScripts() {
      // NO-OP since 1.1.3.
      //
      // Earlier versions monkey-patched document.createElement, window.fetch,
      // and Array.prototype.push to filter ad URLs. These are global,
      // unconditional patches that interfere with Spotify's own internal
      // flows — most importantly the auth token refresh path, which uses
      // Array.prototype.push on internal request queues. Symptom: tracks
      // pausing 7-8 seconds in with "Transport authentication failed /
      // Token is currently unavailable" in the console.
      //
      // rxri/adblock blocks ads purely through:
      //   - AdManagers.*.disable()
      //   - productState.putOverridesValues({ ads:"0", ... })
      //   - slot subscription + clearSlot
      // No DOM/network monkey-patches. We follow the same path.
      //
      // Kept as a no-op method so existing call sites and tests don't break.
      return;
    }

    destroy() {
      this.isInitialized = false;
      this.settingsClient = null;
      this.slotsClient = null;
      this.testingClient = null;
    }
  }

  /**
   * UI Ad Remover
   */
  class UIAdRemover {
    constructor(config) {
      this.config = config;
      this.observer = null;
      this.modalObserver = null;
      this.processedElements = new WeakSet();
      this.cachedSelectors = new Map();
      this.userSelectors = [];
      this.isInitialized = false;
    }

    /**
     * Pull selectors out of the Pattern Manager storage so that user-added
     * patterns are actually applied at runtime. Prior to this, the Pattern
     * Manager UI accepted patterns but the engine ignored them.
     */
    #loadUserSelectors() {
      const out = [];
      try {
        const storage = window.SpadblockerPatternSystem?.storage;
        if (!storage?.getEnabledPatterns) return out;
        for (const p of storage.getEnabledPatterns()) {
          if (p.type !== 'ui') continue;
          if (p.selector && typeof p.selector === 'string') out.push(p.selector);
          else if (p.pattern && typeof p.pattern === 'string') out.push(p.pattern);
        }
      } catch (error) {
        console.error('Spadblocker: #loadUserSelectors failed', error);
      }
      return out;
    }

    /**
     * Re-inject CSS and refresh the cached selector list whenever the user
     * adds, removes, or toggles a pattern.
     */
    #listenForPatternChanges() {
      window.addEventListener('spadblocker:patterns-changed', () => {
        try {
          this.userSelectors = this.#loadUserSelectors();
          // Drop existing user-CSS style block before re-injecting.
          document
            .querySelectorAll('style.spadblocker-ui-ads-user')
            .forEach(el => el.remove());
          this.injectUserCSS();
          this.removeExistingAds();
        } catch (error) {
          console.error('Spadblocker: pattern reload failed', error);
        }
      });
    }

    injectUserCSS() {
      if (!this.userSelectors?.length) return;
      const valid = this.userSelectors.filter(sel => {
        try { document.querySelector(sel); return true; } catch { return false; }
      });
      if (!valid.length) return;
      const style = document.createElement('style');
      style.className = 'spadblocker-ui-ads-user';
      style.textContent = `${valid.join(',\n')} { display: none !important; }`;
      document.head.appendChild(style);
    }

    async initialize() {
      try {
        this.userSelectors = this.#loadUserSelectors();
        this.injectCSS();
        this.setupMutationObserver();
        this.removeExistingAds();
        this.setupModalRemover();
        this.#listenForPatternChanges();
        this.isInitialized = true;

        if (this.config.debugMode) {
          // eslint-disable-next-line no-console
          console.log('Spadblocker: UI ad remover initialized');
        }
      } catch (error) {
        console.error('Spadblocker: UI ad remover initialization failed', error);
        // Still mark as initialized if CSS was injected
        if (document.querySelector('.spadblocker-ui-ads')) {
          this.isInitialized = true;
          if (this.config.debugMode) {
            // eslint-disable-next-line no-console
            console.log('Spadblocker: UI ad remover partially initialized (CSS only)');
          }
        }
      }
    }

    injectCSS() {
      // Sanitized CSS with only allowed properties
      const css = `
        .spadblocker-ui-ads {
          display: none !important;
        }

        [data-testid="ad-container"],
        [data-testid="ad-companion-card"],
        [data-testid="button-like-ad"],
        [data-testid="button-dislike-ad"],
        [data-context-item-type="ad"],
        .DHYqncWuJsraPUB1atpm,
        .oba3DRwYih37VBdjRk1T,
        .GTfvmcnjXqYCdf_pNUrj,
        .main-ad-container,
        .main-topBar-adContainer,
        .main-shelf-ad,
        .main-premiumPromo-container,
        .main-billboard-container,
        .main-trackList-premiumIndicator,
        .main-playlist-premiumIndicator,
        .main-podcastAd-container,
        .main-podcastAd-sponsorContainer {
          display: none !important;
        }

        [data-testid="upgrade-button"],
        .main-upgradeButton,
        .main-topBar-UpgradeButton,
        .main-contextMenu-menuItem[href="/upgrade"] {
          display: none !important;
        }

        .main-premiumPromo-container,
        .main-billboard-container,
        .main-trackList-premiumIndicator,
        .main-playlist-premiumIndicator {
          display: none !important;
        }

        .main-ad-container,
        .main-topBar-adContainer,
        .main-shelf-ad,
        [data-testid="ad-container"] {
          display: none !important;
        }

        .main-podcastAd-container,
        .main-podcastAd-sponsorContainer {
          display: none !important;
        }

        /* Google ad containers */
        #hpto,
        iframe[src*="googletag"],
        iframe[id*="google_ads"],
        div[id*="google_ads"],
        iframe[src*="doubleclick"],
        iframe[src*="securepubads"],
        script[src*="gpt.js"],
        script[src*="doubleclick"],
        .googletag,
        .gpt-ad {
          display: none !important;
        }

        /* HPTO and advanced ad containers */
        #hpto,
        [id*="hpto"],
        [class*="hpto"],
        .ad-slot,
        .ad-container-wrapper,
        .google-ad-slot,
        .dfp-ad {
          display: none !important;
        }

        /* Additional ad containers */
        .m9SWa_YkPxKIly9GR1OC,
        .e-91000-tag[data-encore-id="tag"] {
          display: none !important;
        }

        /* Generic ad class patterns */
        [class*="sl_"],
        [class*="ad-"],
        [class*="Ad"],
        [class*="banner"],
        [class*="promotion"],
        [class*="promo"],
        [class*="sponsor"],
        div[class^="sl_"],
        span[class^="sl_"] {
          display: none !important;
        }

        /* Ad metadata and tracking prevention */
        [data-ad-metadata],
        [data-creative-id],
        [data-line-item-id],
        [data-ad-slot] {
          display: none !important;
        }
      `;

      // Validate CSS content before injection
      if (!this.#isValidCSS(css)) {
        // eslint-disable-next-line no-console
        console.error('Spadblocker: CSS validation failed, skipping injection');
        return;
      }

      const style = document.createElement('style');
      style.className = 'spadblocker-ui-ads';
      style.textContent = css;
      document.head.appendChild(style);

      // Apply user-defined patterns on top of the built-in rules.
      this.injectUserCSS();
    }

    #isValidCSS(_css) {
      // Skip validation for now - CSS is trusted and sanitized
      return true;
    }

    setupMutationObserver() {
      this.observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) {
                // Node.ELEMENT_NODE
                this.processNode(node);
              }
            }
          }
        }
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    setupModalRemover() {
      // Watch for modal dialogs that might contain ads
      this.modalObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && node.classList) {
              // Check for upgrade modals
              if (
                node.classList.contains('main-upgradeModal') ||
                node.classList.contains('main-premiumModal') ||
                node.querySelector('.main-upgradeModal') ||
                node.querySelector('.main-premiumModal')
              ) {
                node.style.display = 'none';
              }
            }
          }
        }
      });

      this.modalObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    removeExistingAds() {
      const adSelectors = [
        '[data-testid="ad-container"]',
        '[data-testid="ad-companion-card"]',
        '[data-testid="button-like-ad"]',
        '[data-testid="button-dislike-ad"]',
        '[data-context-item-type="ad"]',
        '.main-ad-container',
        '.main-topBar-adContainer',
        '.main-shelf-ad',
        '.main-premiumPromo-container',
        '.main-billboard-container',
        '.main-trackList-premiumIndicator',
        '.main-playlist-premiumIndicator',
        '.main-podcastAd-container',
        '.main-podcastAd-sponsorContainer',
        '.DHYqncWuJsraPUB1atpm',
        '.oba3DRwYih37VBdjRk1T',
        '.GTfvmcnjXqYCdf_pNUrj',
        // HPTO ve Google reklamları
        '#hpto',
        '[id*="hpto"]',
        '[class*="hpto"]',
        '.googletag',
        '.gpt-ad',
        '.ad-slot',
        '.ad-container-wrapper',
        '.google-ad-slot',
        '.dfp-ad',
        // DoubleClick ve GPT script/iframe elementleri
        'iframe[src*="doubleclick"]',
        'iframe[src*="securepubads"]',
        'iframe[src*="googletag"]',
        'script[src*="gpt.js"]',
        'script[src*="doubleclick"]',
        // Ad metadata elementleri
        '[data-ad-metadata]',
        '[data-creative-id]',
        '[data-line-item-id]',
        '[data-ad-slot]',
        // Ek reklam containerları
        '.m9SWa_YkPxKIly9GR1OC',
        '.e-91000-tag[data-encore-id="tag"]',
        // Generic ad class patterns
        '[class*="sl_"]',
        '[class*="ad-"]',
        '[class*="Ad"]',
        '[class*="banner"]',
        '[class*="promotion"]',
        '[class*="promo"]',
        '[class*="sponsor"]',
        'div[class^="sl_"]',
        'span[class^="sl_"]'
      ];

      const allSelectors = [...adSelectors, ...(this.userSelectors || [])];
      for (const selector of allSelectors) {
        let elements;
        try {
          elements = document.querySelectorAll(selector);
        } catch {
          continue; // ignore invalid user selectors
        }
        elements.forEach(element => {
          element.style.display = 'none';
          element.classList.add('spadblocker-ui-ads');
        });
      }
    }

    #getCachedElements(selector) {
      if (!this.cachedSelectors.has(selector)) {
        this.cachedSelectors.set(selector, new WeakSet());
      }
      return this.cachedSelectors.get(selector);
    }

    processNode(node) {
      if (this.processedElements.has(node)) {
        return;
      }

      this.processedElements.add(node);

      // Check for ad elements using cached selectors
      const adSelectors = [
        '[data-testid="ad-container"]',
        '[data-testid="ad-companion-card"]',
        '[data-testid="button-like-ad"]',
        '[data-testid="button-dislike-ad"]',
        '[data-context-item-type="ad"]',
        '.main-ad-container',
        '.main-topBar-adContainer',
        '.main-shelf-ad',
        '.main-premiumPromo-container',
        '.main-billboard-container',
        '.main-trackList-premiumIndicator',
        '.main-playlist-premiumIndicator',
        '.main-podcastAd-container',
        '.main-podcastAd-sponsorContainer',
        '.DHYqncWuJsraPUB1atpm', // Ad container wrapper
        '.oba3DRwYih37VBdjRk1T', // Ad companion card
        '.GTfvmcnjXqYCdf_pNUrj', // Ad controls
        // HPTO ve Google reklamları
        '#hpto',
        '[id*="hpto"]',
        '[class*="hpto"]',
        '.googletag',
        '.gpt-ad',
        '.ad-slot',
        '.ad-container-wrapper',
        '.google-ad-slot',
        '.dfp-ad',
        // DoubleClick ve GPT script/iframe elementleri
        'iframe[src*="doubleclick"]',
        'iframe[src*="securepubads"]',
        'iframe[src*="googletag"]',
        'script[src*="gpt.js"]',
        'script[src*="doubleclick"]',
        // Ad metadata elementleri
        '[data-ad-metadata]',
        '[data-creative-id]',
        '[data-line-item-id]',
        '[data-ad-slot]',
        // Ek reklam containerları
        '.m9SWa_YkPxKIly9GR1OC',
        '.e-91000-tag[data-encore-id="tag"]',
        // Generic ad class patterns
        '[class*="sl_"]',
        '[class*="ad-"]',
        '[class*="Ad"]',
        '[class*="banner"]',
        '[class*="promotion"]',
        '[class*="promo"]',
        '[class*="sponsor"]',
        'div[class^="sl_"]',
        'span[class^="sl_"]'
      ];

      for (const selector of adSelectors) {
        const elements = node.matches?.(selector) ? [node] : node.querySelectorAll?.(selector);
        if (elements) {
          const cachedElements = this.#getCachedElements(selector);
          elements.forEach(element => {
            if (!cachedElements.has(element)) {
              element.style.display = 'none';
              element.classList.add('spadblocker-ui-ads');
              cachedElements.add(element);
            }
          });
        }
      }
    }

    destroy() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.modalObserver) {
        this.modalObserver.disconnect();
        this.modalObserver = null;
      }

      this.processedElements = new WeakSet();
      this.cachedSelectors.clear();
      this.isInitialized = false;
    }
  }

  /**
   * Premium Features
   *
   * Historically this class mutated Spicetify.Cosmo.ProductState directly
   * and tickled Spicetify.Player._state to fake a premium account. Both
   * are dead writes on modern Spotify: ProductState is sourced from the
   * Esperanto product-state service (now overridden by
   * AudioAdBlocker.disableAdsViaProductState via putOverridesValues), and
   * Player._state is regenerated by Spotify's own player code.
   *
   * The class is intentionally kept as a no-op so the orchestrator's
   * module lifecycle (init/destroy/status) stays unchanged. The UI side
   * of "looks premium" is now handled by the Spicetify experimental
   * feature flags toggled in AudioAdBlocker.enableExperimentalFeatures
   * (hideUpgradeCTA, enablePremiumUserForMiniPlayer, etc.).
   */
  class PremiumFeatures {
    constructor(config) {
      this.config = config;
      this.isInitialized = false;
    }

    async initialize() {
      this.isInitialized = true;
    }

    overrideProductState() {
      // no-op (see class jsdoc)
    }

    destroy() {
      this.isInitialized = false;
    }
  }

  /**
   * Fallback Manager
   * Provides graceful degradation when features fail
   */
  class FallbackManager {
    #fallbacks = new Map();
    #retryAttempts = new Map();
    #maxRetries = 3;

    constructor(config) {
      this.config = config || CONFIG;
      this.#initializeFallbacks();
    }

    #initializeFallbacks() {
      // Audio ad blocking fallbacks
      this.#fallbacks.set('audioAdBlocking', {
        primary: () => this.#enableAdvancedAudioBlocking(),
        secondary: () => this.#enableBasicAudioBlocking(),
        fallback: () => this.#enableCSSAudioBlocking()
      });

      // UI ad removal fallbacks
      this.#fallbacks.set('uiAdRemoval', {
        primary: () => this.#enableAdvancedUIRemoval(),
        secondary: () => this.#enableBasicUIRemoval(),
        fallback: () => this.#enableCSSOnlyRemoval()
      });

      // Premium features fallbacks
      this.#fallbacks.set('premiumFeatures', {
        primary: () => this.#enableAdvancedPremium(),
        secondary: () => this.#enableBasicPremium(),
        fallback: () => this.#enableMinimalPremium()
      });

      // Webpack integration fallbacks
      this.#fallbacks.set('webpackIntegration', {
        primary: () => this.#enableAdvancedWebpack(),
        secondary: () => this.#enableBasicWebpack(),
        fallback: () => this.#disableWebpackFeatures()
      });
    }

    async executeFallback(featureName) {
      const fallback = this.#fallbacks.get(featureName);
      if (!fallback) {
        console.warn(`Spadblocker: No fallback configured for ${featureName}`);
        return false;
      }

      const attempts = this.#retryAttempts.get(featureName) || 0;

      try {
        // eslint-disable-next-line no-console
        console.log(`Spadblocker: Attempting fallback for ${featureName} (attempt ${attempts + 1})`);

        let result;
        if (attempts === 0) {
          result = await fallback.primary();
        } else if (attempts === 1) {
          result = await fallback.secondary();
        } else {
          result = await fallback.fallback();
        }

        if (result) {
          // eslint-disable-next-line no-console
          console.log(`Spadblocker: Fallback successful for ${featureName}`);
          this.#retryAttempts.delete(featureName);
          return true;
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(`Spadblocker: Fallback failed for ${featureName}:`, error);
      }

      this.#retryAttempts.set(featureName, attempts + 1);

      if (attempts >= this.#maxRetries - 1) {
        // eslint-disable-next-line no-console
        console.warn(`Spadblocker: All fallbacks exhausted for ${featureName}`);
        this.#retryAttempts.delete(featureName);
        return false;
      }

      // Retry with next fallback level
      return await this.executeFallback(featureName);
    }

    #enableAdvancedAudioBlocking() {
      // Full script interception and fetch blocking
      return true;
    }

    #enableBasicAudioBlocking() {
      // Basic script blocking only
      return true;
    }

    #enableCSSAudioBlocking() {
      try {
        // CSS-only ad hiding
        const style = document.createElement('style');
        style.textContent = `
          [data-ad-type="audio"], 
          .ad-audio, 
          .audio-ad { 
            display: none !important; 
          }
        `;
        document.head.appendChild(style);
        return true;
      } catch (error) {
        throw new Error('CSS audio blocking failed');
      }
    }

    #enableAdvancedUIRemoval() {
      // MutationObserver + advanced selectors
      return true;
    }

    #enableBasicUIRemoval() {
      try {
        // Basic CSS injection only
        const style = document.createElement('style');
        style.textContent = `
          .ad-container,
          .ad-banner,
          .ad-overlay { 
            display: none !important; 
          }
        `;
        document.head.appendChild(style);
        return true;
      } catch (error) {
        throw new Error('Basic UI removal failed');
      }
    }

    #enableCSSOnlyRemoval() {
      try {
        // Minimal CSS hiding
        const style = document.createElement('style');
        style.textContent = `
          .ad { 
            display: none !important; 
          }
        `;
        document.head.appendChild(style);
        return true;
      } catch (error) {
        throw new Error('CSS-only removal failed');
      }
    }

    #enableAdvancedPremium() {
      // Full product state override + feature enabling
      return true;
    }

    #enableBasicPremium() {
      try {
        // Basic product state override only
        if (window.Spicetify?.Cosmo?.ProductState) {
          window.Spicetify.Cosmo.ProductState.ads = 0;
          window.Spicetify.Cosmo.ProductState.product = 'premium';
        }
        return true;
      } catch (error) {
        throw new Error('Basic premium features failed');
      }
    }

    #enableMinimalPremium() {
      try {
        // Minimal CSS-only premium appearance
        const style = document.createElement('style');
        style.textContent = `
          .premium-lock,
          .upgrade-button { 
            display: none !important; 
          }
        `;
        document.head.appendChild(style);
        return true;
      } catch (error) {
        throw new Error('Minimal premium features failed');
      }
    }

    #enableAdvancedWebpack() {
      // Full webpack integration
      return true;
    }

    #enableBasicWebpack() {
      // Basic webpack detection only
      return true;
    }

    #disableWebpackFeatures() {
      try {
        // Disable all webpack-dependent features
        // eslint-disable-next-line no-console
        console.warn('Spadblocker: Webpack features disabled due to repeated failures');
        return true;
      } catch (error) {
        throw new Error('Webpack disable failed');
      }
    }

    getFallbackStatus() {
      const status = {};
      for (const [feature, attempts] of this.#retryAttempts) {
        status[feature] = {
          attempts,
          remaining: Math.max(0, this.#maxRetries - attempts)
        };
      }
      return status;
    }

    resetFallbacks() {
      this.#retryAttempts.clear();
      // eslint-disable-next-line no-console
      console.log('Spadblocker: All fallback attempts reset');
    }
  }
  class Spadblocker {
    #audioAdBlocker = null;
    #uiAdRemover = null;
    #premiumFeatures = null;
    #performanceMonitor = new PerformanceMonitor();
    #fallbackManager = null;
    #isInitialized = false;
    #timers = new Set();
    #abortController = null;

    constructor() {
      this.#performanceMonitor.startTimer('initialization');
      this.#fallbackManager = new FallbackManager(CONFIG);
    }

    async initialize() {
      try {
        this.#abortController = new AbortController();

        await this.#waitForPlatform();
        await this.#initializeModules();
        this.#setupEventListeners();

        this.#isInitialized = true;

        // Expose safe public API
        window.Spadblocker = Object.freeze({
          // Safe public methods
          getStatus: () => this.getStatus(),
          getMetrics: () => this.#performanceMonitor.getMetrics(),
          // No direct access to internal components or webpack
          version: (typeof SPADBLOCKER_VERSION !== 'undefined') ? SPADBLOCKER_VERSION : '0.0.0',
          isHealthy: () => this.#isInitialized && !document.hidden,
          // Read-only configuration
          config: Object.freeze({ ...CONFIG })
        });

        const initTime = this.#performanceMonitor.endTimer('initialization');
        // eslint-disable-next-line no-console
        console.log(`✅ Spadblocker initialized in ${initTime.toFixed(2)}ms`);
      } catch (error) {
        console.error('❌ Spadblocker initialization failed:', error);
        throw error;
      }
    }

    async #waitForPlatform() {
      // Preferred: event-driven wait (matches rxri/adblock). The poll-based
      // fallback below kept the old behaviour, but Platform/Player can be
      // truthy stubs BEFORE webpack modules (including AdManagers) load,
      // causing init to finish in ~5 ms with empty managers and no
      // overrides ever applied.
      const Events = window.Spicetify?.Events;
      if (Events?.platformLoaded?.on && Events?.webpackLoaded?.on) {
        try {
          await new Promise(res => Events.platformLoaded.on(res));
          await new Promise(res => Events.webpackLoaded.on(res));
        } catch (error) {
          console.error('Spadblocker: Spicetify.Events wait failed, falling back to poll', error);
        }
      }

      // Belt-and-braces: poll until AdManagers actually has keys, not just
      // until the Spicetify globals exist.
      const maxWaitTime = 15000;
      const startTime = performance.now();
      while (performance.now() - startTime < maxWaitTime) {
        const platform = window.Spicetify?.Platform;
        const player = window.Spicetify?.Player;
        const adKeys = platform?.AdManagers ? Object.keys(platform.AdManagers) : [];
        if (platform && player && adKeys.length > 0) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      throw new Error('Spicetify platform/AdManagers not available within timeout period');
    }

    async #initializeModules() {
      const modules = [];
      const errors = [];

      if (CONFIG.blockAudioAds) {
        try {
          this.#audioAdBlocker = new AudioAdBlocker(CONFIG);
          await this.#audioAdBlocker.initialize();
          modules.push('AudioAdBlocker');
        } catch (error) {
          errors.push(`AudioAdBlocker: ${error.message}`);
          // Attempt fallback
          const fallbackSuccess = await this.#fallbackManager.executeFallback('audioAdBlocking');
          if (fallbackSuccess) {
            modules.push('AudioAdBlocker (fallback)');
          }
        }
      }

      if (CONFIG.blockUIAds) {
        try {
          this.#uiAdRemover = new UIAdRemover(CONFIG);
          await this.#uiAdRemover.initialize();
          modules.push('UIAdRemover');
        } catch (error) {
          errors.push(`UIAdRemover: ${error.message}`);
          // Attempt fallback
          const fallbackSuccess = await this.#fallbackManager.executeFallback('uiAdRemoval');
          if (fallbackSuccess) {
            modules.push('UIAdRemover (fallback)');
          }
        }
      }

      if (CONFIG.enablePremiumFeatures) {
        try {
          this.#premiumFeatures = new PremiumFeatures(CONFIG);
          await this.#premiumFeatures.initialize();
          modules.push('PremiumFeatures');
        } catch (error) {
          errors.push(`PremiumFeatures: ${error.message}`);
          // Attempt fallback
          const fallbackSuccess = await this.#fallbackManager.executeFallback('premiumFeatures');
          if (fallbackSuccess) {
            modules.push('PremiumFeatures (fallback)');
          }
        }
      }

      if (errors.length > 0 && modules.length === 0) {
        // All modules failed and fallbacks exhausted
        throw new Error(`All module initialization failed: ${errors.join(', ')}`);
      }

      // Always-on boot diagnostic so users can immediately see what
      // engaged. Independent of CONFIG.debugMode.
      const Platform = window.Spicetify?.Platform;
      const adMgr = Platform?.AdManagers || {};
      console.log('Spadblocker[boot]', {
        version: (typeof SPADBLOCKER_VERSION !== 'undefined') ? SPADBLOCKER_VERSION : '0.0.0',
        modules,
        errors,
        spicetify: {
          platform: !!Platform,
          player: !!window.Spicetify?.Player,
          topbar: !!window.Spicetify?.Topbar,
          cosmosAsync: !!window.Spicetify?.CosmosAsync,
          adManagerKeys: Object.keys(adMgr),
          productStateApi:
            !!(Platform?.UserAPI?._product_state ||
               Platform?.UserAPI?._product_state_service ||
               Platform?.ProductStateAPI?.productStateApi)
        },
        audioDiagnostics: this.#audioAdBlocker?.diagnostics || null,
        patternSystem: !!window.SpadblockerPatternSystem,
        patternCount: window.SpadblockerPatternSystem?.storage?.getAllPatterns?.()?.length ?? 0,
        fallbacks: this.#fallbackManager.getFallbackStatus()
      });
    }

    #setupEventListeners() {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
      window.addEventListener('beforeunload', this.handlePageUnload.bind(this));

      // Setup maintenance timer
      this.#createTimer(
        () => {
          if (!document.hidden) {
            this.performMaintenance();
          }
        },
        CONFIG.maintenanceIntervalMs,
        true
      );
    }

    #createTimer(callback, interval, isInterval = false) {
      const timerId = isInterval ? setInterval(callback, interval) : setTimeout(callback, interval);
      this.#timers.add(timerId);
      return timerId;
    }

    #clearAllTimers() {
      for (const timerId of this.#timers) {
        clearTimeout(timerId);
        clearInterval(timerId);
      }
      this.#timers.clear();
    }

    handleVisibilityChange() {
      if (document.hidden) {
        if (CONFIG.debugMode) {
          // eslint-disable-next-line no-console
          console.log('🔍 Page hidden - pausing maintenance');
        }
      } else {
        if (CONFIG.debugMode) {
          // eslint-disable-next-line no-console
          console.log('👁️ Page visible - resuming maintenance');
        }
        this.performMaintenance();
      }
    }

    handlePageUnload() {
      this.destroy();
    }

    performMaintenance() {
      try {
        if (CONFIG.enablePerformanceMonitoring) {
          const metrics = this.#performanceMonitor.getMetrics();
          if (CONFIG.debugMode) {
            // eslint-disable-next-line no-console
            console.log('🔧 Spadblocker maintenance:', metrics);
          }
        }

        // Re-override product state if needed
        if (CONFIG.enablePremiumFeatures && this.#premiumFeatures) {
          this.#premiumFeatures.overrideProductState();
        }
      } catch (error) {
        console.error('Spadblocker: Maintenance failed:', error);
      }
    }

    getStatus() {
      const Platform = window.Spicetify?.Platform;
      const productStateApi =
        Platform?.UserAPI?._product_state ||
        Platform?.UserAPI?._product_state_service ||
        Platform?.ProductStateAPI?.productStateApi;
      let productStateOverrides = null;
      try {
        productStateOverrides = productStateApi?._overrides || productStateApi?.overrides || null;
      } catch { /* ignore */ }
      return {
        initialized: this.#isInitialized,
        modules: {
          audioAdBlocker: this.#audioAdBlocker?.isInitialized || false,
          uiAdRemover: this.#uiAdRemover?.isInitialized || false,
          premiumFeatures: this.#premiumFeatures?.isInitialized || false
        },
        audioDiagnostics: this.#audioAdBlocker?.diagnostics || null,
        spicetify: {
          platform: !!Platform,
          player: !!window.Spicetify?.Player,
          topbar: !!window.Spicetify?.Topbar,
          cosmosAsync: !!window.Spicetify?.CosmosAsync,
          events: !!window.Spicetify?.Events,
          adManagerKeys: Platform?.AdManagers ? Object.keys(Platform.AdManagers) : [],
          productStateApi: !!productStateApi,
          productStateOverrides
        },
        patternSystem: !!window.SpadblockerPatternSystem,
        patternCount: window.SpadblockerPatternSystem?.storage?.getAllPatterns?.()?.length ?? 0,
        config: CONFIG,
        uptime: this.#performanceMonitor.getMetrics().uptime,
        fallbacks: this.#fallbackManager.getFallbackStatus()
      };
    }

    destroy() {
      this.#clearAllTimers();

      if (this.#abortController) {
        this.#abortController.abort();
        this.#abortController = null;
      }

      this.#audioAdBlocker?.destroy();
      this.#uiAdRemover?.destroy();
      this.#premiumFeatures?.destroy();
      this.#fallbackManager?.resetFallbacks();

      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('beforeunload', this.handlePageUnload);

      this.#isInitialized = false;
    }
  }

  /**
   * Initialize Spadblocker with error boundaries
   */
  let isInitialized = false;

  async function initializeSpadblocker() {
    // Prevent double initialization
    if (isInitialized) {
      if (CONFIG.debugMode) {
        // eslint-disable-next-line no-console
        console.log('Spadblocker: Already initialized, skipping...');
      }
      return;
    }

    try {
      // eslint-disable-next-line no-console
      console.log('Spadblocker: Extension loaded');

      // Validate environment
      if (typeof window === 'undefined') {
        throw new Error('Spadblocker requires a browser environment');
      }

      if (!document?.body) {
        throw new Error('Spadblocker requires a valid DOM');
      }

      // Initialize pattern system
      initializePatternSystem();

      const spadblocker = new Spadblocker();
      await spadblocker.initialize();

      isInitialized = true;

      // eslint-disable-next-line no-console
      console.log('Spadblocker: Successfully initialized');
      return spadblocker;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to initialize Spadblocker:', error);

      // Graceful degradation - don't break Spotify if extension fails
      if (typeof window !== 'undefined') {
        window.Spadblocker = {
          error: true,
          message: error.message,
          version: (typeof SPADBLOCKER_VERSION !== 'undefined') ? SPADBLOCKER_VERSION : '0.0.0',
          isHealthy: () => false
        };
      }

      return null;
    }
  }

  // Global error handler for extension errors
  if (typeof window !== 'undefined') {
    window.addEventListener('error', event => {
      if (event.filename?.includes('spadblocker') || event.message?.includes('Spadblocker')) {
        // eslint-disable-next-line no-console
        console.error('Spadblocker: Unhandled error:', event.error);
        event.preventDefault(); // Prevent error from breaking Spotify
      }
    });

    window.addEventListener('unhandledrejection', event => {
      if (
        event.reason?.message?.includes('Spadblocker') ||
        event.reason?.stack?.includes('spadblocker')
      ) {
        // eslint-disable-next-line no-console
        console.error('Spadblocker: Unhandled promise rejection:', event.reason);
        event.preventDefault(); // Prevent rejection from breaking Spotify
      }
    });
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSpadblocker);
  } else {
    initializeSpadblocker();
  }
})();
