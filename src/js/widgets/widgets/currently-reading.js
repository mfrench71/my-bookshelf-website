import { BaseWidget } from '../base-widget.js';
import { escapeHtml, getBookStatus } from '../../utils.js';

/**
 * Currently Reading Widget - Shows books currently being read
 */
export class CurrentlyReadingWidget extends BaseWidget {
  static id = 'currentlyReading';
  static name = 'Currently Reading';
  static icon = 'book-open';
  static iconColor = 'text-blue-600';
  static defaultSize = 6;
  static defaultSettings = { count: 6 };

  static settingsSchema = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] }
  ];

  static filterAndSort(books) {
    return books.filter(b => getBookStatus(b) === 'reading');
  }

  static getEmptyMessage() {
    return 'No books currently being read';
  }

  static getSeeAllLink() {
    return '/books/';
  }

  static getSeeAllParams() {
    return { status: 'reading' };
  }

  static render(books, config, genreLookup) {
    return `
      <div class="widget-scroll-container">
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

    return `
      <a href="/books/view/?id=${book.id}" class="flex-shrink-0 w-24 snap-start">
        ${cover}
        <h3 class="text-sm font-medium text-gray-900 mt-2 line-clamp-2">${escapeHtml(book.title)}</h3>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(book.author || 'Unknown')}</p>
      </a>
    `;
  }
}
