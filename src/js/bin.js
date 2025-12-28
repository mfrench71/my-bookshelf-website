/**
 * Bin (soft delete) functionality for books
 * Books in bin are automatically purged after 30 days
 */

import { doc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';
import { updateGenreBookCounts, loadUserGenres, clearGenresCache } from './genres.js';
import { loadUserSeries, clearSeriesCache, getSeriesById, restoreSeries } from './series.js';
import { clearBooksCache } from './utils/cache.js';

/** Number of days before binned books are auto-deleted */
export const BIN_RETENTION_DAYS = 30;

/**
 * Soft delete a book (move to bin)
 * @param {string} userId - The user's ID
 * @param {string} bookId - The book ID
 * @param {Object} book - The book data (for updating counts)
 * @returns {Promise<void>}
 */
export async function softDeleteBook(userId, bookId, book) {
  const bookRef = doc(db, 'users', userId, 'books', bookId);

  await updateDoc(bookRef, {
    deletedAt: Date.now(),
    updatedAt: serverTimestamp()
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
 * @param {string} userId - The user's ID
 * @param {string} bookId - The book ID
 * @param {Object} book - The book data
 * @returns {Promise<Object>} Result with warnings if any
 */
export async function restoreBook(userId, bookId, book) {
  const warnings = [];
  const bookRef = doc(db, 'users', userId, 'books', bookId);
  const updateData = {
    deletedAt: null,
    updatedAt: serverTimestamp()
  };

  // Check if series still exists (including soft-deleted)
  let seriesExists = true;
  let seriesRestored = false;
  if (book.seriesId) {
    // First check active series
    const activeSeries = await loadUserSeries(userId, true);
    seriesExists = activeSeries.some(s => s.id === book.seriesId);

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
    const existingGenreIds = new Set(genres.map(g => g.id));
    const originalCount = validGenres.length;
    validGenres = validGenres.filter(gid => existingGenreIds.has(gid));

    if (validGenres.length < originalCount) {
      // Update book with only valid genres
      updateData.genres = validGenres;
      const removedCount = originalCount - validGenres.length;
      warnings.push(`${removedCount} genre${removedCount > 1 ? 's' : ''} no longer exist${removedCount === 1 ? 's' : ''}`);
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
 * @param {string} userId - The user's ID
 * @param {string} bookId - The book ID
 * @returns {Promise<void>}
 */
export async function permanentlyDeleteBook(userId, bookId) {
  const bookRef = doc(db, 'users', userId, 'books', bookId);
  await deleteDoc(bookRef);

  // Clear cache
  clearBooksCache(userId);
}

/**
 * Empty all books from bin (permanent delete)
 * @param {string} userId - The user's ID
 * @param {Array<Object>} binnedBooks - Books to delete
 * @returns {Promise<number>} Number of books deleted
 */
export async function emptyBin(userId, binnedBooks) {
  if (binnedBooks.length === 0) return 0;

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
 * @param {string} userId - The user's ID
 * @param {Array<Object>} binnedBooks - All binned books
 * @returns {Promise<number>} Number of books purged
 */
export async function purgeExpiredBooks(userId, binnedBooks) {
  const now = Date.now();
  const retentionMs = BIN_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  const expired = binnedBooks.filter(book =>
    book.deletedAt && (now - book.deletedAt) > retentionMs
  );

  if (expired.length === 0) return 0;

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
 * @param {number} deletedAt - Timestamp when book was deleted
 * @returns {number} Days remaining (0 if expired)
 */
export function getDaysRemaining(deletedAt) {
  if (!deletedAt) return BIN_RETENTION_DAYS;

  const now = Date.now();
  const elapsedMs = now - deletedAt;
  const elapsedDays = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const remaining = BIN_RETENTION_DAYS - elapsedDays;

  return Math.max(0, remaining);
}

/**
 * Filter binned books from a list
 * @param {Array<Object>} books - All books
 * @returns {Array<Object>} Active (non-binned) books
 */
export function filterActivebooks(books) {
  return books.filter(book => !book.deletedAt);
}

/**
 * Filter to get only binned books
 * @param {Array<Object>} books - All books
 * @returns {Array<Object>} Binned books
 */
export function filterBinnedBooks(books) {
  return books.filter(book => book.deletedAt);
}

/**
 * Update series book count
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID
 * @param {number} delta - Amount to change (+1 or -1)
 */
async function updateSeriesBookCount(userId, seriesId, delta) {
  const series = await loadUserSeries(userId, true);
  const targetSeries = series.find(s => s.id === seriesId);

  if (!targetSeries) return; // Series doesn't exist, skip

  const seriesRef = doc(db, 'users', userId, 'series', seriesId);
  const newCount = Math.max(0, (targetSeries.bookCount || 0) + delta);

  await updateDoc(seriesRef, {
    bookCount: newCount,
    updatedAt: serverTimestamp()
  });
}
