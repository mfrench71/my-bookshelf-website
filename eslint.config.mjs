import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  // Base recommended rules
  js.configs.recommended,

  // Global ignores
  {
    ignores: [
      '_site/**',
      'dist/**',
      'node_modules/**',
      'src/js/vendor/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.cache/**',
    ],
  },

  // Main source files (TypeScript)
  {
    files: ['src/js/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tseslint.parser,
      parserOptions: {
        project: false, // Don't require tsconfig for linting (faster)
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLImageElement: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        AbortController: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        location: 'readonly',
        history: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        performance: 'readonly',
        crypto: 'readonly',
        // Lucide icons
        lucide: 'readonly',
        // Barcode scanner (loaded from vendor)
        Quagga: 'readonly',
      },
    },
    rules: {
      // Error prevention
      'no-unused-vars': 'off', // TypeScript handles this
      'no-undef': 'off', // TypeScript handles this
      'no-prototype-builtins': 'error',
      'no-duplicate-imports': 'error',

      // Best practices
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'multi-line'],
      'no-throw-literal': 'error',

      // Style
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
    },
  },

  // Main source files (JavaScript - legacy, if any remain)
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        Image: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLImageElement: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',
        AbortController: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
        location: 'readonly',
        history: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        prompt: 'readonly',
        performance: 'readonly',
        // Lucide icons
        lucide: 'readonly',
        // Barcode scanner (loaded from vendor)
        Quagga: 'readonly',
      },
    },
    rules: {
      // Error prevention
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-prototype-builtins': 'error',
      'no-duplicate-imports': 'error',

      // Best practices
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'curly': ['error', 'multi-line'],
      'no-throw-literal': 'error',

      // Style
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
    },
  },

  // Test files
  {
    files: ['tests/**/*.ts', 'tests/**/*.js', 'e2e/**/*.js', '**/*.test.ts', '**/*.test.js', '**/*.spec.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node globals
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        // Browser globals (for jsdom tests)
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        MutationObserver: 'readonly',
        location: 'readonly',
        history: 'readonly',
        Image: 'readonly',
        // Vitest globals
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        test: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },

  // Config and build scripts
  {
    files: ['*.config.js', '*.config.mjs', 'scripts/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        URL: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // 11ty data files (CommonJS)
  {
    files: ['src/_data/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // Service worker (different global context)
  {
    files: ['src/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        location: 'readonly',
        clients: 'readonly',
        skipWaiting: 'readonly',
        console: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
];
