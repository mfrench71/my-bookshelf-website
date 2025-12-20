/**
 * Unit tests for sorting and filtering logic from src/js/books.js
 * These test the pure functions extracted/replicated from books.js
 */

import { describe, it, expect } from 'vitest';
import { createMockBooks } from './setup.js';
import { bookCard } from '../src/js/book-card.js';

// Replicate sorting function from books.js for testing
// Note: In production, createdAt is serialized to milliseconds (plain numbers)
function sortBooks(booksArray, sortKey) {
  const [field, direction] = sortKey.split('-');
  return [...booksArray].sort((a, b) => {
    let aVal, bVal;
    switch (field) {
      case 'title':
        aVal = (a.title || '').toLowerCase();
        bVal = (b.title || '').toLowerCase();
        break;
      case 'author':
        aVal = (a.author || '').toLowerCase();
        bVal = (b.author || '').toLowerCase();
        break;
      case 'rating':
        aVal = a.rating || 0;
        bVal = b.rating || 0;
        break;
      default: // createdAt - handles both Firestore format and serialized milliseconds
        aVal = typeof a.createdAt === 'number' ? a.createdAt :
               (a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0);
        bVal = typeof b.createdAt === 'number' ? b.createdAt :
               (b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0);
    }
    return direction === 'asc'
      ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0)
      : (aVal > bVal ? -1 : aVal < bVal ? 1 : 0);
  });
}

// Replicate rating filter function from books.js for testing
function filterByRating(booksArray, minRating) {
  if (minRating === 0) return booksArray;
  return booksArray.filter(b => (b.rating || 0) >= minRating);
}

describe('sortBooks', () => {
  describe('sort by title', () => {
    it('should sort by title ascending', () => {
      const books = [
        { id: '1', title: 'Zebra Book' },
        { id: '2', title: 'Apple Book' },
        { id: '3', title: 'Mango Book' }
      ];

      const sorted = sortBooks(books, 'title-asc');

      expect(sorted[0].title).toBe('Apple Book');
      expect(sorted[1].title).toBe('Mango Book');
      expect(sorted[2].title).toBe('Zebra Book');
    });

    it('should sort by title descending', () => {
      const books = [
        { id: '1', title: 'Zebra Book' },
        { id: '2', title: 'Apple Book' },
        { id: '3', title: 'Mango Book' }
      ];

      const sorted = sortBooks(books, 'title-desc');

      expect(sorted[0].title).toBe('Zebra Book');
      expect(sorted[1].title).toBe('Mango Book');
      expect(sorted[2].title).toBe('Apple Book');
    });

    it('should be case-insensitive', () => {
      const books = [
        { id: '1', title: 'ZEBRA' },
        { id: '2', title: 'apple' },
        { id: '3', title: 'Mango' }
      ];

      const sorted = sortBooks(books, 'title-asc');

      expect(sorted[0].title).toBe('apple');
      expect(sorted[1].title).toBe('Mango');
      expect(sorted[2].title).toBe('ZEBRA');
    });

    it('should handle null/undefined titles', () => {
      const books = [
        { id: '1', title: 'Zebra' },
        { id: '2', title: null },
        { id: '3', title: 'Apple' }
      ];

      const sorted = sortBooks(books, 'title-asc');

      expect(sorted[0].title).toBe(null); // empty string comes first
      expect(sorted[1].title).toBe('Apple');
      expect(sorted[2].title).toBe('Zebra');
    });
  });

  describe('sort by author', () => {
    it('should sort by author ascending', () => {
      const books = [
        { id: '1', author: 'Zelda Author' },
        { id: '2', author: 'Aaron Author' },
        { id: '3', author: 'Mary Author' }
      ];

      const sorted = sortBooks(books, 'author-asc');

      expect(sorted[0].author).toBe('Aaron Author');
      expect(sorted[1].author).toBe('Mary Author');
      expect(sorted[2].author).toBe('Zelda Author');
    });

    it('should sort by author descending', () => {
      const books = [
        { id: '1', author: 'Zelda Author' },
        { id: '2', author: 'Aaron Author' },
        { id: '3', author: 'Mary Author' }
      ];

      const sorted = sortBooks(books, 'author-desc');

      expect(sorted[0].author).toBe('Zelda Author');
      expect(sorted[1].author).toBe('Mary Author');
      expect(sorted[2].author).toBe('Aaron Author');
    });
  });

  describe('sort by rating', () => {
    it('should sort by rating descending (high to low)', () => {
      const books = [
        { id: '1', rating: 3 },
        { id: '2', rating: 5 },
        { id: '3', rating: 1 },
        { id: '4', rating: 4 }
      ];

      const sorted = sortBooks(books, 'rating-desc');

      expect(sorted[0].rating).toBe(5);
      expect(sorted[1].rating).toBe(4);
      expect(sorted[2].rating).toBe(3);
      expect(sorted[3].rating).toBe(1);
    });

    it('should sort by rating ascending (low to high)', () => {
      const books = [
        { id: '1', rating: 3 },
        { id: '2', rating: 5 },
        { id: '3', rating: 1 },
        { id: '4', rating: 4 }
      ];

      const sorted = sortBooks(books, 'rating-asc');

      expect(sorted[0].rating).toBe(1);
      expect(sorted[1].rating).toBe(3);
      expect(sorted[2].rating).toBe(4);
      expect(sorted[3].rating).toBe(5);
    });

    it('should treat null/undefined ratings as 0', () => {
      const books = [
        { id: '1', rating: 3 },
        { id: '2', rating: null },
        { id: '3', rating: 5 },
        { id: '4' } // no rating property
      ];

      const sorted = sortBooks(books, 'rating-asc');

      expect(sorted[0].rating).toBeFalsy(); // null or undefined
      expect(sorted[1].rating).toBeFalsy();
      expect(sorted[2].rating).toBe(3);
      expect(sorted[3].rating).toBe(5);
    });
  });

  describe('sort by createdAt (date added)', () => {
    it('should sort by date descending (newest first)', () => {
      const books = [
        { id: '1', createdAt: { seconds: 1000 } },
        { id: '2', createdAt: { seconds: 3000 } },
        { id: '3', createdAt: { seconds: 2000 } }
      ];

      const sorted = sortBooks(books, 'createdAt-desc');

      expect(sorted[0].id).toBe('2'); // seconds: 3000
      expect(sorted[1].id).toBe('3'); // seconds: 2000
      expect(sorted[2].id).toBe('1'); // seconds: 1000
    });

    it('should sort by date ascending (oldest first)', () => {
      const books = [
        { id: '1', createdAt: { seconds: 1000 } },
        { id: '2', createdAt: { seconds: 3000 } },
        { id: '3', createdAt: { seconds: 2000 } }
      ];

      const sorted = sortBooks(books, 'createdAt-asc');

      expect(sorted[0].id).toBe('1'); // seconds: 1000
      expect(sorted[1].id).toBe('3'); // seconds: 2000
      expect(sorted[2].id).toBe('2'); // seconds: 3000
    });

    it('should handle Firestore toMillis method', () => {
      const books = [
        { id: '1', createdAt: { toMillis: () => 1000000 } },
        { id: '2', createdAt: { toMillis: () => 3000000 } },
        { id: '3', createdAt: { toMillis: () => 2000000 } }
      ];

      const sorted = sortBooks(books, 'createdAt-desc');

      expect(sorted[0].id).toBe('2');
      expect(sorted[1].id).toBe('3');
      expect(sorted[2].id).toBe('1');
    });

    it('should treat missing createdAt as 0', () => {
      const books = [
        { id: '1', createdAt: { seconds: 1000 } },
        { id: '2' }, // no createdAt
        { id: '3', createdAt: { seconds: 2000 } }
      ];

      const sorted = sortBooks(books, 'createdAt-asc');

      expect(sorted[0].id).toBe('2'); // no date = 0, comes first
    });

    it('should handle milliseconds format (serialized/cached data)', () => {
      const books = [
        { id: '1', createdAt: 1000000 },
        { id: '2', createdAt: 3000000 },
        { id: '3', createdAt: 2000000 }
      ];

      const sorted = sortBooks(books, 'createdAt-desc');

      expect(sorted[0].id).toBe('2'); // 3000000
      expect(sorted[1].id).toBe('3'); // 2000000
      expect(sorted[2].id).toBe('1'); // 1000000
    });

    it('should handle mixed Firestore and milliseconds formats', () => {
      const books = [
        { id: '1', createdAt: 1000000 }, // milliseconds
        { id: '2', createdAt: { seconds: 3000 } }, // Firestore (3000000 ms)
        { id: '3', createdAt: 2000000 } // milliseconds
      ];

      const sorted = sortBooks(books, 'createdAt-desc');

      expect(sorted[0].id).toBe('2'); // 3000000
      expect(sorted[1].id).toBe('3'); // 2000000
      expect(sorted[2].id).toBe('1'); // 1000000
    });
  });

  describe('immutability', () => {
    it('should not modify the original array', () => {
      const original = [
        { id: '1', title: 'Zebra' },
        { id: '2', title: 'Apple' }
      ];
      const originalCopy = [...original];

      sortBooks(original, 'title-asc');

      expect(original).toEqual(originalCopy);
    });
  });
});

describe('filterByRating', () => {
  const books = [
    { id: '1', title: 'Book 1', rating: 5 },
    { id: '2', title: 'Book 2', rating: 4 },
    { id: '3', title: 'Book 3', rating: 3 },
    { id: '4', title: 'Book 4', rating: 2 },
    { id: '5', title: 'Book 5', rating: 1 },
    { id: '6', title: 'Book 6', rating: null },
    { id: '7', title: 'Book 7' } // no rating
  ];

  it('should return all books when minRating is 0', () => {
    const result = filterByRating(books, 0);
    expect(result).toHaveLength(7);
  });

  it('should filter books with 5 stars', () => {
    const result = filterByRating(books, 5);
    expect(result).toHaveLength(1);
    expect(result[0].rating).toBe(5);
  });

  it('should filter books with 4+ stars', () => {
    const result = filterByRating(books, 4);
    expect(result).toHaveLength(2);
    expect(result.every(b => b.rating >= 4)).toBe(true);
  });

  it('should filter books with 3+ stars', () => {
    const result = filterByRating(books, 3);
    expect(result).toHaveLength(3);
    expect(result.every(b => b.rating >= 3)).toBe(true);
  });

  it('should filter books with 2+ stars', () => {
    const result = filterByRating(books, 2);
    expect(result).toHaveLength(4);
  });

  it('should filter books with 1+ stars', () => {
    const result = filterByRating(books, 1);
    expect(result).toHaveLength(5);
  });

  it('should exclude books with null/undefined rating', () => {
    const result = filterByRating(books, 1);
    expect(result.some(b => b.rating === null)).toBe(false);
    expect(result.some(b => b.rating === undefined)).toBe(false);
  });
});

describe('combined sorting and filtering', () => {
  it('should work together correctly', () => {
    const books = [
      { id: '1', title: 'Alpha', rating: 5 },
      { id: '2', title: 'Beta', rating: 3 },
      { id: '3', title: 'Gamma', rating: 5 },
      { id: '4', title: 'Delta', rating: 2 },
      { id: '5', title: 'Epsilon', rating: 4 }
    ];

    // Filter to 4+ stars, then sort by title
    const filtered = filterByRating(books, 4);
    const sorted = sortBooks(filtered, 'title-asc');

    expect(sorted).toHaveLength(3); // Alpha(5), Epsilon(4), Gamma(5)
    expect(sorted[0].title).toBe('Alpha');
    expect(sorted[1].title).toBe('Epsilon');
    expect(sorted[2].title).toBe('Gamma');
  });
});

describe('edge cases', () => {
  it('should handle empty array', () => {
    expect(sortBooks([], 'title-asc')).toEqual([]);
    expect(filterByRating([], 5)).toEqual([]);
  });

  it('should handle single item array', () => {
    const books = [{ id: '1', title: 'Only Book', rating: 5 }];

    expect(sortBooks(books, 'title-asc')).toHaveLength(1);
    expect(filterByRating(books, 5)).toHaveLength(1);
  });

  it('should handle array with duplicate values', () => {
    const books = [
      { id: '1', title: 'Same Title' },
      { id: '2', title: 'Same Title' },
      { id: '3', title: 'Same Title' }
    ];

    const sorted = sortBooks(books, 'title-asc');
    expect(sorted).toHaveLength(3);
  });
});

// Replicate deduplication logic from books.js for testing
function deduplicateBooks(existingBooks, newBooks) {
  const existingIds = new Set(existingBooks.map(b => b.id));
  const uniqueNewBooks = newBooks.filter(b => !existingIds.has(b.id));
  return [...existingBooks, ...uniqueNewBooks];
}

// Replicate serializeBook from books.js exactly
function serializeBook(doc) {
  const data = doc.data();
  const rawCreatedAt = data.createdAt;

  let createdAt = null;
  if (rawCreatedAt) {
    if (typeof rawCreatedAt.toMillis === 'function') {
      createdAt = rawCreatedAt.toMillis();
    } else if (rawCreatedAt.seconds) {
      createdAt = rawCreatedAt.seconds * 1000;
    } else if (typeof rawCreatedAt === 'number') {
      createdAt = rawCreatedAt;
    } else if (typeof rawCreatedAt === 'string') {
      const date = new Date(rawCreatedAt);
      if (!isNaN(date.getTime())) {
        createdAt = date.getTime();
      }
    }
  }

  return {
    id: doc.id,
    ...data,
    createdAt,
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt?.seconds * 1000 || null
  };
}

describe('serializeBook + bookCard integration', () => {
  it('should show dates for ALL books after serialization (mimics real Firestore flow)', () => {
    // Create mock Firestore docs with Timestamp-like objects
    const mockFirestoreDocs = [
      {
        id: 'book-1',
        data: () => ({
          title: 'Book 1',
          author: 'Author 1',
          rating: 5,
          createdAt: { toMillis: () => 1686787200000, seconds: 1686787200 }
        })
      },
      {
        id: 'book-2',
        data: () => ({
          title: 'Book 2',
          author: 'Author 2',
          rating: 4,
          createdAt: { toMillis: () => 1686873600000, seconds: 1686873600 }
        })
      },
      {
        id: 'book-3',
        data: () => ({
          title: 'Book 3',
          author: 'Author 3',
          rating: 3,
          createdAt: { toMillis: () => 1686960000000, seconds: 1686960000 }
        })
      },
    ];

    // Serialize like books.js does
    const serializedBooks = mockFirestoreDocs.map(serializeBook);

    // Verify serialization worked
    serializedBooks.forEach((book, index) => {
      expect(book.createdAt, `Book ${index + 1} should have createdAt as number`).toBeTypeOf('number');
    });

    // Render with showDate like books.js does
    const renderedCards = serializedBooks.map(book => bookCard(book, { showDate: true }));

    // ALL should have dates
    renderedCards.forEach((html, index) => {
      expect(html, `Book ${index + 1} should have "Added" in HTML`).toContain('Added');
      expect(html, `Book ${index + 1} should show year 2023`).toContain('2023');
    });
  });

  it('should handle ISO date strings (actual format from Firebase)', () => {
    const mockFirestoreDocs = [
      {
        id: 'book-1',
        data: () => ({
          title: 'Book 1',
          author: 'Author 1',
          createdAt: '2025-12-20T09:29:20.036460' // ISO string as returned by Firebase
        })
      },
      {
        id: 'book-2',
        data: () => ({
          title: 'Book 2',
          author: 'Author 2',
          createdAt: '2025-12-19T14:26:22.257990'
        })
      },
    ];

    const serializedBooks = mockFirestoreDocs.map(serializeBook);

    // Verify serialization worked with ISO strings
    expect(serializedBooks[0].createdAt).toBeTypeOf('number');
    expect(serializedBooks[0].createdAt).toBeGreaterThan(0);
    expect(serializedBooks[1].createdAt).toBeTypeOf('number');

    // Render
    const renderedCards = serializedBooks.map(book => bookCard(book, { showDate: true }));

    // ALL should have dates
    renderedCards.forEach((html, index) => {
      expect(html, `Book ${index + 1} should have date`).toContain('Added');
      expect(html, `Book ${index + 1} should show year`).toContain('2025');
    });
  });

  it('should handle Firestore timestamps without toMillis method (fallback to seconds)', () => {
    const mockFirestoreDocs = [
      {
        id: 'book-1',
        data: () => ({
          title: 'Book 1',
          author: 'Author 1',
          createdAt: { seconds: 1686787200 } // No toMillis method!
        })
      },
      {
        id: 'book-2',
        data: () => ({
          title: 'Book 2',
          author: 'Author 2',
          createdAt: { seconds: 1686873600 }
        })
      },
    ];

    const serializedBooks = mockFirestoreDocs.map(serializeBook);

    // Verify serialization worked with seconds fallback
    expect(serializedBooks[0].createdAt).toBe(1686787200000);
    expect(serializedBooks[1].createdAt).toBe(1686873600000);

    // Render
    const renderedCards = serializedBooks.map(book => bookCard(book, { showDate: true }));

    // ALL should have dates
    renderedCards.forEach((html, index) => {
      expect(html, `Book ${index + 1} should have date`).toContain('Added');
    });
  });
});

describe('deduplicateBooks', () => {
  it('should add new books that do not exist in existing array', () => {
    const existing = [
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' }
    ];
    const newBooks = [
      { id: '3', title: 'Book 3' },
      { id: '4', title: 'Book 4' }
    ];

    const result = deduplicateBooks(existing, newBooks);

    expect(result).toHaveLength(4);
    expect(result.map(b => b.id)).toEqual(['1', '2', '3', '4']);
  });

  it('should not add duplicates when new books overlap with existing', () => {
    const existing = [
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' }
    ];
    const newBooks = [
      { id: '2', title: 'Book 2 (duplicate)' },
      { id: '3', title: 'Book 3' }
    ];

    const result = deduplicateBooks(existing, newBooks);

    expect(result).toHaveLength(3);
    expect(result.map(b => b.id)).toEqual(['1', '2', '3']);
    // Original book should be kept, not replaced
    expect(result[1].title).toBe('Book 2');
  });

  it('should handle all duplicates (no new books added)', () => {
    const existing = [
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' }
    ];
    const newBooks = [
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' }
    ];

    const result = deduplicateBooks(existing, newBooks);

    expect(result).toHaveLength(2);
  });

  it('should handle empty existing array', () => {
    const existing = [];
    const newBooks = [
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' }
    ];

    const result = deduplicateBooks(existing, newBooks);

    expect(result).toHaveLength(2);
  });

  it('should handle empty new books array', () => {
    const existing = [
      { id: '1', title: 'Book 1' },
      { id: '2', title: 'Book 2' }
    ];
    const newBooks = [];

    const result = deduplicateBooks(existing, newBooks);

    expect(result).toHaveLength(2);
  });

  it('should handle cache + Firebase overlap scenario', () => {
    // Simulates: cache has 20 books, Firebase fetch returns 20 books
    // where first 10 overlap with cache
    const cached = Array.from({ length: 20 }, (_, i) => ({
      id: `book-${i + 1}`,
      title: `Book ${i + 1}`
    }));

    // Firebase returns books 11-30 (first 10 overlap with cache positions 11-20)
    const fromFirebase = Array.from({ length: 20 }, (_, i) => ({
      id: `book-${i + 11}`,
      title: `Book ${i + 11}`
    }));

    const result = deduplicateBooks(cached, fromFirebase);

    // Should have 30 unique books (1-30)
    expect(result).toHaveLength(30);

    // Verify no duplicates
    const ids = result.map(b => b.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(30);
  });
});

describe('hasMoreFromFirebase logic', () => {
  // Simulate the hasMoreFromFirebase logic from books.js
  function calculateHasMore(snapshotDocsLength, uniqueNewBooksLength, BOOKS_PER_PAGE = 20) {
    // If we got a full page but no new unique books, we've caught up - no more to fetch
    if (snapshotDocsLength === BOOKS_PER_PAGE && uniqueNewBooksLength === 0) {
      return false;
    } else {
      return snapshotDocsLength === BOOKS_PER_PAGE;
    }
  }

  it('should return false when we get less than a full page', () => {
    expect(calculateHasMore(10, 10)).toBe(false);
  });

  it('should return true when we get a full page with new books', () => {
    expect(calculateHasMore(20, 20)).toBe(true);
    expect(calculateHasMore(20, 15)).toBe(true); // Some duplicates
    expect(calculateHasMore(20, 5)).toBe(true);  // Many duplicates
    expect(calculateHasMore(20, 1)).toBe(true);  // One new book
  });

  it('should return false when we get a full page of all duplicates', () => {
    // This is the key fix - when we load from cache and then fetch,
    // if all 20 books are already in the cache, we should stop
    expect(calculateHasMore(20, 0)).toBe(false);
  });

  it('should return false when we get zero books', () => {
    expect(calculateHasMore(0, 0)).toBe(false);
  });
});

describe('cache loading scenarios', () => {
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes (matches books.js)

  // Replicate getCachedBooks logic from books.js
  function getCachedBooks(cached, currentSort) {
    try {
      if (!cached) return null;

      const { books: cachedBooks, timestamp, sort, hasMore } = JSON.parse(cached);
      const age = Date.now() - timestamp;

      // Return cache if fresh and same sort order
      if (age < CACHE_TTL && sort === currentSort) {
        return { books: cachedBooks, hasMore: hasMore ?? true };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  describe('valid cache scenarios', () => {
    it('should return cached books when cache is fresh and sort matches', () => {
      const cachedData = {
        books: [{ id: '1', title: 'Book 1' }],
        timestamp: Date.now() - 1000, // 1 second ago
        sort: 'createdAt-desc',
        hasMore: false
      };

      const result = getCachedBooks(JSON.stringify(cachedData), 'createdAt-desc');

      expect(result).not.toBeNull();
      expect(result.books).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('should return hasMore from cache', () => {
      const cacheWithMore = {
        books: [{ id: '1', title: 'Book 1' }],
        timestamp: Date.now(),
        sort: 'createdAt-desc',
        hasMore: true
      };

      const result = getCachedBooks(JSON.stringify(cacheWithMore), 'createdAt-desc');

      expect(result.hasMore).toBe(true);
    });

    it('should default hasMore to true if not in cache (backwards compatibility)', () => {
      const oldFormatCache = {
        books: [{ id: '1', title: 'Book 1' }],
        timestamp: Date.now(),
        sort: 'createdAt-desc'
        // no hasMore field
      };

      const result = getCachedBooks(JSON.stringify(oldFormatCache), 'createdAt-desc');

      expect(result.hasMore).toBe(true);
    });
  });

  describe('cache invalidation scenarios', () => {
    it('should return null when cache is expired (older than TTL)', () => {
      const expiredCache = {
        books: [{ id: '1', title: 'Book 1' }],
        timestamp: Date.now() - CACHE_TTL - 1000, // Expired
        sort: 'createdAt-desc',
        hasMore: false
      };

      const result = getCachedBooks(JSON.stringify(expiredCache), 'createdAt-desc');

      expect(result).toBeNull();
    });

    it('should return null when sort order differs', () => {
      const cachedData = {
        books: [{ id: '1', title: 'Book 1' }],
        timestamp: Date.now(),
        sort: 'createdAt-desc',
        hasMore: false
      };

      // Request different sort
      const result = getCachedBooks(JSON.stringify(cachedData), 'title-asc');

      expect(result).toBeNull();
    });

    it('should return null for null cache', () => {
      const result = getCachedBooks(null, 'createdAt-desc');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const result = getCachedBooks('not valid json', 'createdAt-desc');
      expect(result).toBeNull();
    });
  });

  describe('cache write scenarios', () => {
    // Replicate setCachedBooks logic from books.js
    function createCacheData(booksData, hasMore, currentSort) {
      return {
        books: booksData,
        timestamp: Date.now(),
        sort: currentSort,
        hasMore: hasMore
      };
    }

    it('should include hasMore flag in cache data', () => {
      const books = [{ id: '1', title: 'Book 1' }];

      const cacheData = createCacheData(books, false, 'createdAt-desc');

      expect(cacheData.hasMore).toBe(false);
      expect(cacheData.books).toEqual(books);
      expect(cacheData.sort).toBe('createdAt-desc');
    });

    it('should include timestamp for TTL checking', () => {
      const beforeTime = Date.now();
      const cacheData = createCacheData([], false, 'createdAt-desc');
      const afterTime = Date.now();

      expect(cacheData.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(cacheData.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});

describe('Firebase loading scenarios', () => {
  const BOOKS_PER_PAGE = 20;

  // Simulate the loading decision logic from books.js
  function shouldFetchFromFirebase(cached, forceRefresh) {
    if (forceRefresh) return true;
    if (!cached) return true;
    if (!cached.books || cached.books.length === 0) return true;
    return false;
  }

  describe('initial load decisions', () => {
    it('should fetch from Firebase when cache is empty', () => {
      const result = shouldFetchFromFirebase(null, false);
      expect(result).toBe(true);
    });

    it('should fetch from Firebase when cache has no books', () => {
      const result = shouldFetchFromFirebase({ books: [], hasMore: true }, false);
      expect(result).toBe(true);
    });

    it('should NOT fetch from Firebase when cache has books', () => {
      const cached = {
        books: [{ id: '1', title: 'Book 1' }],
        hasMore: false
      };
      const result = shouldFetchFromFirebase(cached, false);
      expect(result).toBe(false);
    });

    it('should fetch from Firebase when forceRefresh is true even with cache', () => {
      const cached = {
        books: [{ id: '1', title: 'Book 1' }],
        hasMore: false
      };
      const result = shouldFetchFromFirebase(cached, true);
      expect(result).toBe(true);
    });
  });

  describe('Firebase pagination (fetchNextPage)', () => {
    // Simulate fetchNextPage logic
    function simulateFetchNextPage(
      existingBooks,
      newBooksFromFirebase,
      isLastPage // true if less than BOOKS_PER_PAGE returned
    ) {
      const existingIds = new Set(existingBooks.map(b => b.id));
      const uniqueNewBooks = newBooksFromFirebase.filter(b => !existingIds.has(b.id));

      const allBooks = [...existingBooks, ...uniqueNewBooks];

      let hasMoreFromFirebase;
      if (newBooksFromFirebase.length === BOOKS_PER_PAGE && uniqueNewBooks.length === 0) {
        hasMoreFromFirebase = false; // Full page of duplicates
      } else {
        hasMoreFromFirebase = !isLastPage;
      }

      return { books: allBooks, hasMoreFromFirebase, uniqueCount: uniqueNewBooks.length };
    }

    it('should add unique books from Firebase to existing books', () => {
      const existing = [{ id: '1', title: 'Book 1' }];
      const fromFirebase = [
        { id: '2', title: 'Book 2' },
        { id: '3', title: 'Book 3' }
      ];

      const result = simulateFetchNextPage(existing, fromFirebase, true);

      expect(result.books).toHaveLength(3);
      expect(result.uniqueCount).toBe(2);
    });

    it('should not add duplicate books', () => {
      const existing = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];
      const fromFirebase = [
        { id: '2', title: 'Book 2 duplicate' },
        { id: '3', title: 'Book 3' }
      ];

      const result = simulateFetchNextPage(existing, fromFirebase, true);

      expect(result.books).toHaveLength(3);
      expect(result.uniqueCount).toBe(1);
    });

    it('should set hasMoreFromFirebase=false when less than page size returned', () => {
      const existing = [];
      const fromFirebase = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        title: `Book ${i}`
      }));

      const result = simulateFetchNextPage(existing, fromFirebase, true);

      expect(result.hasMoreFromFirebase).toBe(false);
    });

    it('should set hasMoreFromFirebase=true when full page returned', () => {
      const existing = [];
      const fromFirebase = Array.from({ length: BOOKS_PER_PAGE }, (_, i) => ({
        id: `${i}`,
        title: `Book ${i}`
      }));

      const result = simulateFetchNextPage(existing, fromFirebase, false);

      expect(result.hasMoreFromFirebase).toBe(true);
    });

    it('should set hasMoreFromFirebase=false when full page but all duplicates', () => {
      // Cache has 20 books, Firebase returns same 20 books
      const existing = Array.from({ length: BOOKS_PER_PAGE }, (_, i) => ({
        id: `${i}`,
        title: `Book ${i}`
      }));

      const result = simulateFetchNextPage(existing, existing, false);

      expect(result.hasMoreFromFirebase).toBe(false);
      expect(result.uniqueCount).toBe(0);
    });
  });

  describe('cache + Firebase interaction', () => {
    it('should use cached books immediately then fetch remaining from Firebase', () => {
      // Simulate: cache has 20 books with hasMore=true
      const cachedBooks = Array.from({ length: 20 }, (_, i) => ({
        id: `book-${i + 1}`,
        title: `Book ${i + 1}`
      }));
      const cacheHasMore = true;

      // Firebase returns next 20 books
      const firebaseBooks = Array.from({ length: 20 }, (_, i) => ({
        id: `book-${i + 21}`,
        title: `Book ${i + 21}`
      }));

      // Merge
      const existingIds = new Set(cachedBooks.map(b => b.id));
      const uniqueNew = firebaseBooks.filter(b => !existingIds.has(b.id));
      const allBooks = [...cachedBooks, ...uniqueNew];

      expect(allBooks).toHaveLength(40);
      expect(uniqueNew).toHaveLength(20);
    });

    it('should handle cache with complete data (hasMore=false)', () => {
      // If cache says hasMore=false, no need to fetch from Firebase
      const cachedBooks = Array.from({ length: 15 }, (_, i) => ({
        id: `book-${i + 1}`,
        title: `Book ${i + 1}`
      }));
      const cacheHasMore = false;

      // Should skip Firebase fetch
      const shouldFetch = cacheHasMore;

      expect(shouldFetch).toBe(false);
    });
  });
});

describe('pagination and infinite scroll', () => {
  const BOOKS_PER_PAGE = 20;

  // Generate test books
  function generateBooks(count) {
    return Array.from({ length: count }, (_, i) => ({
      id: `book-${i + 1}`,
      title: `Book ${i + 1}`,
      author: `Author ${i + 1}`,
      createdAt: Date.now() - i * 1000 // Decreasing timestamps for proper order
    }));
  }

  // Simulate renderBooks visibility logic
  function getVisibleBooks(allBooks, displayLimit) {
    return allBooks.slice(0, displayLimit);
  }

  // Simulate hasMoreToDisplay logic
  function hasMoreToDisplay(filteredLength, displayLimit, hasMoreFromFirebase) {
    return filteredLength > displayLimit || hasMoreFromFirebase;
  }

  describe('initial load', () => {
    it('should show exactly BOOKS_PER_PAGE (20) books on initial load', () => {
      const allBooks = generateBooks(50);
      const displayLimit = BOOKS_PER_PAGE;

      const visible = getVisibleBooks(allBooks, displayLimit);

      expect(visible).toHaveLength(20);
      expect(visible[0].id).toBe('book-1');
      expect(visible[19].id).toBe('book-20');
    });

    it('should show all books if total is less than BOOKS_PER_PAGE', () => {
      const allBooks = generateBooks(15);
      const displayLimit = BOOKS_PER_PAGE;

      const visible = getVisibleBooks(allBooks, displayLimit);

      expect(visible).toHaveLength(15);
    });

    it('should show loading sentinel when more books exist', () => {
      const allBooks = generateBooks(50);
      const displayLimit = BOOKS_PER_PAGE;
      const hasMoreFromFirebase = true;

      const showSentinel = hasMoreToDisplay(allBooks.length, displayLimit, hasMoreFromFirebase);

      expect(showSentinel).toBe(true);
    });

    it('should not show sentinel when all books are displayed and no more to fetch', () => {
      const allBooks = generateBooks(15);
      const displayLimit = BOOKS_PER_PAGE;
      const hasMoreFromFirebase = false;

      const showSentinel = hasMoreToDisplay(allBooks.length, displayLimit, hasMoreFromFirebase);

      expect(showSentinel).toBe(false);
    });
  });

  describe('infinite scroll - load more', () => {
    it('should increase displayLimit by BOOKS_PER_PAGE when scrolling', () => {
      let displayLimit = BOOKS_PER_PAGE; // 20

      // First scroll
      displayLimit += BOOKS_PER_PAGE;
      expect(displayLimit).toBe(40);

      // Second scroll
      displayLimit += BOOKS_PER_PAGE;
      expect(displayLimit).toBe(60);
    });

    it('should show next batch of books after scroll', () => {
      const allBooks = generateBooks(50);
      let displayLimit = BOOKS_PER_PAGE;

      // Initial view
      let visible = getVisibleBooks(allBooks, displayLimit);
      expect(visible).toHaveLength(20);

      // After first scroll
      displayLimit += BOOKS_PER_PAGE;
      visible = getVisibleBooks(allBooks, displayLimit);
      expect(visible).toHaveLength(40);
      expect(visible[39].id).toBe('book-40');

      // After second scroll
      displayLimit += BOOKS_PER_PAGE;
      visible = getVisibleBooks(allBooks, displayLimit);
      expect(visible).toHaveLength(50); // Only 50 books exist
    });

    it('should show sentinel while there are more books to display locally', () => {
      const allBooks = generateBooks(50);
      let displayLimit = BOOKS_PER_PAGE;
      const hasMoreFromFirebase = false; // All books already loaded

      // After initial load - more to display locally
      let showSentinel = hasMoreToDisplay(allBooks.length, displayLimit, hasMoreFromFirebase);
      expect(showSentinel).toBe(true); // 50 > 20

      // After first scroll
      displayLimit += BOOKS_PER_PAGE; // 40
      showSentinel = hasMoreToDisplay(allBooks.length, displayLimit, hasMoreFromFirebase);
      expect(showSentinel).toBe(true); // 50 > 40

      // After second scroll
      displayLimit += BOOKS_PER_PAGE; // 60
      showSentinel = hasMoreToDisplay(allBooks.length, displayLimit, hasMoreFromFirebase);
      expect(showSentinel).toBe(false); // 50 <= 60
    });

    it('should keep sentinel while there might be more from Firebase', () => {
      const allBooks = generateBooks(20);
      const displayLimit = BOOKS_PER_PAGE;
      const hasMoreFromFirebase = true;

      const showSentinel = hasMoreToDisplay(allBooks.length, displayLimit, hasMoreFromFirebase);

      expect(showSentinel).toBe(true); // hasMoreFromFirebase is true
    });
  });

  describe('pagination with filters', () => {
    it('should apply displayLimit to filtered results', () => {
      const allBooks = generateBooks(50).map((book, i) => ({
        ...book,
        rating: (i % 5) + 1 // Ratings 1-5 cycling
      }));

      // Filter to 5-star books only
      const filtered = filterByRating(allBooks, 5);
      expect(filtered.length).toBe(10); // Every 5th book has rating 5

      // Apply displayLimit
      const displayLimit = BOOKS_PER_PAGE;
      const visible = getVisibleBooks(filtered, displayLimit);

      expect(visible).toHaveLength(10); // All 10 five-star books visible
    });

    it('should paginate filtered results correctly', () => {
      const allBooks = generateBooks(100).map((book, i) => ({
        ...book,
        rating: i < 50 ? 5 : 3 // First 50 are 5-star
      }));

      // Filter to 5-star books only
      const filtered = filterByRating(allBooks, 5);
      expect(filtered.length).toBe(50);

      // Initial display
      let displayLimit = BOOKS_PER_PAGE;
      let visible = getVisibleBooks(filtered, displayLimit);
      expect(visible).toHaveLength(20);

      // After scroll
      displayLimit += BOOKS_PER_PAGE;
      visible = getVisibleBooks(filtered, displayLimit);
      expect(visible).toHaveLength(40);

      // After another scroll
      displayLimit += BOOKS_PER_PAGE;
      visible = getVisibleBooks(filtered, displayLimit);
      expect(visible).toHaveLength(50);
    });
  });

  describe('pagination with sorting', () => {
    it('should paginate sorted results correctly', () => {
      // Books with random order titles
      const allBooks = [
        { id: '1', title: 'Zebra', createdAt: 1000 },
        { id: '2', title: 'Apple', createdAt: 2000 },
        { id: '3', title: 'Mango', createdAt: 3000 },
        { id: '4', title: 'Banana', createdAt: 4000 },
        { id: '5', title: 'Orange', createdAt: 5000 }
      ];

      // Sort by title ascending
      const sorted = sortBooks(allBooks, 'title-asc');

      // Display first 3 (simulating small page size)
      const visible = sorted.slice(0, 3);

      expect(visible[0].title).toBe('Apple');
      expect(visible[1].title).toBe('Banana');
      expect(visible[2].title).toBe('Mango');
    });
  });
});
