/**
 * Unit Tests for FallbackManager Class
 * Tests graceful fallback mechanisms and error handling
 */

// Mock FallbackManager class for testing
class FallbackManager {
  #fallbacks = new Map();
  #retryAttempts = new Map();
  #maxRetries = 3;

  constructor(config) {
    this.config = config || {};
    this.#initializeFallbacks();
  }

  #initializeFallbacks() {
    // Mock fallbacks for testing
    this.#fallbacks.set('testFeature', {
      primary: () => Promise.resolve(true),
      secondary: () => Promise.resolve(true),
      fallback: () => Promise.resolve(true)
    });

    this.#fallbacks.set('failingFeature', {
      primary: () => Promise.reject(new Error('Primary failed')),
      secondary: () => Promise.reject(new Error('Secondary failed')),
      fallback: () => Promise.reject(new Error('Fallback failed'))
    });

    this.#fallbacks.set('partialFailureFeature', {
      primary: () => Promise.reject(new Error('Primary failed')),
      secondary: () => Promise.resolve(true),
      fallback: () => Promise.resolve(true)
    });
  }

  async executeFallback(featureName) {
    const fallback = this.#fallbacks.get(featureName);
    if (!fallback) {
      // eslint-disable-next-line no-console
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

describe('FallbackManager', () => {
  let fallbackManager;

  beforeEach(() => {
    fallbackManager = new FallbackManager({});
  });

  afterEach(() => {
    fallbackManager.resetFallbacks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(fallbackManager).toBeDefined();
      expect(fallbackManager.config).toBeDefined();
    });

    it('should handle missing config gracefully', () => {
      const testManager = new FallbackManager(null);
      expect(testManager).toBeDefined();
    });
  });

  describe('executeFallback', () => {
    it('should execute primary fallback on first attempt', async () => {
      const result = await fallbackManager.executeFallback('testFeature');
      expect(result).toBe(true);
    });

    it('should handle non-existent features gracefully', async () => {
      const result = await fallbackManager.executeFallback('nonExistentFeature');
      expect(result).toBe(false);
    });

    it('should retry with secondary fallback when primary fails', async () => {
      const result = await fallbackManager.executeFallback('partialFailureFeature');
      expect(result).toBe(true);
    });

    it('should exhaust all fallbacks when all fail', async () => {
      const result = await fallbackManager.executeFallback('failingFeature');
      expect(result).toBe(false);
    });
  });

  describe('getFallbackStatus', () => {
    it('should return empty status initially', () => {
      const status = fallbackManager.getFallbackStatus();
      expect(status).toEqual({});
    });

    it('should track retry attempts', async () => {
      await fallbackManager.executeFallback('failingFeature');
      const status = fallbackManager.getFallbackStatus();
      expect(status).toHaveProperty('failingFeature');
      expect(status.failingFeature.attempts).toBeGreaterThan(0);
    });

    it('should calculate remaining attempts correctly', async () => {
      await fallbackManager.executeFallback('failingFeature');
      const fallbackStatus = fallbackManager.getFallbackStatus();
      expect(fallbackStatus.failingFeature.remaining).toBeGreaterThanOrEqual(0);
      expect(fallbackStatus.failingFeature.remaining).toBeLessThanOrEqual(3);
    });
  });

  describe('resetFallbacks', () => {
    it('should clear all retry attempts', async () => {
      // First, make some attempts
      await fallbackManager.executeFallback('failingFeature');
      const status = fallbackManager.getFallbackStatus();
      expect(Object.keys(status).length).toBeGreaterThan(0);

      // Then reset
      fallbackManager.resetFallbacks();
      const resetStatus = fallbackManager.getFallbackStatus();
      expect(resetStatus).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('should handle promise rejections gracefully', async () => {
      const result = await fallbackManager.executeFallback('failingFeature');
      expect(result).toBe(false);
    });

    it('should handle mixed success/failure scenarios', async () => {
      const result = await fallbackManager.executeFallback('partialFailureFeature');
      expect(result).toBe(true);
    });

    it('should not throw on invalid feature names', async () => {
      await expect(fallbackManager.executeFallback('invalidFeature')).resolves.toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should respect max retry limit', async () => {
      const result = await fallbackManager.executeFallback('failingFeature');
      expect(result).toBe(false);

      // Verify that attempts were tracked
      const status = fallbackManager.getFallbackStatus();
      expect(status.failingFeature.attempts).toBeLessThanOrEqual(3);
    });

    it('should reset attempts after successful fallback', async () => {
      await fallbackManager.executeFallback('testFeature');
      const status = fallbackManager.getFallbackStatus();

      // Should have no attempts for successful feature
      expect(status.testFeature).toBeUndefined();
    });
  });
});
