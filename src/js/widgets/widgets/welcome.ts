import { BaseWidget } from '../base-widget.js';
import type { Book, GenreLookup, WidgetConfig, SettingsSchemaItem } from '../types.js';

/**
 * Welcome Widget - Shows welcome message and library stats
 */
export class WelcomeWidget extends BaseWidget {
  static override id = 'welcome';
  static override name = 'Welcome';
  static override icon = 'home';
  static override iconColor = 'text-primary';
  static override defaultSize = 12;
  static override defaultSettings: Record<string, unknown> = {};

  static override settingsSchema: SettingsSchemaItem[] = [];

  static override filterAndSort(books: Book[]): Book[] {
    return books;
  }

  static override getEmptyMessage(): string {
    return '';
  }

  static override getSeeAllLink(): string | null {
    return null;
  }

  /**
   * Override renderWidget to create a custom layout without the standard header
   */
  static override renderWidget(books: Book[], _config: WidgetConfig, _genreLookup?: GenreLookup): string {
    const totalBooks = books.length;
    const thisYear = new Date().getFullYear();
    const booksThisYear = books.filter(b => {
      if (!b.createdAt) return false;
      let date: Date;
      if (typeof b.createdAt === 'string') {
        date = new Date(b.createdAt);
      } else if (typeof b.createdAt === 'number') {
        date = new Date(b.createdAt);
      } else if (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt) {
        date = b.createdAt.toDate();
      } else {
        date = b.createdAt as Date;
      }
      return date.getFullYear() === thisYear;
    }).length;

    let statsText = `${totalBooks} book${totalBooks !== 1 ? 's' : ''} in your library`;
    if (booksThisYear > 0) {
      statsText += ` · ${booksThisYear} added this year`;
    }

    return `
      <div class="widget-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="p-4">
          <h1 class="text-xl font-bold text-gray-900">Welcome back!</h1>
          <p class="text-gray-500 text-sm mt-1">${statsText}</p>
        </div>
      </div>
    `;
  }
}
