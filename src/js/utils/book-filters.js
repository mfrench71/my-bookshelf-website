// Book Filters - Pure filter functions for book arrays

import { getBookStatus } from './reading.js';

/**
 * Filter books by minimum rating
 * @param {Array} books - Array of books to filter
 * @param {number|string} ratingValue - Minimum rating (0 = no filter, 'unrated' = only unrated)
 * @returns {Array} Filtered books array
 */
export function filterByRating(books, ratingValue) {
  if (ratingValue === 0) return books;
  if (ratingValue === 'unrated') {
    return books.filter(b => !b.rating || b.rating === 0);
  }
  return books.filter(b => (b.rating || 0) >= ratingValue);
}

/**
 * Filter books by genre IDs (OR logic - any selected genre matches)
 * @param {Array} books - Array of books to filter
 * @param {Array<string>} genreIds - Array of genre IDs to filter by
 * @returns {Array} Filtered books array
 */
export function filterByGenres(books, genreIds) {
  if (!genreIds || genreIds.length === 0) return books;
  return books.filter(b => b.genres && b.genres.some(gId => genreIds.includes(gId)));
}

/**
 * Filter books by reading status (OR logic - any selected status matches)
 * @param {Array} books - Array of books to filter
 * @param {Array<string>} statuses - Array of statuses ('reading', 'finished', 'to-read', 'dnf')
 * @returns {Array} Filtered books array
 */
export function filterByStatuses(books, statuses) {
  if (!statuses || statuses.length === 0) return books;
  return books.filter(b => statuses.includes(getBookStatus(b)));
}

/**
 * Filter books by series IDs (OR logic - any selected series matches)
 * @param {Array} books - Array of books to filter
 * @param {Array<string>} seriesIds - Array of series IDs to filter by
 * @returns {Array} Filtered books array
 */
export function filterBySeriesIds(books, seriesIds) {
  if (!seriesIds || seriesIds.length === 0) return books;
  return books.filter(b => b.seriesId && seriesIds.includes(b.seriesId));
}

/**
 * Filter books by author name (case-insensitive exact match)
 * @param {Array} books - Array of books to filter
 * @param {string} author - Author name to filter by
 * @returns {Array} Filtered books array
 */
export function filterByAuthor(books, author) {
  if (!author) return books;
  const authorLower = author.toLowerCase();
  return books.filter(b => b.author?.toLowerCase() === authorLower);
}

/**
 * Apply all filters to a books array
 * @param {Array} books - Array of books to filter
 * @param {Object} filters - Filter configuration
 * @param {number} [filters.rating=0] - Minimum rating filter
 * @param {Array<string>} [filters.genres=[]] - Genre IDs to filter by
 * @param {Array<string>} [filters.statuses=[]] - Statuses to filter by
 * @param {Array<string>} [filters.seriesIds=[]] - Series IDs to filter by
 * @param {string} [filters.author=''] - Author to filter by
 * @returns {Array} Filtered books array
 */
export function applyFilters(books, filters = {}) {
  const { rating = 0, genres = [], statuses = [], seriesIds = [], author = '' } = filters;

  let filtered = books;
  filtered = filterByRating(filtered, rating);
  filtered = filterByGenres(filtered, genres);
  filtered = filterByStatuses(filtered, statuses);
  filtered = filterBySeriesIds(filtered, seriesIds);
  filtered = filterByAuthor(filtered, author);

  return filtered;
}
