/**
 * Tests for Widget Registry
 * Tests widget registration, retrieval, and default configuration
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('WidgetRegistry', () => {
  // Inline implementation for testing
  class WidgetRegistry {
    constructor() {
      this.widgets = new Map();
    }

    register(widgetClass) {
      if (!widgetClass.id) {
        throw new Error('Widget must have a static id property');
      }
      this.widgets.set(widgetClass.id, widgetClass);
    }

    get(id) {
      return this.widgets.get(id);
    }

    getAll() {
      return Array.from(this.widgets.values());
    }

    getIds() {
      return Array.from(this.widgets.keys());
    }

    has(id) {
      return this.widgets.has(id);
    }

    getDefaultConfigs() {
      return this.getAll().map((Widget, index) => ({
        id: Widget.id,
        enabled: true,
        order: index,
        size: Widget.defaultSize,
        settings: { ...Widget.defaultSettings }
      }));
    }
  }

  let registry;

  // Mock widget classes
  const MockWidget1 = {
    id: 'widget-1',
    name: 'Widget One',
    defaultSize: 6,
    defaultSettings: { count: 5 }
  };

  const MockWidget2 = {
    id: 'widget-2',
    name: 'Widget Two',
    defaultSize: 12,
    defaultSettings: { showTitle: true }
  };

  const MockWidget3 = {
    id: 'widget-3',
    name: 'Widget Three',
    defaultSize: 3,
    defaultSettings: {}
  };

  beforeEach(() => {
    registry = new WidgetRegistry();
  });

  describe('constructor', () => {
    it('should initialize with empty widgets map', () => {
      expect(registry.widgets.size).toBe(0);
    });
  });

  describe('register', () => {
    it('should register a widget class', () => {
      registry.register(MockWidget1);

      expect(registry.widgets.size).toBe(1);
      expect(registry.widgets.get('widget-1')).toBe(MockWidget1);
    });

    it('should register multiple widgets', () => {
      registry.register(MockWidget1);
      registry.register(MockWidget2);
      registry.register(MockWidget3);

      expect(registry.widgets.size).toBe(3);
    });

    it('should throw error if widget has no id', () => {
      const InvalidWidget = { name: 'No ID Widget' };

      expect(() => registry.register(InvalidWidget)).toThrow('Widget must have a static id property');
    });

    it('should overwrite existing widget with same id', () => {
      const UpdatedWidget = { ...MockWidget1, name: 'Updated Widget' };

      registry.register(MockWidget1);
      registry.register(UpdatedWidget);

      expect(registry.widgets.size).toBe(1);
      expect(registry.get('widget-1').name).toBe('Updated Widget');
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.register(MockWidget1);
      registry.register(MockWidget2);
    });

    it('should return widget by id', () => {
      expect(registry.get('widget-1')).toBe(MockWidget1);
      expect(registry.get('widget-2')).toBe(MockWidget2);
    });

    it('should return undefined for non-existent id', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('getAll', () => {
    it('should return empty array when no widgets registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered widgets', () => {
      registry.register(MockWidget1);
      registry.register(MockWidget2);

      const all = registry.getAll();

      expect(all).toHaveLength(2);
      expect(all).toContain(MockWidget1);
      expect(all).toContain(MockWidget2);
    });
  });

  describe('getIds', () => {
    it('should return empty array when no widgets registered', () => {
      expect(registry.getIds()).toEqual([]);
    });

    it('should return all widget IDs', () => {
      registry.register(MockWidget1);
      registry.register(MockWidget2);

      const ids = registry.getIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('widget-1');
      expect(ids).toContain('widget-2');
    });
  });

  describe('has', () => {
    beforeEach(() => {
      registry.register(MockWidget1);
    });

    it('should return true for registered widget', () => {
      expect(registry.has('widget-1')).toBe(true);
    });

    it('should return false for non-registered widget', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getDefaultConfigs', () => {
    it('should return empty array when no widgets registered', () => {
      expect(registry.getDefaultConfigs()).toEqual([]);
    });

    it('should return default configs for all widgets', () => {
      registry.register(MockWidget1);
      registry.register(MockWidget2);

      const configs = registry.getDefaultConfigs();

      expect(configs).toHaveLength(2);
    });

    it('should include id, enabled, order, size, and settings', () => {
      registry.register(MockWidget1);

      const configs = registry.getDefaultConfigs();

      expect(configs[0]).toEqual({
        id: 'widget-1',
        enabled: true,
        order: 0,
        size: 6,
        settings: { count: 5 }
      });
    });

    it('should set order based on registration order', () => {
      registry.register(MockWidget1);
      registry.register(MockWidget2);
      registry.register(MockWidget3);

      const configs = registry.getDefaultConfigs();

      expect(configs[0].order).toBe(0);
      expect(configs[1].order).toBe(1);
      expect(configs[2].order).toBe(2);
    });

    it('should copy settings object (not reference)', () => {
      registry.register(MockWidget1);

      const configs = registry.getDefaultConfigs();
      configs[0].settings.count = 100;

      expect(MockWidget1.defaultSettings.count).toBe(5); // Original unchanged
    });
  });
});
