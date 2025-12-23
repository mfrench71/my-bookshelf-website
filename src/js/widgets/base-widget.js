import { escapeHtml } from '../utils.js';

/**
 * Base Widget Class - All widgets extend this class
 */
export class BaseWidget {
  // Static properties - must be overridden by subclasses
  static id = '';              // Unique widget identifier (e.g., 'currentlyReading')
  static name = '';            // Display name (e.g., 'Currently Reading')
  static icon = '';            // Lucide icon name (e.g., 'book-open')
  static iconColor = '';       // Tailwind text color class (e.g., 'text-blue-600')
  static defaultSize = 12;     // Default column span: 3, 6, 9, or 12
  static defaultSettings = {}; // Default widget-specific settings

  // Settings schema for UI generation (optional)
  static settingsSchema = [];

  /**
   * Filter and sort books for this widget
   * @param {Array<Object>} books - All user's books
   * @returns {Array<Object>} - Filtered/sorted books for this widget
   */
  static filterAndSort(books) {
    return books;
  }

  /**
   * Render the widget content
   * @param {Array<Object>} books - Filtered books for this widget
   * @param {Object} config - Widget configuration { size, settings }
   * @param {Object} genreLookup - Genre ID to genre object map
   * @returns {string} - HTML string
   */
  static render(books, config, genreLookup) {
    return '<p class="text-gray-500">No content</p>';
  }

  /**
   * Get empty state message
   * @returns {string}
   */
  static getEmptyMessage() {
    return 'No items to display';
  }

  /**
   * Get "See all" link URL (optional)
   * @returns {string|null}
   */
  static getSeeAllLink() {
    return null;
  }

  /**
   * Get "See all" link filter params (optional)
   * @returns {Object|null} - { status: 'reading' } etc.
   */
  static getSeeAllParams() {
    return null;
  }

  /**
   * Render widget wrapper with header
   * @param {Array<Object>} books - Filtered books
   * @param {Object} config - Widget configuration
   * @param {Object} genreLookup - Genre lookup
   * @returns {string} - Full widget HTML
   */
  static renderWidget(books, config, genreLookup) {
    const filteredBooks = this.filterAndSort(books);
    const count = config.settings?.count || 6;
    const displayBooks = filteredBooks.slice(0, count);
    const seeAllLink = this.getSeeAllLink();
    const seeAllParams = this.getSeeAllParams();

    let seeAllHtml = '';
    if (seeAllLink && filteredBooks.length > count) {
      let href = seeAllLink;
      if (seeAllParams) {
        const params = new URLSearchParams(seeAllParams).toString();
        href = `${seeAllLink}?${params}`;
      }
      seeAllHtml = `
        <a href="${href}" class="text-sm text-primary hover:underline flex items-center gap-1">
          See all
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </a>
      `;
    }

    const content = displayBooks.length > 0
      ? this.render(displayBooks, config, genreLookup)
      : `<p class="text-gray-500 text-sm py-4">${escapeHtml(this.getEmptyMessage())}</p>`;

    return `
      <div class="widget-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <i data-lucide="${this.icon}" class="w-5 h-5 ${this.iconColor}"></i>
            <h2 class="font-semibold text-gray-900">${escapeHtml(this.name)}</h2>
            <span class="text-sm text-gray-500">(${filteredBooks.length})</span>
          </div>
          ${seeAllHtml}
        </div>
        <div class="widget-content-area">
          ${content}
        </div>
      </div>
    `;
  }
}
