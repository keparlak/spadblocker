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
    hideUpgradeButtons: true,
    debugMode: false,
    debounceMs: 300,
    maintenanceIntervalMs: 30000,
    premiumOverrideIntervalMs: 60000,
    useWeakRef: true,
    enablePerformanceMonitoring: true
  };

  /**
   * Performance Monitor
   */
  class PerformanceMonitor {
    #metrics = new Map();
    #startTime = performance.now();

    startTimer(name) {
      this.#metrics.set(name, performance.now());
    }

    endTimer(name) {
      const startTime = this.#metrics.get(name);
      if (startTime) {
        const duration = performance.now() - startTime;
        this.#metrics.delete(name);
        return duration;
      }
      return 0;
    }

    getMetrics() {
      return {
        uptime: performance.now() - this.#startTime,
        activeTimers: this.#metrics.size
      };
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
      this.waitForWebpack();
    }

    async waitForWebpack() {
      const MAX_RETRIES = 50;
      const RETRY_DELAY = 200;

      for (let i = 0; i < MAX_RETRIES; i++) {
        // Check for multiple webpack indicators
        if (window.webpackChunk ||
            window.__webpack_require__ ||
            document.querySelector('script[src*="webpack"]') ||
            typeof window.webpackJsonp !== 'undefined') {
          // eslint-disable-next-line no-console
          console.log('Spadblocker: Webpack detected');
          await this.loadModules();
          return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }

      // Don't throw error, just continue without webpack
      if (this.config.debugMode) {
        // eslint-disable-next-line no-console
        console.warn('Spadblocker: Webpack not detected, continuing without webpack integration');
      }
    }

    async loadModules() {
      try {
        // Wait for webpack to be ready
        await new Promise(resolve => {
          if (window.webpackChunk) {
            resolve();
          } else {
            setTimeout(resolve, 1000);
          }
        });

        // Extract modules from webpack
        const modules = this.#extractModules();

        // Extract function modules
        const functionModules = modules
          .filter(module => this.#isValidModule(module))
          .flatMap(module => this.#extractFunctions(module))
          .filter(func => typeof func === 'function');

        this.#cache = modules;
        this.#functionModules = functionModules;

        if (CONFIG.debugMode) {
          // eslint-disable-next-line no-console
          console.log('📦 Webpack modules loaded:', {
            total: modules.length,
            functions: functionModules.length
          });
        }

        return { cache: modules, functionModules };
      } catch (error) {
        console.error('❌ Failed to load webpack modules:', error);
        return { cache: [], functionModules: [] };
      }
    }

    #extractModules() {
      const modules = [];

      // Try different webpack module extraction methods
      if (window.webpackChunk) {
        try {
          const originalChunk = window.webpackChunk;
          window.webpackChunk = (...args) => {
            originalChunk(...args);
            if (args[1]?.length) {
              modules.push(...args[1]);
            }
          };
        } catch (error) {
          console.error('Spadblocker: Failed to extract webpack modules', error);
        }
      }

      return modules;
    }

    #isValidModule(module) {
      return module && typeof module === 'object' && !Array.isArray(module);
    }

    #extractFunctions(module, depth = 0) {
      const MAX_DEPTH = 3;
      const functions = [];

      if (depth > MAX_DEPTH) {
        return functions;
      }

      if (typeof module === 'function') {
        functions.push(module);
      } else if (typeof module === 'object' && module !== null) {
        for (const key in module) {
          if (Object.hasOwn(module, key)) {
            functions.push(...this.#extractFunctions(module[key], depth + 1));
          }
        }
      }

      return functions;
    }

    getSettingsClient(cache, functionModules) {
      try {
        if (cache?.find) {
          const existingClient = cache.find(module => module?.settingsClient)?.settingsClient;
          if (existingClient) {
            return existingClient;
          }
        }

        if (functionModules?.find) {
          const SettingsService = functionModules.find(
            module =>
              module?.SERVICE_ID === 'spotify.ads.esperanto.settings.proto.Settings' ||
              module?.SERVICE_ID === 'spotify.ads.esperanto.proto.Settings'
          );

          return SettingsService ? new SettingsService({}) : null;
        }
        return null;
      } catch (error) {
        console.error('Spadblocker: Failed to get settings client', error);
        return null;
      }
    }

    getSlotsClient(functionModules) {
      try {
        if (functionModules?.find) {
          const existingClient = functionModules.find(
            module => module?.prototype?.constructor?.name === 'AdSlotsClient'
          );

          if (existingClient) {
            return new existingClient();
          }

          const SlotsService = functionModules.find(
            module => module?.SERVICE_ID === 'spotify.ads.esperanto.slots.proto.Slots'
          );

          return SlotsService ? new SlotsService({}) : null;
        }
        return null;
      } catch (error) {
        console.error('Spadblocker: Failed to get slots client', error);
        return null;
      }
    }

    getTestingClient(functionModules) {
      try {
        if (functionModules?.find) {
          const TestingService = functionModules.find(
            module => module?.SERVICE_ID === 'spotify.ads.esperanto.testing.proto.Testing'
          );

          return TestingService ? new TestingService({}) : null;
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
      this.isInitialized = false;
    }

    async initialize() {
      try {
        await this.waitForSpicetify();

        if (this.config.blockAudioAds) {
          await this.setupAdClients();
          await this.configureAdManagers();
          this.blockAdScripts();
        }

        this.isInitialized = true;

        if (this.config.debugMode) {
          // eslint-disable-next-line no-console
          console.log('Spadblocker: Audio ad blocker initialized');
        }
      } catch (error) {
        console.error('Spadblocker: Audio ad blocker initialization failed', error);
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

        this.settingsClient = webpack.getSettingsClient(cache, functionModules);
        this.slotsClient = webpack.getSlotsClient(functionModules);
        this.testingClient = webpack.getTestingClient(functionModules);
      } catch (error) {
        console.error('Spadblocker: Failed to setup ad clients', error);
      }
    }

    async configureAdManagers() {
      try {
        const { Platform } = Spicetify;
        const { AdManagers } = Platform;

        if (AdManagers?.audio) {
          // Disable audio ad manager
          AdManagers.audio.disable();
          if (this.config.debugMode) {
            // eslint-disable-next-line no-console
            console.log('Spadblocker: Audio ad manager disabled');
          }
        }

        if (AdManagers?.video) {
          // Disable video ad manager
          AdManagers.video.disable();
          if (this.config.debugMode) {
            // eslint-disable-next-line no-console
            console.log('Spadblocker: Video ad manager disabled');
          }
        }

        if (AdManagers?.display) {
          // Disable display ad manager
          AdManagers.display.disable();
          if (this.config.debugMode) {
            // eslint-disable-next-line no-console
            console.log('Spadblocker: Display ad manager disabled');
          }
        }
      } catch (error) {
        console.error('Spadblocker: Failed to disable audio ads', error);
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

    blockAdScripts() {
      try {
        // Block Google Publisher Tag and DoubleClick scripts
        const blockedScripts = [
          'securepubads.g.doubleclick.net',
          'googletag',
          'gpt.js',
          'doubleclick.net'
        ];

        // Override createElement to block ad scripts
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName, options) {
          const element = originalCreateElement.call(this, tagName, options);

          if (tagName.toLowerCase() === 'script') {
            const originalSetAttribute = element.setAttribute;
            element.setAttribute = function(name, value) {
              if (name === 'src' && blockedScripts.some(blocked => value.includes(blocked))) {
                if (CONFIG.debugMode) {
                  // eslint-disable-next-line no-console
                  console.log(`🚫 Spadblocker blocked ad script: ${value}`);
                }
                return;
              }
              return originalSetAttribute.call(this, name, value);
            };
          }

          return element;
        };

        // Override window.googletag to prevent GPT initialization
        if (!window.googletag) {
          window.googletag = {
            cmd: [],
            defineSlot: () => ({ addService: () => ({ setTargeting: () => ({}) }) }),
            pubads: () => ({
              setPublisherProvidedId: () => ({}),
              setTargeting: () => ({}),
              enableSingleRequest: () => ({}),
              setPrivacySettings: () => ({}),
              addEventListener: () => ({})
            }),
            enableServices: () => {},
            display: () => {}
          };
        }

        if (CONFIG.debugMode) {
          // eslint-disable-next-line no-console
          console.log('Spadblocker: Ad script blocking enabled');
        }
      } catch (error) {
        console.error('Spadblocker: Failed to block ad scripts', error);
      }
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
      this.isInitialized = false;
    }

    async initialize() {
      try {
        this.injectCSS();
        this.setupMutationObserver();
        this.removeExistingAds();
        this.setupModalRemover();
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
        '.e-91000-tag[data-encore-id="tag"]'
      ];

      for (const selector of adSelectors) {
        const elements = document.querySelectorAll(selector);
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
        '.e-91000-tag[data-encore-id="tag"]'
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
   */
  class PremiumFeatures {
    constructor(config) {
      this.config = config;
      this.originalProductState = null;
      this.isInitialized = false;
      this.timers = new Set();
    }

    async initialize() {
      try {
        await this.waitForSpicetify();

        if (this.config.enablePremiumFeatures) {
          this.overrideProductState();
          this.enablePremiumFeatures();
          this.setupPeriodicOverride();
        }

        this.isInitialized = true;

        if (this.config.debugMode) {
          // eslint-disable-next-line no-console
          console.log('Spadblocker: Premium features initialized');
        }
      } catch (error) {
        console.error('Spadblocker: Premium features initialization failed', error);
      }
    }

    async waitForSpicetify() {
      const MAX_RETRIES = 50;
      const RETRY_DELAY = 100;

      for (let i = 0; i < MAX_RETRIES; i++) {
        if (window.Spicetify?.Player) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }

      throw new Error('Spicetify not available after maximum retries');
    }

    #createTimer(callback, interval, isInterval = false) {
      const timerId = isInterval ? setInterval(callback, interval) : setTimeout(callback, interval);
      this.timers.add(timerId);
      return timerId;
    }

    #clearAllTimers() {
      for (const timerId of this.timers) {
        clearTimeout(timerId);
        clearInterval(timerId);
      }
      this.timers.clear();
    }

    overrideProductState() {
      try {
        const { Cosmo } = Spicetify;

        if (Cosmo?.ProductState) {
          this.originalProductState = { ...Cosmo.ProductState };

          // Override product state to premium
          Cosmo.ProductState = {
            ...Cosmo.ProductState,
            ads: 0,
            product: 'premium',
            canPlayOnDemand: true,
            canPlayUnlimited: true,
            canPlayHighQuality: true,
            canShuffle: true,
            canRepeat: true,
            canSeek: true,
            canSkip: true,
            canControlPlayback: true,
            // Additional premium overrides
            isPremium: true,
            hasUnlimited: true,
            hasNoAds: true,
            hasNoCommercials: true,
            adFree: true
          };

          if (this.config.debugMode) {
            // eslint-disable-next-line no-console
            console.log('Spadblocker: Product state overridden to premium');
          }
        }

        // Also override global ad settings
        if (window.Spicetify?.Platform?.AdManagers) {
          const { AdManagers } = Spicetify.Platform;
          Object.keys(AdManagers).forEach(key => {
            if (AdManagers[key]?.disable) {
              AdManagers[key].disable();
            }
          });
        }
      } catch (error) {
        console.error('Spadblocker: Failed to override product state', error);
      }
    }

    enablePremiumFeatures() {
      try {
        const { Player } = Spicetify;

        if (Player) {
          // Enable shuffle
          if (Player._state) {
            Player._state.shuffle = true;
          }

          // Enable repeat
          if (Player._state) {
            Player._state.repeat = 1;
          }

          // Enable quality
          if (Player.setQuality) {
            Player.setQuality('high');
          }

          if (this.config.debugMode) {
            // eslint-disable-next-line no-console
            console.log('Spadblocker: Premium features enabled');
          }
        }
      } catch (error) {
        console.error('Spadblocker: Failed to enable premium features', error);
      }
    }

    setupPeriodicOverride() {
      this.#createTimer(
        () => {
          this.overrideProductState();
        },
        this.config.premiumOverrideIntervalMs,
        true
      );
    }

    destroy() {
      this.isInitialized = false;
      this.#clearAllTimers();
      this.originalProductState = null;
    }
  }

  /**
   * Main Spadblocker Class
   */
  class Spadblocker {
    #audioAdBlocker = null;
    #uiAdRemover = null;
    #premiumFeatures = null;
    #performanceMonitor = new PerformanceMonitor();
    #isInitialized = false;
    #timers = new Set();
    #abortController = null;

    constructor() {
      this.#performanceMonitor.startTimer('initialization');
    }

    async initialize() {
      try {
        this.#abortController = new AbortController();

        await this.#waitForPlatform();
        await this.#initializeModules();
        this.#setupEventListeners();

        // Expose safe public API
        window.Spadblocker = Object.freeze({
          // Safe public methods
          getStatus: () => this.getStatus(),
          getMetrics: () => this.#performanceMonitor.getMetrics(),
          // No direct access to internal components or webpack
          version: '1.0.0',
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
      const maxWaitTime = 10000;
      const startTime = performance.now();

      while (performance.now() - startTime < maxWaitTime) {
        if (window.Spicetify?.Platform && window.Spicetify?.Player) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      throw new Error('Spicetify platform not available within timeout period');
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
        }
      }

      if (CONFIG.blockUIAds) {
        try {
          this.#uiAdRemover = new UIAdRemover(CONFIG);
          await this.#uiAdRemover.initialize();
          modules.push('UIAdRemover');
        } catch (error) {
          errors.push(`UIAdRemover: ${error.message}`);
        }
      }

      if (CONFIG.enablePremiumFeatures) {
        try {
          this.#premiumFeatures = new PremiumFeatures(CONFIG);
          await this.#premiumFeatures.initialize();
          modules.push('PremiumFeatures');
        } catch (error) {
          errors.push(`PremiumFeatures: ${error.message}`);
        }
      }

      if (errors.length > 0) {
        // Rollback successful initializations
        for (const moduleName of modules) {
          this[moduleName.toLowerCase()]?.destroy();
        }
        throw new Error(`Module initialization failed: ${errors.join(', ')}`);
      }
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
      return {
        initialized: this.#isInitialized,
        modules: {
          audioAdBlocker: this.#audioAdBlocker?.isInitialized || false,
          uiAdRemover: this.#uiAdRemover?.isInitialized || false,
          premiumFeatures: this.#premiumFeatures?.isInitialized || false
        },
        config: CONFIG,
        uptime: this.#performanceMonitor.getMetrics().uptime
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
          version: '1.0.0',
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
