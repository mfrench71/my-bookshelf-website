import { BaseWidget } from '../base-widget.js';
import { escapeHtml, isValidImageUrl, parseTimestamp } from '../../utils.js';

/**
 * Wishlist Widget - Shows user's wishlisted books
 * Uses horizontal scroll layout matching other widgets
 */
export class WishlistWidget extends BaseWidget {
  static id = 'wishlist';
  static name = 'Wishlist';
  static icon = 'heart';
  static iconColor = 'text-red-500';
  static defaultSize = 12;
  static defaultSettings = { count: 6, sortBy: 'priority' };

  // Flag to indicate this widget uses wishlist data, not books
  static requiresWishlist = true;

  static settingsSchema = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] },
    {
      key: 'sortBy',
      label: 'Sort by',
      type: 'select',
      options: [
        { value: 'priority', label: 'Priority' },
        { value: 'createdAt', label: 'Date Added' },
        { value: 'title', label: 'Title' }
      ]
    }
  ];

  /**
   * Filter and sort wishlist items
   * @param {Array} items - Wishlist items (not books)
   * @param {Object} config - Widget configuration
   * @returns {Array} Sorted and limited items
   */
  static filterAndSort(items, config) {
    if (!items || items.length === 0) return [];

    const sortBy = config?.settings?.sortBy || 'priority';
    const count = config?.settings?.count || 6;
    const priorityOrder = { high: 0, medium: 1, low: 2 };

    return [...items]
      .sort((a, b) => {
        if (sortBy === 'priority') {
          // Sort by priority first (high > medium > low > none)
          const pa = priorityOrder[a.priority] ?? 3;
          const pb = priorityOrder[b.priority] ?? 3;
          if (pa !== pb) return pa - pb;
          // Secondary sort by date added (newest first)
          const aTime = parseTimestamp(a.createdAt)?.getTime() || 0;
          const bTime = parseTimestamp(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        }
        if (sortBy === 'createdAt') {
          const aTime = parseTimestamp(a.createdAt)?.getTime() || 0;
          const bTime = parseTimestamp(b.createdAt)?.getTime() || 0;
          return bTime - aTime;
        }
        // Sort by title
        return (a.title || '').localeCompare(b.title || '');
      })
      .slice(0, count);
  }

  static getEmptyMessage() {
    return 'Your wishlist is empty';
  }

  static getSeeAllLink() {
    return '/wishlist/';
  }

  /**
   * Render wishlist widget content
   * @param {Array} items - Wishlist items (passed as 'books' parameter by renderer)
   * @param {Object} config - Widget configuration
   * @returns {string} HTML string
   */
  static render(items, config) {
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
   * @param {Object} item - Wishlist item
   * @returns {string} HTML string
   */
  static renderCard(item) {
    const priorityColors = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-gray-100 text-gray-600'
    };

    const cover = item.coverImageUrl && isValidImageUrl(item.coverImageUrl)
      ? `<div class="relative w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
          <i data-lucide="book" class="w-8 h-8 text-white"></i>
          <img src="${escapeHtml(item.coverImageUrl)}" alt="" class="w-full h-full object-cover absolute inset-0" loading="lazy" onerror="this.style.display='none'">
        </div>`
      : `<div class="w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center flex-shrink-0">
          <i data-lucide="book" class="w-8 h-8 text-white"></i>
        </div>`;

    const priorityBadge = item.priority && priorityColors[item.priority]
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
