// Widget Tests
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock utils before importing widgets
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '',
  getBookStatus: (book) => {
    if (!book.reads || book.reads.length === 0) return null;
    const currentRead = book.reads[book.reads.length - 1];
    if (currentRead.finishedAt) return 'finished';
    if (currentRead.startedAt) return 'reading';
    return null;
  },
  isValidImageUrl: (url) => url && (url.startsWith('http://') || url.startsWith('https://')),
  parseTimestamp: (ts) => ts ? new Date(ts) : null,
  formatDate: (date) => date ? date.toLocaleDateString() : '',
  renderStars: (rating) => '<span class="stars">' + rating + ' stars</span>'
}));

import { CurrentlyReadingWidget } from '../src/js/widgets/widgets/currently-reading.js';
import { RecentlyAddedWidget } from '../src/js/widgets/widgets/recently-added.js';
import { TopRatedWidget } from '../src/js/widgets/widgets/top-rated.js';
import { WelcomeWidget } from '../src/js/widgets/widgets/welcome.js';

describe('CurrentlyReadingWidget', () => {
  describe('static properties', () => {
    it('should have correct id', () => {
      expect(CurrentlyReadingWidget.id).toBe('currentlyReading');
    });

    it('should have correct name', () => {
      expect(CurrentlyReadingWidget.name).toBe('Currently Reading');
    });

    it('should have correct icon', () => {
      expect(CurrentlyReadingWidget.icon).toBe('book-open');
    });

    it('should have correct default settings', () => {
      expect(CurrentlyReadingWidget.defaultSettings).toEqual({ count: 6 });
    });
  });

  describe('filterAndSort', () => {
    it('should filter to only reading books', () => {
      const books = [
        { id: '1', title: 'Reading Book', reads: [{ startedAt: 1000, finishedAt: null }] },
        { id: '2', title: 'Finished Book', reads: [{ startedAt: 1000, finishedAt: 2000 }] },
        { id: '3', title: 'Another Reading', reads: [{ startedAt: 2000, finishedAt: null }] },
        { id: '4', title: 'No Status', reads: [] }
      ];

      const result = CurrentlyReadingWidget.filterAndSort(books);
      expect(result).toHaveLength(2);
      expect(result.map(b => b.title)).toEqual(['Reading Book', 'Another Reading']);
    });

    it('should return empty array when no reading books', () => {
      const books = [
        { id: '1', title: 'Finished', reads: [{ startedAt: 1000, finishedAt: 2000 }] }
      ];

      const result = CurrentlyReadingWidget.filterAndSort(books);
      expect(result).toHaveLength(0);
    });
  });

  describe('getEmptyMessage', () => {
    it('should return correct message', () => {
      expect(CurrentlyReadingWidget.getEmptyMessage()).toBe('No books currently being read');
    });
  });

  describe('getSeeAllLink', () => {
    it('should return books page link', () => {
      expect(CurrentlyReadingWidget.getSeeAllLink()).toBe('/books/');
    });
  });

  describe('getSeeAllParams', () => {
    it('should return reading status filter', () => {
      expect(CurrentlyReadingWidget.getSeeAllParams()).toEqual({ status: 'reading' });
    });
  });

  describe('renderBookCard', () => {
    it('should render book with cover', () => {
      const book = {
        id: '123',
        title: 'Test Book',
        author: 'Test Author',
        coverImageUrl: 'https://example.com/cover.jpg'
      };

      const html = CurrentlyReadingWidget.renderBookCard(book);
      expect(html).toContain('Test Book');
      expect(html).toContain('Test Author');
      expect(html).toContain('https://example.com/cover.jpg');
      expect(html).toContain('/books/view/?id=123');
    });

    it('should render book without cover', () => {
      const book = {
        id: '123',
        title: 'Test Book',
        author: 'Test Author'
      };

      const html = CurrentlyReadingWidget.renderBookCard(book);
      expect(html).toContain('Test Book');
      expect(html).toContain('data-lucide="book"');
    });

    it('should escape HTML in title and author', () => {
      const book = {
        id: '123',
        title: '<script>alert("xss")</script>',
        author: '<b>Bad</b>'
      };

      const html = CurrentlyReadingWidget.renderBookCard(book);
      expect(html).toContain('&lt;script&gt;');
      expect(html).not.toContain('<script>alert');
    });

    it('should show Unknown for missing author', () => {
      const book = { id: '123', title: 'Test' };

      const html = CurrentlyReadingWidget.renderBookCard(book);
      expect(html).toContain('Unknown');
    });
  });
});

describe('RecentlyAddedWidget', () => {
  describe('static properties', () => {
    it('should have correct id', () => {
      expect(RecentlyAddedWidget.id).toBe('recentlyAdded');
    });

    it('should have correct name', () => {
      expect(RecentlyAddedWidget.name).toBe('Recently Added');
    });

    it('should have correct icon', () => {
      expect(RecentlyAddedWidget.icon).toBe('plus-circle');
    });
  });

  describe('filterAndSort', () => {
    it('should sort by createdAt descending', () => {
      const books = [
        { id: '1', title: 'Oldest', createdAt: 1000 },
        { id: '2', title: 'Newest', createdAt: 3000 },
        { id: '3', title: 'Middle', createdAt: 2000 }
      ];

      const result = RecentlyAddedWidget.filterAndSort(books);
      expect(result.map(b => b.title)).toEqual(['Newest', 'Middle', 'Oldest']);
    });

    it('should handle books without createdAt', () => {
      const books = [
        { id: '1', title: 'With Date', createdAt: 1000 },
        { id: '2', title: 'Without Date' }
      ];

      const result = RecentlyAddedWidget.filterAndSort(books);
      expect(result[0].title).toBe('With Date');
    });
  });

  describe('getEmptyMessage', () => {
    it('should return correct message', () => {
      expect(RecentlyAddedWidget.getEmptyMessage()).toBe('No books added yet');
    });
  });

  describe('getSeeAllParams', () => {
    it('should return createdAt-desc sort', () => {
      expect(RecentlyAddedWidget.getSeeAllParams()).toEqual({ sort: 'createdAt-desc' });
    });
  });

  describe('renderBookCard', () => {
    it('should render book with date', () => {
      const book = {
        id: '123',
        title: 'Test Book',
        author: 'Author',
        createdAt: new Date('2024-01-15').getTime()
      };

      const html = RecentlyAddedWidget.renderBookCard(book);
      expect(html).toContain('Test Book');
      expect(html).toContain('Author');
    });
  });
});

describe('TopRatedWidget', () => {
  describe('static properties', () => {
    it('should have correct id', () => {
      expect(TopRatedWidget.id).toBe('topRated');
    });

    it('should have correct name', () => {
      expect(TopRatedWidget.name).toBe('Top Rated');
    });

    it('should have correct icon', () => {
      expect(TopRatedWidget.icon).toBe('star');
    });

    it('should have correct default settings', () => {
      expect(TopRatedWidget.defaultSettings).toEqual({ count: 6, minRating: 4 });
    });
  });

  describe('filterAndSort', () => {
    it('should filter books with rating >= 4', () => {
      const books = [
        { id: '1', title: '5 Star', rating: 5 },
        { id: '2', title: '4 Star', rating: 4 },
        { id: '3', title: '3 Star', rating: 3 },
        { id: '4', title: 'No Rating' }
      ];

      const result = TopRatedWidget.filterAndSort(books);
      expect(result).toHaveLength(2);
    });

    it('should sort by rating descending', () => {
      const books = [
        { id: '1', title: '4 Star', rating: 4 },
        { id: '2', title: '5 Star', rating: 5 }
      ];

      const result = TopRatedWidget.filterAndSort(books);
      expect(result[0].rating).toBe(5);
      expect(result[1].rating).toBe(4);
    });
  });

  describe('getEmptyMessage', () => {
    it('should return correct message', () => {
      expect(TopRatedWidget.getEmptyMessage()).toBe('No highly rated books yet');
    });
  });

  describe('getSeeAllParams', () => {
    it('should return rating filter params', () => {
      expect(TopRatedWidget.getSeeAllParams()).toEqual({ sort: 'rating-desc', rating: '4' });
    });
  });

  describe('render', () => {
    it('should filter by minRating from config', () => {
      const books = [
        { id: '1', title: '5 Star', rating: 5 },
        { id: '2', title: '4 Star', rating: 4 },
        { id: '3', title: '3 Star', rating: 3 }
      ];
      const config = { settings: { minRating: 5 } };

      const html = TopRatedWidget.render(books, config, {});
      expect(html).toContain('5 Star');
      expect(html).not.toContain('4 Star');
    });

    it('should use default minRating of 4', () => {
      const books = [
        { id: '1', title: '4 Star', rating: 4 },
        { id: '2', title: '3 Star', rating: 3 }
      ];
      const config = { settings: {} };

      const html = TopRatedWidget.render(books, config, {});
      expect(html).toContain('4 Star');
      expect(html).not.toContain('3 Star');
    });
  });

  describe('renderBookCard', () => {
    it('should include star rating', () => {
      const book = {
        id: '123',
        title: 'Test',
        rating: 4
      };

      const html = TopRatedWidget.renderBookCard(book);
      expect(html).toContain('rating-stars');
    });
  });
});

describe('WelcomeWidget', () => {
  describe('static properties', () => {
    it('should have correct id', () => {
      expect(WelcomeWidget.id).toBe('welcome');
    });

    it('should have correct name', () => {
      expect(WelcomeWidget.name).toBe('Welcome');
    });

    it('should have correct icon', () => {
      expect(WelcomeWidget.icon).toBe('home');
    });

    it('should have empty settings schema', () => {
      expect(WelcomeWidget.settingsSchema).toEqual([]);
    });
  });

  describe('filterAndSort', () => {
    it('should return all books unchanged', () => {
      const books = [{ id: '1' }, { id: '2' }];
      const result = WelcomeWidget.filterAndSort(books);
      expect(result).toEqual(books);
    });
  });

  describe('getEmptyMessage', () => {
    it('should return empty string', () => {
      expect(WelcomeWidget.getEmptyMessage()).toBe('');
    });
  });

  describe('getSeeAllLink', () => {
    it('should return null', () => {
      expect(WelcomeWidget.getSeeAllLink()).toBeNull();
    });
  });

  describe('renderWidget', () => {
    it('should show total book count', () => {
      const books = [{ id: '1' }, { id: '2' }, { id: '3' }];
      const html = WelcomeWidget.renderWidget(books, {}, {});
      expect(html).toContain('3 books');
    });

    it('should handle singular book', () => {
      const books = [{ id: '1' }];
      const html = WelcomeWidget.renderWidget(books, {}, {});
      expect(html).toContain('1 book');
      expect(html).not.toContain('1 books');
    });

    it('should show books added this year', () => {
      const thisYear = new Date().getFullYear();
      const books = [
        { id: '1', createdAt: new Date(thisYear + '-06-15').getTime() },
        { id: '2', createdAt: new Date('2020-01-01').getTime() }
      ];

      const html = WelcomeWidget.renderWidget(books, {}, {});
      expect(html).toContain('1 added this year');
    });

    it('should include welcome message', () => {
      const html = WelcomeWidget.renderWidget([], {}, {});
      expect(html).toContain('Welcome back!');
    });

    it('should handle zero books', () => {
      const html = WelcomeWidget.renderWidget([], {}, {});
      expect(html).toContain('0 books');
    });
  });
});
