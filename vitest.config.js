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
      exclude: ['src/js/firebase-config.js', 'src/js/app.js'],
      thresholds: {
        // Enforce minimum coverage - fail CI if below these
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    }
  }
});
