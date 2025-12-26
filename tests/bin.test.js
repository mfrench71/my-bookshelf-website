import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BIN_RETENTION_DAYS,
  softDeleteBook,
  restoreBook,
  permanentlyDeleteBook,
  emptyBin,
  purgeExpiredBooks,
  getDaysRemaining,
  filterActivebooks,
  filterBinnedBooks
} from '../src/js/bin.js';

// Mock Firebase
vi.mock('../src/js/firebase-config.js', () => ({
  db: {}
}));

// Mock genres module
const mockUpdateGenreBookCounts = vi.fn();
const mockLoadUserGenres = vi.fn();
const mockClearGenresCache = vi.fn();

vi.mock('/js/genres.js', () => ({
  updateGenreBookCounts: (...args) => mockUpdateGenreBookCounts(...args),
  loadUserGenres: (...args) => mockLoadUserGenres(...args),
  clearGenresCache: () => mockClearGenresCache()
}));

// Mock series module
const mockLoadUserSeries = vi.fn();
const mockClearSeriesCache = vi.fn();

vi.mock('/js/series.js', () => ({
  loadUserSeries: (...args) => mockLoadUserSeries(...args),
  clearSeriesCache: () => mockClearSeriesCache()
}));

// Mock cache module
const mockClearBooksCache = vi.fn();

vi.mock('/js/utils/cache.js', () => ({
  clearBooksCache: (...args) => mockClearBooksCache(...args)
}));

// Mock Firestore functions
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockWriteBatch = vi.fn();

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  doc: vi.fn(() => ({})),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  writeBatch: () => mockWriteBatch(),
  serverTimestamp: vi.fn(() => 'timestamp')
}));

describe('BIN_RETENTION_DAYS', () => {
  it('should be 30 days', () => {
    expect(BIN_RETENTION_DAYS).toBe(30);
  });
});

describe('getDaysRemaining', () => {
  it('should return full retention period for null deletedAt', () => {
    expect(getDaysRemaining(null)).toBe(30);
  });

  it('should return full retention period for undefined deletedAt', () => {
    expect(getDaysRemaining(undefined)).toBe(30);
  });

  it('should return correct days for recently deleted book', () => {
    const now = Date.now();
    const fiveDaysAgo = now - (5 * 24 * 60 * 60 * 1000);
    expect(getDaysRemaining(fiveDaysAgo)).toBe(25);
  });

  it('should return 0 for expired books', () => {
    const now = Date.now();
    const thirtyOneDaysAgo = now - (31 * 24 * 60 * 60 * 1000);
    expect(getDaysRemaining(thirtyOneDaysAgo)).toBe(0);
  });

  it('should return 0 for exactly 30 days old', () => {
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    expect(getDaysRemaining(thirtyDaysAgo)).toBe(0);
  });

  it('should return 1 for 29 days old', () => {
    const now = Date.now();
    const twentyNineDaysAgo = now - (29 * 24 * 60 * 60 * 1000);
    expect(getDaysRemaining(twentyNineDaysAgo)).toBe(1);
  });

  it('should never return negative values', () => {
    const now = Date.now();
    const hundredDaysAgo = now - (100 * 24 * 60 * 60 * 1000);
    expect(getDaysRemaining(hundredDaysAgo)).toBe(0);
  });
});

describe('filterActivebooks', () => {
  it('should return empty array for empty input', () => {
    expect(filterActivebooks([])).toEqual([]);
  });

  it('should return all books when none are deleted', () => {
    const books = [
      { id: '1', title: 'Book 1', deletedAt: null },
      { id: '2', title: 'Book 2', deletedAt: null },
      { id: '3', title: 'Book 3' } // no deletedAt field
    ];
    expect(filterActivebooks(books)).toHaveLength(3);
  });

  it('should filter out deleted books', () => {
    const books = [
      { id: '1', title: 'Book 1', deletedAt: null },
      { id: '2', title: 'Book 2', deletedAt: Date.now() },
      { id: '3', title: 'Book 3' }
    ];
    const result = filterActivebooks(books);
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toEqual(['1', '3']);
  });

  it('should return empty when all books are deleted', () => {
    const books = [
      { id: '1', title: 'Book 1', deletedAt: Date.now() },
      { id: '2', title: 'Book 2', deletedAt: Date.now() }
    ];
    expect(filterActivebooks(books)).toHaveLength(0);
  });
});

describe('filterBinnedBooks', () => {
  it('should return empty array for empty input', () => {
    expect(filterBinnedBooks([])).toEqual([]);
  });

  it('should return empty when no books are deleted', () => {
    const books = [
      { id: '1', title: 'Book 1', deletedAt: null },
      { id: '2', title: 'Book 2' }
    ];
    expect(filterBinnedBooks(books)).toHaveLength(0);
  });

  it('should return only deleted books', () => {
    const now = Date.now();
    const books = [
      { id: '1', title: 'Book 1', deletedAt: null },
      { id: '2', title: 'Book 2', deletedAt: now },
      { id: '3', title: 'Book 3', deletedAt: now - 1000 }
    ];
    const result = filterBinnedBooks(books);
    expect(result).toHaveLength(2);
    expect(result.map(b => b.id)).toEqual(['2', '3']);
  });

  it('should return all books when all are deleted', () => {
    const books = [
      { id: '1', title: 'Book 1', deletedAt: Date.now() },
      { id: '2', title: 'Book 2', deletedAt: Date.now() }
    ];
    expect(filterBinnedBooks(books)).toHaveLength(2);
  });
});

describe('softDeleteBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue();
    mockUpdateGenreBookCounts.mockResolvedValue();
    mockLoadUserSeries.mockResolvedValue([]);
  });

  it('should set deletedAt timestamp', async () => {
    const book = { id: 'book1', title: 'Test', genres: [] };
    await softDeleteBook('user123', 'book1', book);

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateCall = mockUpdateDoc.mock.calls[0][1];
    expect(updateCall.deletedAt).toBeGreaterThan(0);
    expect(updateCall.updatedAt).toBe('timestamp');
  });

  it('should decrement genre book counts', async () => {
    const book = { id: 'book1', title: 'Test', genres: ['genre1', 'genre2'] };
    await softDeleteBook('user123', 'book1', book);

    expect(mockUpdateGenreBookCounts).toHaveBeenCalledWith('user123', [], ['genre1', 'genre2']);
  });

  it('should not update genre counts when book has no genres', async () => {
    const book = { id: 'book1', title: 'Test', genres: [] };
    await softDeleteBook('user123', 'book1', book);

    expect(mockUpdateGenreBookCounts).not.toHaveBeenCalled();
  });

  it('should not update genre counts when genres is undefined', async () => {
    const book = { id: 'book1', title: 'Test' };
    await softDeleteBook('user123', 'book1', book);

    expect(mockUpdateGenreBookCounts).not.toHaveBeenCalled();
  });

  it('should clear books cache', async () => {
    const book = { id: 'book1', title: 'Test', genres: [] };
    await softDeleteBook('user123', 'book1', book);

    expect(mockClearBooksCache).toHaveBeenCalledWith('user123');
  });

  it('should clear genres cache', async () => {
    const book = { id: 'book1', title: 'Test', genres: [] };
    await softDeleteBook('user123', 'book1', book);

    expect(mockClearGenresCache).toHaveBeenCalled();
  });

  it('should clear series cache when book has series', async () => {
    mockLoadUserSeries.mockResolvedValue([{ id: 'series1', name: 'My Series', bookCount: 5 }]);

    const book = { id: 'book1', title: 'Test', genres: [], seriesId: 'series1' };
    await softDeleteBook('user123', 'book1', book);

    expect(mockClearSeriesCache).toHaveBeenCalled();
  });

  it('should decrement series book count', async () => {
    mockLoadUserSeries.mockResolvedValue([{ id: 'series1', name: 'My Series', bookCount: 5 }]);

    const book = { id: 'book1', title: 'Test', genres: [], seriesId: 'series1' };
    await softDeleteBook('user123', 'book1', book);

    // updateDoc called twice: once for book's deletedAt, once for series bookCount
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('should not decrement series count when series does not exist', async () => {
    mockLoadUserSeries.mockResolvedValue([]);

    const book = { id: 'book1', title: 'Test', genres: [], seriesId: 'nonexistent' };
    await softDeleteBook('user123', 'book1', book);

    // updateDoc called once for book's deletedAt only
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('should not clear series cache when book has no series', async () => {
    const book = { id: 'book1', title: 'Test', genres: [] };
    await softDeleteBook('user123', 'book1', book);

    expect(mockClearSeriesCache).not.toHaveBeenCalled();
  });
});

describe('restoreBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue();
    mockUpdateGenreBookCounts.mockResolvedValue();
    mockLoadUserGenres.mockResolvedValue([]);
    mockLoadUserSeries.mockResolvedValue([]);
  });

  it('should clear deletedAt timestamp', async () => {
    const book = { id: 'book1', title: 'Test', genres: [], deletedAt: Date.now() };
    await restoreBook('user123', 'book1', book);

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    const updateCall = mockUpdateDoc.mock.calls[0][1];
    expect(updateCall.deletedAt).toBeNull();
    expect(updateCall.updatedAt).toBe('timestamp');
  });

  it('should re-increment genre book counts for valid genres', async () => {
    mockLoadUserGenres.mockResolvedValue([
      { id: 'genre1', name: 'Fiction' },
      { id: 'genre2', name: 'Mystery' }
    ]);

    const book = { id: 'book1', title: 'Test', genres: ['genre1', 'genre2'], deletedAt: Date.now() };
    await restoreBook('user123', 'book1', book);

    expect(mockUpdateGenreBookCounts).toHaveBeenCalledWith('user123', ['genre1', 'genre2'], []);
  });

  it('should remove orphan genre IDs and return warning', async () => {
    mockLoadUserGenres.mockResolvedValue([
      { id: 'genre1', name: 'Fiction' }
      // genre2 no longer exists
    ]);

    const book = { id: 'book1', title: 'Test', genres: ['genre1', 'genre2'], deletedAt: Date.now() };
    const result = await restoreBook('user123', 'book1', book);

    // Should update book with only valid genres
    const updateCall = mockUpdateDoc.mock.calls[0][1];
    expect(updateCall.genres).toEqual(['genre1']);

    // Should only increment count for valid genre
    expect(mockUpdateGenreBookCounts).toHaveBeenCalledWith('user123', ['genre1'], []);

    // Should return warning
    expect(result.warnings).toContain('1 genre no longer exists');
  });

  it('should handle multiple orphan genres with plural message', async () => {
    mockLoadUserGenres.mockResolvedValue([]);

    const book = { id: 'book1', title: 'Test', genres: ['genre1', 'genre2', 'genre3'], deletedAt: Date.now() };
    const result = await restoreBook('user123', 'book1', book);

    expect(result.warnings).toContain('3 genres no longer exist');
  });

  it('should clear orphan series reference and return warning', async () => {
    mockLoadUserSeries.mockResolvedValue([
      { id: 'otherSeries', name: 'Other Series' }
      // 'series1' no longer exists
    ]);

    const book = {
      id: 'book1',
      title: 'Test',
      genres: [],
      seriesId: 'series1',
      seriesPosition: 2,
      deletedAt: Date.now()
    };
    const result = await restoreBook('user123', 'book1', book);

    const updateCall = mockUpdateDoc.mock.calls[0][1];
    expect(updateCall.seriesId).toBeNull();
    expect(updateCall.seriesPosition).toBeNull();
    expect(result.warnings).toContain('Series no longer exists');
  });

  it('should not clear series reference if series still exists', async () => {
    mockLoadUserSeries.mockResolvedValue([
      { id: 'series1', name: 'My Series', bookCount: 1 }
    ]);

    const book = {
      id: 'book1',
      title: 'Test',
      genres: [],
      seriesId: 'series1',
      seriesPosition: 2,
      deletedAt: Date.now()
    };
    const result = await restoreBook('user123', 'book1', book);

    const updateCall = mockUpdateDoc.mock.calls[0][1];
    expect(updateCall.seriesId).toBeUndefined();
    expect(updateCall.seriesPosition).toBeUndefined();
    expect(result.warnings).not.toContain('Series no longer exists');
  });

  it('should return empty warnings when all references are valid', async () => {
    mockLoadUserGenres.mockResolvedValue([{ id: 'genre1', name: 'Fiction' }]);
    mockLoadUserSeries.mockResolvedValue([{ id: 'series1', name: 'My Series', bookCount: 1 }]);

    const book = {
      id: 'book1',
      title: 'Test',
      genres: ['genre1'],
      seriesId: 'series1',
      deletedAt: Date.now()
    };
    const result = await restoreBook('user123', 'book1', book);

    expect(result.warnings).toHaveLength(0);
  });

  it('should re-increment series book count when series exists', async () => {
    mockLoadUserSeries.mockResolvedValue([{ id: 'series1', name: 'My Series', bookCount: 2 }]);

    const book = {
      id: 'book1',
      title: 'Test',
      genres: [],
      seriesId: 'series1',
      deletedAt: Date.now()
    };
    await restoreBook('user123', 'book1', book);

    // updateDoc called twice: once for book, once for series
    expect(mockUpdateDoc).toHaveBeenCalledTimes(2);
  });

  it('should not increment series count when series was deleted', async () => {
    mockLoadUserSeries.mockResolvedValue([]);

    const book = {
      id: 'book1',
      title: 'Test',
      genres: [],
      seriesId: 'orphanedSeries',
      deletedAt: Date.now()
    };
    await restoreBook('user123', 'book1', book);

    // updateDoc called once for book only (no series update)
    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
  });

  it('should clear all caches', async () => {
    const book = { id: 'book1', title: 'Test', genres: [], deletedAt: Date.now() };
    await restoreBook('user123', 'book1', book);

    expect(mockClearBooksCache).toHaveBeenCalledWith('user123');
    expect(mockClearGenresCache).toHaveBeenCalled();
    expect(mockClearSeriesCache).toHaveBeenCalled();
  });
});

describe('permanentlyDeleteBook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteDoc.mockResolvedValue();
  });

  it('should call deleteDoc', async () => {
    await permanentlyDeleteBook('user123', 'book1');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('should clear books cache', async () => {
    await permanentlyDeleteBook('user123', 'book1');

    expect(mockClearBooksCache).toHaveBeenCalledWith('user123');
  });
});

describe('emptyBin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 for empty bin', async () => {
    const result = await emptyBin('user123', []);
    expect(result).toBe(0);
  });

  it('should batch delete all books', async () => {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const books = [
      { id: 'book1', title: 'Book 1' },
      { id: 'book2', title: 'Book 2' },
      { id: 'book3', title: 'Book 3' }
    ];

    const result = await emptyBin('user123', books);

    expect(mockBatch.delete).toHaveBeenCalledTimes(3);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(result).toBe(3);
  });

  it('should clear books cache', async () => {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    await emptyBin('user123', [{ id: 'book1' }]);

    expect(mockClearBooksCache).toHaveBeenCalledWith('user123');
  });
});

describe('purgeExpiredBooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 when no books are expired', async () => {
    const now = Date.now();
    const books = [
      { id: 'book1', deletedAt: now - (5 * 24 * 60 * 60 * 1000) },  // 5 days ago
      { id: 'book2', deletedAt: now - (10 * 24 * 60 * 60 * 1000) }  // 10 days ago
    ];

    const result = await purgeExpiredBooks('user123', books);
    expect(result).toBe(0);
  });

  it('should delete books older than 30 days', async () => {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const now = Date.now();
    const books = [
      { id: 'book1', deletedAt: now - (5 * 24 * 60 * 60 * 1000) },   // 5 days - not expired
      { id: 'book2', deletedAt: now - (31 * 24 * 60 * 60 * 1000) },  // 31 days - expired
      { id: 'book3', deletedAt: now - (45 * 24 * 60 * 60 * 1000) }   // 45 days - expired
    ];

    const result = await purgeExpiredBooks('user123', books);

    expect(mockBatch.delete).toHaveBeenCalledTimes(2);
    expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    expect(result).toBe(2);
  });

  it('should not delete books at 30 days old', async () => {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const now = Date.now();
    // Use 29.99 days to avoid race condition with Date.now() in function
    const books = [
      { id: 'book1', deletedAt: now - (29.99 * 24 * 60 * 60 * 1000) }
    ];

    const result = await purgeExpiredBooks('user123', books);

    expect(result).toBe(0);
    expect(mockBatch.delete).not.toHaveBeenCalled();
  });

  it('should handle empty bin', async () => {
    const result = await purgeExpiredBooks('user123', []);
    expect(result).toBe(0);
  });

  it('should clear books cache after purging', async () => {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const now = Date.now();
    const books = [
      { id: 'book1', deletedAt: now - (31 * 24 * 60 * 60 * 1000) }
    ];

    await purgeExpiredBooks('user123', books);

    expect(mockClearBooksCache).toHaveBeenCalledWith('user123');
  });

  it('should skip books without deletedAt', async () => {
    const mockBatch = {
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue()
    };
    mockWriteBatch.mockReturnValue(mockBatch);

    const now = Date.now();
    const books = [
      { id: 'book1', deletedAt: null },
      { id: 'book2' },  // no deletedAt field
      { id: 'book3', deletedAt: now - (31 * 24 * 60 * 60 * 1000) }  // expired
    ];

    const result = await purgeExpiredBooks('user123', books);

    expect(mockBatch.delete).toHaveBeenCalledTimes(1);
    expect(result).toBe(1);
  });
});
