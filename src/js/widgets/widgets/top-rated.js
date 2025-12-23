import { BaseWidget } from '../base-widget.js';
import { escapeHtml, renderStars } from '../../utils.js';

/**
 * Top Rated Widget - Shows highest rated books
 */
export class TopRatedWidget extends BaseWidget {
  static id = 'topRated';
  static name = 'Top Rated';
  static icon = 'star';
  static iconColor = 'text-yellow-500';
  static defaultSize = 12;
  static defaultSettings = { count: 6, minRating: 4 };

  static settingsSchema = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] },
    { key: 'minRating', label: 'Minimum rating', type: 'select', options: [1, 2, 3, 4, 5] }
  ];

  static filterAndSort(books) {
    return [...books]
      .filter(b => b.rating && b.rating >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  static getEmptyMessage() {
    return 'No highly rated books yet';
  }

  static getSeeAllLink() {
    return '/books/';
  }

  static getSeeAllParams() {
    return { sort: 'rating', order: 'desc' };
  }

  static render(books, config, genreLookup) {
    const minRating = config.settings?.minRating || 4;
    const filteredBooks = books.filter(b => b.rating >= minRating);

    return `
      <div class="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        ${filteredBooks.map(book => this.renderBookCard(book)).join('')}
      </div>
    `;
  }

  static renderBookCard(book) {
    const cover = book.coverImageUrl
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
        <div class="mt-1">${renderStars(book.rating || 0, 'w-3 h-3')}</div>
      </a>
    `;
  }
}
