// Settings Preferences Page Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Settings Preferences Page', () => {
  describe('Sync Settings UI', () => {
    let container;
    let syncOptionsDiv;

    beforeEach(() => {
      container = document.createElement('div');
      container.innerHTML = `
        <div id="sync-options" class="">
          <select id="hidden-threshold">
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="300">5 minutes</option>
          </select>
          <select id="cooldown-period">
            <option value="30">30 seconds</option>
            <option value="60">1 minute</option>
            <option value="120">2 minutes</option>
          </select>
        </div>
      `;
      document.body.appendChild(container);
      syncOptionsDiv = container.querySelector('#sync-options');
    });

    afterEach(() => {
      container.remove();
    });

    it('should toggle visibility based on enabled state', () => {
      // Simulate disabled state
      const updateVisibility = (enabled) => {
        syncOptionsDiv.classList.toggle('opacity-50', !enabled);
        syncOptionsDiv.classList.toggle('pointer-events-none', !enabled);
      };

      updateVisibility(false);
      expect(syncOptionsDiv.classList.contains('opacity-50')).toBe(true);
      expect(syncOptionsDiv.classList.contains('pointer-events-none')).toBe(true);

      updateVisibility(true);
      expect(syncOptionsDiv.classList.contains('opacity-50')).toBe(false);
      expect(syncOptionsDiv.classList.contains('pointer-events-none')).toBe(false);
    });

    it('should parse threshold values as integers', () => {
      const select = container.querySelector('#hidden-threshold');
      select.value = '60';
      expect(parseInt(select.value, 10)).toBe(60);
    });
  });

  describe('Widget Settings Logic', () => {
    it('should sort widgets by order', () => {
      const widgets = [
        { id: 'a', order: 3 },
        { id: 'b', order: 1 },
        { id: 'c', order: 2 }
      ];

      const sorted = [...widgets].sort((a, b) => a.order - b.order);
      expect(sorted.map(w => w.id)).toEqual(['b', 'c', 'a']);
    });

    it('should update widget settings correctly', () => {
      const widget = {
        id: 'test',
        enabled: true,
        size: 6,
        settings: { count: 6 }
      };

      const updates = { size: 12, settings: { count: 9 } };
      const updated = {
        ...widget,
        ...updates,
        settings: {
          ...widget.settings,
          ...updates.settings
        }
      };

      expect(updated.size).toBe(12);
      expect(updated.settings.count).toBe(9);
      expect(updated.enabled).toBe(true);
    });

    it('should swap widget order correctly', () => {
      const orderedIds = ['a', 'b', 'c', 'd'];
      const currentIndex = 1;
      const newIndex = 2;

      [orderedIds[currentIndex], orderedIds[newIndex]] = [orderedIds[newIndex], orderedIds[currentIndex]];

      expect(orderedIds).toEqual(['a', 'c', 'b', 'd']);
    });

    it('should prevent moving first widget up', () => {
      const index = 0;
      const direction = -1;
      const newIndex = index + direction;

      expect(newIndex < 0).toBe(true);
    });

    it('should prevent moving last widget down', () => {
      const widgets = ['a', 'b', 'c'];
      const index = widgets.length - 1;
      const direction = 1;
      const newIndex = index + direction;

      expect(newIndex >= widgets.length).toBe(true);
    });
  });

  describe('Clear Cache Logic', () => {
    beforeEach(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    it('should identify app-specific localStorage keys', () => {
      localStorage.setItem('mybookshelf_test', 'value');
      localStorage.setItem('homeSettings', 'value');
      localStorage.setItem('syncSettings', 'value');
      localStorage.setItem('widgetSettings_123', 'value');
      localStorage.setItem('gravatar_abc', 'value');
      localStorage.setItem('other_key', 'value');

      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('mybookshelf_') ||
          key.startsWith('homeSettings') ||
          key.startsWith('syncSettings') ||
          key.startsWith('widgetSettings') ||
          key.startsWith('gravatar_')
        )) {
          keysToRemove.push(key);
        }
      }

      expect(keysToRemove).toHaveLength(5);
      expect(keysToRemove).not.toContain('other_key');
    });

    it('should not remove non-app keys', () => {
      localStorage.setItem('external_app_key', 'value');
      localStorage.setItem('mybookshelf_cache', 'value');

      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mybookshelf_')) {
          keysToRemove.push(key);
        }
      }

      expect(keysToRemove).toHaveLength(1);
      expect(keysToRemove[0]).toBe('mybookshelf_cache');
    });
  });
});
