/**
 * Unit tests for src/js/book-card.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bookCard } from '../src/js/book-card.js';
import { createMockBook } from './setup.js';

describe('bookCard', () => {
  describe('basic rendering', () => {
    it('should render a book card with all fields', () => {
      const book = createMockBook({
        id: 'book-123',
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        coverImageUrl: 'https://example.com/gatsby.jpg',
        rating: 5
      });

      const html = bookCard(book);

      expect(html).toContain('href="/book/?id=book-123"');
      expect(html).toContain('The Great Gatsby');
      expect(html).toContain('F. Scott Fitzgerald');
      expect(html).toContain('https://example.com/gatsby.jpg');
      expect(html).toContain('class="book-card"');
    });

    it('should render book without cover image', () => {
      const book = createMockBook({
        title: 'No Cover Book',
        coverImageUrl: ''
      });

      const html = bookCard(book);

      expect(html).toContain('book-cover-placeholder');
      expect(html).toContain('data-lucide="book"');
      expect(html).not.toContain('<img');
    });

    it('should render book without rating', () => {
      const book = createMockBook({
        title: 'Unrated Book',
        rating: 0
      });

      const html = bookCard(book);

      expect(html).toContain('Unrated Book');
      expect(html).not.toContain('rating-stars');
    });

    it('should show "Unknown author" when author is missing', () => {
      const book = createMockBook({
        title: 'Anonymous Book',
        author: ''
      });

      const html = bookCard(book);

      expect(html).toContain('Unknown author');
    });
  });

  describe('XSS prevention', () => {
    it('should escape HTML in title', () => {
      const book = createMockBook({
        title: '<script>alert("xss")</script>'
      });

      const html = bookCard(book);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape HTML in author', () => {
      const book = createMockBook({
        author: '<img src=x onerror=alert(1)>'
      });

      const html = bookCard(book);

      // The malicious author content should be escaped - < and > become entities
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });
  });

  describe('showDate option', () => {
    it('should not show date by default', () => {
      const book = createMockBook();
      const html = bookCard(book);

      expect(html).not.toContain('Added');
    });

    it('should show date when showDate is true', () => {
      const book = createMockBook({
        createdAt: { seconds: 1686787200 } // 2023-06-15
      });

      const html = bookCard(book, { showDate: true });

      expect(html).toContain('Added');
      expect(html).toContain('2023');
    });

    it('should handle missing createdAt gracefully', () => {
      const book = createMockBook({ createdAt: null });

      const html = bookCard(book, { showDate: true });

      // Should not crash, may or may not show date depending on implementation
      expect(html).toContain(book.title);
    });
  });

  describe('rating display', () => {
    it('should render stars for rated books', () => {
      const book = createMockBook({ rating: 4 });
      const html = bookCard(book);

      expect(html).toContain('rating-stars');
      expect(html).toContain('<svg');
    });

    it('should render correct number of filled stars', () => {
      const book = createMockBook({ rating: 3 });
      const html = bookCard(book);

      // Count filled stars (have fill="currentColor" without class="empty")
      const filledStars = (html.match(/fill="currentColor"/g) || []).length;
      expect(filledStars).toBe(3);
    });
  });

  describe('CSS classes', () => {
    it('should include book-card class', () => {
      const book = createMockBook();
      const html = bookCard(book);

      expect(html).toContain('class="book-card"');
    });

    it('should include book-cover class for images', () => {
      const book = createMockBook({
        coverImageUrl: 'https://example.com/cover.jpg'
      });
      const html = bookCard(book);

      expect(html).toContain('class="book-cover"');
    });

    it('should include truncate classes for text overflow', () => {
      const book = createMockBook();
      const html = bookCard(book);

      expect(html).toContain('truncate');
    });

    it('should include lazy loading for cover images', () => {
      const book = createMockBook({
        coverImageUrl: 'https://example.com/cover.jpg'
      });
      const html = bookCard(book);

      expect(html).toContain('loading="lazy"');
    });
  });
});
