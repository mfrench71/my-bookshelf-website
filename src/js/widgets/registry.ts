/**
 * Widget Registry - Singleton for registering and retrieving widgets
 */

import type { BaseWidgetClass, WidgetConfig } from './types.js';

class WidgetRegistry {
  private widgets: Map<string, BaseWidgetClass> = new Map();

  /**
   * Register a widget class
   * @param widgetClass - Widget class to register
   */
  register(widgetClass: BaseWidgetClass): void {
    if (!widgetClass.id) {
      throw new Error('Widget must have a static id property');
    }
    this.widgets.set(widgetClass.id, widgetClass);
  }

  /**
   * Get a widget class by ID
   * @param id - Widget ID
   * @returns Widget class or undefined
   */
  get(id: string): BaseWidgetClass | undefined {
    return this.widgets.get(id);
  }

  /**
   * Get all registered widgets
   * @returns Array of widget classes
   */
  getAll(): BaseWidgetClass[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Get all widget IDs
   * @returns Array of widget IDs
   */
  getIds(): string[] {
    return Array.from(this.widgets.keys());
  }

  /**
   * Check if a widget is registered
   * @param id - Widget ID
   * @returns True if registered
   */
  has(id: string): boolean {
    return this.widgets.has(id);
  }

  /**
   * Get default widget configurations
   * @returns Array of default configurations
   */
  getDefaultConfigs(): WidgetConfig[] {
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
