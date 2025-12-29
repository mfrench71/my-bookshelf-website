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
  restoreSeries: vi.fn()
}));

vi.mock('../src/js/utils/cache.js', () => ({
  clearBooksCache: vi.fn()
}));

vi.mock('../src/js/utils/image-upload.js', () => ({
  deleteImages: vi.fn()
}));

import {
  BIN_RETENTION_DAYS,
  getDaysRemaining,
  filterActivebooks,
  filterBinnedBooks
} from '../src/js/bin.js';

describe('Bin Module', () => {
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

    it('should return correct days remaining', () => {
      const tenDaysAgo = Date.now() - (10 * 24 * 60 * 60 * 1000);
      expect(getDaysRemaining(tenDaysAgo)).toBe(20);
    });

    it('should return 0 for expired books', () => {
      const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
      expect(getDaysRemaining(thirtyOneDaysAgo)).toBe(0);
    });

    it('should return 0 for exactly expired books', () => {
      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
      expect(getDaysRemaining(thirtyDaysAgo)).toBe(0);
    });

    it('should return 30 for just-deleted books', () => {
      const justNow = Date.now();
      expect(getDaysRemaining(justNow)).toBe(30);
    });

    it('should return 1 for book deleted 29 days ago', () => {
      const twentyNineDaysAgo = Date.now() - (29 * 24 * 60 * 60 * 1000);
      expect(getDaysRemaining(twentyNineDaysAgo)).toBe(1);
    });
  });

  describe('filterActivebooks', () => {
    it('should filter out books with deletedAt', () => {
      const books = [
        { id: '1', title: 'Active', deletedAt: null },
        { id: '2', title: 'Deleted', deletedAt: Date.now() },
        { id: '3', title: 'Also Active' }
      ];

      const result = filterActivebooks(books);
      expect(result).toHaveLength(2);
      expect(result.map(b => b.title)).toEqual(['Active', 'Also Active']);
    });

    it('should return all books when none are deleted', () => {
      const books = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];

      const result = filterActivebooks(books);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when all books are deleted', () => {
      const books = [
        { id: '1', title: 'Deleted 1', deletedAt: Date.now() },
        { id: '2', title: 'Deleted 2', deletedAt: Date.now() }
      ];

      const result = filterActivebooks(books);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty input', () => {
      expect(filterActivebooks([])).toEqual([]);
    });
  });

  describe('filterBinnedBooks', () => {
    it('should return only books with deletedAt', () => {
      const books = [
        { id: '1', title: 'Active', deletedAt: null },
        { id: '2', title: 'Deleted', deletedAt: Date.now() },
        { id: '3', title: 'Also Active' }
      ];

      const result = filterBinnedBooks(books);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Deleted');
    });

    it('should return empty array when no books are deleted', () => {
      const books = [
        { id: '1', title: 'Book 1' },
        { id: '2', title: 'Book 2' }
      ];

      const result = filterBinnedBooks(books);
      expect(result).toHaveLength(0);
    });

    it('should return all books when all are deleted', () => {
      const books = [
        { id: '1', title: 'Deleted 1', deletedAt: Date.now() },
        { id: '2', title: 'Deleted 2', deletedAt: Date.now() }
      ];

      const result = filterBinnedBooks(books);
      expect(result).toHaveLength(2);
    });

    it('should return empty array for empty input', () => {
      expect(filterBinnedBooks([])).toEqual([]);
    });

    it('should correctly filter by deletedAt truthiness', () => {
      const books = [
        { id: '1', deletedAt: 0 }, // Falsy but technically deleted at epoch
        { id: '2', deletedAt: 1 }, // Truthy - deleted
        { id: '3', deletedAt: false }, // Falsy - not deleted
        { id: '4', deletedAt: null } // Null - not deleted
      ];

      const result = filterBinnedBooks(books);
      // Only books with truthy deletedAt
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });
});
