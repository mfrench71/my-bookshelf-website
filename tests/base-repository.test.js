import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firebase
vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn((db, ...path) => ({ path: path.join('/') })),
  doc: vi.fn((db, ...path) => ({ path: path.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  getDocsFromServer: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn((ref, ...constraints) => ({ ref, constraints })),
  where: vi.fn((field, op, value) => ({ type: 'where', field, op, value })),
  orderBy: vi.fn((field, dir) => ({ type: 'orderBy', field, dir })),
  limit: vi.fn(n => ({ type: 'limit', n })),
  startAfter: vi.fn(doc => ({ type: 'startAfter', doc })),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
}));

vi.mock('/js/firebase-config.js', () => ({
  db: { name: 'mock-db' },
}));

import { BaseRepository } from '../src/js/repositories/base-repository.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

describe('BaseRepository', () => {
  let repository;
  const userId = 'user123';
  const collectionName = 'testCollection';

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new BaseRepository(collectionName);
  });

  describe('constructor', () => {
    it('should set collection name', () => {
      expect(repository.collectionName).toBe(collectionName);
    });
  });

  describe('getCollectionRef', () => {
    it('should return collection reference with correct path', () => {
      const ref = repository.getCollectionRef(userId);
      expect(collection).toHaveBeenCalledWith(
        { name: 'mock-db' },
        'users',
        userId,
        collectionName
      );
    });
  });

  describe('getDocRef', () => {
    it('should return document reference with correct path', () => {
      const docId = 'doc123';
      repository.getDocRef(userId, docId);
      expect(doc).toHaveBeenCalledWith(
        { name: 'mock-db' },
        'users',
        userId,
        collectionName,
        docId
      );
    });
  });

  describe('getAll', () => {
    it('should return all documents with ids', async () => {
      const mockDocs = [
        { id: 'doc1', data: () => ({ title: 'Book 1' }) },
        { id: 'doc2', data: () => ({ title: 'Book 2' }) },
      ];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await repository.getAll(userId);

      expect(result).toEqual([
        { id: 'doc1', title: 'Book 1' },
        { id: 'doc2', title: 'Book 2' },
      ]);
    });

    it('should return empty array for empty collection', async () => {
      getDocs.mockResolvedValue({ docs: [] });

      const result = await repository.getAll(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should return document with id when found', async () => {
      getDoc.mockResolvedValue({
        exists: () => true,
        id: 'doc1',
        data: () => ({ title: 'Book 1' }),
      });

      const result = await repository.getById(userId, 'doc1');

      expect(result).toEqual({ id: 'doc1', title: 'Book 1' });
    });

    it('should return null when document not found', async () => {
      getDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await repository.getById(userId, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create document with timestamps', async () => {
      addDoc.mockResolvedValue({ id: 'newDoc123' });

      const data = { title: 'New Book', author: 'Author' };
      const result = await repository.create(userId, data);

      expect(addDoc).toHaveBeenCalled();
      const callArgs = addDoc.mock.calls[0][1];
      expect(callArgs.title).toBe('New Book');
      expect(callArgs.author).toBe('Author');
      expect(callArgs.createdAt).toBe('SERVER_TIMESTAMP');
      expect(callArgs.updatedAt).toBe('SERVER_TIMESTAMP');
      expect(result.id).toBe('newDoc123');
    });
  });

  describe('update', () => {
    it('should update document with updatedAt timestamp', async () => {
      updateDoc.mockResolvedValue();

      await repository.update(userId, 'doc1', { title: 'Updated Title' });

      expect(updateDoc).toHaveBeenCalled();
      const callArgs = updateDoc.mock.calls[0][1];
      expect(callArgs.title).toBe('Updated Title');
      expect(callArgs.updatedAt).toBe('SERVER_TIMESTAMP');
    });
  });

  describe('delete', () => {
    it('should delete document', async () => {
      deleteDoc.mockResolvedValue();

      await repository.delete(userId, 'doc1');

      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  describe('queryByField', () => {
    it('should query documents by field', async () => {
      const mockDocs = [{ id: 'doc1', data: () => ({ status: 'active' }) }];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await repository.queryByField(userId, 'status', '==', 'active');

      expect(where).toHaveBeenCalledWith('status', '==', 'active');
      expect(query).toHaveBeenCalled();
      expect(result).toEqual([{ id: 'doc1', status: 'active' }]);
    });
  });

  describe('getWithOptions', () => {
    it('should apply ordering', async () => {
      getDocs.mockResolvedValue({ docs: [] });

      await repository.getWithOptions(userId, {
        orderByField: 'createdAt',
        orderDirection: 'desc',
      });

      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    });

    it('should apply limit', async () => {
      getDocs.mockResolvedValue({ docs: [] });

      await repository.getWithOptions(userId, { limitCount: 10 });

      expect(limit).toHaveBeenCalledWith(10);
    });

    it('should apply both ordering and limit', async () => {
      getDocs.mockResolvedValue({ docs: [] });

      await repository.getWithOptions(userId, {
        orderByField: 'title',
        orderDirection: 'asc',
        limitCount: 5,
      });

      expect(orderBy).toHaveBeenCalledWith('title', 'asc');
      expect(limit).toHaveBeenCalledWith(5);
    });

    it('should work without options', async () => {
      const mockDocs = [{ id: 'doc1', data: () => ({ title: 'Book' }) }];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await repository.getWithOptions(userId);

      expect(result).toEqual([{ id: 'doc1', title: 'Book' }]);
    });
  });

  describe('getPaginated', () => {
    it('should return paginated results with default options', async () => {
      const mockDocs = [
        { id: 'doc1', data: () => ({ title: 'Book 1' }) },
        { id: 'doc2', data: () => ({ title: 'Book 2' }) },
      ];
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await repository.getPaginated(userId);

      expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
      expect(limit).toHaveBeenCalledWith(20);
      expect(result.docs).toEqual([
        { id: 'doc1', title: 'Book 1' },
        { id: 'doc2', title: 'Book 2' },
      ]);
      expect(result.lastDoc).toBe(mockDocs[1]);
      expect(result.hasMore).toBe(false); // Less than limit
    });

    it('should use custom ordering and limit', async () => {
      getDocs.mockResolvedValue({ docs: [] });

      await repository.getPaginated(userId, {
        orderByField: 'title',
        orderDirection: 'asc',
        limitCount: 10,
      });

      expect(orderBy).toHaveBeenCalledWith('title', 'asc');
      expect(limit).toHaveBeenCalledWith(10);
    });

    it('should use startAfter when afterDoc is provided', async () => {
      const cursorDoc = { id: 'cursor' };
      getDocs.mockResolvedValue({ docs: [] });

      await repository.getPaginated(userId, { afterDoc: cursorDoc });

      expect(startAfter).toHaveBeenCalledWith(cursorDoc);
    });

    it('should use getDocsFromServer when fromServer is true', async () => {
      const mockDocs = [{ id: 'doc1', data: () => ({ title: 'Book 1' }) }];
      getDocsFromServer.mockResolvedValue({ docs: mockDocs });

      await repository.getPaginated(userId, { fromServer: true });

      expect(getDocsFromServer).toHaveBeenCalled();
      expect(getDocs).not.toHaveBeenCalled();
    });

    it('should set hasMore true when full page returned', async () => {
      // Create exactly 20 mock docs (default limit)
      const mockDocs = Array.from({ length: 20 }, (_, i) => ({
        id: `doc${i}`,
        data: () => ({ title: `Book ${i}` }),
      }));
      getDocs.mockResolvedValue({ docs: mockDocs });

      const result = await repository.getPaginated(userId);

      expect(result.hasMore).toBe(true);
    });

    it('should return null lastDoc for empty results', async () => {
      getDocs.mockResolvedValue({ docs: [] });

      const result = await repository.getPaginated(userId);

      expect(result.lastDoc).toBeNull();
      expect(result.hasMore).toBe(false);
    });
  });
});
