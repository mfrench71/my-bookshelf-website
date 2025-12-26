// Series Management Module
import { db } from '/js/firebase-config.js';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeSeriesName } from './utils/series-parser.js';

// In-memory cache for series (with TTL)
let seriesCache = null;
let seriesCacheUserId = null;
let seriesCacheTime = 0;
const SERIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all series for a user
 * @param {string} userId - The user's ID
 * @param {boolean} forceRefresh - Force reload from Firestore
 * @returns {Promise<Array>} Array of series objects
 */
export async function loadUserSeries(userId, forceRefresh = false) {
  const now = Date.now();
  const cacheValid = seriesCache &&
                     seriesCacheUserId === userId &&
                     (now - seriesCacheTime) < SERIES_CACHE_TTL;

  if (!forceRefresh && cacheValid) {
    return seriesCache;
  }

  const seriesRef = collection(db, 'users', userId, 'series');
  const q = query(seriesRef, orderBy('name', 'asc'));
  const snapshot = await getDocs(q);

  seriesCache = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  seriesCacheUserId = userId;
  seriesCacheTime = Date.now();

  return seriesCache;
}

/**
 * Find a series by name (normalised matching)
 * @param {string} userId - The user's ID
 * @param {string} name - Series name to search for
 * @returns {Promise<Object|null>} Matching series or null
 */
export async function findSeriesByName(userId, name) {
  const series = await loadUserSeries(userId);
  const normalizedName = normalizeSeriesName(name);
  return series.find(s => s.normalizedName === normalizedName) || null;
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const seriesRef = collection(db, 'users', userId, 'series');
  const docRef = await addDoc(seriesRef, seriesData);

  // Invalidate cache
  seriesCache = null;

  return { id: docRef.id, ...seriesData };
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
  const updateData = { updatedAt: serverTimestamp() };
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

  const seriesRef = doc(db, 'users', userId, 'series', seriesId);
  await updateDoc(seriesRef, updateData);

  // Invalidate cache
  seriesCache = null;

  return { id: seriesId, ...updateData };
}

/**
 * Delete a series and unlink it from all books
 * @param {string} userId - The user's ID
 * @param {string} seriesId - The series ID to delete
 * @returns {Promise<number>} Number of books updated
 */
export async function deleteSeries(userId, seriesId) {
  const batch = writeBatch(db);

  // Find all books with this series
  const booksRef = collection(db, 'users', userId, 'books');
  const q = query(booksRef, where('seriesId', '==', seriesId));
  const snapshot = await getDocs(q);

  // Remove series reference from each book
  snapshot.docs.forEach(bookDoc => {
    const bookRef = doc(db, 'users', userId, 'books', bookDoc.id);
    batch.update(bookRef, {
      seriesId: null,
      seriesPosition: null,
      updatedAt: serverTimestamp()
    });
  });

  // Delete the series document
  const seriesRef = doc(db, 'users', userId, 'series', seriesId);
  batch.delete(seriesRef);

  await batch.commit();

  // Invalidate cache
  seriesCache = null;

  return snapshot.docs.length;
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
      updatedAt: serverTimestamp()
    });
  });

  // Merge expectedBooks arrays (avoiding duplicates by ISBN or title)
  const mergedExpectedBooks = [...(targetSeries.expectedBooks || [])];
  const existingIsbns = new Set(mergedExpectedBooks.map(b => b.isbn).filter(Boolean));
  const existingTitles = new Set(mergedExpectedBooks.map(b => b.title.toLowerCase()));

  for (const book of (sourceSeries.expectedBooks || [])) {
    const isDuplicate = (book.isbn && existingIsbns.has(book.isbn)) ||
                       existingTitles.has(book.title.toLowerCase());
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
    updatedAt: serverTimestamp()
  });

  // Delete source series
  const sourceSeriesRef = doc(db, 'users', userId, 'series', sourceSeriesId);
  batch.delete(sourceSeriesRef);

  await batch.commit();

  // Invalidate cache
  seriesCache = null;

  return {
    booksUpdated: snapshot.docs.length,
    expectedBooksMerged: mergedExpectedBooks.length - (targetSeries.expectedBooks || []).length
  };
}

/**
 * Update bookCount for a series
 * @param {string} userId - The user's ID
 * @param {string} addedSeriesId - Series ID to increment (or null)
 * @param {string} removedSeriesId - Series ID to decrement (or null)
 */
export async function updateSeriesBookCounts(userId, addedSeriesId = null, removedSeriesId = null) {
  if (!addedSeriesId && !removedSeriesId) return;

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
        updatedAt: serverTimestamp()
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
        updatedAt: serverTimestamp()
      });
      hasUpdates = true;
    }
  }

  if (hasUpdates) {
    await batch.commit();
    // Invalidate cache
    seriesCache = null;
  }
}

/**
 * Recalculate book counts for all series
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Results { seriesUpdated, totalBooks }
 */
export async function recalculateSeriesBookCounts(userId) {
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
        updatedAt: serverTimestamp()
      });
      seriesUpdated++;
    }
  }

  if (seriesUpdated > 0) {
    await batch.commit();
  }

  // Invalidate cache
  seriesCache = null;

  return {
    seriesUpdated,
    totalBooks: booksSnapshot.docs.length
  };
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
  const isDuplicate = expectedBooks.some(b =>
    (book.isbn && b.isbn === book.isbn) ||
    b.title.toLowerCase() === book.title.toLowerCase()
  );

  if (isDuplicate) {
    throw new Error('Book already exists in expected books');
  }

  expectedBooks.push({
    title: book.title.trim(),
    isbn: book.isbn?.trim() || null,
    position: book.position || null,
    source: book.source || 'manual'
  });

  // Sort by position
  expectedBooks.sort((a, b) => {
    if (a.position === null && b.position === null) return 0;
    if (a.position === null) return 1;
    if (b.position === null) return -1;
    return a.position - b.position;
  });

  await updateSeries(userId, seriesId, { expectedBooks });
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

  await updateSeries(userId, seriesId, { expectedBooks });
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

    const matches = series.filter(other =>
      other.id !== s.id &&
      !processed.has(other.id) &&
      areSimilarNames(s.name, other.name)
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
