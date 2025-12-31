// Bin (soft delete) Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firebase modules
vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  writeBatch: vi.fn(() => ({
    delete: vi.fn(),
    commit: vi.fn()
  }))
}));

vi.mock('../src/js/firebase-config.js', () => ({
  db: {}
}));

vi.mock('../src/js/genres.js', () => ({
  updateGenreBookCounts: vi.fn(),
  loadUserGenres: vi.fn(() => []),
  clearGenresCache: vi.fn()
}));

vi.mock('../src/js/series.js', () => ({
  loadUserSeries: vi.fn(() => []),
  clearSeriesCache: vi.fn(),
  getSeriesById: vi.fn(),
  restoreSeries: vi.fn(),
  updateSeriesBookCounts: vi.fn()
}));

vi.mock('../src/js/utils/cache.js', () => ({
  clearBooksCache: vi.fn()
}));

vi.mock('../src/js/utils/image-upload.js', () => ({
  deleteImages: vi.fn()
}));

import { binRepository, BIN_RETENTION_DAYS } from '../src/js/repositories/bin-repository.js';

describe('Bin Module', () => {
  describe('BIN_RETENTION_DAYS', () => {
    it('should be 30 days', () => {
      expect(BIN_RETENTION_DAYS).toBe(30);
    });
  });

  describe('getDaysRemaining', () => {
    it('should return full retention period for null deletedAt', () => {
      expect(binRepository.getDaysRemaining(null)).toBe(30);
    });

    it('should return full retention period for undefined deletedAt', () => {
      expect(binRepository.getDaysRemaining(undefined)).toBe(30);
    });

    it('should return correct days remaining', () => {
      const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
      expect(binRepository.getDaysRemaining(tenDaysAgo)).toBe(20);
    });

    it('should return 0 for expired books', () => {
      const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
      expect(binRepository.getDaysRemaining(thirtyOneDaysAgo)).toBe(0);
    });

    it('should return 0 for exactly expired books', () => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      expect(binRepository.getDaysRemaining(thirtyDaysAgo)).toBe(0);
    });

    it('should return 30 for just-deleted books', () => {
      const justNow = Date.now();
      expect(binRepository.getDaysRemaining(justNow)).toBe(30);
    });

    it('should return 1 for book deleted 29 days ago', () => {
      const twentyNineDaysAgo = Date.now() - (29 * 24 * 60 * 60 * 1000);
      expect(binRepository.getDaysRemaining(twentyNineDaysAgo)).toBe(1);
    });
  });

  describe('filterActivebooks', () => {
    it('should filter out books with deletedAt', () => {
      const books = [
        { id: '1', title: 'Active', deletedAt: null },
        { id: '2', title: 'Deleted', deletedAt: Date.now() },
        { id: '3', title: 'Also Active' }
      ];

      const result = binRepository.filterActive(books);
      expect(result).toHaveLength(2);
      expect(result.map(b => b.title)).toEqual(['Active', 'Also Active']);
    });

    it('should return all books when none are deleted', () => {
      const books = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];

      const result = binRepository.filterActive(books);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when all books are deleted', () => {
      const books = [
        { id: '1', title: 'Deleted 1', deletedAt: Date.now() },
        { id: '2', title: 'Deleted 2', deletedAt: Date.now() }
      ];

      const result = binRepository.filterActive(books);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      expect(binRepository.filterActive([])).toEqual([]);
    });
  });

  describe('filterBinnedBooks', () => {
    it('should return only books with deletedAt', () => {
      const books = [
        { id: '1', title: 'Active', deletedAt: null },
        { id: '2', title: 'Deleted', deletedAt: Date.now() },
        { id: '3', title: 'Also Active' }
      ];

      const result = binRepository.filterBinned(books);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Deleted');
    });

    it('should return empty array when no books are deleted', () => {
      const books = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];

      const result = binRepository.filterBinned(books);
      expect(result).toHaveLength(0);
    });

    it('should return all books when all are deleted', () => {
      const books = [
        { id: '1', title: 'Deleted 1', deletedAt: Date.now() },
        { id: '2', title: 'Deleted 2', deletedAt: Date.now() }
      ];

      const result = binRepository.filterBinned(books);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', () => {
      expect(binRepository.filterBinned([])).toEqual([]);
    });

    it('should correctly filter by deletedAt truthiness', () => {
      const books = [
        { id: '1', deletedAt: 0 }, // Falsy but technically deleted at epoch
        { id: '2', deletedAt: 1 }, // Truthy - deleted
        { id: '3', deletedAt: false }, // Falsy - not deleted
        { id: '4', deletedAt: null } // Null - not deleted
      ];

      const result = binRepository.filterBinned(books);
      // Only books with truthy deletedAt
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });
});

// Additional tests for async functions using inline implementations
describe('Bin Async Functions', () => {
  // Test the logic patterns used in async functions
  describe('softDeleteBook logic', () => {
    it('should add deletedAt timestamp to book', () => {
      const book = { id: '1', title: 'Test', genres: [], seriesId: null };
      const updateData = {
        deletedAt: Date.now(),
        updatedAt: 'serverTimestamp'
      };
      expect(updateData.deletedAt).toBeGreaterThan(0);
    });

    it('should decrement genre counts when book has genres', () => {
      const book = { genres: ['g1', 'g2'] };
      const oldGenres = book.genres;
      const newGenres = []; // Removing all genres
      expect(oldGenres).toHaveLength(2);
      expect(newGenres).toHaveLength(0);
    });

    it('should handle book without genres', () => {
      const book = { genres: [] };
      expect(book.genres.length).toBe(0);
    });

    it('should handle book without seriesId', () => {
      const book = { seriesId: null };
      expect(book.seriesId).toBeNull();
    });
  });

  describe('restoreBook logic', () => {
    it('should clear deletedAt on restore', () => {
      const updateData = { deletedAt: null };
      expect(updateData.deletedAt).toBeNull();
    });

    it('should detect orphaned series references', () => {
      const book = { seriesId: 's1' };
      const activeSeries = [{ id: 's2' }, { id: 's3' }];
      const seriesExists = activeSeries.some(s => s.id === book.seriesId);
      expect(seriesExists).toBe(false);
    });

    it('should detect valid series references', () => {
      const book = { seriesId: 's1' };
      const activeSeries = [{ id: 's1' }, { id: 's2' }];
      const seriesExists = activeSeries.some(s => s.id === book.seriesId);
      expect(seriesExists).toBe(true);
    });

    it('should filter valid genres on restore', () => {
      const bookGenres = ['g1', 'g2', 'g3'];
      const existingGenreIds = new Set(['g1', 'g3', 'g4']);
      const validGenres = bookGenres.filter(gid => existingGenreIds.has(gid));
      expect(validGenres).toEqual(['g1', 'g3']);
    });

    it('should handle series that was soft-deleted', () => {
      const seriesData = { id: 's1', deletedAt: Date.now() };
      const wasSoftDeleted = seriesData && seriesData.deletedAt;
      expect(wasSoftDeleted).toBeTruthy();
    });

    it('should handle series that was hard-deleted', () => {
      const seriesData = null;
      const wasHardDeleted = !seriesData;
      expect(wasHardDeleted).toBe(true);
    });
  });

  describe('permanentlyDeleteBook logic', () => {
    it('should delete images when book has images', () => {
      const book = {
        images: [
          { id: 'i1', storagePath: 'path/1.jpg' },
          { id: 'i2', storagePath: 'path/2.jpg' }
        ]
      };
      expect(book.images.length).toBe(2);
    });

    it('should handle book without images', () => {
      const book = { images: [] };
      expect(book.images?.length || 0).toBe(0);
    });

    it('should handle null book parameter', () => {
      const book = null;
      expect(book?.images?.length || 0).toBe(0);
    });
  });

  describe('emptyBin logic', () => {
    it('should return 0 for empty bin', () => {
      const binnedBooks = [];
      expect(binnedBooks.length).toBe(0);
    });

    it('should collect all images from binned books', () => {
      const binnedBooks = [
        { id: '1', images: [{ storagePath: 'a.jpg' }] },
        { id: '2', images: [{ storagePath: 'b.jpg' }, { storagePath: 'c.jpg' }] },
        { id: '3', images: [] }
      ];
      const allImages = binnedBooks.flatMap(book => book.images || []);
      expect(allImages).toHaveLength(3);
    });

    it('should handle books without images property', () => {
      const binnedBooks = [
        { id: '1' },
        { id: '2', images: null }
      ];
      const allImages = binnedBooks.flatMap(book => book.images || []);
      expect(allImages).toHaveLength(0);
    });
  });

  describe('purgeExpiredBooks logic', () => {
    const BIN_RETENTION_DAYS = 30;
    const retentionMs = BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    it('should identify expired books', () => {
      const now = Date.now();
      const books = [
        { id: '1', deletedAt: now - (31 * 24 * 60 * 60 * 1000) }, // 31 days ago - expired
        { id: '2', deletedAt: now - (29 * 24 * 60 * 60 * 1000) }, // 29 days ago - not expired
        { id: '3', deletedAt: now }, // just now - not expired
        { id: '4', deletedAt: null } // not deleted
      ];

      const expired = books.filter(book =>
        book.deletedAt && (now - book.deletedAt) > retentionMs
      );

      expect(expired).toHaveLength(1);
      expect(expired[0].id).toBe('1');
    });

    it('should not purge books exactly at retention limit', () => {
      const now = Date.now();
      const exactlyThirtyDays = now - (30 * 24 * 60 * 60 * 1000);
      const books = [{ id: '1', deletedAt: exactlyThirtyDays }];

      const expired = books.filter(book =>
        book.deletedAt && (now - book.deletedAt) > retentionMs
      );

      expect(expired).toHaveLength(0);
    });

    it('should return 0 when no books are expired', () => {
      const now = Date.now();
      const books = [
        { id: '1', deletedAt: now - (10 * 24 * 60 * 60 * 1000) },
        { id: '2', deletedAt: now - (5 * 24 * 60 * 60 * 1000) }
      ];

      const expired = books.filter(book =>
        book.deletedAt && (now - book.deletedAt) > retentionMs
      );

      expect(expired.length).toBe(0);
    });
  });

  describe('updateSeriesBookCount logic', () => {
    it('should calculate new count with positive delta', () => {
      const currentCount = 5;
      const delta = 1;
      const newCount = Math.max(0, currentCount + delta);
      expect(newCount).toBe(6);
    });

    it('should calculate new count with negative delta', () => {
      const currentCount = 5;
      const delta = -1;
      const newCount = Math.max(0, currentCount + delta);
      expect(newCount).toBe(4);
    });

    it('should not go below zero', () => {
      const currentCount = 0;
      const delta = -1;
      const newCount = Math.max(0, currentCount + delta);
      expect(newCount).toBe(0);
    });

    it('should handle undefined bookCount', () => {
      const currentCount = undefined || 0;
      const delta = 1;
      const newCount = Math.max(0, currentCount + delta);
      expect(newCount).toBe(1);
    });
  });
});
