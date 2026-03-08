/**
 * Jest Setup File for Spadblocker Tests
 * Configures global test environment and mocks
 */

// Mock global browser APIs that are not available in Jest
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => [])
};

global.MutationObserver = jest.fn().mockImplementation((_callback) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  takeRecords: jest.fn(() => [])
}));

global.IntersectionObserver = jest.fn().mockImplementation((_callback) => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
}));

global.WeakRef = jest.fn().mockImplementation((target) => ({
  deref: jest.fn(() => target)
}));

global.FinalizationRegistry = jest.fn().mockImplementation((_callback) => ({
  register: jest.fn(),
  unregister: jest.fn()
}));

// Mock Spicetify API
global.Spicetify = {
  Player: {
    _state: {
      shuffle: false,
      repeat: 0,
      volume: 1.0
    },
    setQuality: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  },
  Platform: {
    AdManagers: {
      audio: {
        disable: jest.fn()
      },
      video: {
        disable: jest.fn()
      }
    }
  },
  Cosmo: {
    ProductState: {
      ads: 1,
      product: 'free',
      canPlayOnDemand: false,
      canPlayUnlimited: false,
      canPlayHighQuality: false,
      canShuffle: false,
      canRepeat: false,
      canSeek: false,
      canSkip: false,
      canControlPlayback: false
    }
  }
};

// Mock HTMLScriptElement for testing
global.HTMLScriptElement = {
  prototype: {
    text: {
      set: jest.fn()
    }
  }
};

// Mock Response for fetch
global.Response = jest.fn().mockImplementation((body, init) => ({
  status: init?.status || 200,
  ok: (init?.status || 200) < 400,
  text: jest.fn().mockResolvedValue(body || ''),
  json: jest.fn().mockResolvedValue({})
}));

// Mock document methods
document.createElement = jest.fn().mockImplementation((tagName) => {
  const element = {
    tagName: tagName.toUpperCase(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn()
    },
    style: {
      display: '',
      cssText: ''
    },
    textContent: '',
    innerHTML: '',
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };

  // Mock script element specific methods
  if (tagName.toLowerCase() === 'script') {
    element.src = '';
    element.text = '';
  }

  return element;
});

// Mock window methods
window.fetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  text: jest.fn().mockResolvedValue(''),
  json: jest.fn().mockResolvedValue({})
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.console = {
  ...originalConsole,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();

  // Reset Spicetify mock to default state
  global.Spicetify.Player._state = {
    shuffle: false,
    repeat: 0,
    volume: 1.0
  };

  // Reset localStorage mock
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});

// Restore console after tests
afterEach(() => {
  // Restore console methods if needed
  Object.assign(console, originalConsole);
});

// Export setup utilities for test files
module.exports = {
  mockSpicetify: global.Spicetify,
  mockPerformance: global.performance,
  mockMutationObserver: global.MutationObserver,
  mockLocalStorage: global.localStorage
};
