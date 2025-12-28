/**
 * Unit tests for src/js/utils/widget-settings.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Firebase
vi.mock('/js/firebase-config.js', () => ({
  db: {}
}));

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  doc: vi.fn(() => 'mock-doc-ref'),
  getDoc: vi.fn(),
  setDoc: vi.fn()
}));

// Mock widget registry
vi.mock('../src/js/widgets/index.js', () => ({
  widgetRegistry: {
    getDefaultConfigs: vi.fn(() => [
      { id: 'welcome', enabled: true, order: 0, size: 12, settings: { count: 6 } },
      { id: 'currentlyReading', enabled: true, order: 1, size: 6, settings: { count: 6 } },
      { id: 'recentlyAdded', enabled: true, order: 2, size: 12, settings: { count: 6 } }
    ])
  }
}));

import { getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  getDefaultWidgetConfigs,
  loadWidgetSettings,
  saveWidgetSettings,
  updateWidgetConfig,
  reorderWidgets,
  resetWidgetSettings,
  getEnabledWidgets
} from '../src/js/utils/widget-settings.js';

describe('widget-settings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getDefaultWidgetConfigs', () => {
    it('should return default configs from registry', () => {
      const configs = getDefaultWidgetConfigs();
      expect(configs).toHaveLength(3);
      expect(configs[0].id).toBe('welcome');
    });
  });

  describe('getEnabledWidgets', () => {
    it('should filter and sort enabled widgets', () => {
      const settings = {
        widgets: [
          { id: 'a', enabled: true, order: 2 },
          { id: 'b', enabled: false, order: 0 },
          { id: 'c', enabled: true, order: 1 }
        ]
      };

      const enabled = getEnabledWidgets(settings);
      expect(enabled).toHaveLength(2);
      expect(enabled[0].id).toBe('c'); // order 1
      expect(enabled[1].id).toBe('a'); // order 2
    });

    it('should return empty array when no widgets enabled', () => {
      const settings = {
        widgets: [
          { id: 'a', enabled: false, order: 0 }
        ]
      };

      const enabled = getEnabledWidgets(settings);
      expect(enabled).toHaveLength(0);
    });
  });

  describe('loadWidgetSettings', () => {
    it('should return defaults for new users', async () => {
      getDoc.mockResolvedValue({ exists: () => false });

      const settings = await loadWidgetSettings('user123');

      expect(settings.version).toBe(2);
      expect(settings.widgets).toHaveLength(3);
    });

    it('should load from Firestore when exists', async () => {
      const firestoreData = {
        version: 2,
        widgets: [
          { id: 'welcome', enabled: true, order: 0, size: 12, settings: {} }
        ]
      };
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => firestoreData
      });

      const settings = await loadWidgetSettings('user123');

      expect(settings.widgets[0].id).toBe('welcome');
    });

    it('should merge new widgets into existing settings', async () => {
      // Simulate existing settings missing one widget
      const firestoreData = {
        version: 2,
        widgets: [
          { id: 'welcome', enabled: true, order: 0, size: 12, settings: {} }
        ]
      };
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => firestoreData
      });

      const settings = await loadWidgetSettings('user123');

      // Should have welcome + 2 new widgets merged in
      expect(settings.widgets.length).toBeGreaterThan(1);
    });

    it('should migrate legacy homeSettings', async () => {
      getDoc.mockResolvedValue({ exists: () => false });
      setDoc.mockResolvedValue();

      // Set legacy settings
      localStorage.setItem('homeSettings', JSON.stringify({
        currentlyReading: { enabled: true, count: 4 }
      }));

      const settings = await loadWidgetSettings('user123');

      expect(settings.version).toBe(2);
      // Legacy settings should be removed
      expect(localStorage.getItem('homeSettings')).toBeNull();
    });

    it('should cache settings locally', async () => {
      const firestoreData = {
        version: 2,
        widgets: [{ id: 'test', enabled: true, order: 0, size: 12, settings: {} }]
      };
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => firestoreData
      });

      await loadWidgetSettings('user123');

      const cached = JSON.parse(localStorage.getItem('widgetSettings'));
      expect(cached.widgets[0].id).toBe('test');
    });

    it('should fallback to cache on Firestore error', async () => {
      // Set cache first
      localStorage.setItem('widgetSettings', JSON.stringify({
        version: 2,
        widgets: [{ id: 'cached', enabled: true, order: 0 }]
      }));

      getDoc.mockRejectedValue(new Error('Network error'));

      const settings = await loadWidgetSettings('user123');

      expect(settings.widgets[0].id).toBe('cached');
    });

    it('should return defaults when cache is invalid', async () => {
      localStorage.setItem('widgetSettings', 'invalid json');
      getDoc.mockRejectedValue(new Error('Network error'));

      const settings = await loadWidgetSettings('user123');

      expect(settings.version).toBe(2);
      expect(settings.widgets).toHaveLength(3); // defaults
    });
  });

  describe('saveWidgetSettings', () => {
    it('should save to Firestore and cache', async () => {
      setDoc.mockResolvedValue();

      const settings = {
        widgets: [{ id: 'test', enabled: true }]
      };

      await saveWidgetSettings('user123', settings);

      expect(setDoc).toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem('widgetSettings'))).toBeDefined();
    });

    it('should throw on Firestore error', async () => {
      setDoc.mockRejectedValue(new Error('Permission denied'));

      await expect(saveWidgetSettings('user123', { widgets: [] }))
        .rejects.toThrow('Permission denied');
    });
  });

  describe('updateWidgetConfig', () => {
    beforeEach(() => {
      // Mock loadWidgetSettings to return test data
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          version: 2,
          widgets: [
            { id: 'welcome', enabled: true, order: 0, size: 12, settings: { count: 6 } },
            { id: 'currentlyReading', enabled: true, order: 1, size: 6, settings: { count: 6 } }
          ]
        })
      });
      setDoc.mockResolvedValue();
    });

    it('should update widget enabled state', async () => {
      const result = await updateWidgetConfig('user123', 'welcome', { enabled: false });

      const updatedWidget = result.widgets.find(w => w.id === 'welcome');
      expect(updatedWidget.enabled).toBe(false);
    });

    it('should update widget settings', async () => {
      const result = await updateWidgetConfig('user123', 'welcome', {
        settings: { count: 10 }
      });

      const updatedWidget = result.widgets.find(w => w.id === 'welcome');
      expect(updatedWidget.settings.count).toBe(10);
    });

    it('should throw for unknown widget', async () => {
      await expect(updateWidgetConfig('user123', 'unknown', { enabled: false }))
        .rejects.toThrow('Widget not found: unknown');
    });
  });

  describe('reorderWidgets', () => {
    beforeEach(() => {
      getDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          version: 2,
          widgets: [
            { id: 'a', enabled: true, order: 0 },
            { id: 'b', enabled: true, order: 1 },
            { id: 'c', enabled: true, order: 2 }
          ]
        })
      });
      setDoc.mockResolvedValue();
    });

    it('should reorder widgets', async () => {
      const result = await reorderWidgets('user123', ['c', 'a', 'b']);

      expect(result.widgets[0].id).toBe('c');
      expect(result.widgets[0].order).toBe(0);
      expect(result.widgets[1].id).toBe('a');
      expect(result.widgets[1].order).toBe(1);
      expect(result.widgets[2].id).toBe('b');
      expect(result.widgets[2].order).toBe(2);
    });

    it('should throw for unknown widget in order', async () => {
      await expect(reorderWidgets('user123', ['c', 'unknown', 'b']))
        .rejects.toThrow('Widget not found: unknown');
    });
  });

  describe('resetWidgetSettings', () => {
    it('should reset to defaults', async () => {
      setDoc.mockResolvedValue();

      const result = await resetWidgetSettings('user123');

      expect(result.version).toBe(2);
      expect(result.widgets).toHaveLength(3);
      expect(setDoc).toHaveBeenCalled();
    });
  });
});
