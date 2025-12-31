/**
 * Unit tests for src/js/utils/sync-settings.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getSyncSettings,
  saveSyncSettings,
  resetSyncSettings,
  getDefaultSyncSettings
} from '../src/js/utils/sync-settings.js';

describe('Sync Settings', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getDefaultSyncSettings', () => {
    it('should return default settings object', () => {
      const defaults = getDefaultSyncSettings();

      expect(defaults).toEqual({
        autoRefreshEnabled: true,
        hiddenThreshold: 30,
        cooldownPeriod: 300,
        genreSuggestionsFirst: false,
        seriesSuggestionsFirst: false
      });
    });

    it('should return a new object each time (not reference)', () => {
      const defaults1 = getDefaultSyncSettings();
      const defaults2 = getDefaultSyncSettings();

      expect(defaults1).not.toBe(defaults2);
      expect(defaults1).toEqual(defaults2);
    });
  });

  describe('getSyncSettings', () => {
    it('should return default settings when nothing stored', () => {
      const settings = getSyncSettings();

      expect(settings.autoRefreshEnabled).toBe(true);
      expect(settings.hiddenThreshold).toBe(30);
      expect(settings.cooldownPeriod).toBe(300);
    });

    it('should return stored settings merged with defaults', () => {
      localStorage.setItem('mybookshelf_sync_settings', JSON.stringify({
        autoRefreshEnabled: false,
        hiddenThreshold: 60
      }));

      const settings = getSyncSettings();

      expect(settings.autoRefreshEnabled).toBe(false);
      expect(settings.hiddenThreshold).toBe(60);
      expect(settings.cooldownPeriod).toBe(300); // Default
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem('mybookshelf_sync_settings', 'invalid json');

      const settings = getSyncSettings();

      // Should return defaults
      expect(settings.autoRefreshEnabled).toBe(true);
      expect(settings.hiddenThreshold).toBe(30);
      expect(settings.cooldownPeriod).toBe(300);
    });

    it('should return a new object each time', () => {
      const settings1 = getSyncSettings();
      const settings2 = getSyncSettings();

      expect(settings1).not.toBe(settings2);
      expect(settings1).toEqual(settings2);
    });
  });

  describe('saveSyncSettings', () => {
    it('should save settings to localStorage', () => {
      saveSyncSettings({ autoRefreshEnabled: false });

      const stored = JSON.parse(localStorage.getItem('mybookshelf_sync_settings'));
      expect(stored.autoRefreshEnabled).toBe(false);
    });

    it('should merge with existing settings', () => {
      saveSyncSettings({ autoRefreshEnabled: false });
      saveSyncSettings({ hiddenThreshold: 120 });

      const settings = getSyncSettings();

      expect(settings.autoRefreshEnabled).toBe(false);
      expect(settings.hiddenThreshold).toBe(120);
    });

    it('should update multiple settings at once', () => {
      saveSyncSettings({
        autoRefreshEnabled: false,
        hiddenThreshold: 60,
        cooldownPeriod: 600
      });

      const settings = getSyncSettings();

      expect(settings.autoRefreshEnabled).toBe(false);
      expect(settings.hiddenThreshold).toBe(60);
      expect(settings.cooldownPeriod).toBe(600);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => saveSyncSettings({ autoRefreshEnabled: false })).not.toThrow();

      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('resetSyncSettings', () => {
    it('should remove sync settings from localStorage', () => {
      saveSyncSettings({ autoRefreshEnabled: false, hiddenThreshold: 120 });
      expect(localStorage.getItem('mybookshelf_sync_settings')).not.toBeNull();

      resetSyncSettings();

      expect(localStorage.getItem('mybookshelf_sync_settings')).toBeNull();
    });

    it('should result in default settings being returned', () => {
      saveSyncSettings({ autoRefreshEnabled: false });
      resetSyncSettings();

      const settings = getSyncSettings();

      expect(settings.autoRefreshEnabled).toBe(true);
      expect(settings.hiddenThreshold).toBe(30);
      expect(settings.cooldownPeriod).toBe(300);
    });

    it('should handle localStorage errors gracefully', () => {
      // Mock localStorage.removeItem to throw
      const originalRemoveItem = localStorage.removeItem;
      localStorage.removeItem = vi.fn(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => resetSyncSettings()).not.toThrow();

      // Restore
      localStorage.removeItem = originalRemoveItem;
    });
  });

  describe('settings values', () => {
    it('should support disabling auto-refresh', () => {
      saveSyncSettings({ autoRefreshEnabled: false });
      expect(getSyncSettings().autoRefreshEnabled).toBe(false);
    });

    it('should support different hidden thresholds', () => {
      const thresholds = [30, 60, 120, 300];
      thresholds.forEach(threshold => {
        saveSyncSettings({ hiddenThreshold: threshold });
        expect(getSyncSettings().hiddenThreshold).toBe(threshold);
      });
    });

    it('should support different cooldown periods', () => {
      const periods = [60, 300, 600];
      periods.forEach(period => {
        saveSyncSettings({ cooldownPeriod: period });
        expect(getSyncSettings().cooldownPeriod).toBe(period);
      });
    });

    it('should default genreSuggestionsFirst to false', () => {
      expect(getSyncSettings().genreSuggestionsFirst).toBe(false);
    });

    it('should default seriesSuggestionsFirst to false', () => {
      expect(getSyncSettings().seriesSuggestionsFirst).toBe(false);
    });

    it('should support enabling genreSuggestionsFirst', () => {
      saveSyncSettings({ genreSuggestionsFirst: true });
      expect(getSyncSettings().genreSuggestionsFirst).toBe(true);
    });

    it('should support enabling seriesSuggestionsFirst', () => {
      saveSyncSettings({ seriesSuggestionsFirst: true });
      expect(getSyncSettings().seriesSuggestionsFirst).toBe(true);
    });

    it('should support independent genre/series settings', () => {
      saveSyncSettings({ genreSuggestionsFirst: true, seriesSuggestionsFirst: false });
      expect(getSyncSettings().genreSuggestionsFirst).toBe(true);
      expect(getSyncSettings().seriesSuggestionsFirst).toBe(false);

      saveSyncSettings({ genreSuggestionsFirst: false, seriesSuggestionsFirst: true });
      expect(getSyncSettings().genreSuggestionsFirst).toBe(false);
      expect(getSyncSettings().seriesSuggestionsFirst).toBe(true);
    });
  });
});
