// Series Management Module
import { db } from '/js/firebase-config.js';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeSeriesName } from './utils/series-parser.js';
import { seriesRepository } from './repositories/series-repository.js';
import { bookRepository } from './repositories/book-repository.js';

// In-memory cache for series (with TTL)
let seriesCache = null;
let seriesCacheUserId = null;
let seriesCacheTime = 0;
const SERIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all series for a user (excludes soft-deleted series)
 * @param {string} userId - The user's ID
 * @param {boolean} forceRefresh - Force reload from Firestore
 * @returns {Promise<Array>} Array of series objects
 */
export async function loadUserSeries(userId, forceRefresh = false) {
  const now = Date.now();
  const cacheValid = seriesCache && seriesCacheUserId === userId && now - seriesCacheTime < SERIES_CACHE_TTL;

  if (!forceRefresh && cacheValid) {
    return seriesCache;
  }

  try {
    const allSeries = await seriesRepository.getAllSorted(userId);
    // Filter out soft-deleted series
    seriesCache = allSeries.filter(s => !s.deletedAt);
    seriesCacheUserId = userId;
    seriesCacheTime = Date.now();

    return seriesCache;
  } catch (error) {
    console.error('Error loading series:', error);
    throw error;
  }
}

/**
 * Find a series by name (normalised matching)
 * @param {string} userId - The user's ID
 * @param {string} name - Series name to search for
 * @returns {Promise<Object|null>} Matching series or null
 */
export async function findSeriesByName(userId, name) {
  try {
    const series = await loadUserSeries(userId);
    const normalizedName = normalizeSeriesName(name);
    return series.find(s => s.normalizedName === normalizedName) || null;
  } catch (error) {
    console.error('Error finding series by name:', error);
    throw error;
  }
}

/**
 * Create a new series
 * @param {string} userId - The user's ID
 * @param {string} name - Series name
 * @param {string} description - Optional description
 * @param {number} totalBooks - Optional total books in series
 * @returns {Promise<Object>} Created series object with ID
 * @throws {Error} If series with same name already exists
 */
export async function createSeries(userId, name, description = null, totalBooks = null) {
  const normalizedName = normalizeSeriesName(name);

  // Check for duplicate name
  const series = await loadUserSeries(userId);
  const existing = series.find(s => s.normalizedName === normalizedName);

  if (existing) {
    throw new Error(`Series "${existing.name}" already exists`);
  }

  const seriesData = {
    name: name.trim(),
    normalizedName,
    description: description?.trim() || null,
    totalBooks: totalBooks && totalBooks > 0 ? totalBooks : null,
    expectedBooks: [],
    bookCount: 0,
  };

  try {
    const result = await seriesRepository.create(userId, seriesData);

    // Invalidate cache
    seriesCache = null;

    return result;
  } catch (error) {
    console.error('Error creating series:', error);
    throw error;
  }
}

/**
 * Update an existing series
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID
 * @param {Object} updates - Fields to update (name, description, totalBooks, expectedBooks)
 * @returns {Promise<Object>} Updated series object
 * @throws {Error} If renaming to an existing series name
 */
export async function updateSeries(userId, seriesId, updates) {
  const updateData = {};
  const series = await loadUserSeries(userId);

  if (updates.name !== undefined) {
    const normalizedName = normalizeSeriesName(updates.name);

    // Check for duplicate name (excluding self)
    const existing = series.find(s => s.normalizedName === normalizedName && s.id !== seriesId);

    if (existing) {
      throw new Error(`Series "${existing.name}" already exists`);
    }

    updateData.name = updates.name.trim();
    updateData.normalizedName = normalizedName;
  }

  if (updates.description !== undefined) {
    updateData.description = updates.description?.trim() || null;
  }

  if (updates.totalBooks !== undefined) {
    updateData.totalBooks = updates.totalBooks && updates.totalBooks > 0 ? updates.totalBooks : null;
  }

  if (updates.expectedBooks !== undefined) {
    updateData.expectedBooks = updates.expectedBooks || [];
  }

  try {
    await seriesRepository.update(userId, seriesId, updateData);

    // Invalidate cache
    seriesCache = null;

    return { id: seriesId, ...updateData };
  } catch (error) {
    console.error('Error updating series:', error);
    throw error;
  }
}

/**
 * Delete a series and unlink it from all books (hard delete)
 * Used for intentional deletion from Settings
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID to delete
 * @returns {Promise<number>} Number of books updated
 */
export async function deleteSeries(userId, seriesId) {
  try {
    const batch = writeBatch(db);

    // Find all books with this series using repository
    const booksInSeries = await bookRepository.getBySeriesId(userId, seriesId);

    // Remove series reference from each book
    booksInSeries.forEach(book => {
      const bookRef = doc(db, 'users', userId, 'books', book.id);
      batch.update(bookRef, {
        seriesId: null,
        seriesPosition: null,
      });
    });

    // Delete the series document
    const seriesRef = doc(db, 'users', userId, 'series', seriesId);
    batch.delete(seriesRef);

    await batch.commit();

    // Invalidate cache
    seriesCache = null;

    return booksInSeries.length;
  } catch (error) {
    console.error('Error deleting series:', error);
    throw error;
  }
}

/**
 * Soft delete a series (move to bin)
 * Used when deleting the last book in a series - allows restore with book
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID to soft delete
 * @returns {Promise<void>}
 */
export async function softDeleteSeries(userId, seriesId) {
  try {
    await seriesRepository.softDelete(userId, seriesId);

    // Invalidate cache
    seriesCache = null;
  } catch (error) {
    console.error('Error soft deleting series:', error);
    throw error;
  }
}

/**
 * Restore a soft-deleted series
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID to restore
 * @returns {Promise<void>}
 */
export async function restoreSeries(userId, seriesId) {
  try {
    await seriesRepository.restore(userId, seriesId);

    // Invalidate cache
    seriesCache = null;
  } catch (error) {
    console.error('Error restoring series:', error);
    throw error;
  }
}

/**
 * Get a series by ID (including soft-deleted)
 * Used for restore operations
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID
 * @returns {Promise<Object|null>} Series object or null if not found
 */
export async function getSeriesById(userId, seriesId) {
  try {
    return await seriesRepository.getById(userId, seriesId);
  } catch (error) {
    console.error('Error getting series by ID:', error);
    throw error;
  }
}

/**
 * Merge one series into another
 * @param {string} userId - The user's ID
 * @param {string} sourceSeriesId - Series to merge from (will be deleted)
 * @param {string} targetSeriesId - Series to merge into (will be kept)
 * @returns {Promise<Object>} Results { booksUpdated, expectedBooksMerged }
 */
export async function mergeSeries(userId, sourceSeriesId, targetSeriesId) {
  if (sourceSeriesId === targetSeriesId) {
    throw new Error('Cannot merge a series into itself');
  }

  const series = await loadUserSeries(userId, true);
  const sourceSeries = series.find(s => s.id === sourceSeriesId);
  const targetSeries = series.find(s => s.id === targetSeriesId);

  if (!sourceSeries) throw new Error('Source series not found');
  if (!targetSeries) throw new Error('Target series not found');

  try {
    const batch = writeBatch(db);

    // Find all books with the source series
    const booksRef = collection(db, 'users', userId, 'books');
    const q = query(booksRef, where('seriesId', '==', sourceSeriesId));
    const snapshot = await getDocs(q);

    // Update books to use target series
    snapshot.docs.forEach(bookDoc => {
      const bookRef = doc(db, 'users', userId, 'books', bookDoc.id);
      batch.update(bookRef, {
        seriesId: targetSeriesId,
        updatedAt: serverTimestamp(),
      });
    });

    // Merge expectedBooks arrays (avoiding duplicates by ISBN or title)
    const mergedExpectedBooks = [...(targetSeries.expectedBooks || [])];
    const existingIsbns = new Set(mergedExpectedBooks.map(b => b.isbn).filter(Boolean));
    const existingTitles = new Set(mergedExpectedBooks.map(b => b.title.toLowerCase()));

    for (const book of sourceSeries.expectedBooks || []) {
      const isDuplicate = (book.isbn && existingIsbns.has(book.isbn)) || existingTitles.has(book.title.toLowerCase());
      if (!isDuplicate) {
        mergedExpectedBooks.push(book);
        if (book.isbn) existingIsbns.add(book.isbn);
        existingTitles.add(book.title.toLowerCase());
      }
    }

    // Update target series
    const newBookCount = (targetSeries.bookCount || 0) + snapshot.docs.length;
    const newTotalBooks = Math.max(
      targetSeries.totalBooks || 0,
      sourceSeries.totalBooks || 0,
      newBookCount + mergedExpectedBooks.length
    );

    const targetSeriesRef = doc(db, 'users', userId, 'series', targetSeriesId);
    batch.update(targetSeriesRef, {
      bookCount: newBookCount,
      totalBooks: newTotalBooks || null,
      expectedBooks: mergedExpectedBooks,
      updatedAt: serverTimestamp(),
    });

    // Delete source series
    const sourceSeriesRef = doc(db, 'users', userId, 'series', sourceSeriesId);
    batch.delete(sourceSeriesRef);

    await batch.commit();

    // Invalidate cache
    seriesCache = null;

    return {
      booksUpdated: snapshot.docs.length,
      expectedBooksMerged: mergedExpectedBooks.length - (targetSeries.expectedBooks || []).length,
    };
  } catch (error) {
    console.error('Error merging series:', error);
    throw error;
  }
}

/**
 * Update bookCount for a series
 * @param {string} userId - The user's ID
 * @param {string} addedSeriesId - Series ID to increment (or null)
 * @param {string} removedSeriesId - Series ID to decrement (or null)
 */
export async function updateSeriesBookCounts(userId, addedSeriesId = null, removedSeriesId = null) {
  if (!addedSeriesId && !removedSeriesId) return;

  try {
    const series = await loadUserSeries(userId, true);
    const seriesMap = new Map(series.map(s => [s.id, s]));
    const batch = writeBatch(db);
    let hasUpdates = false;

    // Increment count for added series
    if (addedSeriesId) {
      const addedSeries = seriesMap.get(addedSeriesId);
      if (addedSeries) {
        const seriesRef = doc(db, 'users', userId, 'series', addedSeriesId);
        batch.update(seriesRef, {
          bookCount: (addedSeries.bookCount || 0) + 1,
          updatedAt: serverTimestamp(),
        });
        hasUpdates = true;
      }
    }

    // Decrement count for removed series
    if (removedSeriesId) {
      const removedSeries = seriesMap.get(removedSeriesId);
      if (removedSeries) {
        const seriesRef = doc(db, 'users', userId, 'series', removedSeriesId);
        batch.update(seriesRef, {
          bookCount: Math.max(0, (removedSeries.bookCount || 0) - 1),
          updatedAt: serverTimestamp(),
        });
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      await batch.commit();
      // Invalidate cache
      seriesCache = null;
    }
  } catch (error) {
    console.error('Error updating series book counts:', error);
    throw error;
  }
}

/**
 * Recalculate book counts for all series
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Results { seriesUpdated, totalBooks }
 */
export async function recalculateSeriesBookCounts(userId) {
  try {
    // Load all books
    const booksRef = collection(db, 'users', userId, 'books');
    const booksSnapshot = await getDocs(booksRef);

    // Load all series
    const series = await loadUserSeries(userId, true);

    // Count books per series
    const seriesCounts = new Map();
    for (const s of series) {
      seriesCounts.set(s.id, 0);
    }

    for (const bookDoc of booksSnapshot.docs) {
      const bookData = bookDoc.data();
      // Skip soft-deleted books
      if (bookData.deletedAt) continue;

      const seriesId = bookData.seriesId;

      if (seriesId && seriesCounts.has(seriesId)) {
        seriesCounts.set(seriesId, seriesCounts.get(seriesId) + 1);
      }
    }

    // Update series with new counts
    const batch = writeBatch(db);
    let seriesUpdated = 0;

    for (const s of series) {
      const newCount = seriesCounts.get(s.id) || 0;
      if (newCount !== (s.bookCount || 0)) {
        const seriesRef = doc(db, 'users', userId, 'series', s.id);
        batch.update(seriesRef, {
          bookCount: newCount,
          updatedAt: serverTimestamp(),
        });
        seriesUpdated++;
      }
    }

    if (seriesUpdated > 0) {
      await batch.commit();
    }

    // Invalidate cache
    seriesCache = null;

    // Count only active (non-deleted) books
    const activeBookCount = booksSnapshot.docs.filter(d => !d.data().deletedAt).length;
    return {
      seriesUpdated,
      totalBooks: activeBookCount,
    };
  } catch (error) {
    console.error('Error recalculating series book counts:', error);
    throw error;
  }
}

/**
 * Clear the series cache
 */
export function clearSeriesCache() {
  seriesCache = null;
  seriesCacheUserId = null;
  seriesCacheTime = 0;
}

/**
 * Create a lookup map from series IDs to series objects
 * @param {Array} series - Array of series objects
 * @returns {Map} Map of seriesId -> series object
 */
export function createSeriesLookup(series) {
  return new Map(series.map(s => [s.id, s]));
}

/**
 * Add an expected book to a series
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID
 * @param {Object} book - Book info { title, isbn, position, source }
 * @returns {Promise<void>}
 */
export async function addExpectedBook(userId, seriesId, book) {
  const series = await loadUserSeries(userId);
  const targetSeries = series.find(s => s.id === seriesId);

  if (!targetSeries) throw new Error('Series not found');

  const expectedBooks = [...(targetSeries.expectedBooks || [])];

  // Check for duplicates
  const isDuplicate = expectedBooks.some(
    b => (book.isbn && b.isbn === book.isbn) || b.title.toLowerCase() === book.title.toLowerCase()
  );

  if (isDuplicate) {
    throw new Error('Book already exists in expected books');
  }

  expectedBooks.push({
    title: book.title.trim(),
    isbn: book.isbn?.trim() || null,
    position: book.position || null,
    source: book.source || 'manual',
  });

  // Sort by position
  expectedBooks.sort((a, b) => {
    if (a.position === null && b.position === null) return 0;
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  try {
    await updateSeries(userId, seriesId, { expectedBooks });
  } catch (error) {
    console.error('Error adding expected book:', error);
    throw error;
  }
}

/**
 * Remove an expected book from a series
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID
 * @param {number} index - Index of book to remove
 * @returns {Promise<void>}
 */
export async function removeExpectedBook(userId, seriesId, index) {
  const series = await loadUserSeries(userId);
  const targetSeries = series.find(s => s.id === seriesId);

  if (!targetSeries) throw new Error('Series not found');

  const expectedBooks = [...(targetSeries.expectedBooks || [])];

  if (index < 0 || index >= expectedBooks.length) {
    throw new Error('Invalid book index');
  }

  expectedBooks.splice(index, 1);

  try {
    await updateSeries(userId, seriesId, { expectedBooks });
  } catch (error) {
    console.error('Error removing expected book:', error);
    throw error;
  }
}

/**
 * Get series with potential duplicates (for merge suggestions)
 * @param {Array} series - Array of series objects
 * @returns {Array<Array>} Array of potential duplicate groups
 */
export function findPotentialDuplicates(series) {
  const groups = [];
  const processed = new Set();

  for (const s of series) {
    if (processed.has(s.id)) continue;

    const matches = series.filter(
      other => other.id !== s.id && !processed.has(other.id) && areSimilarNames(s.name, other.name)
    );

    if (matches.length > 0) {
      const group = [s, ...matches];
      group.forEach(g => processed.add(g.id));
      groups.push(group);
    }
  }

  return groups;
}

/**
 * Check if two series names are similar enough to suggest merging
 * @param {string} name1 - First name
 * @param {string} name2 - Second name
 * @returns {boolean} True if names are similar
 */
function areSimilarNames(name1, name2) {
  const n1 = normalizeSeriesName(name1);
  const n2 = normalizeSeriesName(name2);

  // Exact match after normalisation
  if (n1 === n2) return true;

  // One contains the other (e.g., "Harry Potter" vs "Harry Potter Series")
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Remove common suffixes and compare
  const suffixes = ['series', 'saga', 'trilogy', 'cycle', 'chronicles'];
  let stripped1 = n1;
  let stripped2 = n2;

  for (const suffix of suffixes) {
    stripped1 = stripped1.replace(new RegExp(`\\s*${suffix}\\s*$`), '').trim();
    stripped2 = stripped2.replace(new RegExp(`\\s*${suffix}\\s*$`), '').trim();
  }

  if (stripped1 === stripped2 && stripped1.length > 3) return true;

  return false;
}
