// Book Repository - Data access for books collection
// Extends BaseRepository with book-specific operations

import { query, where, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { BaseRepository } from './base-repository.js';

/**
 * Repository for book data access
 * Provides book-specific query methods beyond basic CRUD
 */
class BookRepository extends BaseRepository {
  constructor() {
    super('books');
  }

  /**
   * Get a book by ISBN
   * @param {string} userId - The user's Firebase UID
   * @param {string} isbn - ISBN to search for
   * @returns {Promise<Object|null>} Book if found, null otherwise
   */
  async getByIsbn(userId, isbn) {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('isbn', '==', isbn), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Get all books in a series
   * @param {string} userId - The user's Firebase UID
   * @param {string} seriesId - Series ID to filter by
   * @returns {Promise<Array<Object>>} Array of books in the series
   */
  async getBySeriesId(userId, seriesId) {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('seriesId', '==', seriesId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Check if a position is taken in a series
   * @param {string} userId - The user's Firebase UID
   * @param {string} seriesId - Series ID
   * @param {number} position - Position to check
   * @param {string} [excludeBookId] - Optional book ID to exclude (for updates)
   * @returns {Promise<boolean>} True if position is taken
   */
  async isSeriesPositionTaken(userId, seriesId, position, excludeBookId = null) {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('seriesId', '==', seriesId), where('seriesPosition', '==', position));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return false;
    }

    // If excluding a book (for updates), check if the match is the same book
    if (excludeBookId) {
      return snapshot.docs.some(doc => doc.id !== excludeBookId);
    }

    return true;
  }

  /**
   * Get active books (not soft-deleted)
   * @param {string} userId - The user's Firebase UID
   * @returns {Promise<Array<Object>>} Array of active books
   */
  async getActive(userId) {
    const books = await this.getAll(userId);
    return books.filter(book => !book.deletedAt);
  }

  /**
   * Get soft-deleted books (in bin)
   * @param {string} userId - The user's Firebase UID
   * @returns {Promise<Array<Object>>} Array of deleted books
   */
  async getDeleted(userId) {
    const books = await this.getAll(userId);
    return books.filter(book => book.deletedAt);
  }

  /**
   * Get books with a specific genre
   * @param {string} userId - The user's Firebase UID
   * @param {string} genreId - Genre ID to filter by
   * @returns {Promise<Array<Object>>} Array of books with the genre
   */
  async getByGenreId(userId, genreId) {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('genres', 'array-contains', genreId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get recently added books
   * @param {string} userId - The user's Firebase UID
   * @param {number} [count=10] - Number of books to return
   * @returns {Promise<Array<Object>>} Array of recent books
   */
  async getRecent(userId, count = 10) {
    return this.getWithOptions(userId, {
      orderByField: 'createdAt',
      orderDirection: 'desc',
      limitCount: count,
    });
  }

  /**
   * Soft delete a book (move to bin)
   * @param {string} userId - The user's Firebase UID
   * @param {string} bookId - Book ID to soft delete
   * @returns {Promise<void>}
   */
  async softDelete(userId, bookId) {
    await this.update(userId, bookId, {
      deletedAt: new Date().toISOString(),
    });
  }

  /**
   * Restore a soft-deleted book
   * @param {string} userId - The user's Firebase UID
   * @param {string} bookId - Book ID to restore
   * @returns {Promise<void>}
   */
  async restore(userId, bookId) {
    await this.update(userId, bookId, {
      deletedAt: null,
    });
  }
}

// Export singleton instance
export const bookRepository = new BookRepository();

// Also export class for testing
export { BookRepository };
