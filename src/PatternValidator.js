/**
 * Pattern Validation Framework
 * Comprehensive validation system for ad blocking patterns
 */

class PatternValidator {
  #validationRules = new Map();
  #errorTypes = {
    INVALID_TYPE: 'INVALID_TYPE',
    INVALID_SYNTAX: 'INVALID_SYNTAX',
    INVALID_SELECTOR: 'INVALID_SELECTOR',
    INVALID_PATTERN: 'INVALID_PATTERN',
    DUPLICATE_PATTERN: 'DUPLICATE_PATTERN',
    PATTERN_TOO_LONG: 'PATTERN_TOO_LONG',
    INVALID_EFFECTIVENESS: 'INVALID_EFFECTIVENESS',
    INVALID_SOURCE: 'INVALID_SOURCE'
  };

  constructor() {
    this.#initializeValidationRules();
  }

  /**
   * Initialize validation rules for different pattern types
   */
  #initializeValidationRules() {
    // Audio pattern rules
    this.#validationRules.set('audio', {
      requiredFields: ['id', 'type', 'pattern'],
      optionalFields: ['selector', 'effectiveness', 'enabled', 'source'],
      patternMaxLength: 100,
      selectorMaxLength: 200,
      allowedSources: ['default', 'user', 'community', 'import'],
      effectivenessRange: { min: 0, max: 1 }
    });

    // UI pattern rules
    this.#validationRules.set('ui', {
      requiredFields: ['id', 'type', 'pattern', 'selector'],
      optionalFields: ['effectiveness', 'enabled', 'source'],
      patternMaxLength: 100,
      selectorMaxLength: 200,
      allowedSources: ['default', 'user', 'community', 'import'],
      effectivenessRange: { min: 0, max: 1 }
    });

    // Script pattern rules
    this.#validationRules.set('script', {
      requiredFields: ['id', 'type', 'pattern'],
      optionalFields: ['selector', 'effectiveness', 'enabled', 'source'],
      patternMaxLength: 100,
      selectorMaxLength: 200,
      allowedSources: ['default', 'user', 'community', 'import'],
      effectivenessRange: { min: 0, max: 1 }
    });
  }

  /**
   * Validate a single pattern
   */
  validatePattern(pattern, existingPatterns = []) {
    const errors = [];
    const warnings = [];

    // Check if pattern is an object
    if (!pattern || typeof pattern !== 'object') {
      errors.push({
        type: this.#errorTypes.INVALID_TYPE,
        message: 'Pattern must be an object',
        field: 'pattern'
      });
      return { valid: false, errors, warnings };
    }

    // Validate pattern type
    if (!pattern.type || !this.#validationRules.has(pattern.type)) {
      errors.push({
        type: this.#errorTypes.INVALID_TYPE,
        message: `Pattern type must be one of: ${Array.from(this.#validationRules.keys()).join(', ')}`,
        field: 'type'
      });
    }

    const rules = this.#validationRules.get(pattern.type);
    if (!rules) {
      return { valid: false, errors, warnings };
    }

    // Validate required fields
    for (const field of rules.requiredFields) {
      if (!pattern[field] || pattern[field] === '') {
        errors.push({
          type: this.#errorTypes.INVALID_PATTERN,
          message: `Required field '${field}' is missing or empty`,
          field
        });
      }
    }

    // Validate field types and constraints
    this.#validateFieldTypes(pattern, rules, errors, warnings);

    // Validate pattern syntax
    this.#validatePatternSyntax(pattern, rules, errors, warnings);

    // Validate selector syntax if present
    if (pattern.selector) {
      this.#validateSelectorSyntax(pattern.selector, errors, warnings);
    }

    // Check for duplicates
    this.#checkForDuplicates(pattern, existingPatterns, errors, warnings);

    // Validate effectiveness range
    if (pattern.effectiveness !== undefined) {
      if (typeof pattern.effectiveness !== 'number' ||
          pattern.effectiveness < rules.effectivenessRange.min ||
          pattern.effectiveness > rules.effectivenessRange.max) {
        errors.push({
          type: this.#errorTypes.INVALID_EFFECTIVENESS,
          message: `Effectiveness must be a number between ${rules.effectivenessRange.min} and ${rules.effectivenessRange.max}`,
          field: 'effectiveness'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate field types and constraints
   */
  #validateFieldTypes(pattern, rules, errors, warnings) {
    // ID validation
    if (pattern.id !== undefined) {
      if (typeof pattern.id !== 'string') {
        errors.push({
          type: this.#errorTypes.INVALID_TYPE,
          message: 'ID must be a string',
          field: 'id'
        });
      } else if (pattern.id.length > 50) {
        errors.push({
          type: this.#errorTypes.PATTERN_TOO_LONG,
          message: 'ID must be 50 characters or less',
          field: 'id'
        });
      }
    }

    // Pattern validation
    if (pattern.pattern !== undefined) {
      if (typeof pattern.pattern !== 'string') {
        errors.push({
          type: this.#errorTypes.INVALID_TYPE,
          message: 'Pattern must be a string',
          field: 'pattern'
        });
      } else if (pattern.pattern.length > rules.patternMaxLength) {
        errors.push({
          type: this.#errorTypes.PATTERN_TOO_LONG,
          message: `Pattern must be ${rules.patternMaxLength} characters or less`,
          field: 'pattern'
        });
      }
    }

    // Selector validation
    if (pattern.selector !== undefined) {
      if (typeof pattern.selector !== 'string') {
        errors.push({
          type: this.#errorTypes.INVALID_TYPE,
          message: 'Selector must be a string',
          field: 'selector'
        });
      } else if (pattern.selector.length > rules.selectorMaxLength) {
        errors.push({
          type: this.#errorTypes.PATTERN_TOO_LONG,
          message: `Selector must be ${rules.selectorMaxLength} characters or less`,
          field: 'selector'
        });
      }
    }

    // Source validation
    if (pattern.source !== undefined) {
      if (!rules.allowedSources.includes(pattern.source)) {
        errors.push({
          type: this.#errorTypes.INVALID_SOURCE,
          message: `Source must be one of: ${rules.allowedSources.join(', ')}`,
          field: 'source'
        });
      }
    }

    // Enabled validation
    if (pattern.enabled !== undefined && typeof pattern.enabled !== 'boolean') {
      errors.push({
        type: this.#errorTypes.INVALID_TYPE,
        message: 'Enabled must be a boolean',
        field: 'enabled'
      });
    }
  }

  /**
   * Validate pattern syntax based on type
   */
  #validatePatternSyntax(pattern, rules, errors, warnings) {
    if (!pattern.pattern) {
      return;
    }

    const patternStr = pattern.pattern;

    switch (pattern.type) {
      case 'audio':
        this.#validateAudioPattern(patternStr, errors, warnings);
        break;
      case 'ui':
        this.#validateUIPattern(patternStr, errors, warnings);
        break;
      case 'script':
        this.#validateScriptPattern(patternStr, errors, warnings);
        break;
    }
  }

  /**
   * Validate audio ad patterns
   */
  #validateAudioPattern(pattern, errors, warnings) {
    // Check for common audio ad indicators
    const audioIndicators = ['ad-', 'ads', 'advertisement', 'doubleclick', 'google'];
    const hasValidIndicator = audioIndicators.some(indicator => pattern.includes(indicator));

    if (!hasValidIndicator) {
      warnings.push({
        type: 'WEAK_PATTERN',
        message: 'Audio pattern may not contain common ad indicators',
        field: 'pattern'
      });
    }

    // Check for potentially dangerous patterns
    const dangerousPatterns = ['eval', 'function', 'javascript:', 'data:'];
    if (dangerousPatterns.some(dangerous => pattern.toLowerCase().includes(dangerous))) {
      errors.push({
        type: this.#errorTypes.INVALID_SYNTAX,
        message: 'Pattern contains potentially dangerous elements',
        field: 'pattern'
      });
    }
  }

  /**
   * Validate UI ad patterns
   */
  #validateUIPattern(pattern, errors, warnings) {
    // Check for CSS selector patterns
    if (pattern.includes('[') || pattern.includes(']') || pattern.includes('.')) {
      // CSS selector detected, validate syntax
      try {
        document.querySelector(pattern);
      } catch (error) {
        errors.push({
          type: this.#errorTypes.INVALID_SELECTOR,
          message: 'Invalid CSS selector syntax',
          field: 'pattern'
        });
      }
    }
  }

  /**
   * Validate script patterns
   */
  #validateScriptPattern(pattern, errors, warnings) {
    // Check for script URL patterns
    const scriptIndicators = ['.js', 'script', 'src='];
    const hasValidIndicator = scriptIndicators.some(indicator => pattern.includes(indicator));

    if (!hasValidIndicator) {
      warnings.push({
        type: 'WEAK_PATTERN',
        message: 'Script pattern may not target script elements',
        field: 'pattern'
      });
    }
  }

  /**
   * Validate CSS selector syntax
   */
  #validateSelectorSyntax(selector, errors, warnings) {
    try {
      // Try to create a dummy element to validate selector
      document.querySelector(selector);
    } catch (error) {
      errors.push({
        type: this.#errorTypes.INVALID_SELECTOR,
        message: `Invalid CSS selector: ${error.message}`,
        field: 'selector'
      });
    }
  }

  /**
   * Check for duplicate patterns
   */
  #checkForDuplicates(pattern, existingPatterns, errors, warnings) {
    if (!pattern.id || !Array.isArray(existingPatterns)) {
      return;
    }

    const duplicate = existingPatterns.find(existing =>
      existing.id === pattern.id && existing.id !== pattern.id
    );

    if (duplicate) {
      errors.push({
        type: this.#errorTypes.DUPLICATE_PATTERN,
        message: `Pattern with ID '${pattern.id}' already exists`,
        field: 'id'
      });
    }

    // Check for similar patterns (warning)
    const similar = existingPatterns.find(existing =>
      existing.pattern === pattern.pattern && existing.id !== pattern.id
    );

    if (similar) {
      warnings.push({
        type: 'SIMILAR_PATTERN',
        message: `Similar pattern already exists with ID '${similar.id}'`,
        field: 'pattern'
      });
    }
  }

  /**
   * Validate multiple patterns
   */
  validatePatterns(patterns, existingPatterns = []) {
    const results = [];
    const allErrors = [];
    const allWarnings = [];

    for (const pattern of patterns) {
      const result = this.validatePattern(pattern, existingPatterns);
      results.push(result);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      valid: allErrors.length === 0,
      results,
      totalErrors: allErrors.length,
      totalWarnings: allWarnings.length,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  /**
   * Get validation statistics
   */
  getValidationStats(results) {
    const stats = {
      total: results.length,
      valid: 0,
      invalid: 0,
      errorsByType: {},
      warningsByType: {}
    };

    for (const result of results) {
      if (result.valid) {
        stats.valid++;
      } else {
        stats.invalid++;
      }

      // Count errors by type
      for (const error of result.errors) {
        stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
      }

      // Count warnings by type
      for (const warning of result.warnings) {
        stats.warningsByType[warning.type] = (stats.warningsByType[warning.type] || 0) + 1;
      }
    }

    return stats;
  }

  /**
   * Sanitize pattern (fix common issues)
   */
  sanitizePattern(pattern) {
    const sanitized = { ...pattern };

    // Trim string fields
    if (sanitized.id && typeof sanitized.id === 'string') {
      sanitized.id = sanitized.id.trim();
    }

    if (sanitized.pattern && typeof sanitized.pattern === 'string') {
      sanitized.pattern = sanitized.pattern.trim();
    }

    if (sanitized.selector && typeof sanitized.selector === 'string') {
      sanitized.selector = sanitized.selector.trim();
    }

    // Set default values
    if (sanitized.effectiveness === undefined) {
      sanitized.effectiveness = 0.5;
    }

    if (sanitized.enabled === undefined) {
      sanitized.enabled = true;
    }

    if (sanitized.source === undefined) {
      sanitized.source = 'user';
    }

    return sanitized;
  }

  /**
   * Get available pattern types
   */
  getPatternTypes() {
    return Array.from(this.#validationRules.keys());
  }

  /**
   * Get validation rules for a pattern type
   */
  getValidationRules(type) {
    return this.#validationRules.get(type) || null;
  }

  /**
   * Get error types
   */
  getErrorTypes() {
    return { ...this.#errorTypes };
  }
}

// Export for use in main extension
