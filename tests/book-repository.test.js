import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn((db, ...path) => ({ path: path.join('/') })),
  doc: vi.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  limit: vi.fn(n => ({ type: 'limit', n })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('/js/firebase-config.js', () => ({
  db: { name: 'mock-db' },
}));

import { bookRepository, BookRepository } from '../src/js/repositories/book-repository.js';
import { getDocs, updateDoc, where, limit } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

describe('BookRepository', () => {
  const userId = 'user123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('singleton', () => {
    it('should export a singleton instance', () => {
      expect(bookRepository).toBeInstanceOf(BookRepository);
    });

    it('should have correct collection name', () => {
      expect(bookRepository.collectionName).toBe('books');
    });
  });

  describe('getByIsbn', () => {
    it('should return book when ISBN found', async () => {
      getDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'book1', data: () => ({ title: 'Test Book', isbn: '1234567890' }) }],
      });

      const result = await bookRepository.getByIsbn(userId, '1234567890');

      expect(where).toHaveBeenCalledWith('isbn', '==', '1234567890');
      expect(limit).toHaveBeenCalledWith(1);
      expect(result).toEqual({ id: 'book1', title: 'Test Book', isbn: '1234567890' });
    });

    it('should return null when ISBN not found', async () => {
      getDocs.mockResolvedValue({ empty: true, docs: [] });

      const result = await bookRepository.getByIsbn(userId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getBySeriesId', () => {
    it('should return all books in series', async () => {
      const mockDocs = [
        { id: 'book1', data: () => ({ title: 'Book 1', seriesId: 'series1', seriesPosition: 1 }) },
        { id: 'book2', data: () => ({ title: 'Book 2', seriesId: 'series1', seriesPosition: 2 }) },
      ];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await bookRepository.getBySeriesId(userId, 'series1');

      expect(where).toHaveBeenCalledWith('seriesId', '==', 'series1');
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Book 1');
      expect(result[1].title).toBe('Book 2');
    });

    it('should return empty array for series with no books', async () => {
      getDocs.mockResolvedValue({ docs: [] });

      const result = await bookRepository.getBySeriesId(userId, 'emptySeries');

      expect(result).toEqual([]);
    });
  });

  describe('isSeriesPositionTaken', () => {
    it('should return true when position is taken', async () => {
      getDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'book1' }],
      });

      const result = await bookRepository.isSeriesPositionTaken(userId, 'series1', 1);

      expect(where).toHaveBeenCalledWith('seriesId', '==', 'series1');
      expect(where).toHaveBeenCalledWith('seriesPosition', '==', 1);
      expect(result).toBe(true);
    });

    it('should return false when position is available', async () => {
      getDocs.mockResolvedValue({ empty: true, docs: [] });

      const result = await bookRepository.isSeriesPositionTaken(userId, 'series1', 5);

      expect(result).toBe(false);
    });

    it('should return false when position taken by excluded book', async () => {
      getDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'book1' }],
      });

      const result = await bookRepository.isSeriesPositionTaken(userId, 'series1', 1, 'book1');

      expect(result).toBe(false);
    });

    it('should return true when position taken by different book', async () => {
      getDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'book2' }],
      });

      const result = await bookRepository.isSeriesPositionTaken(userId, 'series1', 1, 'book1');

      expect(result).toBe(true);
    });
  });

  describe('getActive', () => {
    it('should return only non-deleted books', async () => {
      const mockDocs = [
        { id: 'book1', data: () => ({ title: 'Active Book' }) },
        { id: 'book2', data: () => ({ title: 'Deleted Book', deletedAt: '2024-01-01' }) },
        { id: 'book3', data: () => ({ title: 'Another Active' }) },
      ];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await bookRepository.getActive(userId);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Active Book');
      expect(result[1].title).toBe('Another Active');
    });
  });

  describe('getDeleted', () => {
    it('should return only deleted books', async () => {
      const mockDocs = [
        { id: 'book1', data: () => ({ title: 'Active Book' }) },
        { id: 'book2', data: () => ({ title: 'Deleted Book', deletedAt: '2024-01-01' }) },
      ];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await bookRepository.getDeleted(userId);

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Deleted Book');
    });
  });

  describe('getByGenreId', () => {
    it('should return books with specific genre', async () => {
      const mockDocs = [
        { id: 'book1', data: () => ({ title: 'Fantasy Book', genres: ['genre1', 'genre2'] }) },
      ];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await bookRepository.getByGenreId(userId, 'genre1');

      expect(where).toHaveBeenCalledWith('genres', 'array-contains', 'genre1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getRecent', () => {
    it('should return recent books with default count', async () => {
      const mockDocs = Array.from({ length: 10 }, (_, i) => ({
        id: `book${i}`,
        data: () => ({ title: `Book ${i}` }),
      }));
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await bookRepository.getRecent(userId);

      expect(result).toHaveLength(10);
    });

    it('should respect custom count', async () => {
      const mockDocs = Array.from({ length: 5 }, (_, i) => ({
        id: `book${i}`,
        data: () => ({ title: `Book ${i}` }),
      }));
      getDocs.mockResolvedValue({ docs: mockDocs });

      await bookRepository.getRecent(userId, 5);

      // Verify limit was called (through getWithOptions)
      expect(limit).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt timestamp', async () => {
      updateDoc.mockResolvedValue();
      const now = new Date().toISOString().slice(0, 10); // Just date part for comparison

      await bookRepository.softDelete(userId, 'book1');

      expect(updateDoc).toHaveBeenCalled();
      const updateData = updateDoc.mock.calls[0][1];
      expect(updateData.deletedAt).toBeDefined();
      expect(updateData.deletedAt.slice(0, 10)).toBe(now);
    });
  });

  describe('restore', () => {
    it('should clear deletedAt', async () => {
      updateDoc.mockResolvedValue();

      await bookRepository.restore(userId, 'book1');

      expect(updateDoc).toHaveBeenCalled();
      const updateData = updateDoc.mock.calls[0][1];
      expect(updateData.deletedAt).toBeNull();
    });
  });
});
