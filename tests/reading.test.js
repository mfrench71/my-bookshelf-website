// Reading Utilities Tests
import { describe, it, expect } from 'vitest';

import {
  migrateBookReads,
  getCurrentRead,
  getBookStatus
} from '../src/js/utils/reading.js';

describe('Reading Utilities', () => {
  describe('migrateBookReads', () => {
    it('should return book unchanged if it already has reads array', () => {
      const book = {
        id: '1',
        title: 'Test Book',
        reads: [{ startedAt: 1000, finishedAt: 2000 }]
      };
      const result = migrateBookReads(book);
      expect(result).toEqual(book);
    });

    it('should migrate old startedAt/finishedAt to reads array', () => {
      const book = {
        id: '1',
        title: 'Test Book',
        startedAt: 1000,
        finishedAt: 2000,
        status: 'finished'
      };
      const result = migrateBookReads(book);

      expect(result.reads).toEqual([{ startedAt: 1000, finishedAt: 2000 }]);
      expect(result.startedAt).toBeUndefined();
      expect(result.finishedAt).toBeUndefined();
      expect(result.status).toBeUndefined();
    });

    it('should migrate startedAt only', () => {
      const book = {
        id: '1',
        title: 'Test Book',
        startedAt: 1000
      };
      const result = migrateBookReads(book);

      expect(result.reads).toEqual([{ startedAt: 1000, finishedAt: null }]);
    });

    it('should migrate finishedAt only', () => {
      const book = {
        id: '1',
        title: 'Test Book',
        finishedAt: 2000
      };
      const result = migrateBookReads(book);

      expect(result.reads).toEqual([{ startedAt: null, finishedAt: 2000 }]);
    });

    it('should create empty reads array if no dates', () => {
      const book = {
        id: '1',
        title: 'Test Book'
      };
      const result = migrateBookReads(book);

      expect(result.reads).toEqual([]);
    });

    it('should not modify the original book', () => {
      const book = {
        id: '1',
        title: 'Test Book',
        startedAt: 1000,
        finishedAt: 2000
      };
      const result = migrateBookReads(book);

      expect(book.startedAt).toBe(1000);
      expect(book.finishedAt).toBe(2000);
    });

    it('should preserve other book properties', () => {
      const book = {
        id: '1',
        title: 'Test Book',
        author: 'John Doe',
        rating: 5,
        startedAt: 1000
      };
      const result = migrateBookReads(book);

      expect(result.id).toBe('1');
      expect(result.title).toBe('Test Book');
      expect(result.author).toBe('John Doe');
      expect(result.rating).toBe(5);
    });
  });

  describe('getCurrentRead', () => {
    it('should return last read entry from reads array', () => {
      const book = {
        reads: [
          { startedAt: 1000, finishedAt: 2000 },
          { startedAt: 3000, finishedAt: null }
        ]
      };
      const result = getCurrentRead(book);
      expect(result).toEqual({ startedAt: 3000, finishedAt: null });
    });

    it('should return null for empty reads array', () => {
      const book = { reads: [] };
      const result = getCurrentRead(book);
      expect(result).toBe(null);
    });

    it('should return null for book without reads', () => {
      const book = { title: 'Test Book' };
      const result = getCurrentRead(book);
      expect(result).toBe(null);
    });

    it('should migrate old format and return current read', () => {
      const book = {
        startedAt: 1000,
        finishedAt: 2000
      };
      const result = getCurrentRead(book);
      expect(result).toEqual({ startedAt: 1000, finishedAt: 2000 });
    });

    it('should return single read entry', () => {
      const book = {
        reads: [{ startedAt: 1000, finishedAt: 2000 }]
      };
      const result = getCurrentRead(book);
      expect(result).toEqual({ startedAt: 1000, finishedAt: 2000 });
    });
  });

  describe('getBookStatus', () => {
    it('should return "finished" for book with startedAt and finishedAt', () => {
      const book = {
        reads: [{ startedAt: 1000, finishedAt: 2000 }]
      };
      expect(getBookStatus(book)).toBe('finished');
    });

    it('should return "reading" for book with startedAt but no finishedAt', () => {
      const book = {
        reads: [{ startedAt: 1000, finishedAt: null }]
      };
      expect(getBookStatus(book)).toBe('reading');
    });

    it('should return null for book with no reads', () => {
      const book = { reads: [] };
      expect(getBookStatus(book)).toBe(null);
    });

    it('should return null for book without reads array', () => {
      const book = { title: 'Test Book' };
      expect(getBookStatus(book)).toBe(null);
    });

    it('should return null for read entry with no dates', () => {
      const book = {
        reads: [{ startedAt: null, finishedAt: null }]
      };
      expect(getBookStatus(book)).toBe(null);
    });

    it('should use current (last) read for status', () => {
      const book = {
        reads: [
          { startedAt: 1000, finishedAt: 2000 },
          { startedAt: 3000, finishedAt: null }
        ]
      };
      expect(getBookStatus(book)).toBe('reading');
    });

    it('should handle old format book', () => {
      const book = {
        startedAt: 1000,
        finishedAt: 2000
      };
      expect(getBookStatus(book)).toBe('finished');
    });

    it('should handle re-read scenario', () => {
      const book = {
        reads: [
          { startedAt: 1000, finishedAt: 2000 },
          { startedAt: 3000, finishedAt: 4000 }
        ]
      };
      expect(getBookStatus(book)).toBe('finished');
    });
  });
});
