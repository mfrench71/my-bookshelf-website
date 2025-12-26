import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '/js': path.resolve(__dirname, 'src/js')
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/js/**/*.js'],
      exclude: [
        // Firebase config
        'src/js/firebase-config.js',
        'src/js/app.js',
        // Entry point files with DOM/Firebase dependencies
        'src/js/header.js',
        'src/js/login.js',
        'src/js/index.js',
        'src/js/books/*.js',
        'src/js/settings/*.js',
        // Re-export modules
        'src/js/utils.js',
        'src/js/utils/index.js',
        'src/js/schemas/index.js',
        // Vendor files
        'src/js/vendor/**'
      ],
      thresholds: {
        // Enforce minimum coverage for testable modules
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    }
  }
});
