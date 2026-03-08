/**
 * Spadblocker - Custom Spotify Adblocker Extension
 * Eliminates ads and unlocks premium features for free users
 *
 * @version 1.0.0
 * @author Spadblocker Team
 * @license MIT
 */

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

  /**
   * Configuration
   */
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
    #moduleRefs = new WeakMap();

    loadWebpack(performanceMonitor) {
      performanceMonitor?.startTimer('webpackLoad');

      try {
        // Try webpack chunk
        const chunk = window.webpackChunkclient_web?.push([[Symbol()], {}, req => req]);

        if (!chunk?.m) {
          throw new Error('Webpack chunk not found');
        }

        const modules = Object.keys(chunk.m).map(id => chunk(id));

        // Extract function modules
        const functionModules = modules
          .filter(module => this.#isValidModule(module))
          .flatMap(module => this.#extractFunctions(module))
          .filter(func => typeof func === 'function');

        this.#cache = modules;
        this.#functionModules = functionModules;

        if (CONFIG.debugMode) {
          console.log('📦 Webpack modules loaded:', {
            total: modules.length,
            functions: functionModules.length
          });
        }

        return { cache: modules, functionModules };
      } catch (error) {
        console.error('❌ Failed to load webpack modules:', error);
        return { cache: [], functionModules: [] };
      } finally {
        performanceMonitor?.endTimer('webpackLoad');
      }
    }

    #isValidModule(module) {
      return module && typeof module === 'object' && !Array.isArray(module);
    }

    #extractFunctions(module) {
      const functions = [];
      const visited = new WeakSet();
      const MAX_DEPTH = 10;

      const extractFromObject = (obj, depth = 0) => {
        if (visited.has(obj) || depth >= MAX_DEPTH) {
          return; // Prevent infinite recursion and stack overflow
        }
        visited.add(obj);

        try {
          Object.values(obj).forEach(value => {
            if (typeof value === 'function') {
              functions.push(value);
            } else if (value && typeof value === 'object' && value !== obj) {
              extractFromObject(value, depth + 1);
            }
          });
        } catch (error) {
          // Ignore errors during extraction
        }
      };

      extractFromObject(module);
      return functions;
    }

    findModule(serviceId) {
      const cached = this.#functionModules.find(module => module?.SERVICE_ID === serviceId);
      return cached ?? null;
    }

    getStats() {
      return {
        cacheSize: this.#cache.length,
        functionModules: this.#functionModules.length,
        weakRefs: this.#moduleRefs.size || 0
      };
    }
  }

  /**
   * Audio Ad Blocker
   */
  class AudioAdBlocker {
    constructor(webpackIntegration, config) {
      this.webpack = webpackIntegration;
      this.config = config;
      this.retryCounter = new Map();
      this.isInitialized = false;
    }

    async initialize() {
      try {
        await this.waitForSpicetify();
        await this.setupAdClients();
        await this.configureAdManagers();
        this.isInitialized = true;

        if (this.config.debugMode) {
          console.log('Spadblocker: Audio ad blocker initialized');
        }
      } catch (error) {
        console.error('Spadblocker: Audio ad blocker initialization failed', error);
      }
    }

    async waitForSpicetify() {
      const MAX_RETRIES = 50;
      const RETRY_DELAY = 100;
      let retries = 0;

      return new Promise((resolve, reject) => {
        const checkSpicetify = () => {
          if (window.Spicetify?.Platform?.AdManagers) {
            resolve();
          } else if (retries >= MAX_RETRIES) {
            reject(new Error('Spicetify not available after maximum retries'));
          } else {
            retries++;
            setTimeout(checkSpicetify, RETRY_DELAY);
          }
        };
        checkSpicetify();
      });
    }

    async setupAdClients() {
      // Get settings client
      this.settingsClient = this.getSettingsClient(
        this.webpack.cache,
        this.webpack.functionModules
      );

      // Get slots client
      this.slotsClient = this.getSlotsClient(this.webpack.functionModules);

      // Get testing client
      this.testingClient = this.getTestingClient(this.webpack.functionModules);
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

    async configureAdManagers() {
      try {
        const { Platform } = Spicetify;
        const { AdManagers } = Platform;

        if (AdManagers?.audio) {
          // Disable audio ad manager
          AdManagers.audio.disable();
          if (this.config.debugMode) {
            console.log('Spadblocker: Audio ad manager disabled');
          }
        }

        if (AdManagers?.video) {
          // Disable video ad manager
          AdManagers.video.disable();
          if (this.config.debugMode) {
            console.log('Spadblocker: Video ad manager disabled');
          }
        }

        if (AdManagers?.display) {
          // Disable display ad manager
          AdManagers.display.disable();
          if (this.config.debugMode) {
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

        if (this.slotsClient) {
          const { adSlots } = await this.slotsClient.getSlots();
          adSlotsArray = adSlots;
        } else {
          try {
            const { adSlots: responseAdSlots = [] } =
              await Spicetify.CosmosAsync.get('sp://ads/v1/slots');
            adSlotsArray = responseAdSlots || [];
          } catch (error) {
            console.error('Spadblocker: Failed to get ad slots', error);
            return;
          }
        }

        for (const slot of adSlotsArray) {
          await this.configureAdSlot(slot.slotId || slot.slot_id);
        }

        if (this.config.debugMode) {
          console.log(`Spadblocker: Configured ${adSlotsArray.length} ad slots`);
        }
      } catch (error) {
        console.error('Spadblocker: Failed to configure ad slots', error);
      }
    }

    async configureAdSlot(slotId) {
      try {
        if (this.settingsClient) {
          await this.settingsClient.updateAdSlot(slotId, {
            enabled: false,
            maxAds: 0,
            adFrequency: 0
          });
        }
      } catch (error) {
        console.error(`Spadblocker: Failed to configure ad slot ${slotId}`, error);
      }
    }

    addNegativePlaytime() {
      try {
        const { Platform } = Spicetify;
        const { PlayerAPI } = Platform;

        if (PlayerAPI && PlayerAPI._state) {
          PlayerAPI._state.playtime = -100000000000;
        }
      } catch (error) {
        console.error('Spadblocker: Failed to add negative playtime', error);
      }
    }

    destroy() {
      this.isInitialized = false;
      this.retryCounter.clear();
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
      this.isInitialized = false;
      this.cachedSelectors = new Map();
    }

    async initialize() {
      try {
        this.injectCSS();
        this.setupMutationObserver();
        this.removeExistingAds();
        this.setupModalRemover();
        this.isInitialized = true;

        if (this.config.debugMode) {
          console.log('Spadblocker: UI ad remover initialized');
        }
      } catch (error) {
        console.error('Spadblocker: UI ad remover initialization failed', error);
        // Still mark as initialized if CSS was injected
        if (document.querySelector('.spadblocker-ui-ads')) {
          this.isInitialized = true;
          if (this.config.debugMode) {
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
      `;

      // Validate CSS content before injection
      if (!this.#isValidCSS(css)) {
        console.error('Spadblocker: CSS validation failed, skipping injection');
        return;
      }

      const style = document.createElement('style');
      style.className = 'spadblocker-ui-ads';
      style.textContent = css;
      document.head.appendChild(style);
    }

    #isValidCSS(css) {
      // Basic CSS validation - only allow safe CSS properties
      const allowedProperties = [
        'display',
        'visibility',
        'opacity',
        'position',
        'z-index',
        'width',
        'height',
        'margin',
        'padding',
        'top',
        'left',
        'right',
        'bottom'
      ];

      const cssRules = css.match(/[^{]+\{[^}]*\}/g) || [];

      for (const rule of cssRules) {
        const properties = rule.match(/([^:]+):([^;]+);/g) || [];

        for (const prop of properties) {
          const propName = prop.split(':')[0].trim();
          if (!allowedProperties.includes(propName)) {
            return false;
          }
        }
      }

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

    #getCachedElements(selector) {
      if (!this.cachedSelectors.has(selector)) {
        this.cachedSelectors.set(selector, new Set());
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
        '.GTfvmcnjXqYCdf_pNUrj' // Ad controls
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

    removeExistingAds() {
      const adSelectors = [
        '[data-testid="ad-container"]',
        '.main-ad-container',
        '.main-topBar-adContainer',
        '.main-shelf-ad',
        '.main-premiumPromo-container',
        '.main-billboard-container',
        '.main-trackList-premiumIndicator',
        '.main-playlist-premiumIndicator',
        '.main-podcastAd-container',
        '.main-podcastAd-sponsorContainer'
      ];

      adSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.style.display = 'none';
          element.classList.add('spadblocker-ui-ads');
        });
      });
    }

    removePremiumModals() {
      const modalSelectors = [
        '[data-testid="premium-modal"]',
        '.main-premiumModal-container',
        '.main-upgradeModal-container',
        '[data-testid="upgrade-modal"]'
      ];

      modalSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          element.style.display = 'none';
          element.classList.add('spadblocker-ui-ads');
        });
      });
    }

    setupModalRemover() {
      this.removePremiumModals();

      this.modalObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.addedNodes.length) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === 1) {
                // Node.ELEMENT_NODE
                this.checkAndRemoveModal(node);
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

    checkAndRemoveModal(node) {
      const modalSelectors = [
        '[data-testid="premium-modal"]',
        '.main-premiumModal-container',
        '.main-upgradeModal-container',
        '[data-testid="upgrade-modal"]'
      ];

      for (const selector of modalSelectors) {
        if (node.matches?.(selector) || node.querySelector?.(selector)) {
          this.removeModal(node);
          break;
        }
      }
    }

    removeModal(node) {
      if (node.style) {
        node.style.display = 'none';
      }
      node.classList.add('spadblocker-ui-ads');
    }

    destroy() {
      this.isInitialized = false;

      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }

      if (this.modalObserver) {
        this.modalObserver.disconnect();
        this.modalObserver = null;
      }

      const style = document.querySelector('.spadblocker-ui-ads');
      if (style) {
        style.remove();
      }

      this.processedElements = new WeakSet();
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

    async initialize() {
      try {
        await this.waitForSpicetify();
        this.overrideProductState();
        this.enablePremiumFeatures();
        this.setupPeriodicOverride();
        this.isInitialized = true;

        if (this.config.debugMode) {
          console.log('Spadblocker: Premium features initialized');
        }
      } catch (error) {
        console.error('Spadblocker: Premium features initialization failed', error);
      }
    }

    async waitForSpicetify() {
      const MAX_RETRIES = 50;
      const RETRY_DELAY = 100;
      let retries = 0;

      return new Promise((resolve, reject) => {
        const checkSpicetify = () => {
          if (window.Spicetify?.Platform?.UserAPI) {
            resolve();
          } else if (retries >= MAX_RETRIES) {
            reject(new Error('Spicetify not available after maximum retries'));
          } else {
            retries++;
            setTimeout(checkSpicetify, RETRY_DELAY);
          }
        };
        checkSpicetify();
      });
    }

    overrideProductState() {
      try {
        const { Platform } = Spicetify;
        const { UserAPI } = Platform;
        const productState = UserAPI._product_state || UserAPI._product_state_service;

        if (productState) {
          this.originalProductState = { ...productState };

          // Override to premium
          Object.assign(productState, {
            product: 'premium',
            catalogue: 'premium',
            ads: '0',
            type: 'premium',
            canPlayPodcasts: true,
            canPlayAudio: true,
            canPlayVideo: true,
            canPlayOffline: true,
            canPlayUnlimited: true,
            canPlayHighQuality: true,
            canShuffle: true,
            canRepeat: true,
            canSeek: true,
            canSkip: true,
            canControlPlayback: true
          });

          if (this.config.debugMode) {
            console.log('Spadblocker: Product state overridden to premium');
          }
        }
      } catch (error) {
        console.error('Spadblocker: Failed to override product state', error);
      }
    }

    enablePremiumFeatures() {
      try {
        const { Platform } = Spicetify;
        const { PlayerAPI } = Platform;

        if (PlayerAPI) {
          // Enable shuffle
          if (PlayerAPI._state) {
            PlayerAPI._state.shuffle = true;
          }

          // Enable repeat
          if (PlayerAPI._state) {
            PlayerAPI._state.repeat = 1;
          }

          // Enable quality
          if (PlayerAPI.setQuality) {
            PlayerAPI.setQuality('high');
          }

          if (this.config.debugMode) {
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

    getPremiumStatus() {
      try {
        const { Platform } = Spicetify;
        const { UserAPI } = Platform;
        const _productState = UserAPI._product_state || UserAPI._product_state_service;

        return {
          isPremium: true,
          product: 'premium',
          catalogue: 'premium',
          ads: '0',
          features: {
            shuffle: true,
            queue: true,
            quality: true,
            lyrics: true,
            offline: true,
            connect: true
          }
        };
      } catch (error) {
        console.error('Spadblocker: Failed to get premium status', error);
        return null;
      }
    }

    destroy() {
      this.isInitialized = false;
      this.#clearAllTimers();
      this.originalProductState = null;
    }
  }

  /**
   * Main Spadblocker Controller
   */
  class Spadblocker {
    #audioAdBlocker = null;
    #uiAdRemover = null;
    #premiumFeatures = null;
    #webpack = null;
    #performanceMonitor = new PerformanceMonitor();
    #isInitialized = false;
    #timers = new Set();
    #abortController = null;

    constructor() {
      this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
      this.handlePageUnload = this.handlePageUnload.bind(this);
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

    async initialize() {
      this.#performanceMonitor.startTimer('initialization');

      try {
        await this.#waitForPlatform();

        // Load webpack modules
        const webpack = new WebpackIntegration();
        webpack.loadWebpack(this.#performanceMonitor);

        this.#webpack = webpack;

        // Initialize modules conditionally
        await this.#initializeModules(webpack);

        // Setup event listeners
        this.#setupEventListeners();

        // Setup periodic maintenance
        this.#setupMaintenance();

        this.#isInitialized = true;

        // Expose limited, safe global API
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
        console.log(`✅ Spadblocker initialized in ${initTime.toFixed(2)}ms`);
      } catch (error) {
        console.error('❌ Spadblocker initialization failed:', error);
        throw error;
      }
    }

    async #waitForPlatform() {
      const maxWaitTime = 10000;
      const startTime = performance.now();

      return new Promise((resolve, reject) => {
        const checkPlatform = () => {
          if (window.Spicetify?.Events) {
            resolve();
          } else if (performance.now() - startTime > maxWaitTime) {
            reject(new Error('Platform not available within timeout'));
          } else {
            setTimeout(checkPlatform, 100);
          }
        };
        checkPlatform();
      });
    }

    async #initializeModules(webpack) {
      const initializedModules = [];

      try {
        const modulePromises = [];

        if (CONFIG.blockAudioAds) {
          modulePromises.push(
            this.#initializeAudioBlocker(webpack).then(result => {
              initializedModules.push('audioAdBlocker');
              return result;
            })
          );
        }

        if (CONFIG.blockUIAds) {
          modulePromises.push(
            this.#initializeUIRemover().then(result => {
              initializedModules.push('uiAdRemover');
              return result;
            })
          );
        }

        if (CONFIG.enablePremiumFeatures) {
          modulePromises.push(
            this.#initializePremiumFeatures().then(result => {
              initializedModules.push('premiumFeatures');
              return result;
            })
          );
        }

        const results = await Promise.allSettled(modulePromises);

        // Check for failures and rollback if needed
        const failures = results.filter(result => result.status === 'rejected');

        if (failures.length > 0) {
          console.error(`❌ ${failures.length} module(s) failed to initialize`);

          // Rollback successfully initialized modules
          for (const moduleName of initializedModules) {
            try {
              if (moduleName === 'audioAdBlocker' && this.#audioAdBlocker) {
                this.#audioAdBlocker.destroy();
                this.#audioAdBlocker = null;
              } else if (moduleName === 'uiAdRemover' && this.#uiAdRemover) {
                this.#uiAdRemover.destroy();
                this.#uiAdRemover = null;
              } else if (moduleName === 'premiumFeatures' && this.#premiumFeatures) {
                this.#premiumFeatures.destroy();
                this.#premiumFeatures = null;
              }
            } catch (rollbackError) {
              console.error(`❌ Failed to rollback ${moduleName}:`, rollbackError);
            }
          }

          throw new Error(
            'Module initialization failed, rolled back successfully initialized modules'
          );
        }

        return results;
      } catch (error) {
        console.error('❌ Module initialization failed:', error);
        throw error;
      }
    }

    async #initializeAudioBlocker(webpack) {
      try {
        this.#audioAdBlocker = new AudioAdBlocker(webpack, CONFIG);
        await this.#audioAdBlocker.initialize();
      } catch (error) {
        console.error('❌ Audio ad blocker initialization failed:', error);
        throw error;
      }
    }

    async #initializeUIRemover() {
      try {
        this.#uiAdRemover = new UIAdRemover(CONFIG);
        await this.#uiAdRemover.initialize();
      } catch (error) {
        console.error('❌ UI ad remover initialization failed:', error);
        // Don't throw error for UI remover, just log it
      }
    }

    async #initializePremiumFeatures() {
      try {
        this.#premiumFeatures = new PremiumFeatures(CONFIG);
        await this.#premiumFeatures.initialize();
      } catch (error) {
        console.error('❌ Premium features initialization failed:', error);
        throw error;
      }
    }

    #setupEventListeners() {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('beforeunload', this.handlePageUnload);
    }

    #setupMaintenance() {
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

    performMaintenance() {
      try {
        if (this.#audioAdBlocker?.isInitialized) {
          this.#audioAdBlocker.addNegativePlaytime();
        }

        if (this.#premiumFeatures?.isInitialized) {
          this.#premiumFeatures.overrideProductState();
        }
      } catch (error) {
        console.error('Spadblocker: Maintenance failed:', error);
      }
    }

    handleVisibilityChange() {
      if (document.hidden) {
        if (CONFIG.debugMode) {
          console.log('🔍 Page hidden - pausing maintenance');
        }
      } else {
        if (CONFIG.debugMode) {
          console.log('👁️ Page visible - resuming maintenance');
        }
        this.performMaintenance();
      }
    }

    handlePageUnload() {
      this.destroy();
    }

    getStatus() {
      return {
        initialized: this.#isInitialized,
        modules: {
          audioAdBlocker: this.#audioAdBlocker?.isInitialized ?? false,
          uiAdRemover: this.#uiAdRemover?.isInitialized ?? false,
          premiumFeatures: this.#premiumFeatures?.isInitialized ?? false
        },
        performance: this.#performanceMonitor.getMetrics(),
        webpack: this.#webpack?.getStats() ?? { cacheSize: 0, functionModules: 0, weakRefs: 0 },
        config: CONFIG
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
  async function initializeSpadblocker() {
    try {
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

      console.log('Spadblocker: Successfully initialized');
      return spadblocker;
    } catch (error) {
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
        console.error('Spadblocker: Unhandled error:', event.error);
        event.preventDefault(); // Prevent error from breaking Spotify
      }
    });

    window.addEventListener('unhandledrejection', event => {
      if (
        event.reason?.message?.includes('Spadblocker') ||
        event.reason?.stack?.includes('spadblocker')
      ) {
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
