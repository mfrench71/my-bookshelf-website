import { BaseWidget } from '../base-widget.js';
import { escapeHtml, isValidImageUrl, parseTimestamp } from '../../utils.js';
import type { WishlistItem, GenreLookup, WidgetConfig, SettingsSchemaItem } from '../types.js';

/**
 * Wishlist Widget - Shows user's wishlisted books
 * Uses horizontal scroll layout matching other widgets
 */
export class WishlistWidget extends BaseWidget {
  static override id = 'wishlist';
  static override name = 'Wishlist';
  static override icon = 'heart';
  static override iconColor = 'text-red-500';
  static override defaultSize = 12;
  static override defaultSettings: Record<string, unknown> = { count: 6, sortBy: 'priority' };

  // Flag to indicate this widget uses wishlist data, not books
  static override requiresWishlist = true;

  static override settingsSchema: SettingsSchemaItem[] = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] },
    {
      key: 'sortBy',
      label: 'Sort by',
      type: 'select',
      options: [
        { value: 'priority', label: 'Priority' },
        { value: 'createdAt', label: 'Date Added' },
        { value: 'title', label: 'Title' },
      ],
    },
  ];

  /**
   * Filter and sort wishlist items
   * Override base class method to handle wishlist items
   * @param items - Wishlist items (not books)
   * @param config - Widget configuration
   * @returns Sorted and limited items
   */
  static override filterAndSort(items: WishlistItem[], config?: WidgetConfig): WishlistItem[] {
    if (!items || items.length === 0) return [];

    const sortBy = (config?.settings?.sortBy as string) || 'priority';
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

    // Sort items (base widget handles count limiting in renderWidget)
    return [...items].sort((a, b) => {
      if (sortBy === 'priority') {
        // Sort by priority first (high > medium > low > none)
        const pa = a.priority ? (priorityOrder[a.priority] ?? 3) : 3;
        const pb = b.priority ? (priorityOrder[b.priority] ?? 3) : 3;
        if (pa !== pb) return pa - pb;
        // Secondary sort by date added (newest first)
        const aTime = parseTimestamp(a.createdAt as Parameters<typeof parseTimestamp>[0])?.getTime() || 0;
        const bTime = parseTimestamp(b.createdAt as Parameters<typeof parseTimestamp>[0])?.getTime() || 0;
        return bTime - aTime;
      }
      if (sortBy === 'createdAt') {
        const aTime = parseTimestamp(a.createdAt as Parameters<typeof parseTimestamp>[0])?.getTime() || 0;
        const bTime = parseTimestamp(b.createdAt as Parameters<typeof parseTimestamp>[0])?.getTime() || 0;
        return bTime - aTime;
      }
      // Sort by title
      return (a.title || '').localeCompare(b.title || '');
    });
  }

  static override getEmptyMessage(): string {
    return 'Your wishlist is empty';
  }

  static override getSeeAllLink(): string {
    return '/wishlist/';
  }

  /**
   * Override renderWidget to handle wishlist data
   */
  static override renderWidget(items: WishlistItem[], config: WidgetConfig, _genreLookup?: GenreLookup): string {
    const sortedItems = this.filterAndSort(items, config);
    const count = (config.settings?.count as number) || 6;
    const displayItems = sortedItems.slice(0, count);
    const seeAllLink = this.getSeeAllLink();

    let seeAllHtml = '';
    if (seeAllLink && sortedItems.length > count) {
      seeAllHtml = `
        <a href="${seeAllLink}" class="text-sm text-primary hover:underline flex items-center gap-1">
          See all
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </a>
      `;
    }

    const content =
      displayItems.length > 0
        ? this.render(displayItems, config)
        : `<p class="text-gray-500 text-sm py-4">${escapeHtml(this.getEmptyMessage())}</p>`;

    return `
      <div class="widget-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <i data-lucide="${this.icon}" class="w-5 h-5 ${this.iconColor}"></i>
            <h2 class="font-semibold text-gray-900">${escapeHtml(this.name)}</h2>
            <span class="text-sm text-gray-500">(${sortedItems.length})</span>
          </div>
          ${seeAllHtml}
        </div>
        <div class="widget-content-area">
          ${content}
        </div>
      </div>
    `;
  }

  /**
   * Render wishlist widget content
   * @param items - Wishlist items
   * @param _config - Widget configuration
   * @returns HTML string
   */
  static override render(items: WishlistItem[], _config: WidgetConfig): string {
    if (!items || items.length === 0) {
      return `<p class="text-gray-500 text-sm p-4">${this.getEmptyMessage()}</p>`;
    }

    return `
      <div class="widget-scroll-container">
        ${items.map(item => this.renderCard(item)).join('')}
      </div>
    `;
  }

  /**
   * Render individual wishlist item card
   * @param item - Wishlist item
   * @returns HTML string
   */
  static renderCard(item: WishlistItem): string {
    const priorityColors: Record<string, string> = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-gray-100 text-gray-600',
    };

    const cover =
      item.coverImageUrl && isValidImageUrl(item.coverImageUrl)
        ? `<div class="relative w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
          <i data-lucide="book" class="w-8 h-8 text-white"></i>
          <img src="${escapeHtml(item.coverImageUrl)}" alt="" class="w-full h-full object-cover absolute inset-0" loading="lazy" onerror="this.style.display='none'">
        </div>`
        : `<div class="w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center flex-shrink-0">
          <i data-lucide="book" class="w-8 h-8 text-white"></i>
        </div>`;

    const priorityBadge =
      item.priority && priorityColors[item.priority]
        ? `<span class="text-xs px-1.5 py-0.5 rounded mt-1 inline-block ${priorityColors[item.priority]} capitalize">${item.priority}</span>`
        : '';

    return `
      <a href="/wishlist/" class="flex-shrink-0 w-24 snap-start">
        ${cover}
        <h3 class="text-sm font-medium text-gray-900 mt-2 line-clamp-2">${escapeHtml(item.title || 'Unknown')}</h3>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(item.author || '')}</p>
        ${priorityBadge}
      </a>
    `;
  }
}
