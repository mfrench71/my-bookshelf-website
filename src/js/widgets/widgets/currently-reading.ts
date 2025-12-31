import { BaseWidget } from '../base-widget.js';
import { escapeHtml, getBookStatus, isValidImageUrl } from '../../utils.js';
import type { Book, GenreLookup, WidgetConfig, SettingsSchemaItem } from '../types.js';

/**
 * Currently Reading Widget - Shows books currently being read
 */
export class CurrentlyReadingWidget extends BaseWidget {
  static override id = 'currentlyReading';
  static override name = 'Currently Reading';
  static override icon = 'book-open';
  static override iconColor = 'text-blue-600';
  static override defaultSize = 6;
  static override defaultSettings: Record<string, unknown> = { count: 6 };

  static override settingsSchema: SettingsSchemaItem[] = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] },
  ];

  static override filterAndSort(books: Book[]): Book[] {
    return books.filter(b => getBookStatus(b) === 'reading');
  }

  static override getEmptyMessage(): string {
    return 'No books currently being read';
  }

  static override getSeeAllLink(): string {
    return '/books/';
  }

  static override getSeeAllParams(): Record<string, string> {
    return { status: 'reading' };
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

    return `
      <a href="/books/view/?id=${book.id}" class="flex-shrink-0 w-24 snap-start">
        ${cover}
        <h3 class="text-sm font-medium text-gray-900 mt-2 line-clamp-2">${escapeHtml(book.title)}</h3>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(book.author || 'Unknown')}</p>
      </a>
    `;
  }
}
