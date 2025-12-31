import { BaseWidget } from '../base-widget.js';
import { escapeHtml, parseTimestamp, formatDate, getBookStatus, isValidImageUrl } from '../../utils.js';
import type { Book, GenreLookup, WidgetConfig, SettingsSchemaItem } from '../types.js';

/**
 * Recently Finished Widget - Shows recently completed books
 */
export class RecentlyFinishedWidget extends BaseWidget {
  static override id = 'recentlyFinished';
  static override name = 'Recently Finished';
  static override icon = 'check-circle';
  static override iconColor = 'text-purple-600';
  static override defaultSize = 12;
  static override defaultSettings: Record<string, unknown> = { count: 6 };

  static override settingsSchema: SettingsSchemaItem[] = [
    { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] },
  ];

  static override filterAndSort(books: Book[]): Book[] {
    return [...books]
      .filter(b => getBookStatus(b as unknown as Parameters<typeof getBookStatus>[0]) === 'finished')
      .sort((a, b) => {
        // Sort by most recent finish date (last entry in reads array)
        const aReads = a.reads || [];
        const bReads = b.reads || [];
        const aFinish = aReads[aReads.length - 1]?.finishedAt;
        const bFinish = bReads[bReads.length - 1]?.finishedAt;
        const aTime = aFinish ? parseTimestamp(aFinish as Parameters<typeof parseTimestamp>[0])?.getTime() || 0 : 0;
        const bTime = bFinish ? parseTimestamp(bFinish as Parameters<typeof parseTimestamp>[0])?.getTime() || 0 : 0;
        return bTime - aTime;
      });
  }

  static override getEmptyMessage(): string {
    return 'No finished books yet';
  }

  static override getSeeAllLink(): string {
    return '/books/';
  }

  static override getSeeAllParams(): Record<string, string> {
    return { status: 'finished' };
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

    // Get finish date from most recent reads entry
    const reads = book.reads || [];
    const finishDate = reads[reads.length - 1]?.finishedAt;
    const formattedDate = finishDate
      ? formatDate(parseTimestamp(finishDate as Parameters<typeof parseTimestamp>[0]))
      : '';

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
