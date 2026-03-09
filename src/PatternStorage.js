/**
 * Pattern Storage System
 * Manages user-submitted ad blocking patterns
 */

class PatternStorage {
  #storageKey = 'spadblocker_patterns';
  #patterns = new Map();
  #maxPatterns = 1000;
  #version = '1.0.0';

  constructor() {
    this.#loadPatterns();
  }

  /**
   * Load patterns from localStorage
   */
  #loadPatterns() {
    try {
      const stored = localStorage.getItem(this.#storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.version === this.#version && data.patterns) {
          this.#patterns = new Map(data.patterns);
          // eslint-disable-next-line no-console
          console.log(`Spadblocker: Loaded ${this.#patterns.size} patterns from storage`);
          return;
        }
      }

      // Initialize with default patterns if none exist
      this.#initializeDefaultPatterns();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Spadblocker: Failed to load patterns:', error);
      this.#initializeDefaultPatterns();
    }
  }

  /**
   * Initialize default patterns
   */
  #initializeDefaultPatterns() {
    const defaultPatterns = [
      // Audio ad patterns
      {
        id: 'default-audio-1',
        type: 'audio',
        pattern: 'ad-',
        selector: '[data-ad-type="audio"]',
        enabled: true,
        effectiveness: 0.95,
        source: 'default',
        createdAt: Date.now()
      },
      {
        id: 'default-audio-2',
        type: 'audio',
        pattern: 'ads',
        selector: '.ad-audio',
        enabled: true,
        effectiveness: 0.90,
        source: 'default',
        createdAt: Date.now()
      },
      // UI ad patterns
      {
        id: 'default-ui-1',
        type: 'ui',
        pattern: 'advertisement',
        selector: '.ad-container',
        enabled: true,
        effectiveness: 0.85,
        source: 'default',
        createdAt: Date.now()
      },
      {
        id: 'default-ui-2',
        type: 'ui',
        pattern: 'doubleclick',
        selector: '[class*="google-ad"]',
        enabled: true,
        effectiveness: 0.92,
        source: 'default',
        createdAt: Date.now()
      }
    ];

    this.#patterns = new Map(defaultPatterns.map(p => [p.id, p]));
    this.#savePatterns();
  }

  /**
   * Save patterns to localStorage
   */
  #savePatterns() {
    try {
      const data = {
        version: this.#version,
        patterns: Array.from(this.#patterns.entries()),
        lastUpdated: Date.now()
      };
      localStorage.setItem(this.#storageKey, JSON.stringify(data));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Spadblocker: Failed to save patterns:', error);
    }
  }

  /**
   * Add a new pattern
   */
  addPattern(pattern) {
    try {
      // Validate pattern structure
      const validation = this.#validatePattern(pattern);
      if (!validation.valid) {
        throw new Error(`Invalid pattern: ${validation.errors.join(', ')}`);
      }

      // Check if pattern already exists
      if (this.#patterns.has(pattern.id)) {
        throw new Error(`Pattern with ID ${pattern.id} already exists`);
      }

      // Check storage limits
      if (this.#patterns.size >= this.#maxPatterns) {
        throw new Error(`Maximum pattern limit (${this.#maxPatterns}) reached`);
      }

      // Add timestamp and default effectiveness
      const newPattern = {
        ...pattern,
        effectiveness: pattern.effectiveness || 0.5,
        createdAt: Date.now(),
        enabled: pattern.enabled !== false
      };

      this.#patterns.set(pattern.id, newPattern);
      this.#savePatterns();

      // eslint-disable-next-line no-console
      console.log(`Spadblocker: Added pattern ${pattern.id}`);
      return newPattern;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Spadblocker: Failed to add pattern:', error);
      throw error;
    }
  }

  /**
   * Update an existing pattern
   */
  updatePattern(id, updates) {
    try {
      if (!this.#patterns.has(id)) {
        throw new Error(`Pattern with ID ${id} not found`);
      }

      const existing = this.#patterns.get(id);
      const updated = { ...existing, ...updates, id, updatedAt: Date.now() };

      // Validate updated pattern
      const validation = this.#validatePattern(updated);
      if (!validation.valid) {
        throw new Error(`Invalid pattern update: ${validation.errors.join(', ')}`);
      }

      this.#patterns.set(id, updated);
      this.#savePatterns();

      // eslint-disable-next-line no-console
      console.log(`Spadblocker: Updated pattern ${id}`);
      return updated;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Spadblocker: Failed to update pattern:', error);
      throw error;
    }
  }

  /**
   * Remove a pattern
   */
  removePattern(id) {
    try {
      if (!this.#patterns.has(id)) {
        throw new Error(`Pattern with ID ${id} not found`);
      }

      this.#patterns.delete(id);
      this.#savePatterns();

      // eslint-disable-next-line no-console
      console.log(`Spadblocker: Removed pattern ${id}`);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Spadblocker: Failed to remove pattern:', error);
      return false;
    }
  }

  /**
   * Get pattern by ID
   */
  getPattern(id) {
    return this.#patterns.get(id) || null;
  }

  /**
   * Get all patterns
   */
  getAllPatterns() {
    return Array.from(this.#patterns.values());
  }

  /**
   * Get all patterns (alias for getAllPatterns)
   */
  getPatterns() {
    return this.getAllPatterns();
  }

  /**
   * Get patterns by type
   */
  getPatternsByType(type) {
    return Array.from(this.#patterns.values()).filter(p => p.type === type);
  }

  /**
   * Get enabled patterns only
   */
  getEnabledPatterns() {
    return Array.from(this.#patterns.values()).filter(p => p.enabled !== false);
  }

  /**
   * Get patterns by effectiveness range
   */
  getPatternsByEffectiveness(minEffectiveness = 0.7) {
    return Array.from(this.#patterns.values()).filter(p =>
      p.effectiveness >= minEffectiveness
    );
  }

  /**
   * Update pattern effectiveness
   */
  updateEffectiveness(id, newEffectiveness) {
    try {
      if (!this.#patterns.has(id)) {
        throw new Error(`Pattern with ID ${id} not found`);
      }

      const pattern = this.#patterns.get(id);
      const updated = {
        ...pattern,
        effectiveness: Math.max(0, Math.min(1, newEffectiveness)),
        lastEffectivenessUpdate: Date.now()
      };

      this.#patterns.set(id, updated);
      this.#savePatterns();

      return updated;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Spadblocker: Failed to update effectiveness:', error);
      throw error;
    }
  }

  /**
   * Validate pattern structure
   */
  #validatePattern(pattern) {
    const errors = [];

    if (!pattern.id || typeof pattern.id !== 'string') {
      errors.push('Pattern must have a valid string ID');
    }

    if (!pattern.type || !['audio', 'ui', 'script'].includes(pattern.type)) {
      errors.push('Pattern must have a valid type (audio, ui, script)');
    }

    if (!pattern.pattern || typeof pattern.pattern !== 'string') {
      errors.push('Pattern must have a valid string pattern');
    }

    if (pattern.effectiveness !== undefined) {
      if (typeof pattern.effectiveness !== 'number' ||
          pattern.effectiveness < 0 || pattern.effectiveness > 1) {
        errors.push('Pattern effectiveness must be a number between 0 and 1');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get storage statistics
   */
  getStats() {
    const patterns = Array.from(this.#patterns.values());
    const enabled = patterns.filter(p => p.enabled !== false);
    const byType = {
      audio: patterns.filter(p => p.type === 'audio').length,
      ui: patterns.filter(p => p.type === 'ui').length,
      script: patterns.filter(p => p.type === 'script').length
    };

    return {
      total: patterns.length,
      enabled: enabled.length,
      disabled: patterns.length - enabled.length,
      byType,
      averageEffectiveness: patterns.reduce((sum, p) => sum + (p.effectiveness || 0), 0) / patterns.length,
      storageUsage: JSON.stringify(localStorage.getItem(this.#storageKey) || '{}').length
    };
  }

  /**
   * Export patterns for backup
   */
  exportPatterns() {
    const data = {
      version: this.#version,
      patterns: Array.from(this.#patterns.values()),
      exportedAt: Date.now()
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import patterns from backup
   */
  importPatterns(jsonData) {
    try {
      const data = JSON.parse(jsonData);

      if (!data.patterns || !Array.isArray(data.patterns)) {
        throw new Error('Invalid pattern data format');
      }

      let imported = 0;
      let skipped = 0;

      for (const pattern of data.patterns) {
        try {
          // Validate each pattern
          const validation = this.#validatePattern(pattern);
          if (!validation.valid) {
            skipped++;
            continue;
          }

          // Check for conflicts
          if (this.#patterns.has(pattern.id)) {
            skipped++;
            continue;
          }

          // Check storage limits
          if (this.#patterns.size >= this.#maxPatterns) {
            throw new Error('Storage limit reached during import');
          }

          // Add with new ID to avoid conflicts
          const newPattern = {
            ...pattern,
            id: `${pattern.id}_imported_${Date.now()}`,
            importedAt: Date.now(),
            source: 'import'
          };

          this.#patterns.set(newPattern.id, newPattern);
          imported++;
        } catch (error) {
          skipped++;
        }
      }

      this.#savePatterns();

      // eslint-disable-next-line no-console
      console.log(`Spadblocker: Imported ${imported} patterns, skipped ${skipped}`);
      return { imported, skipped };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Spadblocker: Failed to import patterns:', error);
      throw error;
    }
  }

  /**
   * Clear all patterns
   */
  clearAllPatterns() {
    this.#patterns.clear();
    this.#savePatterns();
    // eslint-disable-next-line no-console
    console.log('Spadblocker: Cleared all patterns');
  }
}

// Export for use in main extension
