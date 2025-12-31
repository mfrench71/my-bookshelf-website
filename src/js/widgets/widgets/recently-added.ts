import { BaseWidget } from '../base-widget.js';
import { escapeHtml, parseTimestamp, formatDate, isValidImageUrl } from '../../utils.js';
import type { Book, GenreLookup, WidgetConfig, SettingsSchemaItem } from '../types.js';

/**
 * Recently Added Widget - Shows most recently added books
 */
export class RecentlyAddedWidget extends BaseWidget {
  static override id = 'recentlyAdded';
  static override name = 'Recently Added';
  static override icon = 'plus-circle';
  static override iconColor = 'text-green-600';
  static override defaultSize = 12;
  static override defaultSettings: Record<string, unknown> = { count: 6 };

  static override settingsSchema: SettingsSchemaItem[] = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] },
  ];

  static override filterAndSort(books: Book[]): Book[] {
    return [...books].sort((a, b) => {
      const aTime = parseTimestamp(a.createdAt)?.getTime() || 0;
      const bTime = parseTimestamp(b.createdAt)?.getTime() || 0;
      return bTime - aTime;
    });
  }

  static override getEmptyMessage(): string {
    return 'No books added yet';
  }

  static override getSeeAllLink(): string {
    return '/books/';
  }

  static override getSeeAllParams(): Record<string, string> {
    return { sort: 'createdAt-desc' };
  }

  static override render(books: Book[], _config: WidgetConfig, _genreLookup?: GenreLookup): string {
    return `
      <div class="widget-scroll-container">
        ${books.map(book => this.renderBookCard(book)).join('')}
      </div>
    `;
  }

  static renderBookCard(book: Book): string {
    const cover =
      book.coverImageUrl && isValidImageUrl(book.coverImageUrl)
        ? `<div class="relative w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center overflow-hidden flex-shrink-0">
          <i data-lucide="book" class="w-8 h-8 text-white"></i>
          <img src="${escapeHtml(book.coverImageUrl)}" alt="" class="w-full h-full object-cover absolute inset-0" loading="lazy" onerror="this.style.display='none'">
        </div>`
        : `<div class="w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center flex-shrink-0">
          <i data-lucide="book" class="w-8 h-8 text-white"></i>
        </div>`;

    const addedDate = book.createdAt ? formatDate(parseTimestamp(book.createdAt)) : '';

    return `
      <a href="/books/view/?id=${book.id}" class="flex-shrink-0 w-24 snap-start">
        ${cover}
        <h3 class="text-sm font-medium text-gray-900 mt-2 line-clamp-2">${escapeHtml(book.title)}</h3>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(book.author || 'Unknown')}</p>
        ${addedDate ? `<p class="text-xs text-gray-400">${addedDate}</p>` : ''}
      </a>
    `;
  }
}
