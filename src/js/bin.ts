/**
 * Bin (soft delete) functionality for books
 * Books in bin are automatically purged after 30 days
 */

import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';
import { updateGenreBookCounts, loadUserGenres, clearGenresCache } from './genres.js';
import { loadUserSeries, clearSeriesCache, getSeriesById, restoreSeries } from './series.js';
import { clearBooksCache } from './utils/cache.js';
import { deleteImages } from './utils/image-upload.js';

/** Book data with optional bin fields */
interface BinnedBook {
  id: string;
  deletedAt?: number | null;
  genres?: string[];
  seriesId?: string | null;
  seriesPosition?: number | null;
  images?: Array<{ storagePath: string }>;
  [key: string]: unknown;
}

/** Result of restoring a book */
interface RestoreResult {
  warnings: string[];
  seriesRestored: boolean;
}

/** Number of days before binned books are auto-deleted */
export const BIN_RETENTION_DAYS = 30;

/**
 * Soft delete a book (move to bin)
 * @param userId - The user's ID
 * @param bookId - The book ID
 * @param book - The book data (for updating counts)
 */
export async function softDeleteBook(userId: string, bookId: string, book: BinnedBook): Promise<void> {
  const bookRef = doc(db, 'users', userId, 'books', bookId);

  await updateDoc(bookRef, {
    deletedAt: Date.now(),
    updatedAt: serverTimestamp(),
  });

  // Decrement genre book counts
  const bookGenres = book.genres || [];
  if (bookGenres.length > 0) {
    await updateGenreBookCounts(userId, [], bookGenres);
  }

  // Decrement series book count
  if (book.seriesId) {
    await updateSeriesBookCount(userId, book.seriesId, -1);
  }

  // Clear caches
  clearBooksCache(userId);
  clearGenresCache();
  if (book.seriesId) {
    clearSeriesCache();
  }
}

/**
 * Restore a book from bin
 * @param userId - The user's ID
 * @param bookId - The book ID
 * @param book - The book data
 * @returns Result with warnings if any
 */
export async function restoreBook(userId: string, bookId: string, book: BinnedBook): Promise<RestoreResult> {
  const warnings: string[] = [];
  const bookRef = doc(db, 'users', userId, 'books', bookId);
  const updateData: Record<string, unknown> = {
    deletedAt: null,
    updatedAt: serverTimestamp(),
  };

  // Check if series still exists (including soft-deleted)
  let seriesExists = true;
  let seriesRestored = false;
  if (book.seriesId) {
    // First check active series
    const activeSeries = await loadUserSeries(userId, true);
    seriesExists = activeSeries.some((s: { id: string }) => s.id === book.seriesId);

    if (!seriesExists) {
      // Check if series was soft-deleted (can be restored)
      const seriesData = await getSeriesById(userId, book.seriesId);

      if (seriesData && seriesData.deletedAt) {
        // Series was soft-deleted - restore it
        await restoreSeries(userId, book.seriesId);
        seriesExists = true;
        seriesRestored = true;
      } else if (!seriesData) {
        // Series was hard-deleted - clear orphaned reference
        updateData.seriesId = null;
        updateData.seriesPosition = null;
        warnings.push('Series no longer exists');
      }
    }
  }

  // Check which genres still exist
  let validGenres = book.genres || [];
  if (validGenres.length > 0) {
    const genres = await loadUserGenres(userId, true);
    const existingGenreIds = new Set(genres.map((g: { id: string }) => g.id));
    const originalCount = validGenres.length;
    validGenres = validGenres.filter(gid => existingGenreIds.has(gid));

    if (validGenres.length < originalCount) {
      // Update book with only valid genres
      updateData.genres = validGenres;
      const removedCount = originalCount - validGenres.length;
      warnings.push(
        `${removedCount} genre${removedCount > 1 ? 's' : ''} no longer exist${removedCount === 1 ? 's' : ''}`
      );
    }
  }

  await updateDoc(bookRef, updateData);

  // Re-increment genre book counts (only for valid genres)
  if (validGenres.length > 0) {
    await updateGenreBookCounts(userId, validGenres, []);
  }

  // Re-increment series book count (only if series still exists)
  if (book.seriesId && seriesExists) {
    await updateSeriesBookCount(userId, book.seriesId, 1);
  }

  // Clear caches
  clearBooksCache(userId);
  clearGenresCache();
  clearSeriesCache();

  return { warnings, seriesRestored };
}

/**
 * Permanently delete a book (hard delete)
 * @param userId - The user's ID
 * @param bookId - The book ID
 * @param book - The book data (for deleting images)
 */
export async function permanentlyDeleteBook(
  userId: string,
  bookId: string,
  book: BinnedBook | null = null
): Promise<void> {
  // Delete images from Storage first (if book has any)
  if (book?.images?.length) {
    await deleteImages(book.images);
  }

  const bookRef = doc(db, 'users', userId, 'books', bookId);
  await deleteDoc(bookRef);

  // Clear cache
  clearBooksCache(userId);
}

/**
 * Empty all books from bin (permanent delete)
 * @param userId - The user's ID
 * @param binnedBooks - Books to delete
 * @returns Number of books deleted
 */
export async function emptyBin(userId: string, binnedBooks: BinnedBook[]): Promise<number> {
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

  // Clear cache
  clearBooksCache(userId);

  return binnedBooks.length;
}

/**
 * Purge expired books from bin (older than retention period)
 * @param userId - The user's ID
 * @param binnedBooks - All binned books
 * @returns Number of books purged
 */
export async function purgeExpiredBooks(userId: string, binnedBooks: BinnedBook[]): Promise<number> {
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

  // Clear cache
  clearBooksCache(userId);

  return expired.length;
}

/**
 * Calculate days remaining before auto-purge
 * @param deletedAt - Timestamp when book was deleted
 * @returns Days remaining (0 if expired)
 */
export function getDaysRemaining(deletedAt: number | null | undefined): number {
  if (!deletedAt) return BIN_RETENTION_DAYS;

  const now = Date.now();
  const elapsedMs = now - deletedAt;
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const remaining = BIN_RETENTION_DAYS - elapsedDays;

  return Math.max(0, remaining);
}

/**
 * Filter binned books from a list
 * @param books - All books
 * @returns Active (non-binned) books
 */
export function filterActivebooks<T extends { deletedAt?: number | null }>(books: T[]): T[] {
  return books.filter(book => !book.deletedAt);
}

/**
 * Filter to get only binned books
 * @param books - All books
 * @returns Binned books
 */
export function filterBinnedBooks<T extends { deletedAt?: number | null }>(books: T[]): T[] {
  return books.filter(book => book.deletedAt);
}

/**
 * Update series book count
 * @param userId - The user's ID
 * @param seriesId - The series ID
 * @param delta - Amount to change (+1 or -1)
 */
async function updateSeriesBookCount(userId: string, seriesId: string, delta: number): Promise<void> {
  const series = await loadUserSeries(userId, true);
  const targetSeries = series.find((s: { id: string }) => s.id === seriesId);

  if (!targetSeries) return; // Series doesn't exist, skip

  const seriesRef = doc(db, 'users', userId, 'series', seriesId);
  const newCount = Math.max(0, (targetSeries.bookCount || 0) + delta);

  await updateDoc(seriesRef, {
    bookCount: newCount,
    updatedAt: serverTimestamp(),
  });
}
