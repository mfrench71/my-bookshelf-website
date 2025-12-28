/**
 * Unit tests for src/js/widgets/widgets/recently-finished.js
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (s) => s ? String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '',
  isValidImageUrl: (url) => url && (url.startsWith('http://') || url.startsWith('https://')),
  parseTimestamp: (ts) => {
    if (!ts) return null;
    if (ts.seconds) return new Date(ts.seconds * 1000);
    if (ts instanceof Date) return ts;
    return new Date(ts);
  },
  formatDate: (date) => date ? date.toLocaleDateString() : '',
  getBookStatus: (book) => {
    // Simplified logic for testing
    if (book.readHistory?.some(h => h.finishDate)) return 'finished';
    if (book.readHistory?.some(h => h.startDate && !h.finishDate)) return 'reading';
    return 'unread';
  }
}));

import { RecentlyFinishedWidget } from '../src/js/widgets/widgets/recently-finished.js';

describe('RecentlyFinishedWidget', () => {
  describe('static properties', () => {
    it('should have correct id', () => {
      expect(RecentlyFinishedWidget.id).toBe('recentlyFinished');
    });

    it('should have correct name', () => {
      expect(RecentlyFinishedWidget.name).toBe('Recently Finished');
    });

    it('should have correct icon', () => {
      expect(RecentlyFinishedWidget.icon).toBe('check-circle');
    });

    it('should have correct iconColor', () => {
      expect(RecentlyFinishedWidget.iconColor).toBe('text-purple-600');
    });

    it('should have defaultSize of 12', () => {
      expect(RecentlyFinishedWidget.defaultSize).toBe(12);
    });

    it('should have defaultSettings with count 6', () => {
      expect(RecentlyFinishedWidget.defaultSettings).toEqual({ count: 6 });
    });

    it('should have settingsSchema with count option', () => {
      expect(RecentlyFinishedWidget.settingsSchema).toEqual([
        { key: 'count', label: 'Items to show', type: 'select', options: [3, 6, 9, 12] }
      ]);
    });
  });

  describe('filterAndSort', () => {
    it('should filter only finished books', () => {
      const books = [
        { id: '1', title: 'Finished Book', readHistory: [{ finishDate: { seconds: 1000 } }] },
        { id: '2', title: 'Reading Book', readHistory: [{ startDate: { seconds: 500 } }] },
        { id: '3', title: 'Unread Book' }
      ];

      const result = RecentlyFinishedWidget.filterAndSort(books);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Finished Book');
    });

    it('should sort by finish date descending (most recent first)', () => {
      const books = [
        { id: '1', title: 'Old Finish', readHistory: [{ finishDate: { seconds: 1000 } }] },
        { id: '2', title: 'Recent Finish', readHistory: [{ finishDate: { seconds: 3000 } }] },
        { id: '3', title: 'Middle Finish', readHistory: [{ finishDate: { seconds: 2000 } }] }
      ];

      const result = RecentlyFinishedWidget.filterAndSort(books);

      expect(result[0].title).toBe('Recent Finish');
      expect(result[1].title).toBe('Middle Finish');
      expect(result[2].title).toBe('Old Finish');
    });

    it('should handle empty array', () => {
      const result = RecentlyFinishedWidget.filterAndSort([]);
      expect(result).toEqual([]);
    });

    it('should handle books without readHistory', () => {
      const books = [
        { id: '1', title: 'No History' },
        { id: '2', title: 'Has History', readHistory: [{ finishDate: { seconds: 1000 } }] }
      ];

      const result = RecentlyFinishedWidget.filterAndSort(books);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Has History');
    });

    it('should handle books with null finish dates', () => {
      const books = [
        { id: '1', title: 'Finished', readHistory: [{ finishDate: { seconds: 1000 } }] },
        { id: '2', title: 'Started Only', readHistory: [{ startDate: { seconds: 500 }, finishDate: null }] }
      ];

      const result = RecentlyFinishedWidget.filterAndSort(books);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Finished');
    });

    it('should not mutate original array', () => {
      const books = [
        { id: '1', title: 'Book', readHistory: [{ finishDate: { seconds: 1000 } }] }
      ];
      const originalLength = books.length;

      RecentlyFinishedWidget.filterAndSort(books);

      expect(books.length).toBe(originalLength);
    });
  });

  describe('getEmptyMessage', () => {
    it('should return empty message', () => {
      expect(RecentlyFinishedWidget.getEmptyMessage()).toBe('No finished books yet');
    });
  });

  describe('getSeeAllLink', () => {
    it('should return books page link', () => {
      expect(RecentlyFinishedWidget.getSeeAllLink()).toBe('/books/');
    });
  });

  describe('getSeeAllParams', () => {
    it('should return status filter params', () => {
      expect(RecentlyFinishedWidget.getSeeAllParams()).toEqual({ status: 'finished' });
    });
  });

  describe('render', () => {
    it('should render scroll container', () => {
      const books = [
        { id: '1', title: 'Test Book', author: 'Author', readHistory: [{ finishDate: { seconds: 1000 } }] }
      ];

      const html = RecentlyFinishedWidget.render(books, {});

      expect(html).toContain('widget-scroll-container');
    });

    it('should render multiple books', () => {
      const books = [
        { id: '1', title: 'Book 1', readHistory: [{ finishDate: { seconds: 1000 } }] },
        { id: '2', title: 'Book 2', readHistory: [{ finishDate: { seconds: 2000 } }] }
      ];

      const html = RecentlyFinishedWidget.render(books, {});

      expect(html).toContain('Book 1');
      expect(html).toContain('Book 2');
    });
  });

  describe('renderBookCard', () => {
    it('should render book with cover image', () => {
      const book = {
        id: '123',
        title: 'Test Book',
        author: 'Test Author',
        coverImageUrl: 'https://example.com/cover.jpg',
        readHistory: [{ finishDate: { seconds: 1609459200 } }]
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).toContain('href="/books/view/?id=123"');
      expect(html).toContain('Test Book');
      expect(html).toContain('Test Author');
      expect(html).toContain('https://example.com/cover.jpg');
    });

    it('should render book without cover image', () => {
      const book = {
        id: '456',
        title: 'No Cover Book',
        author: 'Author'
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).toContain('No Cover Book');
      expect(html).toContain('data-lucide="book"');
      expect(html).not.toContain('<img');
    });

    it('should render Unknown for missing author', () => {
      const book = {
        id: '789',
        title: 'No Author Book'
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).toContain('Unknown');
    });

    it('should render finish date when available', () => {
      const book = {
        id: '1',
        title: 'Book',
        readHistory: [{ finishDate: { seconds: 1609459200 } }]
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).toContain('Finished');
    });

    it('should not render finish date when not available', () => {
      const book = {
        id: '1',
        title: 'Book'
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).not.toContain('Finished');
    });

    it('should escape HTML in title', () => {
      const book = {
        id: '1',
        title: '<script>alert("xss")</script>'
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in author', () => {
      const book = {
        id: '1',
        title: 'Book',
        author: '<b>Bold Author</b>'
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).not.toContain('<b>');
      expect(html).toContain('&lt;b&gt;');
    });

    it('should reject invalid cover URLs', () => {
      const book = {
        id: '1',
        title: 'Book',
        coverImageUrl: 'javascript:alert(1)'
      };

      const html = RecentlyFinishedWidget.renderBookCard(book);

      expect(html).not.toContain('<img');
    });
  });
});
