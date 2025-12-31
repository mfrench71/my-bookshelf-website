// Book Filters - Pure filter functions for book arrays

import { getBookStatus } from './reading.js';

/** Book type for filtering */
interface Book {
  id?: string;
  title?: string;
  author?: string;
  rating?: number;
  genres?: string[];
  seriesId?: string;
  startDate?: string | Date | null;
  finishDate?: string | Date | null;
  status?: string;
  reads?: Array<{ startedAt?: string | null; finishedAt?: string | null }>;
  [key: string]: unknown;
}

/** Filter configuration */
interface FilterConfig {
  rating?: number | 'unrated';
  genres?: string[];
  statuses?: string[];
  seriesIds?: string[];
  author?: string;
}

/**
 * Filter books by minimum rating
 * @param books - Array of books to filter
 * @param ratingValue - Minimum rating (0 = no filter, 'unrated' = only unrated)
 * @returns Filtered books array
 */
export function filterByRating(books: Book[], ratingValue: number | 'unrated'): Book[] {
  if (ratingValue === 0) return books;
  if (ratingValue === 'unrated') {
    return books.filter(b => !b.rating || b.rating === 0);
  }
  return books.filter(b => (b.rating || 0) >= ratingValue);
}

/**
 * Filter books by genre IDs (OR logic - any selected genre matches)
 * @param books - Array of books to filter
 * @param genreIds - Array of genre IDs to filter by
 * @returns Filtered books array
 */
export function filterByGenres(books: Book[], genreIds: string[]): Book[] {
  if (!genreIds || genreIds.length === 0) return books;
  return books.filter(b => b.genres && b.genres.some(gId => genreIds.includes(gId)));
}

/**
 * Filter books by reading status (OR logic - any selected status matches)
 * @param books - Array of books to filter
 * @param statuses - Array of statuses ('reading', 'finished', 'to-read', 'dnf')
 * @returns Filtered books array
 */
export function filterByStatuses(books: Book[], statuses: string[]): Book[] {
  if (!statuses || statuses.length === 0) return books;
  return books.filter(b => statuses.includes(getBookStatus(b)));
}

/**
 * Filter books by series IDs (OR logic - any selected series matches)
 * @param books - Array of books to filter
 * @param seriesIds - Array of series IDs to filter by
 * @returns Filtered books array
 */
export function filterBySeriesIds(books: Book[], seriesIds: string[]): Book[] {
  if (!seriesIds || seriesIds.length === 0) return books;
  return books.filter(b => b.seriesId && seriesIds.includes(b.seriesId));
}

/**
 * Filter books by author name (case-insensitive exact match)
 * @param books - Array of books to filter
 * @param author - Author name to filter by
 * @returns Filtered books array
 */
export function filterByAuthor(books: Book[], author: string): Book[] {
  if (!author) return books;
  const authorLower = author.toLowerCase();
  return books.filter(b => b.author?.toLowerCase() === authorLower);
}

/**
 * Apply all filters to a books array
 * @param books - Array of books to filter
 * @param filters - Filter configuration
 * @returns Filtered books array
 */
export function applyFilters(books: Book[], filters: FilterConfig = {}): Book[] {
  const { rating = 0, genres = [], statuses = [], seriesIds = [], author = '' } = filters;

  let filtered = books;
  filtered = filterByRating(filtered, rating);
  filtered = filterByGenres(filtered, genres);
  filtered = filterByStatuses(filtered, statuses);
  filtered = filterBySeriesIds(filtered, seriesIds);
  filtered = filterByAuthor(filtered, author);

  return filtered;
}
