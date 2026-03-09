/**
 * User Pattern Submission Interface
 * Allows users to add and manage ad blocking patterns
 */

class PatternSubmissionInterface {
  #storage = null;
  #validator = null;
  #isInitialized = false;
  #topbarButton = null;
  #manualButton = null;

  constructor() {
    this.#initialize();
  }

  /**
   * Initialize the interface
   */
  #initialize() {
    if (this.#isInitialized) return;

    try {
      // Wait for Spicetify to be ready
      this.#waitForSpicetify();
      this.#isInitialized = true;
    } catch (error) {
      console.error('Spadblocker: Failed to initialize pattern submission interface:', error);
    }
  }

  /**
   * Wait for Spicetify to be ready
   */
  #waitForSpicetify() {
    const maxWait = 5000; // 5 seconds
    const checkInterval = 100; // 100ms
    let waited = 0;

    const checkSpicetify = () => {
      if (window.Spicetify && window.Spicetify.Topbar && window.SpadblockerPatternSystem) {
        this.#storage = window.SpadblockerPatternSystem.storage;
        this.#validator = window.SpadblockerPatternSystem.validator;
        this.#createInterface();
        return;
      }

      if (waited < maxWait) {
        waited += checkInterval;
        setTimeout(checkSpicetify, checkInterval);
      } else {
        console.warn('Spadblocker: Spicetify or pattern system not available after timeout');
      }
    };

    checkSpicetify();
  }

  /**
   * Create the user interface
   */
  #createInterface() {
    try {
      // Create main container
      const container = this.#createContainer();
      
      // Create form section
      const formSection = this.#createFormSection();
      container.appendChild(formSection);
      
      // Create patterns list section
      const listSection = this.#createPatternsListSection();
      container.appendChild(listSection);
      
      // Add to page
      this.#addToPage(container);
      
      console.log('Spadblocker: Pattern submission interface created');
    } catch (error) {
      console.error('Spadblocker: Failed to create interface:', error);
    }
  }

  /**
   * Create main container
   */
  #createContainer() {
    const container = document.createElement('div');
    container.id = 'spadblocker-pattern-interface';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      max-height: 600px;
      background: rgba(0, 0, 0, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      z-index: 10000;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      overflow-y: auto;
      display: none;
    `;

    // Add header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h3');
    title.textContent = 'Pattern Manager';
    title.style.cssText = `
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1DB954;
    `;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'none';
    closeBtn.onclick = () => this.hide();

    header.appendChild(title);
    header.appendChild(closeBtn);
    container.appendChild(header);

    return container;
  }

  /**
   * Create form section
   */
  #createFormSection() {
    const section = document.createElement('div');
    section.style.cssText = `
      margin-bottom: 20px;
    `;

    // Form title
    const formTitle = document.createElement('h4');
    formTitle.textContent = 'Add New Pattern';
    formTitle.style.cssText = `
      margin: 0 0 15px 0;
      font-size: 16px;
      font-weight: 500;
      color: #1DB954;
    `;

    // Form
    const form = document.createElement('form');
    form.id = 'spadblocker-pattern-form';
    form.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // Pattern ID field
    const idGroup = this.#createInputField('pattern-id', 'Pattern ID', 'text', 'unique-id');
    
    // Pattern type field
    const typeGroup = this.#createSelectField('pattern-type', 'Type', [
      { value: 'audio', text: 'Audio Ad' },
      { value: 'ui', text: 'UI Ad' },
      { value: 'script', text: 'Script' }
    ]);
    
    // Pattern field
    const patternGroup = this.#createInputField('pattern-pattern', 'Pattern', 'text', 'ad-');
    
    // Selector field (for UI patterns)
    const selectorGroup = this.#createInputField('pattern-selector', 'CSS Selector (optional)', 'text', '.ad-container');
    
    // Effectiveness field
    const effectivenessGroup = this.#createInputField('pattern-effectiveness', 'Effectiveness (0-1)', 'number', '0.7');
    
    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.textContent = 'Add Pattern';
    submitBtn.style.cssText = `
      background: #1DB954;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 10px;
    `;
    submitBtn.onmouseover = () => submitBtn.style.background = '#1AA05A';
    submitBtn.onmouseout = () => submitBtn.style.background = '#1DB954';

    form.onsubmit = (e) => {
      e.preventDefault();
      this.#handlePatternSubmit();
    };

    form.appendChild(idGroup);
    form.appendChild(typeGroup);
    form.appendChild(patternGroup);
    form.appendChild(selectorGroup);
    form.appendChild(effectivenessGroup);
    form.appendChild(submitBtn);

    section.appendChild(formTitle);
    section.appendChild(form);

    return section;
  }

  /**
   * Create input field group
   */
  #createInputField(id, label, type, placeholder = '') {
    const group = document.createElement('div');
    group.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 5px;
    `;

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.8);
    `;

    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.placeholder = placeholder;
    input.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 8px 12px;
      color: white;
      font-size: 14px;
      transition: all 0.2s;
    `;
    input.onfocus = () => {
      input.style.borderColor = '#1DB954';
      input.style.background = 'rgba(255, 255, 255, 0.15)';
    };
    input.onblur = () => {
      input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      input.style.background = 'rgba(255, 255, 255, 0.1)';
    };

    group.appendChild(labelEl);
    group.appendChild(input);

    return group;
  }

  /**
   * Create select field group
   */
  #createSelectField(id, label, options) {
    const group = document.createElement('div');
    group.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 5px;
    `;

    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.8);
    `;

    const select = document.createElement('select');
    select.id = id;
    select.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      padding: 8px 12px;
      color: white;
      font-size: 14px;
      cursor: pointer;
    `;

    options.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.text;
      opt.style.cssText = `
        background: #1a1a1a;
        color: white;
      `;
      select.appendChild(opt);
    });

    group.appendChild(labelEl);
    group.appendChild(select);

    return group;
  }

  /**
   * Create patterns list section
   */
  #createPatternsListSection() {
    const section = document.createElement('div');
    section.id = 'spadblocker-patterns-list';
    section.style.cssText = `
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h4');
    title.textContent = 'Existing Patterns';
    title.style.cssText = `
      margin: 0 0 15px 0;
      font-size: 16px;
      font-weight: 500;
      color: #1DB954;
    `;

    const list = document.createElement('div');
    list.id = 'patterns-list';
    list.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    `;

    section.appendChild(title);
    section.appendChild(list);

    // Load existing patterns
    this.#loadPatternsList();

    return section;
  }

  /**
   * Load patterns list
   */
  #loadPatternsList() {
    if (!this.#storage) return;

    try {
      const patterns = this.#storage.getAllPatterns();
      const list = document.getElementById('patterns-list');
      
      if (!list) return;

      list.innerHTML = '';

      if (patterns.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No patterns added yet';
        empty.style.cssText = `
          color: rgba(255, 255, 255, 0.5);
          font-style: italic;
          text-align: center;
          padding: 20px;
        `;
        list.appendChild(empty);
        return;
      }

      patterns.forEach(pattern => {
        const item = this.#createPatternItem(pattern);
        list.appendChild(item);
      });
    } catch (error) {
      console.error('Spadblocker: Failed to load patterns list:', error);
    }
  }

  /**
   * Create pattern item
   */
  #createPatternItem(pattern) {
    const item = document.createElement('div');
    item.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    `;

    const info = document.createElement('div');
    info.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const id = document.createElement('div');
    id.textContent = pattern.id;
    id.style.cssText = `
      font-weight: 600;
      font-size: 12px;
      color: #1DB954;
      margin-bottom: 2px;
    `;

    const details = document.createElement('div');
    details.textContent = `${pattern.type} - ${pattern.pattern}`;
    details.style.cssText = `
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      word-break: break-all;
    `;

    info.appendChild(id);
    info.appendChild(details);

    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 5px;
    `;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = pattern.enabled ? 'Disable' : 'Enable';
    toggleBtn.style.cssText = `
      background: ${pattern.enabled ? '#E53935' : '#1DB954'};
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
    `;
    toggleBtn.onclick = () => this.#togglePattern(pattern.id, toggleBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.style.cssText = `
      background: #E53935;
      color: white;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      cursor: pointer;
    `;
    deleteBtn.onclick = () => this.#deletePattern(pattern.id);

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    item.appendChild(info);
    item.appendChild(actions);

    return item;
  }

  /**
   * Handle pattern submission
   */
  #handlePatternSubmit() {
    if (!this.#storage || !this.#validator) {
      this.#showMessage('Pattern system not available', 'error');
      return;
    }

    try {
      const formData = this.#getFormData();
      const pattern = this.#sanitizePattern(formData);
      
      // Validate pattern
      const validation = this.#validator.validatePattern(pattern);
      if (!validation.valid) {
        this.#showMessage('Validation failed: ' + validation.errors.map(e => e.message).join(', '), 'error');
        return;
      }

      // Add pattern
      this.#storage.addPattern(pattern);
      this.#showMessage('Pattern added successfully!', 'success');
      
      // Reset form
      document.getElementById('spadblocker-pattern-form').reset();
      
      // Reload patterns list
      this.#loadPatternsList();
      
    } catch (error) {
      this.#showMessage('Failed to add pattern: ' + error.message, 'error');
    }
  }

  /**
   * Get form data
   */
  #getFormData() {
    return {
      id: document.getElementById('pattern-id').value.trim(),
      type: document.getElementById('pattern-type').value,
      pattern: document.getElementById('pattern-pattern').value.trim(),
      selector: document.getElementById('pattern-selector').value.trim(),
      effectiveness: parseFloat(document.getElementById('pattern-effectiveness').value) || 0.5,
      source: 'user',
      enabled: true
    };
  }

  /**
   * Sanitize pattern data
   */
  #sanitizePattern(pattern) {
    if (this.#validator && typeof this.#validator.sanitizePattern === 'function') {
      return this.#validator.sanitizePattern(pattern);
    }
    return pattern;
  }

  /**
   * Toggle pattern enabled/disabled
   */
  #togglePattern(id, button) {
    if (!this.#storage) return;

    try {
      const pattern = this.#storage.getPattern(id);
      if (pattern) {
        const updated = { ...pattern, enabled: !pattern.enabled };
        this.#storage.updatePattern(id, updated);
        button.textContent = updated.enabled ? 'Disable' : 'Enable';
        button.style.background = updated.enabled ? '#E53935' : '#1DB954';
        this.#loadPatternsList();
      }
    } catch (error) {
      console.error('Spadblocker: Failed to toggle pattern:', error);
    }
  }

  /**
   * Delete pattern
   */
  #deletePattern(id) {
    if (!this.#storage) return;

    if (window.confirm('Are you sure you want to delete this pattern?')) {
      try {
        this.#storage.removePattern(id);
        this.#showMessage('Pattern deleted successfully', 'success');
        this.#loadPatternsList();
      } catch (error) {
        console.error('Spadblocker: Failed to delete pattern:', error);
        this.#showMessage('Failed to delete pattern', 'error');
      }
    }
  }

  /**
   * Show message
   */
  #showMessage(text, type = 'info') {
    // Create message element
    const message = document.createElement('div');
    message.textContent = text;
    message.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10001;
      transition: all 0.3s;
      ${
        type === 'error' 
          ? 'background: #E53935; color: white;' 
          : type === 'success'
          ? 'background: #1DB954; color: white;'
          : 'background: #1E88E5; color: white;'
      }
    `;

    document.body.appendChild(message);

    // Remove after 3 seconds
    setTimeout(() => {
      if (message.parentNode) {
        message.parentNode.removeChild(message);
      }
    }, 3000);
  }

  /**
   * Add interface to page
   */
  #addToPage(container) {
    document.body.appendChild(container);

    // Create toggle button
    this.#createToggleButton();
  }

  /**
   * Create toggle button using Spicetify Topbar API
   */
  #createToggleButton() {
    if (!window.Spicetify || !window.Spicetify.Topbar) {
      console.warn('Spadblocker: Spicetify Topbar not available, falling back to manual button');
      this.#createManualButton();
      return;
    }

    try {
      // Create SVG icon for the button
      const svgIcon = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      `;

      // Create Topbar button
      const button = new Spicetify.Topbar.Button(
        "Pattern Manager",
        svgIcon,
        () => this.toggle()
      );

      this.#topbarButton = button;
      console.log('Spadblocker: Topbar button created successfully');
    } catch (error) {
      console.error('Spadblocker: Failed to create Topbar button:', error);
      this.#createManualButton();
    }
  }

  /**
   * Fallback manual button creation
   */
  #createManualButton() {
    const button = document.createElement('button');
    button.id = 'spadblocker-pattern-toggle';
    button.textContent = '🎯';
    button.title = 'Pattern Manager';
    button.style.cssText = `
      position: fixed !important;
      top: 80px !important;
      right: 20px !important;
      width: 50px !important;
      height: 50px !important;
      background: #1DB954 !important;
      border: none !important;
      border-radius: 50% !important;
      font-size: 20px !important;
      cursor: pointer !important;
      z-index: 999999 !important;
      transition: all 0.3s !important;
      box-shadow: 0 4px 12px rgba(29, 185, 84, 0.3) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: white !important;
    `;
    
    button.onmouseover = () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 6px 20px rgba(29, 185, 84, 0.4)';
    };
    
    button.onmouseout = () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 4px 12px rgba(29, 185, 84, 0.3)';
    };
    
    button.onclick = () => this.toggle();

    document.body.appendChild(button);
    this.#manualButton = button;
  }

  /**
   * Show interface
   */
  show() {
    const container = document.getElementById('spadblocker-pattern-interface');
    const button = document.getElementById('spadblocker-pattern-toggle');
    
    if (container) {
      container.style.display = 'block';
      if (button) button.style.display = 'none';
    }
  }

  /**
   * Hide interface
   */
  hide() {
    const container = document.getElementById('spadblocker-pattern-interface');
    const button = document.getElementById('spadblocker-pattern-toggle');
    
    if (container) {
      container.style.display = 'none';
      if (button) button.style.display = 'block';
    }
  }

  /**
   * Toggle interface
   */
  toggle() {
    const container = document.getElementById('spadblocker-pattern-interface');
    if (container) {
      if (container.style.display === 'none') {
        this.show();
      } else {
        this.hide();
      }
    }
  }
}

// Export for use in main extension
if (typeof window !== 'undefined') {
  window.SpadblockerPatternSubmission = PatternSubmissionInterface;
  
  // Create global instance
  window.SpadblockerPatternSubmissionInstance = null;
  
  // Auto-initialize when pattern system is ready
  const initPatternSubmission = () => {
    if (window.SpadblockerPatternSystem && !window.SpadblockerPatternSubmissionInstance) {
      window.SpadblockerPatternSubmissionInstance = new PatternSubmissionInterface();
      console.log('Spadblocker: Pattern Submission Interface auto-initialized');
    }
  };
  
  // Wait for pattern system and initialize
  const waitForSystem = () => {
    if (window.SpadblockerPatternSystem) {
      initPatternSubmission();
    } else {
      setTimeout(waitForSystem, 100);
    }
  };
  
  waitForSystem();
}
