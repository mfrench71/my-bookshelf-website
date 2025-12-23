import { BaseWidget } from '../base-widget.js';
import { escapeHtml, parseTimestamp, formatDate, getBookStatus } from '../../utils.js';

/**
 * Recently Finished Widget - Shows recently completed books
 */
export class RecentlyFinishedWidget extends BaseWidget {
  static id = 'recentlyFinished';
  static name = 'Recently Finished';
  static icon = 'check-circle';
  static iconColor = 'text-purple-600';
  static defaultSize = 12;
  static defaultSettings = { count: 6 };

  static settingsSchema = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] }
  ];

  static filterAndSort(books) {
    return [...books]
      .filter(b => getBookStatus(b) === 'finished')
      .sort((a, b) => {
        // Sort by most recent finish date
        const aFinish = a.readHistory?.[0]?.finishDate;
        const bFinish = b.readHistory?.[0]?.finishDate;
        const aTime = aFinish ? parseTimestamp(aFinish)?.getTime() || 0 : 0;
        const bTime = bFinish ? parseTimestamp(bFinish)?.getTime() || 0 : 0;
        return bTime - aTime;
      });
  }

  static getEmptyMessage() {
    return 'No finished books yet';
  }

  static getSeeAllLink() {
    return '/books/';
  }

  static getSeeAllParams() {
    return { status: 'finished' };
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

    // Get finish date from most recent read history entry
    const finishDate = book.readHistory?.[0]?.finishDate;
    const formattedDate = finishDate ? formatDate(parseTimestamp(finishDate)) : '';

    return `
      <a href="/books/view/?id=${book.id}" class="flex-shrink-0 w-24 snap-start">
        ${cover}
        <h3 class="text-sm font-medium text-gray-900 mt-2 line-clamp-2">${escapeHtml(book.title)}</h3>
        <p class="text-xs text-gray-500 truncate">${escapeHtml(book.author || 'Unknown')}</p>
        ${formattedDate ? `<p class="text-xs text-gray-400">Finished ${formattedDate}</p>` : ''}
      </a>
    `;
  }
}
