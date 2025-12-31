import { BaseWidget } from '../base-widget.js';
import { escapeHtml } from '../../utils.js';
import type { Book, GenreLookup, SeriesLookup, Series, WidgetConfig, SettingsSchemaItem } from '../types.js';

/**
 * Series Progress Widget - Shows series completion status
 *
 * Unlike other widgets that filter books, this widget displays series data
 * with completion progress (owned vs total books).
 */
export class SeriesProgressWidget extends BaseWidget {
  static override id = 'seriesProgress';
  static override name = 'Series Progress';
  static override icon = 'library';
  static override iconColor = 'text-purple-600';
  static override defaultSize = 6;
  static override defaultSettings: Record<string, unknown> = { count: 6, sortBy: 'name' };

  static override settingsSchema: SettingsSchemaItem[] = [
    { key: 'count', label: 'Series to show', type: 'select', options: [3, 6, 9, 12] },
    {
      key: 'sortBy',
      label: 'Sort by',
      type: 'select',
      options: [
        { value: 'name', label: 'Name' },
        { value: 'progress', label: 'Progress' },
        { value: 'bookCount', label: 'Books owned' },
      ],
    },
  ];

  // This widget doesn't use filterAndSort for books
  static override filterAndSort(_books: Book[]): Book[] {
    return [];
  }

  static override getEmptyMessage(): string {
    return 'No series yet. Add books to a series to track progress.';
  }

  static override getSeeAllLink(): string {
    return '/settings/';
  }

  /**
   * Override renderWidget to handle series data instead of books
   */
  static override renderWidget(
    _books: Book[],
    config: WidgetConfig,
    _genreLookup?: GenreLookup,
    seriesLookup?: SeriesLookup | null
  ): string {
    // Get series from lookup
    const series: Series[] = seriesLookup ? Array.from(seriesLookup.values()) : [];

    if (series.length === 0) {
      return `
        <div class="widget-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="flex items-center justify-between p-4 border-b border-gray-100">
            <div class="flex items-center gap-2">
              <i data-lucide="${this.icon}" class="w-5 h-5 ${this.iconColor}"></i>
              <h2 class="font-semibold text-gray-900">${escapeHtml(this.name)}</h2>
              <span class="text-sm text-gray-500">(0)</span>
            </div>
          </div>
          <div class="widget-content-area">
            <p class="text-gray-500 text-sm py-4 px-4">${escapeHtml(this.getEmptyMessage())}</p>
          </div>
        </div>
      `;
    }

    // Sort series based on settings
    const sortBy = (config.settings?.sortBy as string) || 'name';
    const sortedSeries = this.sortSeries(series, sortBy);

    // Limit to count
    const count = (config.settings?.count as number) || 6;
    const displaySeries = sortedSeries.slice(0, count);

    const seeAllHtml =
      series.length > count
        ? `
      <a href="${this.getSeeAllLink()}" class="text-sm text-primary hover:underline flex items-center gap-1">
        Manage series
        <i data-lucide="chevron-right" class="w-4 h-4"></i>
      </a>
    `
        : '';

    return `
      <div class="widget-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="flex items-center justify-between p-4 border-b border-gray-100">
          <div class="flex items-center gap-2">
            <i data-lucide="${this.icon}" class="w-5 h-5 ${this.iconColor}"></i>
            <h2 class="font-semibold text-gray-900">${escapeHtml(this.name)}</h2>
            <span class="text-sm text-gray-500">(${series.length})</span>
          </div>
          ${seeAllHtml}
        </div>
        <div class="widget-content-area p-4">
          <div class="space-y-3">
            ${displaySeries.map(s => this.renderSeriesRow(s)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Sort series based on sort option
   */
  static sortSeries(series: Series[], sortBy: string): Series[] {
    return [...series].sort((a, b) => {
      switch (sortBy) {
        case 'progress': {
          // Sort by completion percentage (descending), incomplete first
          const aTotalBooks = (a.totalBooks as number) || 0;
          const bTotalBooks = (b.totalBooks as number) || 0;
          const aProgress = aTotalBooks ? (a.bookCount || 0) / aTotalBooks : 0;
          const bProgress = bTotalBooks ? (b.bookCount || 0) / bTotalBooks : 0;
          // Incomplete series first, then by progress
          if (aProgress < 1 && bProgress >= 1) return -1;
          if (bProgress < 1 && aProgress >= 1) return 1;
          return bProgress - aProgress;
        }
        case 'bookCount':
          return (b.bookCount || 0) - (a.bookCount || 0);
        case 'name':
        default:
          return ((a.name as string) || '').localeCompare((b.name as string) || '');
      }
    });
  }

  /**
   * Render a single series row with progress bar
   */
  static renderSeriesRow(series: Series): string {
    const owned = series.bookCount || 0;
    const total = (series.totalBooks as number) || 0;
    const hasTotal = total > 0;

    // Calculate progress percentage
    const progress = hasTotal ? Math.min((owned / total) * 100, 100) : 0;
    const isComplete = hasTotal && owned >= total;

    // Progress bar color
    const barColor = isComplete ? 'bg-green-500' : 'bg-purple-500';
    const bgColor = isComplete ? 'bg-green-100' : 'bg-gray-200';

    // Status text
    let statusText: string;
    if (hasTotal) {
      statusText = isComplete
        ? `<span class="text-green-600 font-medium">Complete!</span>`
        : `<span class="text-gray-600">${owned} of ${total} books</span>`;
    } else {
      statusText = `<span class="text-gray-500">${owned} book${owned !== 1 ? 's' : ''}</span>`;
    }

    // Link to books filtered by this series (use ID for reliable filtering)
    const filterLink = `/books/?series=${encodeURIComponent(series.id as string)}`;

    return `
      <a href="${filterLink}" class="block p-3 rounded-lg hover:bg-gray-50 transition-colors -mx-1">
        <div class="flex items-center justify-between mb-1">
          <span class="font-medium text-gray-900 truncate flex-1 mr-2">${escapeHtml(series.name as string)}</span>
          ${statusText}
        </div>
        ${
          hasTotal
            ? `
          <div class="h-2 ${bgColor} rounded-full overflow-hidden">
            <div class="h-full ${barColor} rounded-full transition-all duration-300" style="width: ${progress}%"></div>
          </div>
        `
            : ''
        }
      </a>
    `;
  }
}
