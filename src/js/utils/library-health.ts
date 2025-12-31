/**
 * Library Health Analysis Utilities
 * Analyzes book library for missing/incomplete data and provides fix actions
 */

import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';
import { lookupISBN } from './api.js';
import type { BookCovers as CoverSources } from '../types/index.js';

/** Book data structure for health analysis */
interface Book {
  id: string;
  isbn?: string;
  title?: string;
  author?: string;
  coverImageUrl?: string;
  genres?: string[];
  pageCount?: number;
  physicalFormat?: string;
  publisher?: string;
  publishedDate?: string;
  deletedAt?: unknown;
  covers?: CoverSources;
  [key: string]: unknown;
}

/** Health field configuration */
interface HealthFieldConfig {
  weight: number;
  label: string;
  apiFixable: boolean;
}

/** Health fields configuration map */
type HealthFieldsMap = Record<string, HealthFieldConfig>;

/** Library health issues */
export interface HealthIssues {
  missingCover: Book[];
  missingGenres: Book[];
  missingPageCount: Book[];
  missingFormat: Book[];
  missingPublisher: Book[];
  missingPublishedDate: Book[];
  missingIsbn: Book[];
  [key: string]: Book[];
}

/** Library health report */
export interface HealthReport {
  totalBooks: number;
  completenessScore: number;
  totalIssues: number;
  fixableBooks: number;
  issues: HealthIssues;
}

/** Completeness rating */
interface CompletenessRating {
  label: string;
  colour: string;
}

/** API data from lookupISBN */
interface APIData {
  coverImageUrl?: string;
  genres?: string[];
  pageCount?: number;
  physicalFormat?: string;
  publisher?: string;
  publishedDate?: string;
  covers?: CoverSources;
}

/** Change preview for a single field */
interface FieldChange {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
}

/** Preview result for a single book */
interface PreviewResult {
  hasChanges: boolean;
  changes: FieldChange[];
  error?: string;
  apiData?: APIData;
}

/** Book with changes and API data */
interface BookWithChanges {
  book: Book;
  changes: FieldChange[];
  apiData: APIData;
}

/** Book without changes */
interface BookNoChanges {
  book: Book;
}

/** Book with error */
interface BookError {
  book: Book;
  error: string;
}

/** Preview batch result */
interface PreviewBatchResult {
  booksWithChanges: BookWithChanges[];
  booksNoChanges: BookNoChanges[];
  errors: BookError[];
}

/** Progress callback type */
type ProgressCallback = (current: number, total: number, book?: Book) => void;

/** Apply changes result */
interface ApplyChangesResult {
  saved: Array<{ book: Book; fieldsUpdated: string[] }>;
  errors: Array<{ book: Book; error: string }>;
}

/** Fix book result */
interface FixBookResult {
  success: boolean;
  fieldsFixed: string[];
  error?: string;
}

/** Fix batch result */
interface FixBatchResult {
  fixed: Array<{ book: Book; fieldsFixed: string[] }>;
  skipped: Array<{ book: Book; reason: string }>;
  errors: Array<{ book: Book; error: string }>;
  fieldsFixedCount: Record<string, number>;
}

/**
 * Fields to check for completeness, with weights for scoring
 * Higher weight = more important for completeness score
 *
 * API availability notes:
 * - coverImageUrl: Good availability from both Google Books and Open Library
 * - genres: Good from Google Books categories, supplemented by Open Library subjects
 * - pageCount: Poor coverage - many books don't have this in APIs
 * - physicalFormat: Very poor - only Open Library edition endpoint, rarely available
 * - publisher: Good availability from both APIs
 * - publishedDate: Good availability from both APIs
 */
export const HEALTH_FIELDS: HealthFieldsMap = {
  coverImageUrl: { weight: 2, label: 'Cover Image', apiFixable: true },
  genres: { weight: 2, label: 'Genres', apiFixable: true },
  pageCount: { weight: 1, label: 'Page Count', apiFixable: false }, // Poor API coverage
  physicalFormat: { weight: 1, label: 'Format', apiFixable: false }, // Very poor API coverage
  publisher: { weight: 1, label: 'Publisher', apiFixable: true },
  publishedDate: { weight: 1, label: 'Published Date', apiFixable: true },
  isbn: { weight: 0, label: 'ISBN', apiFixable: false }, // Not counted in score, but tracked
};

/**
 * Check if a book field has a value
 * @param book - Book object
 * @param field - Field name
 * @returns True if field has a value
 */
export function hasFieldValue(book: Book, field: string): boolean {
  if (field === 'genres') {
    return Array.isArray(book.genres) && book.genres.length > 0;
  }
  return !!book[field];
}

/**
 * Analyze a single book for missing fields
 * @param book - Book object
 * @returns List of missing field names
 */
export function getMissingFields(book: Book): string[] {
  const missing: string[] = [];
  for (const field of Object.keys(HEALTH_FIELDS)) {
    if (!hasFieldValue(book, field)) {
      missing.push(field);
    }
  }
  return missing;
}

/**
 * Calculate completeness score for a single book (0-100%)
 * @param book - Book object
 * @returns Completeness percentage
 */
export function calculateBookCompleteness(book: Book): number {
  let score = 0;
  let totalWeight = 0;

  for (const [field, config] of Object.entries(HEALTH_FIELDS)) {
    if (config.weight > 0) {
      totalWeight += config.weight;
      if (hasFieldValue(book, field)) {
        score += config.weight;
      }
    }
  }

  if (totalWeight === 0) return 100;
  return Math.round((score / totalWeight) * 100);
}

/**
 * Calculate overall library completeness (0-100%)
 * @param books - Array of book objects
 * @returns Library completeness percentage
 */
export function calculateLibraryCompleteness(books: Book[]): number {
  if (!books || books.length === 0) return 100;

  let totalScore = 0;
  let hasIncompleteBook = false;

  for (const book of books) {
    const bookScore = calculateBookCompleteness(book);
    totalScore += bookScore;
    if (bookScore < 100) {
      hasIncompleteBook = true;
    }
  }

  const score = Math.round(totalScore / books.length);

  // Cap at 99% if any book has missing fields (avoid rounding to 100% with issues)
  if (hasIncompleteBook && score === 100) {
    return 99;
  }

  return score;
}

/**
 * Analyze library for missing data
 * @param books - All user books (excluding binned)
 * @returns Health report with issues and completeness score
 */
export function analyzeLibraryHealth(books: Book[]): HealthReport {
  const activeBooks = books.filter(b => !b.deletedAt);

  const issues: HealthIssues = {
    missingCover: [],
    missingGenres: [],
    missingPageCount: [],
    missingFormat: [],
    missingPublisher: [],
    missingPublishedDate: [],
    missingIsbn: [],
  };

  for (const book of activeBooks) {
    if (!hasFieldValue(book, 'coverImageUrl')) issues.missingCover.push(book);
    if (!hasFieldValue(book, 'genres')) issues.missingGenres.push(book);
    if (!hasFieldValue(book, 'pageCount')) issues.missingPageCount.push(book);
    if (!hasFieldValue(book, 'physicalFormat')) issues.missingFormat.push(book);
    if (!hasFieldValue(book, 'publisher')) issues.missingPublisher.push(book);
    if (!hasFieldValue(book, 'publishedDate')) issues.missingPublishedDate.push(book);
    if (!hasFieldValue(book, 'isbn')) issues.missingIsbn.push(book);
  }

  const completenessScore = calculateLibraryCompleteness(activeBooks);

  // Calculate total issues (excluding ISBN since it's not in completeness score)
  const totalIssues =
    issues.missingCover.length +
    issues.missingGenres.length +
    issues.missingPageCount.length +
    issues.missingFormat.length +
    issues.missingPublisher.length +
    issues.missingPublishedDate.length;

  // Books that can be fixed (have ISBN)
  const fixableBooks = activeBooks.filter(b => b.isbn && getMissingFields(b).some(f => HEALTH_FIELDS[f]?.apiFixable));

  return {
    totalBooks: activeBooks.length,
    completenessScore,
    totalIssues,
    fixableBooks: fixableBooks.length,
    issues,
  };
}

/**
 * Get completeness rating label
 * @param score - Completeness score (0-100)
 * @returns Rating label and colour
 */
export function getCompletenessRating(score: number): CompletenessRating {
  if (score >= 90) return { label: 'Excellent', colour: 'green' };
  if (score >= 70) return { label: 'Good', colour: 'green' };
  if (score >= 50) return { label: 'Fair', colour: 'amber' };
  return { label: 'Needs Attention', colour: 'red' };
}

/**
 * Preview what changes would be made from API data (does not save)
 * @param book - Book object with id and isbn
 * @returns Preview result
 */
export async function previewBookFix(book: Book): Promise<PreviewResult> {
  if (!book.isbn) {
    return { hasChanges: false, changes: [], error: 'No ISBN' };
  }

  let apiData: APIData | null;
  try {
    apiData = await lookupISBN(book.isbn, { skipCache: true });
  } catch (_e) {
    return { hasChanges: false, changes: [], error: 'API lookup failed' };
  }

  if (!apiData) {
    return { hasChanges: false, changes: [], error: 'No API data' };
  }

  const changes: FieldChange[] = [];

  // Check each field for potential updates
  if (!book.coverImageUrl && apiData.coverImageUrl) {
    changes.push({
      field: 'coverImageUrl',
      label: 'Cover',
      oldValue: null,
      newValue: apiData.coverImageUrl,
    });
  }
  if ((!book.genres || book.genres.length === 0) && apiData.genres?.length) {
    changes.push({
      field: 'genres',
      label: 'Genres',
      oldValue: null,
      newValue: apiData.genres.join(', '),
    });
  }
  if (!book.pageCount && apiData.pageCount) {
    changes.push({
      field: 'pageCount',
      label: 'Page Count',
      oldValue: null,
      newValue: apiData.pageCount,
    });
  }
  if (!book.physicalFormat && apiData.physicalFormat) {
    changes.push({
      field: 'physicalFormat',
      label: 'Format',
      oldValue: null,
      newValue: apiData.physicalFormat,
    });
  }
  if (!book.publisher && apiData.publisher) {
    changes.push({
      field: 'publisher',
      label: 'Publisher',
      oldValue: null,
      newValue: apiData.publisher,
    });
  }
  if (!book.publishedDate && apiData.publishedDate) {
    changes.push({
      field: 'publishedDate',
      label: 'Published',
      oldValue: null,
      newValue: apiData.publishedDate,
    });
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    apiData, // Include full API data for later use
  };
}

/**
 * Preview fixes for multiple books
 * @param books - Books to check
 * @param onProgress - Progress callback (current, total, book)
 * @param delayMs - Delay between API calls
 * @returns Preview batch result
 */
export async function previewBooksFromAPI(
  books: Book[],
  onProgress?: ProgressCallback,
  delayMs: number = 500
): Promise<PreviewBatchResult> {
  const results: PreviewBatchResult = {
    booksWithChanges: [],
    booksNoChanges: [],
    errors: [],
  };

  for (let i = 0; i < books.length; i++) {
    const book = books[i];

    if (onProgress) {
      onProgress(i + 1, books.length, book);
    }

    if (!book.isbn) {
      results.errors.push({ book, error: 'No ISBN' });
      continue;
    }

    const preview = await previewBookFix(book);

    if (preview.error && preview.error !== 'No API data') {
      results.errors.push({ book, error: preview.error });
    } else if (preview.hasChanges && preview.apiData) {
      results.booksWithChanges.push({ book, changes: preview.changes, apiData: preview.apiData });
    } else {
      results.booksNoChanges.push({ book });
    }

    // Delay between API calls
    if (i < books.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Apply previewed changes to books
 * @param userId - User ID
 * @param booksWithChanges - From previewBooksFromAPI results
 * @param onProgress - Progress callback (current, total)
 * @returns Apply changes result
 */
export async function applyPreviewedChanges(
  userId: string,
  booksWithChanges: BookWithChanges[],
  onProgress?: (current: number, total: number) => void
): Promise<ApplyChangesResult> {
  const results: ApplyChangesResult = { saved: [], errors: [] };

  for (let i = 0; i < booksWithChanges.length; i++) {
    const { book, apiData } = booksWithChanges[i];

    if (onProgress) {
      onProgress(i + 1, booksWithChanges.length);
    }

    const updates: Record<string, unknown> = {};

    // Build updates from API data
    if (!book.coverImageUrl && apiData.coverImageUrl) {
      updates.coverImageUrl = apiData.coverImageUrl;
    }
    if ((!book.genres || book.genres.length === 0) && apiData.genres?.length) {
      updates.genres = apiData.genres;
    }
    if (!book.pageCount && apiData.pageCount) {
      updates.pageCount = apiData.pageCount;
    }
    if (!book.physicalFormat && apiData.physicalFormat) {
      updates.physicalFormat = apiData.physicalFormat;
    }
    if (!book.publisher && apiData.publisher) {
      updates.publisher = apiData.publisher;
    }
    if (!book.publishedDate && apiData.publishedDate) {
      updates.publishedDate = apiData.publishedDate;
    }

    // Update covers object
    if (apiData.covers) {
      const existingCovers = book.covers || {};
      const newCovers: CoverSources = { ...existingCovers };
      if (apiData.covers.googleBooks && !existingCovers.googleBooks) {
        newCovers.googleBooks = apiData.covers.googleBooks;
      }
      if (apiData.covers.openLibrary && !existingCovers.openLibrary) {
        newCovers.openLibrary = apiData.covers.openLibrary;
      }
      if (Object.keys(newCovers).length > Object.keys(existingCovers).length) {
        updates.covers = newCovers;
      }
    }

    if (Object.keys(updates).length === 0) {
      continue; // No updates needed
    }

    try {
      updates.updatedAt = serverTimestamp();
      await updateDoc(doc(db, 'users', userId, 'books', book.id), updates);
      results.saved.push({
        book,
        fieldsUpdated: Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'covers'),
      });
    } catch (err) {
      const error = err as Error;
      results.errors.push({ book, error: error.message });
    }
  }

  return results;
}

/**
 * Attempt to fix a book from API data (legacy - still used for single book fixes)
 * Only fills empty fields - never overwrites existing user data
 * @param userId - User ID
 * @param book - Book object with id and isbn
 * @returns Fix result
 */
export async function fixBookFromAPI(userId: string, book: Book): Promise<FixBookResult> {
  if (!book.isbn) {
    return { success: false, fieldsFixed: [], error: 'No ISBN - cannot lookup' };
  }

  let apiData: APIData | null;
  try {
    apiData = await lookupISBN(book.isbn, { skipCache: true });
  } catch (_e) {
    return { success: false, fieldsFixed: [], error: 'API lookup failed' };
  }

  if (!apiData) {
    return { success: false, fieldsFixed: [], error: 'No data available from APIs' };
  }

  const updates: Record<string, unknown> = {};
  const fieldsFixed: string[] = [];

  // Only fill empty fields (never overwrite user data)
  if (!book.coverImageUrl && apiData.coverImageUrl) {
    updates.coverImageUrl = apiData.coverImageUrl;
    fieldsFixed.push('coverImageUrl');
  }
  if ((!book.genres || book.genres.length === 0) && apiData.genres?.length) {
    updates.genres = apiData.genres;
    fieldsFixed.push('genres');
  }
  if (!book.pageCount && apiData.pageCount) {
    updates.pageCount = apiData.pageCount;
    fieldsFixed.push('pageCount');
  }
  if (!book.physicalFormat && apiData.physicalFormat) {
    updates.physicalFormat = apiData.physicalFormat;
    fieldsFixed.push('physicalFormat');
  }
  if (!book.publisher && apiData.publisher) {
    updates.publisher = apiData.publisher;
    fieldsFixed.push('publisher');
  }
  if (!book.publishedDate && apiData.publishedDate) {
    updates.publishedDate = apiData.publishedDate;
    fieldsFixed.push('publishedDate');
  }

  // Also update covers object if available
  if (apiData.covers) {
    const existingCovers = book.covers || {};
    const newCovers: CoverSources = { ...existingCovers };
    if (apiData.covers.googleBooks && !existingCovers.googleBooks) {
      newCovers.googleBooks = apiData.covers.googleBooks;
    }
    if (apiData.covers.openLibrary && !existingCovers.openLibrary) {
      newCovers.openLibrary = apiData.covers.openLibrary;
    }
    if (Object.keys(newCovers).length > Object.keys(existingCovers).length) {
      updates.covers = newCovers;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, fieldsFixed: [], error: 'No new data available' };
  }

  // Save to Firestore
  try {
    updates.updatedAt = serverTimestamp();
    await updateDoc(doc(db, 'users', userId, 'books', book.id), updates);
    return { success: true, fieldsFixed };
  } catch (err) {
    const error = err as Error;
    return { success: false, fieldsFixed: [], error: `Save failed: ${error.message}` };
  }
}

/**
 * Fix multiple books from API data with progress callback
 * @param userId - User ID
 * @param books - Books to fix
 * @param onProgress - Progress callback (current, total, book)
 * @param delayMs - Delay between API calls (default: 500ms)
 * @returns Fix batch result
 */
export async function fixBooksFromAPI(
  userId: string,
  books: Book[],
  onProgress?: ProgressCallback,
  delayMs: number = 500
): Promise<FixBatchResult> {
  const results: FixBatchResult = {
    fixed: [],
    skipped: [],
    errors: [],
    fieldsFixedCount: {},
  };

  for (let i = 0; i < books.length; i++) {
    const book = books[i];

    if (onProgress) {
      onProgress(i + 1, books.length, book);
    }

    const result = await fixBookFromAPI(userId, book);

    if (result.success) {
      results.fixed.push({ book, fieldsFixed: result.fieldsFixed });
      // Count fields fixed
      for (const field of result.fieldsFixed) {
        results.fieldsFixedCount[field] = (results.fieldsFixedCount[field] || 0) + 1;
      }
    } else if (result.error === 'No ISBN - cannot lookup') {
      results.skipped.push({ book, reason: 'No ISBN' });
    } else {
      results.errors.push({ book, error: result.error || 'Unknown error' });
    }

    // Delay between API calls to avoid rate limiting
    if (i < books.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Get books that need a specific field fixed
 * @param healthReport - Result from analyzeLibraryHealth
 * @param issueType - One of: missingCover, missingGenres, missingPageCount, etc.
 * @returns Books with that issue
 */
export function getBooksWithIssue(healthReport: HealthReport, issueType: keyof HealthIssues): Book[] {
  return healthReport.issues[issueType] || [];
}

/**
 * Get fixable books for a specific issue (books with ISBN)
 * @param healthReport - Result from analyzeLibraryHealth
 * @param issueType - One of: missingCover, missingGenres, missingPageCount, etc.
 * @returns Fixable books with that issue
 */
export function getFixableBooksWithIssue(healthReport: HealthReport, issueType: keyof HealthIssues): Book[] {
  const books = getBooksWithIssue(healthReport, issueType);
  return books.filter(b => b.isbn);
}
