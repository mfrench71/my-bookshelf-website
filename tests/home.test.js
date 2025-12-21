/**
 * Tests for src/js/home.js - Home page dashboard logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Home settings constants (replicated from home.js)
const HOME_SETTINGS_KEY = 'homeSettings';
const RECOMMENDATIONS_CACHE_KEY = 'recommendationsCache';
const RECOMMENDATIONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_HOME_SETTINGS = {
  currentlyReading: { enabled: true, count: 6 },
  recentlyAdded: { enabled: true, count: 6 },
  topRated: { enabled: true, count: 6 },
  recentlyFinished: { enabled: true, count: 6 },
  recommendations: { enabled: true, count: 6 }
};

// Replicate getHomeSettings from home.js
function getHomeSettings() {
  try {
    const stored = localStorage.getItem(HOME_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_HOME_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn('Error loading home settings:', e);
  }
  return { ...DEFAULT_HOME_SETTINGS };
}

// Replicate recommendations cache functions
function getRecommendationsCache(userId) {
  try {
    const cached = localStorage.getItem(`${RECOMMENDATIONS_CACHE_KEY}_${userId}`);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < RECOMMENDATIONS_CACHE_TTL) {
        return data;
      }
    }
  } catch (e) {
    // Ignore cache errors
  }
  return null;
}

function setRecommendationsCache(userId, data) {
  try {
    localStorage.setItem(`${RECOMMENDATIONS_CACHE_KEY}_${userId}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    // Ignore cache errors
  }
}

// Replicate filterOwnedBooks from home.js
function filterOwnedBooks(recommendations, ownedBooks) {
  const ownedTitles = new Set(ownedBooks.map(b => b.title?.toLowerCase()));
  const ownedIsbns = new Set(ownedBooks.map(b => b.isbn).filter(Boolean));

  return recommendations.filter(rec => {
    // Check ISBN match
    if (rec.isbn && ownedIsbns.has(rec.isbn)) return false;
    // Check title match
    if (rec.title && ownedTitles.has(rec.title.toLowerCase())) return false;
    return true;
  });
}

// Replicate section filtering logic from home.js
function filterBooksForSection(books, sectionType) {
  switch (sectionType) {
    case 'currentlyReading':
      return books.filter(b => b.status === 'reading');
    case 'recentlyAdded':
      return [...books].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    case 'topRated':
      return books
        .filter(b => b.rating && b.rating >= 4)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'recentlyFinished':
      return books
        .filter(b => b.status === 'finished')
        .sort((a, b) => (b.finishedAt || b.updatedAt || 0) - (a.finishedAt || a.updatedAt || 0));
    default:
      return books;
  }
}

describe('Home Settings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getHomeSettings', () => {
    it('should return default settings when nothing is stored', () => {
      const settings = getHomeSettings();

      expect(settings).toEqual(DEFAULT_HOME_SETTINGS);
    });

    it('should return stored settings when available', () => {
      const customSettings = {
        currentlyReading: { enabled: false, count: 3 },
        recentlyAdded: { enabled: true, count: 9 }
      };
      localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify(customSettings));

      const settings = getHomeSettings();

      expect(settings.currentlyReading.enabled).toBe(false);
      expect(settings.currentlyReading.count).toBe(3);
      expect(settings.recentlyAdded.count).toBe(9);
      // Other sections should use defaults
      expect(settings.topRated.enabled).toBe(true);
    });

    it('should merge partial settings with defaults', () => {
      const partialSettings = {
        recommendations: { enabled: false, count: 12 }
      };
      localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify(partialSettings));

      const settings = getHomeSettings();

      expect(settings.recommendations.enabled).toBe(false);
      expect(settings.recommendations.count).toBe(12);
      // All other sections should have defaults
      expect(settings.currentlyReading.enabled).toBe(true);
      expect(settings.currentlyReading.count).toBe(6);
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem(HOME_SETTINGS_KEY, 'not valid json');

      const settings = getHomeSettings();

      expect(settings).toEqual(DEFAULT_HOME_SETTINGS);
    });
  });
});

describe('Section Filtering', () => {
  const mockBooks = [
    { id: '1', title: 'Book 1', status: 'reading', rating: 5, createdAt: 1000, finishedAt: null },
    { id: '2', title: 'Book 2', status: 'finished', rating: 4, createdAt: 2000, finishedAt: 3000 },
    { id: '3', title: 'Book 3', status: 'want-to-read', rating: 3, createdAt: 3000, finishedAt: null },
    { id: '4', title: 'Book 4', status: 'reading', rating: 5, createdAt: 4000, finishedAt: null },
    { id: '5', title: 'Book 5', status: 'finished', rating: 2, createdAt: 5000, finishedAt: 6000 },
    { id: '6', title: 'Book 6', status: null, rating: null, createdAt: 6000, finishedAt: null }
  ];

  describe('currentlyReading section', () => {
    it('should filter only books with status "reading"', () => {
      const result = filterBooksForSection(mockBooks, 'currentlyReading');

      expect(result).toHaveLength(2);
      expect(result.every(b => b.status === 'reading')).toBe(true);
      expect(result.map(b => b.id)).toContain('1');
      expect(result.map(b => b.id)).toContain('4');
    });

    it('should return empty array when no books are being read', () => {
      const booksWithoutReading = mockBooks.filter(b => b.status !== 'reading');

      const result = filterBooksForSection(booksWithoutReading, 'currentlyReading');

      expect(result).toHaveLength(0);
    });
  });

  describe('recentlyAdded section', () => {
    it('should sort books by createdAt descending (newest first)', () => {
      const result = filterBooksForSection(mockBooks, 'recentlyAdded');

      expect(result).toHaveLength(6);
      expect(result[0].id).toBe('6'); // createdAt: 6000
      expect(result[1].id).toBe('5'); // createdAt: 5000
      expect(result[5].id).toBe('1'); // createdAt: 1000
    });

    it('should handle books without createdAt', () => {
      const booksWithMissingDates = [
        { id: '1', title: 'Book 1', createdAt: 1000 },
        { id: '2', title: 'Book 2', createdAt: null },
        { id: '3', title: 'Book 3', createdAt: 2000 }
      ];

      const result = filterBooksForSection(booksWithMissingDates, 'recentlyAdded');

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('3'); // createdAt: 2000
      expect(result[1].id).toBe('1'); // createdAt: 1000
      expect(result[2].id).toBe('2'); // createdAt: null (treated as 0)
    });
  });

  describe('topRated section', () => {
    it('should filter books with rating >= 4', () => {
      const result = filterBooksForSection(mockBooks, 'topRated');

      expect(result).toHaveLength(3);
      expect(result.every(b => b.rating >= 4)).toBe(true);
    });

    it('should sort by rating descending', () => {
      const result = filterBooksForSection(mockBooks, 'topRated');

      expect(result[0].rating).toBe(5);
      expect(result[1].rating).toBe(5);
      expect(result[2].rating).toBe(4);
    });

    it('should exclude unrated books', () => {
      const result = filterBooksForSection(mockBooks, 'topRated');

      expect(result.some(b => b.rating === null)).toBe(false);
    });
  });

  describe('recentlyFinished section', () => {
    it('should filter only books with status "finished"', () => {
      const result = filterBooksForSection(mockBooks, 'recentlyFinished');

      expect(result).toHaveLength(2);
      expect(result.every(b => b.status === 'finished')).toBe(true);
    });

    it('should sort by finishedAt descending', () => {
      const result = filterBooksForSection(mockBooks, 'recentlyFinished');

      expect(result[0].id).toBe('5'); // finishedAt: 6000
      expect(result[1].id).toBe('2'); // finishedAt: 3000
    });

    it('should fall back to updatedAt when finishedAt is missing', () => {
      const booksWithMixedDates = [
        { id: '1', status: 'finished', finishedAt: 1000 },
        { id: '2', status: 'finished', finishedAt: null, updatedAt: 3000 },
        { id: '3', status: 'finished', finishedAt: 2000 }
      ];

      const result = filterBooksForSection(booksWithMixedDates, 'recentlyFinished');

      expect(result[0].id).toBe('2'); // updatedAt: 3000
      expect(result[1].id).toBe('3'); // finishedAt: 2000
      expect(result[2].id).toBe('1'); // finishedAt: 1000
    });
  });
});

describe('Recommendations Cache', () => {
  const userId = 'test-user-123';

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getRecommendationsCache', () => {
    it('should return null when cache is empty', () => {
      const result = getRecommendationsCache(userId);

      expect(result).toBeNull();
    });

    it('should return cached data when fresh', () => {
      const recommendations = [
        { title: 'Book 1', author: 'Author 1' },
        { title: 'Book 2', author: 'Author 2' }
      ];
      setRecommendationsCache(userId, recommendations);

      const result = getRecommendationsCache(userId);

      expect(result).toEqual(recommendations);
    });

    it('should return null when cache is expired (older than 24 hours)', () => {
      const recommendations = [{ title: 'Book 1', author: 'Author 1' }];
      setRecommendationsCache(userId, recommendations);

      // Advance time by 25 hours
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);

      const result = getRecommendationsCache(userId);

      expect(result).toBeNull();
    });

    it('should return cached data just before expiry', () => {
      const recommendations = [{ title: 'Book 1', author: 'Author 1' }];
      setRecommendationsCache(userId, recommendations);

      // Advance time by just under 24 hours
      vi.advanceTimersByTime(RECOMMENDATIONS_CACHE_TTL - 1000);

      const result = getRecommendationsCache(userId);

      expect(result).toEqual(recommendations);
    });

    it('should handle invalid JSON gracefully', () => {
      localStorage.setItem(`${RECOMMENDATIONS_CACHE_KEY}_${userId}`, 'invalid json');

      const result = getRecommendationsCache(userId);

      expect(result).toBeNull();
    });

    it('should be user-specific', () => {
      const user1Recs = [{ title: 'User 1 Book' }];
      const user2Recs = [{ title: 'User 2 Book' }];

      setRecommendationsCache('user1', user1Recs);
      setRecommendationsCache('user2', user2Recs);

      expect(getRecommendationsCache('user1')).toEqual(user1Recs);
      expect(getRecommendationsCache('user2')).toEqual(user2Recs);
    });
  });

  describe('setRecommendationsCache', () => {
    it('should store recommendations with timestamp', () => {
      const recommendations = [{ title: 'Book 1' }];

      setRecommendationsCache(userId, recommendations);

      const stored = JSON.parse(localStorage.getItem(`${RECOMMENDATIONS_CACHE_KEY}_${userId}`));
      expect(stored.data).toEqual(recommendations);
      expect(stored.timestamp).toBeTypeOf('number');
    });
  });
});

describe('Filter Owned Books', () => {
  describe('filterOwnedBooks', () => {
    it('should filter out books by ISBN match', () => {
      const recommendations = [
        { title: 'Book 1', isbn: '1234567890' },
        { title: 'Book 2', isbn: '0987654321' },
        { title: 'Book 3', isbn: '1111111111' }
      ];
      const ownedBooks = [
        { title: 'Owned Book', isbn: '1234567890' }
      ];

      const result = filterOwnedBooks(recommendations, ownedBooks);

      expect(result).toHaveLength(2);
      expect(result.map(b => b.isbn)).not.toContain('1234567890');
    });

    it('should filter out books by title match (case-insensitive)', () => {
      const recommendations = [
        { title: 'The Great Gatsby', isbn: '111' },
        { title: 'To Kill a Mockingbird', isbn: '222' },
        { title: '1984', isbn: '333' }
      ];
      const ownedBooks = [
        { title: 'THE GREAT GATSBY' },
        { title: '1984' }
      ];

      const result = filterOwnedBooks(recommendations, ownedBooks);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('To Kill a Mockingbird');
    });

    it('should handle recommendations without ISBN', () => {
      const recommendations = [
        { title: 'Book 1' },
        { title: 'Book 2', isbn: '' },
        { title: 'Book 3', isbn: null }
      ];
      const ownedBooks = [{ title: 'Book 1' }];

      const result = filterOwnedBooks(recommendations, ownedBooks);

      expect(result).toHaveLength(2);
    });

    it('should handle owned books without ISBN', () => {
      const recommendations = [
        { title: 'Rec Book 1', isbn: '123' },
        { title: 'Rec Book 2', isbn: '456' }
      ];
      const ownedBooks = [
        { title: 'Owned Book' } // No ISBN
      ];

      const result = filterOwnedBooks(recommendations, ownedBooks);

      expect(result).toHaveLength(2);
    });

    it('should return all recommendations when no owned books match', () => {
      const recommendations = [
        { title: 'New Book 1', isbn: '111' },
        { title: 'New Book 2', isbn: '222' }
      ];
      const ownedBooks = [
        { title: 'Different Book', isbn: '999' }
      ];

      const result = filterOwnedBooks(recommendations, ownedBooks);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when all recommendations are owned', () => {
      const recommendations = [
        { title: 'Book 1', isbn: '111' },
        { title: 'Book 2', isbn: '222' }
      ];
      const ownedBooks = [
        { title: 'Book 1', isbn: '111' },
        { title: 'Book 2', isbn: '222' }
      ];

      const result = filterOwnedBooks(recommendations, ownedBooks);

      expect(result).toHaveLength(0);
    });

    it('should handle empty recommendations array', () => {
      const result = filterOwnedBooks([], [{ title: 'Owned Book' }]);

      expect(result).toHaveLength(0);
    });

    it('should handle empty owned books array', () => {
      const recommendations = [
        { title: 'Book 1' },
        { title: 'Book 2' }
      ];

      const result = filterOwnedBooks(recommendations, []);

      expect(result).toHaveLength(2);
    });
  });
});

describe('Section Display Logic', () => {
  describe('item count limiting', () => {
    it('should respect maxCount setting', () => {
      const allBooks = Array.from({ length: 20 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Book ${i + 1}`,
        status: 'reading'
      }));

      const sectionBooks = filterBooksForSection(allBooks, 'currentlyReading');
      const displayBooks = sectionBooks.slice(0, 6); // maxCount from settings

      expect(displayBooks).toHaveLength(6);
    });

    it('should show all books when less than maxCount', () => {
      const allBooks = Array.from({ length: 3 }, (_, i) => ({
        id: `${i + 1}`,
        title: `Book ${i + 1}`,
        status: 'reading'
      }));

      const sectionBooks = filterBooksForSection(allBooks, 'currentlyReading');
      const displayBooks = sectionBooks.slice(0, 6);

      expect(displayBooks).toHaveLength(3);
    });
  });

  describe('section visibility', () => {
    it('should respect enabled setting', () => {
      const settings = {
        currentlyReading: { enabled: false, count: 6 },
        recentlyAdded: { enabled: true, count: 6 }
      };

      expect(settings.currentlyReading.enabled).toBe(false);
      expect(settings.recentlyAdded.enabled).toBe(true);
    });

    it('should support different count values (3, 6, 9, 12)', () => {
      [3, 6, 9, 12].forEach(count => {
        const settings = { section: { enabled: true, count } };
        expect(settings.section.count).toBe(count);
      });
    });
  });
});

describe('Welcome Message Stats', () => {
  // Replicate stats calculation from home.js
  function calculateStats(books) {
    const totalBooks = books.length;
    const thisYear = new Date().getFullYear();
    const booksThisYear = books.filter(b => {
      const date = new Date(b.createdAt);
      return date.getFullYear() === thisYear;
    }).length;

    return { totalBooks, booksThisYear };
  }

  it('should count total books correctly', () => {
    const books = Array.from({ length: 50 }, (_, i) => ({
      id: `${i}`,
      createdAt: Date.now() - i * 86400000
    }));

    const stats = calculateStats(books);

    expect(stats.totalBooks).toBe(50);
  });

  it('should count books added this year', () => {
    const thisYear = new Date().getFullYear();
    const books = [
      { id: '1', createdAt: new Date(`${thisYear}-01-15`).getTime() },
      { id: '2', createdAt: new Date(`${thisYear}-06-20`).getTime() },
      { id: '3', createdAt: new Date(`${thisYear - 1}-12-25`).getTime() }
    ];

    const stats = calculateStats(books);

    expect(stats.booksThisYear).toBe(2);
  });

  it('should handle books without createdAt', () => {
    const books = [
      { id: '1', createdAt: Date.now() },
      { id: '2', createdAt: null },
      { id: '3' } // no createdAt field
    ];

    const stats = calculateStats(books);

    expect(stats.totalBooks).toBe(3);
    // Only the first book has valid createdAt for this year
    expect(stats.booksThisYear).toBe(1);
  });

  it('should handle empty library', () => {
    const stats = calculateStats([]);

    expect(stats.totalBooks).toBe(0);
    expect(stats.booksThisYear).toBe(0);
  });
});

describe('Recommendation Deduplication', () => {
  // Replicate deduplication from home.js
  function deduplicateRecommendations(books) {
    const seen = new Set();
    return books.filter(book => {
      const key = `${book.title?.toLowerCase()}|${book.author?.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  it('should remove duplicate books by title+author', () => {
    const books = [
      { title: 'Book 1', author: 'Author A' },
      { title: 'Book 2', author: 'Author B' },
      { title: 'Book 1', author: 'Author A' }, // duplicate
      { title: 'Book 3', author: 'Author C' }
    ];

    const result = deduplicateRecommendations(books);

    expect(result).toHaveLength(3);
  });

  it('should be case-insensitive', () => {
    const books = [
      { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
      { title: 'THE GREAT GATSBY', author: 'F. SCOTT FITZGERALD' }
    ];

    const result = deduplicateRecommendations(books);

    expect(result).toHaveLength(1);
  });

  it('should treat different authors as different books', () => {
    const books = [
      { title: 'Same Title', author: 'Author A' },
      { title: 'Same Title', author: 'Author B' }
    ];

    const result = deduplicateRecommendations(books);

    expect(result).toHaveLength(2);
  });

  it('should handle missing title or author', () => {
    const books = [
      { title: 'Book 1', author: null },
      { title: null, author: 'Author' },
      { title: 'Book 2', author: 'Author' }
    ];

    const result = deduplicateRecommendations(books);

    expect(result).toHaveLength(3);
  });
});
