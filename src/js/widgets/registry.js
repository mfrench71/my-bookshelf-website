/**
 * Widget Registry - Singleton for registering and retrieving widgets
 */
class WidgetRegistry {
  constructor() {
    this.widgets = new Map();
  }

  /**
   * Register a widget class
   * @param {typeof BaseWidget} widgetClass - Widget class to register
   */
  register(widgetClass) {
    if (!widgetClass.id) {
      throw new Error('Widget must have a static id property');
    }
    this.widgets.set(widgetClass.id, widgetClass);
  }

  /**
   * Get a widget class by ID
   * @param {string} id - Widget ID
   * @returns {typeof BaseWidget|undefined}
   */
  get(id) {
    return this.widgets.get(id);
  }

  /**
   * Get all registered widgets
   * @returns {Array<typeof BaseWidget>}
   */
  getAll() {
    return Array.from(this.widgets.values());
  }

  /**
   * Get all widget IDs
   * @returns {Array<string>}
   */
  getIds() {
    return Array.from(this.widgets.keys());
  }

  /**
   * Check if a widget is registered
   * @param {string} id - Widget ID
   * @returns {boolean}
   */
  has(id) {
    return this.widgets.has(id);
  }

  /**
   * Get default widget configurations
   * @returns {Array<Object>}
   */
  getDefaultConfigs() {
    return this.getAll().map((Widget, index) => ({
      id: Widget.id,
      enabled: true,
      order: index,
      size: Widget.defaultSize,
      settings: { ...Widget.defaultSettings },
    }));
  }
}

// Singleton instance
export const widgetRegistry = new WidgetRegistry();
