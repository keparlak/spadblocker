import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        // Browser globals
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        WeakRef: 'readonly',
        FinalizationRegistry: 'readonly',
        performance: 'readonly',
        PerformanceObserver: 'readonly',
        AbortController: 'readonly',
        Symbol: 'readonly',
        HTMLScriptElement: 'readonly',
        Response: 'readonly',
        global: 'readonly',
        // Spotify/Spicetify globals
        Spicetify: 'readonly',
        AudioAdBlocker: 'readonly',
        UIAdRemover: 'readonly',
        PremiumFeatures: 'readonly'
      }
    },
    plugins: {
      import: importPlugin
    },
    rules: {
      // JavaScript best practices
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-console': ['warn', { 
        allow: ['warn', 'error', 'info', 'debug'] 
      }],
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'arrow-spacing': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': 'error',
      'object-shorthand': 'error',
      'prefer-destructuring': ['error', {
        array: false,
        object: true
      }],
      
      // ES2023+ features
      'prefer-object-has-own': 'error',
      'prefer-object-spread': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
      
      // Code quality
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'brace-style': ['error', '1tbs'],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'no-trailing-spaces': 'error',
      'eol-last': 'error',
      
      // Import rules
      'import/order': ['error', {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'newlines-between': 'always'
      }],
      'import/no-unresolved': 'off', // Node.js modules
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      
      // Performance and security
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-eval': 'error'
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.json', '.mjs']
        }
      }
    }
  },
  {
    files: ['src/setupTests.js', 'src/**/*.test.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        // Jest globals
        jest: 'readonly',
        describe: 'readonly',
        test: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // Node.js globals
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        performance: 'readonly',
        AbortController: 'readonly',
        Symbol: 'readonly',
        // Browser globals for testing
        global: 'readonly',
        window: 'readonly',
        document: 'readonly',
        HTMLScriptElement: 'readonly',
        Response: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        WeakRef: 'readonly',
        FinalizationRegistry: 'readonly',
        localStorage: 'readonly'
      }
    },
    rules: {
      // Allow more console statements in tests
      'no-console': 'off',
      // Allow unused vars in tests
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      // Allow module exports in tests
      'no-var': 'off'
    }
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: {
        // Node.js globals
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        performance: 'readonly',
        AbortController: 'readonly',
        Symbol: 'readonly',
        // Browser globals for analyze-bundle.js
        document: 'readonly',
        window: 'readonly',
        Node: 'readonly'
      }
    },
    rules: {
      // Allow more console statements in scripts
      'no-console': 'off',
      // Allow unused vars in scripts
      'no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }]
    }
  }
];
