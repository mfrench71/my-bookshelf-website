// Bin Repository - Data access layer for soft-deleted books
// Handles soft delete, restore, and permanent deletion

import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';
import { eventBus, Events } from '../utils/event-bus.js';
import { clearBooksCache } from '../utils/cache.js';
import { deleteImages } from '../utils/image-upload.js';

/** Book with bin-related fields */
export interface BinnedBook {
  id: string;
  deletedAt?: number | null;
  genres?: string[];
  seriesId?: string | null;
  seriesPosition?: number | null;
  images?: Array<{ storagePath: string }>;
  [key: string]: unknown;
}

/** Result of restoring a book */
export interface RestoreResult {
  warnings: string[];
  seriesRestored: boolean;
}

/** Number of days before binned books are auto-deleted */
export const BIN_RETENTION_DAYS = 30;

/**
 * Repository for bin (soft delete) operations
 */
class BinRepository {
  /**
   * Soft delete a book (move to bin)
   * @param userId - The user's ID
   * @param bookId - The book ID
   * @param book - The book data (for updating counts)
   * @param callbacks - Callbacks for updating genre/series counts
   */
  async softDelete(
    userId: string,
    bookId: string,
    book: BinnedBook,
    callbacks: {
      updateGenreCounts?: (userId: string, added: string[], removed: string[]) => Promise<void>;
      updateSeriesCount?: (userId: string, seriesId: string, delta: number) => Promise<void>;
      clearGenresCache?: () => void;
      clearSeriesCache?: () => void;
    } = {}
  ): Promise<void> {
    const bookRef = doc(db, 'users', userId, 'books', bookId);

    await updateDoc(bookRef, {
      deletedAt: Date.now(),
      updatedAt: serverTimestamp(),
    });

    // Decrement genre book counts
    const bookGenres = book.genres || [];
    if (bookGenres.length > 0 && callbacks.updateGenreCounts) {
      await callbacks.updateGenreCounts(userId, [], bookGenres);
    }

    // Decrement series book count
    if (book.seriesId && callbacks.updateSeriesCount) {
      await callbacks.updateSeriesCount(userId, book.seriesId, -1);
    }

    // Clear caches
    clearBooksCache(userId);
    callbacks.clearGenresCache?.();
    if (book.seriesId) {
      callbacks.clearSeriesCache?.();
    }

    eventBus.emit(Events.BOOK_DELETED, { bookId, soft: true });
  }

  /**
   * Restore a book from bin
   * @param userId - The user's ID
   * @param bookId - The book ID
   * @param book - The book data
   * @param callbacks - Callbacks for validating and updating related data
   * @returns Result with warnings if any
   */
  async restore(
    userId: string,
    bookId: string,
    book: BinnedBook,
    callbacks: {
      loadGenres?: (userId: string, force: boolean) => Promise<Array<{ id: string }>>;
      loadSeries?: (userId: string, force: boolean) => Promise<Array<{ id: string }>>;
      getSeriesById?: (userId: string, seriesId: string) => Promise<{ deletedAt?: number | null } | null>;
      restoreSeries?: (userId: string, seriesId: string) => Promise<void>;
      updateGenreCounts?: (userId: string, added: string[], removed: string[]) => Promise<void>;
      updateSeriesCount?: (userId: string, seriesId: string, delta: number) => Promise<void>;
      clearGenresCache?: () => void;
      clearSeriesCache?: () => void;
    } = {}
  ): Promise<RestoreResult> {
    const warnings: string[] = [];
    const bookRef = doc(db, 'users', userId, 'books', bookId);
    const updateData: Record<string, unknown> = {
      deletedAt: null,
      updatedAt: serverTimestamp(),
    };

    // Check if series still exists (including soft-deleted)
    let seriesExists = true;
    let seriesRestored = false;
    if (book.seriesId && callbacks.loadSeries) {
      const activeSeries = await callbacks.loadSeries(userId, true);
      seriesExists = activeSeries.some((s: { id: string }) => s.id === book.seriesId);

      if (!seriesExists && callbacks.getSeriesById && callbacks.restoreSeries) {
        const seriesData = await callbacks.getSeriesById(userId, book.seriesId);

        if (seriesData?.deletedAt) {
          await callbacks.restoreSeries(userId, book.seriesId);
          seriesExists = true;
          seriesRestored = true;
        } else if (!seriesData) {
          updateData.seriesId = null;
          updateData.seriesPosition = null;
          warnings.push('Series no longer exists');
        }
      }
    }

    // Check which genres still exist
    let validGenres = book.genres || [];
    if (validGenres.length > 0 && callbacks.loadGenres) {
      const genres = await callbacks.loadGenres(userId, true);
      const existingGenreIds = new Set(genres.map((g: { id: string }) => g.id));
      const originalCount = validGenres.length;
      validGenres = validGenres.filter(gid => existingGenreIds.has(gid));

      if (validGenres.length < originalCount) {
        updateData.genres = validGenres;
        const removedCount = originalCount - validGenres.length;
        warnings.push(
          `${removedCount} genre${removedCount > 1 ? 's' : ''} no longer exist${removedCount === 1 ? 's' : ''}`
        );
      }
    }

    await updateDoc(bookRef, updateData);

    // Re-increment genre book counts
    if (validGenres.length > 0 && callbacks.updateGenreCounts) {
      await callbacks.updateGenreCounts(userId, validGenres, []);
    }

    // Re-increment series book count
    if (book.seriesId && seriesExists && callbacks.updateSeriesCount) {
      await callbacks.updateSeriesCount(userId, book.seriesId, 1);
    }

    // Clear caches
    clearBooksCache(userId);
    callbacks.clearGenresCache?.();
    callbacks.clearSeriesCache?.();

    eventBus.emit(Events.BOOK_RESTORED, { bookId });

    return { warnings, seriesRestored };
  }

  /**
   * Permanently delete a book (hard delete)
   * @param userId - The user's ID
   * @param bookId - The book ID
   * @param book - The book data (for deleting images)
   */
  async permanentlyDelete(userId: string, bookId: string, book: BinnedBook | null = null): Promise<void> {
    // Delete images from Storage first
    if (book?.images?.length) {
      await deleteImages(book.images);
    }

    const bookRef = doc(db, 'users', userId, 'books', bookId);
    await deleteDoc(bookRef);

    clearBooksCache(userId);
    eventBus.emit(Events.BOOK_DELETED, { bookId, soft: false });
  }

  /**
   * Empty all books from bin (permanent delete)
   * @param userId - The user's ID
   * @param binnedBooks - Books to delete
   * @returns Number of books deleted
   */
  async emptyBin(userId: string, binnedBooks: BinnedBook[]): Promise<number> {
    if (binnedBooks.length === 0) return 0;

    // Delete all images from Storage first
    const allImages = binnedBooks.flatMap(book => book.images || []);
    if (allImages.length > 0) {
      await deleteImages(allImages);
    }

    const batch = writeBatch(db);

    for (const book of binnedBooks) {
      const bookRef = doc(db, 'users', userId, 'books', book.id);
      batch.delete(bookRef);
    }

    await batch.commit();
    clearBooksCache(userId);

    return binnedBooks.length;
  }

  /**
   * Purge expired books from bin
   * @param userId - The user's ID
   * @param binnedBooks - All binned books
   * @returns Number of books purged
   */
  async purgeExpired(userId: string, binnedBooks: BinnedBook[]): Promise<number> {
    const now = Date.now();
    const retentionMs = BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    const expired = binnedBooks.filter(book => book.deletedAt && now - book.deletedAt > retentionMs);

    if (expired.length === 0) return 0;

    // Delete all images from Storage first
    const allImages = expired.flatMap(book => book.images || []);
    if (allImages.length > 0) {
      await deleteImages(allImages);
    }

    const batch = writeBatch(db);

    for (const book of expired) {
      const bookRef = doc(db, 'users', userId, 'books', book.id);
      batch.delete(bookRef);
    }

    await batch.commit();
    clearBooksCache(userId);

    return expired.length;
  }

  /**
   * Calculate days remaining before auto-purge
   * @param deletedAt - Timestamp when book was deleted
   * @returns Days remaining (0 if expired)
   */
  getDaysRemaining(deletedAt: number | null | undefined): number {
    if (!deletedAt) return BIN_RETENTION_DAYS;

    const now = Date.now();
    const elapsedMs = now - deletedAt;
    const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
    const remaining = BIN_RETENTION_DAYS - elapsedDays;

    return Math.max(0, remaining);
  }

  /**
   * Filter to get only active (non-binned) books
   * @param books - All books
   * @returns Active books
   */
  filterActive<T extends { deletedAt?: number | null }>(books: T[]): T[] {
    return books.filter(book => !book.deletedAt);
  }

  /**
   * Filter to get only binned books
   * @param books - All books
   * @returns Binned books
   */
  filterBinned<T extends { deletedAt?: number | null }>(books: T[]): T[] {
    return books.filter(book => book.deletedAt);
  }
}

// Export singleton instance
export const binRepository = new BinRepository();
