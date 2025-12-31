// Book Repository - Data access for books collection
// Extends BaseRepository with book-specific operations

import { query, where, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { BaseRepository } from './base-repository.js';
import type { Book } from '../types/index.d.ts';

/**
 * Repository for book data access
 * Provides book-specific query methods beyond basic CRUD
 */
class BookRepository extends BaseRepository<Book> {
  constructor() {
    super('books');
  }

  /**
   * Get a book by ISBN
   * @param userId - The user's Firebase UID
   * @param isbn - ISBN to search for
   * @returns Book if found, null otherwise
   */
  async getByIsbn(userId: string, isbn: string): Promise<Book | null> {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('isbn', '==', isbn), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Book;
  }

  /**
   * Get all books in a series
   * @param userId - The user's Firebase UID
   * @param seriesId - Series ID to filter by
   * @returns Array of books in the series
   */
  async getBySeriesId(userId: string, seriesId: string): Promise<Book[]> {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('seriesId', '==', seriesId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as Book);
  }

  /**
   * Check if a position is taken in a series
   * @param userId - The user's Firebase UID
   * @param seriesId - Series ID
   * @param position - Position to check
   * @param excludeBookId - Optional book ID to exclude (for updates)
   * @returns True if position is taken
   */
  async isSeriesPositionTaken(
    userId: string,
    seriesId: string,
    position: number,
    excludeBookId: string | null = null
  ): Promise<boolean> {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('seriesId', '==', seriesId), where('seriesPosition', '==', position));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return false;
    }

    // If excluding a book (for updates), check if the match is the same book
    if (excludeBookId) {
      return snapshot.docs.some(docSnap => docSnap.id !== excludeBookId);
    }

    return true;
  }

  /**
   * Get active books (not soft-deleted)
   * @param userId - The user's Firebase UID
   * @returns Array of active books
   */
  async getActive(userId: string): Promise<Book[]> {
    const books = await this.getAll(userId);
    return books.filter(book => !book.deletedAt);
  }

  /**
   * Get soft-deleted books (in bin)
   * @param userId - The user's Firebase UID
   * @returns Array of deleted books
   */
  async getDeleted(userId: string): Promise<Book[]> {
    const books = await this.getAll(userId);
    return books.filter(book => book.deletedAt);
  }

  /**
   * Get books with a specific genre
   * @param userId - The user's Firebase UID
   * @param genreId - Genre ID to filter by
   * @returns Array of books with the genre
   */
  async getByGenreId(userId: string, genreId: string): Promise<Book[]> {
    const collectionRef = this.getCollectionRef(userId);
    const q = query(collectionRef, where('genres', 'array-contains', genreId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }) as Book);
  }

  /**
   * Get recently added books
   * @param userId - The user's Firebase UID
   * @param count - Number of books to return
   * @returns Array of recent books
   */
  async getRecent(userId: string, count = 10): Promise<Book[]> {
    return this.getWithOptions(userId, {
      orderByField: 'createdAt',
      orderDirection: 'desc',
      limitCount: count,
    });
  }

  /**
   * Soft delete a book (move to bin)
   * @param userId - The user's Firebase UID
   * @param bookId - Book ID to soft delete
   */
  async softDelete(userId: string, bookId: string): Promise<void> {
    await this.update(userId, bookId, {
      deletedAt: Date.now(),
    } as Partial<Book>);
  }

  /**
   * Restore a soft-deleted book
   * @param userId - The user's Firebase UID
   * @param bookId - Book ID to restore
   */
  async restore(userId: string, bookId: string): Promise<void> {
    await this.update(userId, bookId, {
      deletedAt: null,
    });
  }
}

// Export singleton instance
export const bookRepository = new BookRepository();

// Also export class for testing
export { BookRepository };
