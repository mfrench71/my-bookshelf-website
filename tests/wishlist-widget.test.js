/**
 * Unit tests for src/js/widgets/widgets/wishlist.js
 */

import { describe, it, expect, vi } from 'vitest';
import { WishlistWidget } from '../src/js/widgets/widgets/wishlist.js';

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (s) => s ? s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '',
  isValidImageUrl: (url) => url && url.startsWith('http'),
  parseTimestamp: (ts) => ts ? new Date(ts) : null
}));

describe('WishlistWidget', () => {
  describe('static properties', () => {
    it('should have correct id', () => {
      expect(WishlistWidget.id).toBe('wishlist');
    });

    it('should have correct name', () => {
      expect(WishlistWidget.name).toBe('Wishlist');
    });

    it('should have correct icon', () => {
      expect(WishlistWidget.icon).toBe('heart');
    });

    it('should have correct icon color', () => {
      expect(WishlistWidget.iconColor).toBe('text-red-500');
    });

    it('should have default size of 12', () => {
      expect(WishlistWidget.defaultSize).toBe(12);
    });

    it('should have default settings', () => {
      expect(WishlistWidget.defaultSettings).toEqual({ count: 6, sortBy: 'priority' });
    });

    it('should have requiresWishlist flag set to true', () => {
      expect(WishlistWidget.requiresWishlist).toBe(true);
    });

    it('should have settings schema with count and sortBy options', () => {
      expect(WishlistWidget.settingsSchema).toHaveLength(2);
      expect(WishlistWidget.settingsSchema[0].key).toBe('count');
      expect(WishlistWidget.settingsSchema[1].key).toBe('sortBy');
    });
  });

  describe('filterAndSort', () => {
    const items = [
      { id: '1', title: 'Book A', priority: 'low', createdAt: '2025-01-01' },
      { id: '2', title: 'Book B', priority: 'high', createdAt: '2025-01-02' },
      { id: '3', title: 'Book C', priority: 'medium', createdAt: '2025-01-03' },
      { id: '4', title: 'Book D', priority: null, createdAt: '2025-01-04' }
    ];

    it('should return empty array for null items', () => {
      expect(WishlistWidget.filterAndSort(null, {})).toEqual([]);
    });

    it('should return empty array for empty items', () => {
      expect(WishlistWidget.filterAndSort([], {})).toEqual([]);
    });

    it('should sort by priority (high first) by default', () => {
      const sorted = WishlistWidget.filterAndSort(items, { settings: { sortBy: 'priority' } });
      expect(sorted[0].priority).toBe('high');
      expect(sorted[1].priority).toBe('medium');
      expect(sorted[2].priority).toBe('low');
      expect(sorted[3].priority).toBe(null);
    });

    it('should use secondary date sort when priorities are equal', () => {
      const samepriorityItems = [
        { id: '1', title: 'Older', priority: 'high', createdAt: '2025-01-01' },
        { id: '2', title: 'Newer', priority: 'high', createdAt: '2025-01-05' }
      ];
      const sorted = WishlistWidget.filterAndSort(samepriorityItems, { settings: { sortBy: 'priority' } });
      expect(sorted[0].title).toBe('Newer');
      expect(sorted[1].title).toBe('Older');
    });

    it('should sort by createdAt (newest first)', () => {
      const sorted = WishlistWidget.filterAndSort(items, { settings: { sortBy: 'createdAt' } });
      expect(sorted[0].title).toBe('Book D');
      expect(sorted[1].title).toBe('Book C');
      expect(sorted[2].title).toBe('Book B');
      expect(sorted[3].title).toBe('Book A');
    });

    it('should sort by title alphabetically', () => {
      const sorted = WishlistWidget.filterAndSort(items, { settings: { sortBy: 'title' } });
      expect(sorted[0].title).toBe('Book A');
      expect(sorted[1].title).toBe('Book B');
      expect(sorted[2].title).toBe('Book C');
      expect(sorted[3].title).toBe('Book D');
    });

    it('should return all items (base widget handles count limiting)', () => {
      const sorted = WishlistWidget.filterAndSort(items, { settings: { count: 2, sortBy: 'title' } });
      expect(sorted).toHaveLength(4); // All items returned, sorted
      expect(sorted[0].title).toBe('Book A');
      expect(sorted[1].title).toBe('Book B');
    });

    it('should return all items regardless of count setting', () => {
      const manyItems = Array.from({ length: 10 }, (_, i) => ({
        id: String(i),
        title: `Book ${i}`,
        priority: 'low',
        createdAt: '2025-01-01'
      }));
      const sorted = WishlistWidget.filterAndSort(manyItems, {});
      expect(sorted).toHaveLength(10); // All items returned
    });

    it('should handle items with missing createdAt', () => {
      const itemsWithMissingDates = [
        { id: '1', title: 'Has date', createdAt: '2025-01-01' },
        { id: '2', title: 'No date', createdAt: null }
      ];
      const sorted = WishlistWidget.filterAndSort(itemsWithMissingDates, { settings: { sortBy: 'createdAt' } });
      expect(sorted).toHaveLength(2);
    });

    it('should handle items with missing titles', () => {
      const itemsWithMissingTitles = [
        { id: '1', title: null },
        { id: '2', title: 'Book B' }
      ];
      const sorted = WishlistWidget.filterAndSort(itemsWithMissingTitles, { settings: { sortBy: 'title' } });
      expect(sorted).toHaveLength(2);
    });
  });

  describe('getEmptyMessage', () => {
    it('should return appropriate message', () => {
      expect(WishlistWidget.getEmptyMessage()).toBe('Your wishlist is empty');
    });
  });

  describe('getSeeAllLink', () => {
    it('should return wishlist page link', () => {
      expect(WishlistWidget.getSeeAllLink()).toBe('/wishlist/');
    });
  });

  describe('render', () => {
    it('should render empty message when no items', () => {
      const html = WishlistWidget.render([], {});
      expect(html).toContain('Your wishlist is empty');
    });

    it('should render empty message when items is null', () => {
      const html = WishlistWidget.render(null, {});
      expect(html).toContain('Your wishlist is empty');
    });

    it('should render scroll container with items', () => {
      const items = [{ id: '1', title: 'Test Book', author: 'Test Author' }];
      const html = WishlistWidget.render(items, {});
      expect(html).toContain('widget-scroll-container');
      expect(html).toContain('Test Book');
    });
  });

  describe('renderCard', () => {
    it('should render item with title and author', () => {
      const item = { id: '1', title: 'Test Book', author: 'John Doe' };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('Test Book');
      expect(html).toContain('John Doe');
    });

    it('should render placeholder cover when no image URL', () => {
      const item = { id: '1', title: 'Test Book', coverImageUrl: null };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('data-lucide="book"');
      expect(html).not.toContain('<img');
    });

    it('should render cover image when valid URL', () => {
      const item = { id: '1', title: 'Test Book', coverImageUrl: 'https://example.com/cover.jpg' };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('<img');
      expect(html).toContain('https://example.com/cover.jpg');
    });

    it('should not render image for invalid URL', () => {
      const item = { id: '1', title: 'Test Book', coverImageUrl: 'not-a-url' };
      const html = WishlistWidget.renderCard(item);
      expect(html).not.toContain('<img');
    });

    it('should render high priority badge', () => {
      const item = { id: '1', title: 'Test Book', priority: 'high' };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('bg-red-100');
      expect(html).toContain('text-red-700');
      expect(html).toContain('high');
    });

    it('should render medium priority badge', () => {
      const item = { id: '1', title: 'Test Book', priority: 'medium' };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('bg-yellow-100');
      expect(html).toContain('text-yellow-700');
      expect(html).toContain('medium');
    });

    it('should render low priority badge', () => {
      const item = { id: '1', title: 'Test Book', priority: 'low' };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('bg-gray-100');
      expect(html).toContain('text-gray-600');
      expect(html).toContain('low');
    });

    it('should not render priority badge when no priority', () => {
      const item = { id: '1', title: 'Test Book', priority: null };
      const html = WishlistWidget.renderCard(item);
      expect(html).not.toContain('bg-red-100');
      expect(html).not.toContain('bg-yellow-100');
      expect(html).not.toContain('bg-gray-100');
    });

    it('should link to wishlist page', () => {
      const item = { id: '1', title: 'Test Book' };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('href="/wishlist/"');
    });

    it('should escape special characters in title', () => {
      const item = { id: '1', title: '<script>alert("xss")</script>' };
      const html = WishlistWidget.renderCard(item);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape special characters in author', () => {
      const item = { id: '1', title: 'Book', author: '<b>Author</b>' };
      const html = WishlistWidget.renderCard(item);
      expect(html).not.toContain('<b>');
      expect(html).toContain('&lt;b&gt;');
    });

    it('should show Unknown for missing title', () => {
      const item = { id: '1', title: null };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('Unknown');
    });

    it('should handle empty author gracefully', () => {
      const item = { id: '1', title: 'Book', author: '' };
      const html = WishlistWidget.renderCard(item);
      expect(html).toContain('Book');
    });
  });

  describe('renderWidget (inherited from BaseWidget)', () => {
    const config = { settings: { count: 6, sortBy: 'priority' } };

    it('should render complete widget with header', () => {
      const items = [{ id: '1', title: 'Test Book', priority: 'high' }];
      const html = WishlistWidget.renderWidget(items, config);
      expect(html).toContain('widget-card');
      expect(html).toContain('Wishlist');
      expect(html).toContain('data-lucide="heart"');
    });

    it('should render empty state when no items', () => {
      const html = WishlistWidget.renderWidget([], config);
      expect(html).toContain('Your wishlist is empty');
    });

    it('should show See all link when more items than count', () => {
      // Need more items than config count (6) to show See all link
      const items = Array.from({ length: 8 }, (_, i) => ({
        id: String(i),
        title: `Book ${i}`,
        priority: 'low'
      }));
      const html = WishlistWidget.renderWidget(items, config);
      expect(html).toContain('See all');
      expect(html).toContain('href="/wishlist/"');
    });

    it('should not show See all link when items fit within count', () => {
      const items = [{ id: '1', title: 'Test Book' }];
      const html = WishlistWidget.renderWidget(items, config);
      expect(html).not.toContain('See all');
    });
  });
});
