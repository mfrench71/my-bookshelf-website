import { BaseWidget } from '../base-widget.js';
import { escapeHtml, renderStars, isValidImageUrl } from '../../utils.js';
import type { Book, GenreLookup, WidgetConfig, SettingsSchemaItem } from '../types.js';

/**
 * Top Rated Widget - Shows highest rated books
 */
export class TopRatedWidget extends BaseWidget {
  static override id = 'topRated';
  static override name = 'Top Rated';
  static override icon = 'star';
  static override iconColor = 'text-yellow-500';
  static override defaultSize = 12;
  static override defaultSettings: Record<string, unknown> = { count: 6, minRating: 4 };

  static override settingsSchema: SettingsSchemaItem[] = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] },
    { key: 'minRating', label: 'Minimum rating', type: 'select', options: [1, 2, 3, 4, 5] },
  ];

  static override filterAndSort(books: Book[]): Book[] {
    return [...books].filter(b => b.rating && b.rating >= 4).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  static override getEmptyMessage(): string {
    return 'No highly rated books yet';
  }

  static override getSeeAllLink(): string {
    return '/books/';
  }

  static override getSeeAllParams(): Record<string, string> {
    return { sort: 'rating-desc', rating: '4' };
  }

  static override render(books: Book[], config: WidgetConfig, _genreLookup?: GenreLookup): string {
    const minRating = (config.settings?.minRating as number) || 4;
    const filteredBooks = books.filter(b => (b.rating || 0) >= minRating);

    return `
      <div class="widget-scroll-container">
        ${filteredBooks.map(book => this.renderBookCard(book)).join('')}
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
        <div class="rating-stars mt-1">${renderStars(book.rating || 0)}</div>
      </a>
    `;
  }
}
