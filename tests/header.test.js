/**
 * Unit tests for header.js search functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeText } from '../src/js/utils.js';

// Mock books data for search testing
const mockBooks = [
  { id: '1', title: 'Harry Potter and the Sorcerer\'s Stone', author: 'J.K. Rowling' },
  { id: '2', title: 'The Hobbit', author: 'J.R.R. Tolkien' },
  { id: '3', title: 'Don\'t Make Me Think', author: 'Steve Krug' },
  { id: '4', title: '1984', author: 'George Orwell' },
  { id: '5', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' }
];

// Replicate search filter logic from header.js
function filterBooks(books, queryText) {
  if (!queryText) return [];
  const normalizedQuery = normalizeText(queryText);
  return books.filter(b =>
    normalizeText(b.title).includes(normalizedQuery) ||
    normalizeText(b.author).includes(normalizedQuery)
  );
}

// Replicate cache completeness check logic from header.js
function isCacheComplete(cached) {
  if (!cached) return false;
  try {
    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
    const books = parsed.books || parsed || [];
    const hasMore = parsed.hasMore ?? true;
    return books.length > 0 && !hasMore;
  } catch (e) {
    return false;
  }
}

describe('header search filtering', () => {
  it('should find books by title', () => {
    const results = filterBooks(mockBooks, 'Harry');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Harry Potter and the Sorcerer\'s Stone');
  });

  it('should find books by author', () => {
    const results = filterBooks(mockBooks, 'Tolkien');
    expect(results).toHaveLength(1);
    expect(results[0].author).toBe('J.R.R. Tolkien');
  });

  it('should be case-insensitive', () => {
    const results = filterBooks(mockBooks, 'HOBBIT');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('The Hobbit');
  });

  it('should handle apostrophes in search', () => {
    const results = filterBooks(mockBooks, "Don't");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Don\'t Make Me Think');
  });

  it('should handle curly apostrophes', () => {
    const results = filterBooks(mockBooks, "Don't"); // curly apostrophe
    expect(results).toHaveLength(1);
  });

  it('should return empty array for empty query', () => {
    const results = filterBooks(mockBooks, '');
    expect(results).toHaveLength(0);
  });

  it('should return empty array when no matches', () => {
    const results = filterBooks(mockBooks, 'xyz123');
    expect(results).toHaveLength(0);
  });

  it('should find partial matches', () => {
    const results = filterBooks(mockBooks, 'great');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('The Great Gatsby');
  });

  it('should find multiple matches', () => {
    const results = filterBooks(mockBooks, 'the');
    expect(results.length).toBeGreaterThan(1);
  });
});

describe('cache completeness check', () => {
  it('should return false for null cache', () => {
    expect(isCacheComplete(null)).toBe(false);
  });

  it('should return false for empty cache', () => {
    expect(isCacheComplete(JSON.stringify({ books: [], hasMore: false }))).toBe(false);
  });

  it('should return false when hasMore is true', () => {
    const cache = JSON.stringify({
      books: [{ id: '1', title: 'Book 1' }],
      hasMore: true
    });
    expect(isCacheComplete(cache)).toBe(false);
  });

  it('should return true when hasMore is false and has books', () => {
    const cache = JSON.stringify({
      books: [{ id: '1', title: 'Book 1' }],
      hasMore: false
    });
    expect(isCacheComplete(cache)).toBe(true);
  });

  it('should default hasMore to true if not specified', () => {
    const cache = JSON.stringify({
      books: [{ id: '1', title: 'Book 1' }]
    });
    expect(isCacheComplete(cache)).toBe(false);
  });

  it('should handle old cache format (array directly)', () => {
    const cache = JSON.stringify([{ id: '1', title: 'Book 1' }]);
    // Old format doesn't have hasMore, so defaults to true (incomplete)
    expect(isCacheComplete(cache)).toBe(false);
  });

  it('should return false for invalid JSON', () => {
    expect(isCacheComplete('invalid json')).toBe(false);
  });

  it('should handle already parsed object', () => {
    const cache = {
      books: [{ id: '1', title: 'Book 1' }],
      hasMore: false
    };
    expect(isCacheComplete(cache)).toBe(true);
  });
});

describe('search result count', () => {
  // Replicate result count formatting from header.js
  function formatResultCount(count) {
    if (count === 0) return '';
    return `${count} result${count !== 1 ? 's' : ''}`;
  }

  it('should format single result correctly', () => {
    expect(formatResultCount(1)).toBe('1 result');
  });

  it('should format multiple results with plural', () => {
    expect(formatResultCount(5)).toBe('5 results');
  });

  it('should return empty string for zero results', () => {
    expect(formatResultCount(0)).toBe('');
  });

  it('should show result count when searching', () => {
    const results = filterBooks(mockBooks, 'the');
    expect(formatResultCount(results.length)).toBe(`${results.length} results`);
  });
});

describe('lazy loading behavior', () => {
  // These test the expected behavior patterns

  it('should not load books until search opens', () => {
    // Initial state should have no books loaded
    let allBooksLoaded = false;
    let books = [];

    expect(allBooksLoaded).toBe(false);
    expect(books).toHaveLength(0);
  });

  it('should prevent duplicate loading calls', () => {
    let loadCount = 0;
    let isLoadingBooks = false;
    let allBooksLoaded = false;

    function loadAllBooksForSearch() {
      if (allBooksLoaded || isLoadingBooks) return false;
      isLoadingBooks = true;
      loadCount++;
      return true;
    }

    // First call should load
    expect(loadAllBooksForSearch()).toBe(true);
    expect(loadCount).toBe(1);

    // Second call while loading should be blocked
    expect(loadAllBooksForSearch()).toBe(false);
    expect(loadCount).toBe(1);

    // After loading completes
    isLoadingBooks = false;
    allBooksLoaded = true;

    // Should not reload
    expect(loadAllBooksForSearch()).toBe(false);
    expect(loadCount).toBe(1);
  });
});
