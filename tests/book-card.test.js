/**
 * Unit tests for src/js/book-card.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bookCard } from '../src/js/book-card.js';
import { createMockBook, createSerializedBook, createSerializedBooks } from './setup.js';

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

    it('should show date with milliseconds format (serialized/cached data)', () => {
      const milliseconds = 1686787200000; // 2023-06-15 00:00:00 UTC
      const book = createMockBook({
        createdAt: milliseconds
      });

      const html = bookCard(book, { showDate: true });

      expect(html).toContain('Added');
      expect(html).toContain('2023');
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

  describe('status badge', () => {
    // Status is now inferred from reads array
    it('should render "Reading" badge when book has startedAt but no finishedAt', () => {
      const book = createMockBook({
        reads: [{ startedAt: Date.now() - 86400000, finishedAt: null }]
      });
      const html = bookCard(book);

      expect(html).toContain('Reading');
      expect(html).toContain('bg-blue-100');
      expect(html).toContain('text-blue-700');
      expect(html).toContain('data-lucide="book-open"');
    });

    it('should render "Finished" badge when book has both startedAt and finishedAt', () => {
      const book = createMockBook({
        reads: [{ startedAt: Date.now() - 86400000 * 7, finishedAt: Date.now() }]
      });
      const html = bookCard(book);

      expect(html).toContain('Finished');
      expect(html).toContain('bg-green-100');
      expect(html).toContain('text-green-700');
      expect(html).toContain('data-lucide="check-circle"');
    });

    it('should not render status badge for empty reads array', () => {
      const book = createMockBook({ reads: [] });
      const html = bookCard(book);

      expect(html).not.toContain('Reading');
      expect(html).not.toContain('Finished');
    });

    it('should not render status badge when reads is undefined', () => {
      const book = createMockBook({ reads: undefined });
      const html = bookCard(book);

      expect(html).not.toContain('Reading');
      expect(html).not.toContain('Finished');
    });

    it('should infer status from legacy startedAt/finishedAt fields (migration)', () => {
      // Old format: startedAt and finishedAt directly on book
      const book = createMockBook({
        startedAt: Date.now() - 86400000,
        finishedAt: Date.now()
      });
      const html = bookCard(book);

      expect(html).toContain('Finished');
      expect(html).toContain('bg-green-100');
    });
  });

  describe('book list rendering (integration)', () => {
    it('should show date for ALL serialized books, not just the first one', () => {
      const books = createSerializedBooks(5);

      // Render all books like the book list does
      const renderedCards = books.map(book => bookCard(book, { showDate: true }));

      // EVERY card should contain "Added"
      renderedCards.forEach((html, index) => {
        expect(html, `Book ${index + 1} should have "Added" date`).toContain('Added');
      });
    });

    it('should show unique dates for books with different createdAt values', () => {
      // Create books with specific dates
      const books = [
        createSerializedBook({ id: '1', createdAt: new Date('2023-01-15').getTime() }),
        createSerializedBook({ id: '2', createdAt: new Date('2023-06-20').getTime() }),
        createSerializedBook({ id: '3', createdAt: new Date('2024-03-10').getTime() }),
      ];

      const renderedCards = books.map(book => bookCard(book, { showDate: true }));

      // Each should have a date
      expect(renderedCards[0]).toContain('2023');
      expect(renderedCards[1]).toContain('2023');
      expect(renderedCards[2]).toContain('2024');
    });

    it('should handle mixed format dates (for backwards compatibility)', () => {
      const books = [
        createSerializedBook({ id: '1', createdAt: 1686787200000 }), // milliseconds
        createMockBook({ id: '2', createdAt: { seconds: 1686787200 } }), // Firestore format
        createSerializedBook({ id: '3', createdAt: 1686787200000 }), // milliseconds
      ];

      const renderedCards = books.map(book => bookCard(book, { showDate: true }));

      // ALL should have dates
      renderedCards.forEach((html, index) => {
        expect(html, `Book ${index + 1} should have date`).toContain('Added');
        expect(html, `Book ${index + 1} should show year`).toContain('2023');
      });
    });

    it('should gracefully handle books with missing createdAt (legacy data)', () => {
      const books = [
        createSerializedBook({ id: '1', createdAt: 1686787200000 }), // has date
        { id: '2', title: 'Old Book', author: 'Author', createdAt: null }, // null
        { id: '3', title: 'Legacy Book', author: 'Author', createdAt: undefined }, // undefined
        { id: '4', title: 'No Date Book', author: 'Author' }, // missing field
      ];

      const renderedCards = books.map(book => bookCard(book, { showDate: true }));

      // First book should have date
      expect(renderedCards[0]).toContain('Added');
      expect(renderedCards[0]).toContain('2023');

      // Others should NOT crash, just not show date
      expect(renderedCards[1]).toContain('Old Book');
      expect(renderedCards[1]).not.toContain('Added');

      expect(renderedCards[2]).toContain('Legacy Book');
      expect(renderedCards[2]).not.toContain('Added');

      expect(renderedCards[3]).toContain('No Date Book');
      expect(renderedCards[3]).not.toContain('Added');
    });
  });
});
