import { BaseWidget } from '../base-widget.js';

/**
 * Welcome Widget - Shows welcome message and library stats
 */
export class WelcomeWidget extends BaseWidget {
  static id = 'welcome';
  static name = 'Welcome';
  static icon = 'home';
  static iconColor = 'text-primary';
  static defaultSize = 12;
  static defaultSettings = {};

  static settingsSchema = [];

  static filterAndSort(books) {
    return books;
  }

  static getEmptyMessage() {
    return '';
  }

  static getSeeAllLink() {
    return null;
  }

  /**
   * Override renderWidget to create a custom layout without the standard header
   */
  static renderWidget(books, _config, _genreLookup) {
    const totalBooks = books.length;
    const thisYear = new Date().getFullYear();
    const booksThisYear = books.filter(b => {
      if (!b.createdAt) return false;
      const date = new Date(b.createdAt);
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
