/**
 * Configuration Validation System
 * Validates CONFIG object schema and values
 */

class ConfigValidator {
  #validationCache = new Map();
  #schema = {
    blockAudioAds: {
      type: 'boolean',
      required: false,
      default: true
    },
    blockUIAds: {
      type: 'boolean',
      required: false,
      default: true
    },
    enablePremiumFeatures: {
      type: 'boolean',
      required: false,
      default: true
    },
    debugMode: {
      type: 'boolean',
      required: false,
      default: false
    },
    enablePerformanceMonitoring: {
      type: 'boolean',
      required: false,
      default: true
    },
    maintenanceIntervalMs: {
      type: 'number',
      required: false,
      default: 30000,
      min: 1000,
      max: 300000
    },
    premiumOverrideIntervalMs: {
      type: 'number',
      required: false,
      default: 5000,
      min: 1000,
      max: 60000
    },
    maxRetries: {
      type: 'number',
      required: false,
      default: 3,
      min: 1,
      max: 10
    },
    blockedScripts: {
      type: 'array',
      required: false,
      default: [
        'ad-',
        'ads',
        'advertisement',
        'doubleclick',
        'google_ad',
        'googlesyndication'
      ],
      validate: (value) => {
        return Array.isArray(value) && value.every(item => typeof item === 'string');
      }
    },
    adSelectors: {
      type: 'array',
      required: false,
      default: [],
      validate: (value) => {
        return Array.isArray(value) && value.every(item => typeof item === 'string');
      }
    }
  };

  constructor() {
    this.#validationCache = new Map();
  }

  /**
   * Validate entire CONFIG object
   */
  validate(config) {
    const errors = [];
    const warnings = [];

    // Check if config is object
    if (typeof config !== 'object' || config === null) {
      errors.push('CONFIG must be an object');
      return { valid: false, errors, warnings };
    }

    // Validate each property
    for (const [key, schema] of Object.entries(this.#schema)) {
      const value = config[key];
      const result = this.#validateProperty(key, value, schema);

      if (!result.valid) {
        errors.push(...result.errors);
      }

      if (result.warnings?.length > 0) {
        warnings.push(...result.warnings);
      }
    }

    // Check for unknown properties
    const unknownProps = Object.keys(config).filter(key => !this.#schema[key]);
    if (unknownProps.length > 0) {
      warnings.push(`Unknown configuration properties: ${unknownProps.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitized: this.#sanitizeConfig(config)
    };
  }

  /**
   * Validate individual property
   */
  #validateProperty(key, value, schema) {
    const errors = [];
    const warnings = [];

    // Type validation
    if (value !== undefined && !this.#validateType(value, schema.type)) {
      errors.push(`${key}: Expected ${schema.type}, got ${typeof value}`);
      return { valid: false, errors };
    }

    // Required validation
    if (schema.required && value === undefined) {
      errors.push(`${key}: Required property is missing`);
      return { valid: false, errors };
    }

    // Skip further validation if value is undefined and not required
    if (value === undefined && !schema.required) {
      return { valid: true, errors: [], warnings };
    }

    // Range validation for numbers
    if (schema.type === 'number' && value !== undefined) {
      if (schema.min !== undefined && value < schema.min) {
        errors.push(`${key}: Must be >= ${schema.min}, got ${value}`);
      }
      if (schema.max !== undefined && value > schema.max) {
        errors.push(`${key}: Must be <= ${schema.max}, got ${value}`);
      }
    }

    // Array validation
    if (schema.type === 'array' && value !== undefined) {
      if (!Array.isArray(value)) {
        errors.push(`${key}: Must be an array, got ${typeof value}`);
      } else if (schema.validate && !schema.validate(value)) {
        errors.push(`${key}: Array validation failed`);
      }
    }

    // Custom validation
    if (schema.validate && value !== undefined && !schema.validate(value)) {
      errors.push(`${key}: Custom validation failed`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate type with caching
   */
  #validateType(value, expectedType) {
    const cacheKey = `${typeof value}-${expectedType}`;

    if (this.#validationCache.has(cacheKey)) {
      return this.#validationCache.get(cacheKey);
    }

    let isValid = false;

    switch (expectedType) {
      case 'boolean':
        isValid = typeof value === 'boolean';
        break;
      case 'number':
        isValid = typeof value === 'number' && !isNaN(value);
        break;
      case 'string':
        isValid = typeof value === 'string';
        break;
      case 'array':
        isValid = Array.isArray(value);
        break;
      case 'object':
        isValid = typeof value === 'object' && value !== null && !Array.isArray(value);
        break;
    }

    this.#validationCache.set(cacheKey, isValid);
    return isValid;
  }

  /**
   * Sanitize configuration values
   */
  #sanitizeConfig(config) {
    const sanitized = { ...config };

    for (const [key, schema] of Object.entries(this.#schema)) {
      if (sanitized[key] === undefined && schema.default !== undefined) {
        sanitized[key] = schema.default;
      }
    }

    return sanitized;
  }

  /**
   * Get default configuration
   */
  getDefaults() {
    const defaults = {};
    for (const [key, schema] of Object.entries(this.#schema)) {
      defaults[key] = schema.default;
    }
    return defaults;
  }

  /**
   * Validate specific property
   */
  validateProperty(key, value) {
    const schema = this.#schema[key];
    if (!schema) {
      return {
        valid: false,
        errors: [`Unknown property: ${key}`],
        warnings: []
      };
    }

    return this.#validateProperty(key, value, schema);
  }

  /**
   * Clear validation cache
   */
  clearCache() {
    this.#validationCache.clear();
  }
}

// Export for use in main extension
