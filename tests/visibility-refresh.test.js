/**
 * Unit tests for src/js/utils/visibility-refresh.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupVisibilityRefresh,
  getLastRefreshTime,
  setLastRefreshTime
} from '../src/js/utils/visibility-refresh.js';
import { saveSyncSettings, resetSyncSettings } from '../src/js/utils/sync-settings.js';

describe('Visibility Refresh', () => {
  let cleanup;
  let visibilityListeners = [];

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset sync settings to defaults
    resetSyncSettings();

    // Reset last refresh time
    setLastRefreshTime(0);

    // Mock document.hidden
    Object.defineProperty(document, 'hidden', {
      value: false,
      writable: true,
      configurable: true
    });

    // Capture visibility change listeners
    visibilityListeners = [];
    const originalAddEventListener = document.addEventListener;
    document.addEventListener = vi.fn((event, handler) => {
      if (event === 'visibilitychange') {
        visibilityListeners.push(handler);
      }
      originalAddEventListener.call(document, event, handler);
    });
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    localStorage.clear();
  });

  // Helper to simulate visibility change
  function simulateVisibilityChange(hidden) {
    Object.defineProperty(document, 'hidden', {
      value: hidden,
      writable: true,
      configurable: true
    });
    visibilityListeners.forEach(listener => listener());
  }

  describe('setupVisibilityRefresh', () => {
    it('should return a cleanup function', () => {
      const refreshFn = vi.fn();
      cleanup = setupVisibilityRefresh(refreshFn);

      expect(typeof cleanup).toBe('function');
    });

    it('should add visibilitychange event listener', () => {
      const refreshFn = vi.fn();
      cleanup = setupVisibilityRefresh(refreshFn);

      expect(document.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });

    it('should not call refresh immediately', () => {
      const refreshFn = vi.fn();
      cleanup = setupVisibilityRefresh(refreshFn);

      expect(refreshFn).not.toHaveBeenCalled();
    });
  });

  describe('visibility change handling', () => {
    it('should not refresh when tab becomes hidden', () => {
      const refreshFn = vi.fn();
      cleanup = setupVisibilityRefresh(refreshFn);

      simulateVisibilityChange(true); // Hide tab

      expect(refreshFn).not.toHaveBeenCalled();
    });

    it('should not refresh when hidden duration is less than threshold', async () => {
      const refreshFn = vi.fn();
      cleanup = setupVisibilityRefresh(refreshFn);

      // Default threshold is 30 seconds
      simulateVisibilityChange(true); // Hide tab

      // Wait less than threshold (mocked - just set time)
      await new Promise(r => setTimeout(r, 10));

      simulateVisibilityChange(false); // Show tab

      expect(refreshFn).not.toHaveBeenCalled();
    });

    it('should refresh when hidden duration exceeds threshold', async () => {
      const refreshFn = vi.fn().mockResolvedValue(undefined);

      // Set a very short threshold for testing
      saveSyncSettings({ hiddenThreshold: 0.01, cooldownPeriod: 0 });

      cleanup = setupVisibilityRefresh(refreshFn);

      simulateVisibilityChange(true); // Hide tab

      // Wait a bit
      await new Promise(r => setTimeout(r, 20));

      simulateVisibilityChange(false); // Show tab

      // Should have been called at least once
      expect(refreshFn).toHaveBeenCalled();
    });

    it('should respect cooldown period', async () => {
      const refreshFn = vi.fn().mockResolvedValue(undefined);

      // Set very short threshold but long cooldown
      saveSyncSettings({ hiddenThreshold: 0.01, cooldownPeriod: 600 });

      // Set last refresh to now
      setLastRefreshTime(Date.now());

      cleanup = setupVisibilityRefresh(refreshFn);

      simulateVisibilityChange(true); // Hide tab
      await new Promise(r => setTimeout(r, 20));
      simulateVisibilityChange(false); // Show tab

      // Should not refresh due to cooldown
      expect(refreshFn).not.toHaveBeenCalled();
    });

    it('should not refresh when auto-refresh is disabled', async () => {
      const refreshFn = vi.fn();

      saveSyncSettings({ autoRefreshEnabled: false, hiddenThreshold: 0.01 });

      cleanup = setupVisibilityRefresh(refreshFn);

      simulateVisibilityChange(true); // Hide tab
      await new Promise(r => setTimeout(r, 20));
      simulateVisibilityChange(false); // Show tab

      expect(refreshFn).not.toHaveBeenCalled();
    });
  });

  describe('getLastRefreshTime', () => {
    it('should return 0 initially', () => {
      setLastRefreshTime(0);
      expect(getLastRefreshTime()).toBe(0);
    });

    it('should return the set time', () => {
      const time = 1234567890;
      setLastRefreshTime(time);

      expect(getLastRefreshTime()).toBe(time);
    });
  });

  describe('setLastRefreshTime', () => {
    it('should set the last refresh time', () => {
      const time = Date.now();
      setLastRefreshTime(time);

      expect(getLastRefreshTime()).toBe(time);
    });

    it('should default to current time when no argument', () => {
      const before = Date.now();
      setLastRefreshTime();
      const after = Date.now();

      const lastRefresh = getLastRefreshTime();
      expect(lastRefresh).toBeGreaterThanOrEqual(before);
      expect(lastRefresh).toBeLessThanOrEqual(after);
    });
  });

  describe('error handling', () => {
    it('should handle refresh function errors gracefully', async () => {
      const refreshFn = vi.fn().mockRejectedValue(new Error('Refresh failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      saveSyncSettings({ hiddenThreshold: 0.01, cooldownPeriod: 0 });
      cleanup = setupVisibilityRefresh(refreshFn);

      simulateVisibilityChange(true);
      await new Promise(r => setTimeout(r, 20));
      simulateVisibilityChange(false);

      // Should have tried to call refresh
      expect(refreshFn).toHaveBeenCalled();

      // Wait for async error handling
      await new Promise(r => setTimeout(r, 10));

      // Should have logged error
      expect(consoleSpy).toHaveBeenCalledWith('Auto-refresh failed:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('multiple setups', () => {
    it('should allow multiple independent setups', () => {
      const refreshFn1 = vi.fn();
      const refreshFn2 = vi.fn();

      const cleanup1 = setupVisibilityRefresh(refreshFn1);
      const cleanup2 = setupVisibilityRefresh(refreshFn2);

      // Both should have registered listeners
      expect(visibilityListeners.length).toBeGreaterThanOrEqual(2);

      cleanup1();
      cleanup2();
    });
  });
});
