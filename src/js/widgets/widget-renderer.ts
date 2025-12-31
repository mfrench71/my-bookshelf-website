/**
 * Widget Renderer
 *
 * Renders widgets to the DOM based on user configuration.
 * Handles widget grid layout, skeleton loading states, and icon initialization.
 */

import { widgetRegistry } from './registry.js';
import { getEnabledWidgets } from '../utils/widget-settings.js';
import { initIcons } from '../utils.js';
import type {
  Book,
  WishlistItem,
  GenreLookup,
  SeriesLookup,
  WidgetSettings,
  WidgetConfig,
  WidgetInfo,
  WidgetSizeOption,
} from './types.js';

/**
 * Render skeleton loading state for widgets
 * @param container - Container element
 * @param count - Number of skeleton widgets to show
 */
export function renderWidgetSkeletons(container: HTMLElement, count = 4): void {
  const skeletons = Array(count)
    .fill(0)
    .map(
      () => `
    <div class="widget-skeleton widget-col-12">
      <div class="skeleton-header">
        <div class="skeleton skeleton-icon"></div>
        <div class="skeleton skeleton-title"></div>
      </div>
      <div class="skeleton-content">
        ${Array(4)
          .fill(0)
          .map(
            () => `
          <div class="skeleton-book">
            <div class="skeleton skeleton-book-cover"></div>
            <div class="skeleton skeleton-book-title"></div>
            <div class="skeleton skeleton-book-author"></div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `
    )
    .join('');

  container.innerHTML = `<div class="widget-grid">${skeletons}</div>`;
}

/**
 * Render all enabled widgets to container
 * @param container - Container element
 * @param books - User's books
 * @param settings - Widget settings { version, widgets: [...] }
 * @param genreLookup - Genre ID to genre object map
 * @param seriesLookup - Series ID to series object map
 * @param wishlistItems - User's wishlist items (optional)
 */
export function renderWidgets(
  container: HTMLElement,
  books: Book[],
  settings: WidgetSettings,
  genreLookup: GenreLookup = {},
  seriesLookup: SeriesLookup | null = null,
  wishlistItems: WishlistItem[] = []
): void {
  const enabledWidgets = getEnabledWidgets(settings) as WidgetConfig[];

  if (enabledWidgets.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <p>No widgets enabled. Go to Settings to configure your dashboard.</p>
      </div>
    `;
    return;
  }

  const widgetHtml = enabledWidgets
    .map(config => {
      const Widget = widgetRegistry.get(config.id);
      if (!Widget) {
        console.warn(`Widget not found: ${config.id}`);
        return '';
      }

      const sizeClass = `widget-col-${config.size || Widget.defaultSize}`;
      // Pass wishlist items instead of books for widgets that require it
      const data = Widget.requiresWishlist ? wishlistItems : books;
      const html = Widget.renderWidget(data, config, genreLookup, seriesLookup);

      return `<div class="${sizeClass}">${html}</div>`;
    })
    .join('');

  // Replace skeletons with actual widgets using crossfade animation
  container.innerHTML = `<div class="widget-grid fade-in">${widgetHtml}</div>`;

  // Initialize Lucide icons after rendering
  initIcons();
}

/**
 * Render a single widget (for preview in settings)
 * @param widgetId - Widget ID
 * @param books - Sample books
 * @param config - Widget configuration
 * @param genreLookup - Genre lookup
 * @param seriesLookup - Series lookup
 * @returns HTML string
 */
export function renderSingleWidget(
  widgetId: string,
  books: Book[],
  config: WidgetConfig,
  genreLookup: GenreLookup = {},
  seriesLookup: SeriesLookup | null = null
): string {
  const Widget = widgetRegistry.get(widgetId);
  if (!Widget) {
    return '<p class="text-gray-500">Widget not found</p>';
  }

  return Widget.renderWidget(books, config, genreLookup, seriesLookup);
}

/**
 * Get widget info for settings UI
 * @returns Array of widget info objects
 */
export function getWidgetInfo(): WidgetInfo[] {
  return widgetRegistry.getAll().map(Widget => ({
    id: Widget.id,
    name: Widget.name,
    icon: Widget.icon,
    iconColor: Widget.iconColor,
    defaultSize: Widget.defaultSize,
    defaultSettings: Widget.defaultSettings,
    settingsSchema: Widget.settingsSchema,
  }));
}

/**
 * Size options for widget configuration
 */
export const WIDGET_SIZES: WidgetSizeOption[] = [
  { value: 3, label: 'Small', description: 'Quarter width' },
  { value: 6, label: 'Medium', description: 'Half width' },
  { value: 9, label: 'Large', description: 'Three-quarter width' },
  { value: 12, label: 'Full', description: 'Full width' },
];
