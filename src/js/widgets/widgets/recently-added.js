import { BaseWidget } from '../base-widget.js';
import { escapeHtml, parseTimestamp, formatDate } from '../../utils.js';

/**
 * Recently Added Widget - Shows most recently added books
 */
export class RecentlyAddedWidget extends BaseWidget {
  static id = 'recentlyAdded';
  static name = 'Recently Added';
  static icon = 'plus-circle';
  static iconColor = 'text-green-600';
  static defaultSize = 12;
  static defaultSettings = { count: 6 };

  static settingsSchema = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] }
  ];

  static filterAndSort(books) {
    return [...books].sort((a, b) => {
      const aTime = parseTimestamp(a.createdAt)?.getTime() || 0;
      const bTime = parseTimestamp(b.createdAt)?.getTime() || 0;
      return bTime - aTime;
    });
  }

  static getEmptyMessage() {
    return 'No books added yet';
  }

  static getSeeAllLink() {
    return '/books/';
  }

  static getSeeAllParams() {
    return { sort: 'newest' };
  }

  static render(books, config, genreLookup) {
    return `
      <div class="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide">
        ${books.map(book => this.renderBookCard(book)).join('')}
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
