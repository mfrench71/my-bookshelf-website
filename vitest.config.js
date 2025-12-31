import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '/js': path.resolve(__dirname, 'src/js')
    },
    // Resolve .js imports to .ts files when TypeScript version exists
    extensions: ['.ts', '.js', '.json']
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{js,ts}'],
    exclude: ['tests/emulator/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/js/**/*.{js,ts}'],
      exclude: [
        // Firebase config
        'src/js/firebase-config.js',
        'src/js/app.js',
        // Entry point files with DOM/Firebase dependencies (both .js and .ts)
        'src/js/header.{js,ts}',
        'src/js/login.{js,ts}',
        'src/js/index.{js,ts}',
        'src/js/books/*.{js,ts}',
        'src/js/settings/*.{js,ts}',
        'src/js/wishlist/*.{js,ts}',
        // Re-export modules
        'src/js/utils.{js,ts}',
        'src/js/utils/index.{js,ts}',
        'src/js/schemas/index.{js,ts}',
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
