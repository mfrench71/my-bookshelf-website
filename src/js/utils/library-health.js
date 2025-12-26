/**
 * Library Health Analysis Utilities
 * Analyzes book library for missing/incomplete data and provides fix actions
 */

import { doc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';
import { lookupISBN } from './api.js';

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
export const HEALTH_FIELDS = {
  coverImageUrl: { weight: 2, label: 'Cover Image', apiFixable: true },
  genres: { weight: 2, label: 'Genres', apiFixable: true },
  pageCount: { weight: 1, label: 'Page Count', apiFixable: false }, // Poor API coverage
  physicalFormat: { weight: 1, label: 'Format', apiFixable: false }, // Very poor API coverage
  publisher: { weight: 1, label: 'Publisher', apiFixable: true },
  publishedDate: { weight: 1, label: 'Published Date', apiFixable: true },
  isbn: { weight: 0, label: 'ISBN', apiFixable: false } // Not counted in score, but tracked
};

/**
 * Check if a book field has a value
 * @param {Object} book - Book object
 * @param {string} field - Field name
 * @returns {boolean} True if field has a value
 */
export function hasFieldValue(book, field) {
  if (field === 'genres') {
    return Array.isArray(book.genres) && book.genres.length > 0;
  }
  return !!book[field];
}

/**
 * Analyze a single book for missing fields
 * @param {Object} book - Book object
 * @returns {Array<string>} List of missing field names
 */
export function getMissingFields(book) {
  const missing = [];
  for (const field of Object.keys(HEALTH_FIELDS)) {
    if (!hasFieldValue(book, field)) {
      missing.push(field);
    }
  }
  return missing;
}

/**
 * Calculate completeness score for a single book (0-100%)
 * @param {Object} book - Book object
 * @returns {number} Completeness percentage
 */
export function calculateBookCompleteness(book) {
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
 * @param {Array<Object>} books - Array of book objects
 * @returns {number} Library completeness percentage
 */
export function calculateLibraryCompleteness(books) {
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
 * @param {Array<Object>} books - All user books (excluding binned)
 * @returns {Object} Health report with issues and completeness score
 */
export function analyzeLibraryHealth(books) {
  const activeBooks = books.filter(b => !b.deletedAt);

  const issues = {
    missingCover: [],
    missingGenres: [],
    missingPageCount: [],
    missingFormat: [],
    missingPublisher: [],
    missingPublishedDate: [],
    missingIsbn: []
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
  const totalIssues = issues.missingCover.length +
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
    issues
  };
}

/**
 * Get completeness rating label
 * @param {number} score - Completeness score (0-100)
 * @returns {Object} { label, colour }
 */
export function getCompletenessRating(score) {
  if (score >= 90) return { label: 'Excellent', colour: 'green' };
  if (score >= 70) return { label: 'Good', colour: 'green' };
  if (score >= 50) return { label: 'Fair', colour: 'amber' };
  return { label: 'Needs Attention', colour: 'red' };
}

/**
 * Preview what changes would be made from API data (does not save)
 * @param {Object} book - Book object with id and isbn
 * @returns {Promise<Object>} { hasChanges, changes[], error? }
 */
export async function previewBookFix(book) {
  if (!book.isbn) {
    return { hasChanges: false, changes: [], error: 'No ISBN' };
  }

  let apiData;
  try {
    apiData = await lookupISBN(book.isbn, { skipCache: true });
  } catch (e) {
    return { hasChanges: false, changes: [], error: 'API lookup failed' };
  }

  if (!apiData) {
    return { hasChanges: false, changes: [], error: 'No API data' };
  }

  const changes = [];

  // Check each field for potential updates
  if (!book.coverImageUrl && apiData.coverImageUrl) {
    changes.push({ field: 'coverImageUrl', label: 'Cover', oldValue: null, newValue: apiData.coverImageUrl });
  }
  if ((!book.genres || book.genres.length === 0) && apiData.genres?.length > 0) {
    changes.push({ field: 'genres', label: 'Genres', oldValue: null, newValue: apiData.genres.join(', ') });
  }
  if (!book.pageCount && apiData.pageCount) {
    changes.push({ field: 'pageCount', label: 'Page Count', oldValue: null, newValue: apiData.pageCount });
  }
  if (!book.physicalFormat && apiData.physicalFormat) {
    changes.push({ field: 'physicalFormat', label: 'Format', oldValue: null, newValue: apiData.physicalFormat });
  }
  if (!book.publisher && apiData.publisher) {
    changes.push({ field: 'publisher', label: 'Publisher', oldValue: null, newValue: apiData.publisher });
  }
  if (!book.publishedDate && apiData.publishedDate) {
    changes.push({ field: 'publishedDate', label: 'Published', oldValue: null, newValue: apiData.publishedDate });
  }

  return {
    hasChanges: changes.length > 0,
    changes,
    apiData // Include full API data for later use
  };
}

/**
 * Preview fixes for multiple books
 * @param {Array<Object>} books - Books to check
 * @param {Function} onProgress - Progress callback (current, total, book)
 * @param {number} delayMs - Delay between API calls
 * @returns {Promise<Object>} { booksWithChanges[], booksNoChanges[], errors[] }
 */
export async function previewBooksFromAPI(books, onProgress, delayMs = 500) {
  const results = {
    booksWithChanges: [],
    booksNoChanges: [],
    errors: []
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
    } else if (preview.hasChanges) {
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
 * @param {string} userId - User ID
 * @param {Array<Object>} booksWithChanges - From previewBooksFromAPI results
 * @param {Function} onProgress - Progress callback (current, total)
 * @returns {Promise<Object>} { saved, errors }
 */
export async function applyPreviewedChanges(userId, booksWithChanges, onProgress) {
  const results = { saved: [], errors: [] };

  for (let i = 0; i < booksWithChanges.length; i++) {
    const { book, apiData } = booksWithChanges[i];

    if (onProgress) {
      onProgress(i + 1, booksWithChanges.length);
    }

    const updates = {};

    // Build updates from API data
    if (!book.coverImageUrl && apiData.coverImageUrl) {
      updates.coverImageUrl = apiData.coverImageUrl;
    }
    if ((!book.genres || book.genres.length === 0) && apiData.genres?.length > 0) {
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
      const newCovers = { ...existingCovers };
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
      results.saved.push({ book, fieldsUpdated: Object.keys(updates).filter(k => k !== 'updatedAt' && k !== 'covers') });
    } catch (e) {
      results.errors.push({ book, error: e.message });
    }
  }

  return results;
}

/**
 * Attempt to fix a book from API data (legacy - still used for single book fixes)
 * Only fills empty fields - never overwrites existing user data
 * @param {string} userId - User ID
 * @param {Object} book - Book object with id and isbn
 * @returns {Promise<Object>} { success, fieldsFixed[], error? }
 */
export async function fixBookFromAPI(userId, book) {
  if (!book.isbn) {
    return { success: false, fieldsFixed: [], error: 'No ISBN - cannot lookup' };
  }

  let apiData;
  try {
    apiData = await lookupISBN(book.isbn, { skipCache: true });
  } catch (e) {
    return { success: false, fieldsFixed: [], error: 'API lookup failed' };
  }

  if (!apiData) {
    return { success: false, fieldsFixed: [], error: 'No data available from APIs' };
  }

  const updates = {};
  const fieldsFixed = [];

  // Only fill empty fields (never overwrite user data)
  if (!book.coverImageUrl && apiData.coverImageUrl) {
    updates.coverImageUrl = apiData.coverImageUrl;
    fieldsFixed.push('coverImageUrl');
  }
  if ((!book.genres || book.genres.length === 0) && apiData.genres?.length > 0) {
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
    const newCovers = { ...existingCovers };
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
  } catch (e) {
    return { success: false, fieldsFixed: [], error: `Save failed: ${e.message}` };
  }
}

/**
 * Fix multiple books from API data with progress callback
 * @param {string} userId - User ID
 * @param {Array<Object>} books - Books to fix
 * @param {Function} onProgress - Progress callback (current, total, book)
 * @param {number} delayMs - Delay between API calls (default: 500ms)
 * @returns {Promise<Object>} { fixed, skipped, errors, fieldsFixedCount }
 */
export async function fixBooksFromAPI(userId, books, onProgress, delayMs = 500) {
  const results = {
    fixed: [],
    skipped: [],
    errors: [],
    fieldsFixedCount: {}
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
      results.errors.push({ book, error: result.error });
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
 * @param {Object} healthReport - Result from analyzeLibraryHealth
 * @param {string} issueType - One of: missingCover, missingGenres, missingPageCount, etc.
 * @returns {Array<Object>} Books with that issue
 */
export function getBooksWithIssue(healthReport, issueType) {
  return healthReport.issues[issueType] || [];
}

/**
 * Get fixable books for a specific issue (books with ISBN)
 * @param {Object} healthReport - Result from analyzeLibraryHealth
 * @param {string} issueType - One of: missingCover, missingGenres, missingPageCount, etc.
 * @returns {Array<Object>} Fixable books with that issue
 */
export function getFixableBooksWithIssue(healthReport, issueType) {
  const books = getBooksWithIssue(healthReport, issueType);
  return books.filter(b => b.isbn);
}
