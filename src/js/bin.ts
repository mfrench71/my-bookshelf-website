/**
 * Bin (soft delete) functionality for books
 * Thin wrapper around binRepository for backward compatibility
 * New code should import from repositories/bin-repository.ts directly
 */

import {
  binRepository,
  BIN_RETENTION_DAYS,
  type BinnedBook,
  type RestoreResult,
} from './repositories/bin-repository.js';
import { updateGenreBookCounts, loadUserGenres, clearGenresCache } from './genres.js';
import { loadUserSeries, clearSeriesCache, getSeriesById, restoreSeries } from './series.js';

// Re-export types and constants
export { BIN_RETENTION_DAYS };
export type { BinnedBook, RestoreResult };

/**
 * Soft delete a book (move to bin)
 * @param userId - The user's ID
 * @param bookId - The book ID
 * @param book - The book data (for updating counts)
 */
export async function softDeleteBook(userId: string, bookId: string, book: BinnedBook): Promise<void> {
  return binRepository.softDelete(userId, bookId, book, {
    updateGenreCounts: updateGenreBookCounts,
    updateSeriesCount: updateSeriesBookCount,
    clearGenresCache,
    clearSeriesCache,
  });
}

/**
 * Restore a book from bin
 * @param userId - The user's ID
 * @param bookId - The book ID
 * @param book - The book data
 * @returns Result with warnings if any
 */
export async function restoreBook(userId: string, bookId: string, book: BinnedBook): Promise<RestoreResult> {
  return binRepository.restore(userId, bookId, book, {
    loadGenres: loadUserGenres,
    loadSeries: loadUserSeries,
    getSeriesById,
    restoreSeries,
    updateGenreCounts: updateGenreBookCounts,
    updateSeriesCount: updateSeriesBookCount,
    clearGenresCache,
    clearSeriesCache,
  });
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
  return binRepository.permanentlyDelete(userId, bookId, book);
}

/**
 * Empty all books from bin (permanent delete)
 * @param userId - The user's ID
 * @param binnedBooks - Books to delete
 * @returns Number of books deleted
 */
export async function emptyBin(userId: string, binnedBooks: BinnedBook[]): Promise<number> {
  return binRepository.emptyBin(userId, binnedBooks);
}

/**
 * Purge expired books from bin (older than retention period)
 * @param userId - The user's ID
 * @param binnedBooks - All binned books
 * @returns Number of books purged
 */
export async function purgeExpiredBooks(userId: string, binnedBooks: BinnedBook[]): Promise<number> {
  return binRepository.purgeExpired(userId, binnedBooks);
}

/**
 * Calculate days remaining before auto-purge
 * @param deletedAt - Timestamp when book was deleted
 * @returns Days remaining (0 if expired)
 */
export function getDaysRemaining(deletedAt: number | null | undefined): number {
  return binRepository.getDaysRemaining(deletedAt);
}

/**
 * Filter binned books from a list
 * @param books - All books
 * @returns Active (non-binned) books
 */
export function filterActivebooks<T extends { deletedAt?: number | null }>(books: T[]): T[] {
  return binRepository.filterActive(books);
}

/**
 * Filter to get only binned books
 * @param books - All books
 * @returns Binned books
 */
export function filterBinnedBooks<T extends { deletedAt?: number | null }>(books: T[]): T[] {
  return binRepository.filterBinned(books);
}

/**
 * Update series book count (internal helper)
 * @param userId - The user's ID
 * @param seriesId - The series ID
 * @param delta - Amount to change (+1 or -1)
 */
async function updateSeriesBookCount(userId: string, seriesId: string, delta: number): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { updateSeriesBookCounts } = await import('./series.js');
  await updateSeriesBookCounts(userId);
}
