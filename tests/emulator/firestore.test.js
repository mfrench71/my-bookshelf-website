// Firebase Emulator Integration Tests
// Run: npx firebase emulators:start (in another terminal)
// Then: npm run test:emulator

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initializeEmulator,
  cleanupEmulator,
  createTestUser,
  deleteTestUser,
  clearUserData,
  createTestBook,
  createTestGenre,
  createTestSeries,
  getBook,
  getAllBooks,
  getAllGenres,
  getAllSeries,
  updateBook,
  deleteBook,
  moveBookToBin,
  restoreBookFromBin,
  db,
} from './setup.js';

// Skip tests if emulator is not running
const EMULATOR_AVAILABLE = process.env.FIRESTORE_EMULATOR_HOST || process.env.CI;

describe.skipIf(!EMULATOR_AVAILABLE)('Firestore Emulator Integration Tests', () => {
  let testUser;
  let userId;

  beforeAll(async () => {
    initializeEmulator();
    testUser = await createTestUser('integration@test.com', 'testpass123');
    userId = testUser.uid;
  });

  afterAll(async () => {
    if (userId) {
      await clearUserData(userId);
      await deleteTestUser(userId);
    }
    await cleanupEmulator();
  });

  beforeEach(async () => {
    // Clear user data before each test
    if (userId) {
      await clearUserData(userId);
    }
  });

  describe('Book CRUD Operations', () => {
    it('should create a book', async () => {
      const bookId = await createTestBook(userId, {
        title: 'Test Book',
        author: 'Test Author',
        isbn: '9780123456789',
      });

      expect(bookId).toBeDefined();

      const book = await getBook(userId, bookId);
      expect(book).toBeDefined();
      expect(book.title).toBe('Test Book');
      expect(book.author).toBe('Test Author');
    });

    it('should read all books', async () => {
      await createTestBook(userId, { title: 'Book 1' });
      await createTestBook(userId, { title: 'Book 2' });
      await createTestBook(userId, { title: 'Book 3' });

      const books = await getAllBooks(userId);
      expect(books).toHaveLength(3);
    });

    it('should update a book', async () => {
      const bookId = await createTestBook(userId, { title: 'Original Title' });

      await updateBook(userId, bookId, { title: 'Updated Title' });

      const book = await getBook(userId, bookId);
      expect(book.title).toBe('Updated Title');
    });

    it('should delete a book', async () => {
      const bookId = await createTestBook(userId, { title: 'To Delete' });

      await deleteBook(userId, bookId);

      const book = await getBook(userId, bookId);
      expect(book).toBeNull();
    });

    it('should handle book with all fields', async () => {
      const bookId = await createTestBook(userId, {
        title: 'Complete Book',
        author: 'Full Author',
        isbn: '9781234567890',
        status: 'reading',
        rating: 4,
        genres: ['genre1', 'genre2'],
        seriesId: 'series1',
        seriesPosition: 1,
        coverImageUrl: 'https://example.com/cover.jpg',
        pageCount: 350,
        publisher: 'Test Publisher',
        publishedDate: '2024-01-01',
        notes: 'Test notes',
      });

      const book = await getBook(userId, bookId);
      expect(book.title).toBe('Complete Book');
      expect(book.status).toBe('reading');
      expect(book.rating).toBe(4);
      expect(book.genres).toHaveLength(2);
    });
  });

  describe('Genre Operations', () => {
    it('should create a genre', async () => {
      const genreId = await createTestGenre(userId, {
        name: 'Fantasy',
        color: '#8b5cf6',
      });

      expect(genreId).toBeDefined();

      const genres = await getAllGenres(userId);
      expect(genres).toHaveLength(1);
      expect(genres[0].name).toBe('Fantasy');
    });

    it('should read all genres', async () => {
      await createTestGenre(userId, { name: 'Fantasy' });
      await createTestGenre(userId, { name: 'Sci-Fi' });
      await createTestGenre(userId, { name: 'Mystery' });

      const genres = await getAllGenres(userId);
      expect(genres).toHaveLength(3);
    });
  });

  describe('Series Operations', () => {
    it('should create a series', async () => {
      const seriesId = await createTestSeries(userId, {
        name: 'The Lord of the Rings',
        expectedBooks: 3,
      });

      expect(seriesId).toBeDefined();

      const series = await getAllSeries(userId);
      expect(series).toHaveLength(1);
      expect(series[0].name).toBe('The Lord of the Rings');
    });

    it('should read all series', async () => {
      await createTestSeries(userId, { name: 'Series 1' });
      await createTestSeries(userId, { name: 'Series 2' });

      const series = await getAllSeries(userId);
      expect(series).toHaveLength(2);
    });
  });

  describe('Bin Operations', () => {
    it('should move book to bin', async () => {
      const bookId = await createTestBook(userId, { title: 'To Bin' });

      await moveBookToBin(userId, bookId);

      // Book should not be in books collection
      const book = await getBook(userId, bookId);
      expect(book).toBeNull();

      // Book should be in bin
      const binDoc = await db.collection('users').doc(userId).collection('bin').doc(bookId).get();
      expect(binDoc.exists).toBe(true);
      expect(binDoc.data().title).toBe('To Bin');
      expect(binDoc.data().deletedAt).toBeDefined();
    });

    it('should restore book from bin', async () => {
      const bookId = await createTestBook(userId, { title: 'To Restore' });
      await moveBookToBin(userId, bookId);

      await restoreBookFromBin(userId, bookId);

      // Book should be back in books collection
      const book = await getBook(userId, bookId);
      expect(book).toBeDefined();
      expect(book.title).toBe('To Restore');
      expect(book.deletedAt).toBeUndefined();

      // Book should not be in bin
      const binDoc = await db.collection('users').doc(userId).collection('bin').doc(bookId).get();
      expect(binDoc.exists).toBe(false);
    });
  });

  describe('Data Isolation', () => {
    it('should isolate data between users', async () => {
      // Create second test user
      const testUser2 = await createTestUser('user2@test.com', 'testpass456');
      const userId2 = testUser2.uid;

      try {
        // Create books for both users
        await createTestBook(userId, { title: 'User 1 Book' });
        await createTestBook(userId2, { title: 'User 2 Book' });

        // Each user should only see their own books
        const user1Books = await getAllBooks(userId);
        const user2Books = await getAllBooks(userId2);

        expect(user1Books).toHaveLength(1);
        expect(user1Books[0].title).toBe('User 1 Book');

        expect(user2Books).toHaveLength(1);
        expect(user2Books[0].title).toBe('User 2 Book');
      } finally {
        await clearUserData(userId2);
        await deleteTestUser(userId2);
      }
    });
  });

  describe('Query Operations', () => {
    it('should query books by status', async () => {
      await createTestBook(userId, { title: 'To Read', status: 'to-read' });
      await createTestBook(userId, { title: 'Reading', status: 'reading' });
      await createTestBook(userId, { title: 'Finished', status: 'completed' });

      const readingBooks = await db
        .collection('users')
        .doc(userId)
        .collection('books')
        .where('status', '==', 'reading')
        .get();

      expect(readingBooks.docs).toHaveLength(1);
      expect(readingBooks.docs[0].data().title).toBe('Reading');
    });

    it('should query books by series', async () => {
      const seriesId = await createTestSeries(userId, { name: 'Test Series' });

      await createTestBook(userId, { title: 'Book 1', seriesId });
      await createTestBook(userId, { title: 'Book 2', seriesId });
      await createTestBook(userId, { title: 'Standalone' });

      const seriesBooks = await db
        .collection('users')
        .doc(userId)
        .collection('books')
        .where('seriesId', '==', seriesId)
        .get();

      expect(seriesBooks.docs).toHaveLength(2);
    });

    it('should query books by rating', async () => {
      await createTestBook(userId, { title: 'Low Rated', rating: 2 });
      await createTestBook(userId, { title: 'High Rated', rating: 5 });
      await createTestBook(userId, { title: 'Medium Rated', rating: 3 });

      const highRated = await db
        .collection('users')
        .doc(userId)
        .collection('books')
        .where('rating', '>=', 4)
        .get();

      expect(highRated.docs).toHaveLength(1);
      expect(highRated.docs[0].data().title).toBe('High Rated');
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch writes', async () => {
      const batch = db.batch();
      const booksRef = db.collection('users').doc(userId).collection('books');

      // Add multiple books in batch
      for (let i = 1; i <= 5; i++) {
        const docRef = booksRef.doc();
        batch.set(docRef, {
          title: `Batch Book ${i}`,
          author: 'Batch Author',
          status: 'to-read',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await batch.commit();

      const books = await getAllBooks(userId);
      expect(books).toHaveLength(5);
    });
  });
});
