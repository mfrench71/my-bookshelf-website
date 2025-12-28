// Genre Management Module
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
import { normalizeGenreName } from './utils.js';

// Predefined color palette for genres (36 colors) - rainbow order
export const GENRE_COLORS = [
  // Reds
  '#fca5a5', // red-300
  '#f87171', // red-400
  '#ef4444', // red-500
  '#dc2626', // red-600
  '#b91c1c', // red-700
  // Roses
  '#fda4af', // rose-300
  '#fb7185', // rose-400
  '#f43f5e', // rose-500
  // Oranges
  '#fdba74', // orange-300
  '#fb923c', // orange-400
  '#f97316', // orange-500
  '#ea580c', // orange-600
  // Ambers
  '#fcd34d', // amber-300
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  // Yellows
  '#fde047', // yellow-300
  '#facc15', // yellow-400
  // Limes
  '#bef264', // lime-300
  '#a3e635', // lime-400
  '#84cc16', // lime-500
  // Greens
  '#86efac', // green-300
  '#4ade80', // green-400
  '#22c55e', // green-500
  '#16a34a', // green-600
  // Emeralds
  '#6ee7b7', // emerald-300
  '#34d399', // emerald-400
  '#10b981', // emerald-500
  // Teals
  '#5eead4', // teal-300
  '#2dd4bf', // teal-400
  '#14b8a6', // teal-500
  // Cyans
  '#67e8f9', // cyan-300
  '#22d3ee', // cyan-400
  '#06b6d4', // cyan-500
  // Skys
  '#7dd3fc', // sky-300
  '#38bdf8', // sky-400
  '#0ea5e9', // sky-500
  // Blues
  '#93c5fd', // blue-300
  '#60a5fa', // blue-400
  '#3b82f6', // blue-500
  '#2563eb', // blue-600
  // Indigos
  '#a5b4fc', // indigo-300
  '#818cf8', // indigo-400
  '#6366f1', // indigo-500
  // Violets
  '#c4b5fd', // violet-300
  '#a78bfa', // violet-400
  '#8b5cf6', // violet-500
  '#7c3aed', // violet-600
  // Purples
  '#d8b4fe', // purple-300
  '#c084fc', // purple-400
  '#a855f7', // purple-500
  '#9333ea', // purple-600
  // Fuchsias
  '#f0abfc', // fuchsia-300
  '#e879f9', // fuchsia-400
  '#d946ef', // fuchsia-500
  // Pinks
  '#f9a8d4', // pink-300
  '#f472b6', // pink-400
  '#ec4899', // pink-500
  // Neutrals
  '#a8a29e', // stone-400
  '#78716c', // stone-500
  '#a1a1aa', // zinc-400
  '#71717a'  // zinc-500
];

// In-memory cache for genres (with TTL)
let genresCache = null;
let genresCacheUserId = null;
let genresCacheTime = 0;
const GENRES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all genres for a user
 * @param {string} userId - The user's ID
 * @param {boolean} forceRefresh - Force reload from Firestore
 * @returns {Promise<Array>} Array of genre objects
 */
export async function loadUserGenres(userId, forceRefresh = false) {
  const now = Date.now();
  const cacheValid = genresCache &&
                     genresCacheUserId === userId &&
                     (now - genresCacheTime) < GENRES_CACHE_TTL;

  if (!forceRefresh && cacheValid) {
    return genresCache;
  }

  try {
    const genresRef = collection(db, 'users', userId, 'genres');
    const q = query(genresRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    genresCache = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    genresCacheUserId = userId;
    genresCacheTime = Date.now();

    return genresCache;
  } catch (error) {
    console.error('Error loading genres:', error);
    throw error;
  }
}

/**
 * Get colors that are already used by genres
 * @param {Array} genres - Array of genre objects
 * @param {string} excludeGenreId - Optional genre ID to exclude (for editing)
 * @returns {Set<string>} Set of used color hex values
 */
export function getUsedColors(genres, excludeGenreId = null) {
  return new Set(
    genres
      .filter(g => g.id !== excludeGenreId)
      .map(g => g.color?.toLowerCase())
  );
}

/**
 * Get available colors (not yet used by any genre)
 * @param {Array} genres - Array of genre objects
 * @param {string} excludeGenreId - Optional genre ID to exclude (for editing)
 * @returns {Array<string>} Array of available color hex values
 */
export function getAvailableColors(genres, excludeGenreId = null) {
  const usedColors = getUsedColors(genres, excludeGenreId);
  return GENRE_COLORS.filter(c => !usedColors.has(c.toLowerCase()));
}

/**
 * Create a new genre
 * @param {string} userId - The user's ID
 * @param {string} name - Genre name
 * @param {string} color - Hex color (optional, auto-assigned if not provided)
 * @returns {Promise<Object>} Created genre object with ID
 * @throws {Error} If genre with same name or color already exists
 */
export async function createGenre(userId, name, color = null) {
  try {
    const normalizedName = normalizeGenreName(name);

    // Check for duplicate name
    const genres = await loadUserGenres(userId);
    const existing = genres.find(g => g.normalizedName === normalizedName);

    if (existing) {
      throw new Error(`Genre "${existing.name}" already exists`);
    }

    const usedColors = getUsedColors(genres);

    // Validate or auto-assign color
    if (color) {
      // Check if color is already used
      if (usedColors.has(color.toLowerCase())) {
        throw new Error('This color is already used by another genre');
      }
    } else {
      // Auto-assign first available color
      color = GENRE_COLORS.find(c => !usedColors.has(c.toLowerCase())) || GENRE_COLORS[genres.length % GENRE_COLORS.length];
    }

    const genreData = {
      name: name.trim(),
      normalizedName,
      color,
      bookCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const genresRef = collection(db, 'users', userId, 'genres');
    const docRef = await addDoc(genresRef, genreData);

    // Invalidate cache
    genresCache = null;

    return { id: docRef.id, ...genreData };
  } catch (error) {
    // Re-throw validation errors as-is, log Firebase errors
    if (!error.message.includes('already exists') && !error.message.includes('already used')) {
      console.error('Error creating genre:', error);
    }
    throw error;
  }
}

/**
 * Update an existing genre
 * @param {string} userId - The user's ID
 * @param {string} genreId - The genre ID
 * @param {Object} updates - Fields to update (name, color)
 * @returns {Promise<Object>} Updated genre object
 * @throws {Error} If renaming to an existing genre name or using a duplicate color
 */
export async function updateGenre(userId, genreId, updates) {
  try {
    const updateData = { updatedAt: serverTimestamp() };
    const genres = await loadUserGenres(userId);

    if (updates.name !== undefined) {
      const normalizedName = normalizeGenreName(updates.name);

      // Check for duplicate name (excluding self)
      const existing = genres.find(g => g.normalizedName === normalizedName && g.id !== genreId);

      if (existing) {
        throw new Error(`Genre "${existing.name}" already exists`);
      }

      updateData.name = updates.name.trim();
      updateData.normalizedName = normalizedName;
    }

    if (updates.color !== undefined) {
      // Check for duplicate color (excluding self)
      const usedColors = getUsedColors(genres, genreId);
      if (usedColors.has(updates.color.toLowerCase())) {
        throw new Error('This color is already used by another genre');
      }
      updateData.color = updates.color;
    }

    const genreRef = doc(db, 'users', userId, 'genres', genreId);
    await updateDoc(genreRef, updateData);

    // Invalidate cache
    genresCache = null;

    return { id: genreId, ...updateData };
  } catch (error) {
    if (!error.message.includes('already exists') && !error.message.includes('already used')) {
      console.error('Error updating genre:', error);
    }
    throw error;
  }
}

/**
 * Delete a genre and remove it from all books
 * @param {string} userId - The user's ID
 * @param {string} genreId - The genre ID to delete
 * @returns {Promise<number>} Number of books updated
 */
export async function deleteGenre(userId, genreId) {
  try {
    const batch = writeBatch(db);

    // Find all books with this genre
    const booksRef = collection(db, 'users', userId, 'books');
    const q = query(booksRef, where('genres', 'array-contains', genreId));
    const snapshot = await getDocs(q);

    // Remove genre from each active book (skip soft-deleted)
    snapshot.docs.forEach(bookDoc => {
      const bookData = bookDoc.data();
      if (bookData.deletedAt) return; // Skip soft-deleted books

      const bookRef = doc(db, 'users', userId, 'books', bookDoc.id);
      const currentGenres = bookData.genres || [];
      batch.update(bookRef, {
        genres: currentGenres.filter(g => g !== genreId),
        updatedAt: serverTimestamp()
      });
    });

    // Delete the genre document
    const genreRef = doc(db, 'users', userId, 'genres', genreId);
    batch.delete(genreRef);

    await batch.commit();

    // Invalidate cache
    genresCache = null;

    return snapshot.docs.length;
  } catch (error) {
    console.error('Error deleting genre:', error);
    throw error;
  }
}

/**
 * Update bookCounts for multiple genres in a batch
 * @param {string} userId - The user's ID
 * @param {Array<string>} addedGenreIds - Genre IDs to increment
 * @param {Array<string>} removedGenreIds - Genre IDs to decrement
 */
export async function updateGenreBookCounts(userId, addedGenreIds = [], removedGenreIds = []) {
  if (addedGenreIds.length === 0 && removedGenreIds.length === 0) return;

  try {
    const genres = await loadUserGenres(userId, true);
    const genreMap = new Map(genres.map(g => [g.id, g]));
    const batch = writeBatch(db);

    // Increment counts for added genres
    for (const genreId of addedGenreIds) {
      const genre = genreMap.get(genreId);
      if (genre) {
        const genreRef = doc(db, 'users', userId, 'genres', genreId);
        batch.update(genreRef, {
          bookCount: (genre.bookCount || 0) + 1,
          updatedAt: serverTimestamp()
        });
      }
    }

    // Decrement counts for removed genres
    for (const genreId of removedGenreIds) {
      const genre = genreMap.get(genreId);
      if (genre) {
        const genreRef = doc(db, 'users', userId, 'genres', genreId);
        batch.update(genreRef, {
          bookCount: Math.max(0, (genre.bookCount || 0) - 1),
          updatedAt: serverTimestamp()
        });
      }
    }

    await batch.commit();

    // Invalidate cache
    genresCache = null;
  } catch (error) {
    console.error('Error updating genre book counts:', error);
    throw error;
  }
}

/**
 * Clear the genres cache
 */
export function clearGenresCache() {
  genresCache = null;
  genresCacheUserId = null;
  genresCacheTime = 0;
}

/**
 * Migrate book genre data from names to IDs
 * Finds books with genre names instead of IDs and updates them
 * @param {string} userId - The user's ID
 * @param {Function} onProgress - Optional callback for progress updates (booksProcessed, totalBooks)
 * @returns {Promise<Object>} Migration results { booksUpdated, genresCreated, errors }
 */
export async function migrateGenreData(userId, onProgress = () => {}) {
  const results = {
    booksUpdated: 0,
    genresCreated: 0,
    errors: []
  };

  let booksSnapshot;
  let genres;
  let genreIdSet;

  try {
    // Load all books
    const booksRef = collection(db, 'users', userId, 'books');
    booksSnapshot = await getDocs(booksRef);

    // Load all genres
    genres = await loadUserGenres(userId, true);
    genreIdSet = new Set(genres.map(g => g.id));
  } catch (error) {
    console.error('Error loading data for genre migration:', error);
    throw error;
  }

  // Filter out soft-deleted books for processing
  const activeBookDocs = booksSnapshot.docs.filter(d => !d.data().deletedAt);
  const totalBooks = activeBookDocs.length;

  // Track genre book counts (genreId -> count)
  const genreBookCounts = new Map();

  let processed = 0;

  for (const bookDoc of activeBookDocs) {
    const bookData = bookDoc.data();
    const bookGenres = bookData.genres || [];

    // Check if any genre entries are names (not IDs)
    const needsMigration = bookGenres.some(g => !genreIdSet.has(g) && typeof g === 'string' && g.length > 0);

    if (needsMigration) {
      const newGenreIds = [];

      for (const genreEntry of bookGenres) {
        if (genreIdSet.has(genreEntry)) {
          // Already a valid ID
          newGenreIds.push(genreEntry);
        } else if (typeof genreEntry === 'string' && genreEntry.length > 0) {
          // This is a genre name, find or create the genre
          try {
            const normalizedName = normalizeGenreName(genreEntry);
            let matchingGenre = genres.find(g => g.normalizedName === normalizedName);

            if (!matchingGenre) {
              // Create the genre
              matchingGenre = await createGenre(userId, genreEntry);
              genres = await loadUserGenres(userId, true);
              genreIdSet.add(matchingGenre.id);
              results.genresCreated++;
            }

            if (!newGenreIds.includes(matchingGenre.id)) {
              newGenreIds.push(matchingGenre.id);
            }
          } catch (error) {
            results.errors.push(`Book "${bookData.title}": Failed to process genre`);
          }
        }
      }

      // Update the book if genres changed
      if (JSON.stringify(bookGenres.sort()) !== JSON.stringify(newGenreIds.sort())) {
        try {
          const bookRef = doc(db, 'users', userId, 'books', bookDoc.id);
          await updateDoc(bookRef, {
            genres: newGenreIds,
            updatedAt: serverTimestamp()
          });
          results.booksUpdated++;

          // Track counts for newly assigned genres (that weren't valid IDs before)
          for (const genreId of newGenreIds) {
            if (!bookGenres.includes(genreId)) {
              genreBookCounts.set(genreId, (genreBookCounts.get(genreId) || 0) + 1);
            }
          }
        } catch (error) {
          results.errors.push(`Failed to update book "${bookData.title}"`);
        }
      }
    }

    processed++;
    onProgress(processed, totalBooks);
  }

  // Update book counts for affected genres
  if (genreBookCounts.size > 0) {
    try {
      const batch = writeBatch(db);
      for (const [genreId, count] of genreBookCounts) {
        const genre = genres.find(g => g.id === genreId);
        if (genre) {
          const genreRef = doc(db, 'users', userId, 'genres', genreId);
          batch.update(genreRef, {
            bookCount: (genre.bookCount || 0) + count,
            updatedAt: serverTimestamp()
          });
        }
      }
      await batch.commit();
    } catch (error) {
      console.error('Error updating genre counts during migration:', error);
      results.errors.push('Failed to update genre counts');
    }
  }

  // Invalidate cache
  genresCache = null;

  return results;
}

/**
 * Recalculate book counts for all genres
 * Scans all books and updates the bookCount field on each genre
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Results { genresUpdated, totalBooks }
 */
export async function recalculateGenreBookCounts(userId) {
  try {
    // Load all books
    const booksRef = collection(db, 'users', userId, 'books');
    const booksSnapshot = await getDocs(booksRef);

    // Load all genres
    const genres = await loadUserGenres(userId, true);

    // Count books per genre
    const genreCounts = new Map();
    for (const genre of genres) {
      genreCounts.set(genre.id, 0);
    }

    for (const bookDoc of booksSnapshot.docs) {
      const bookData = bookDoc.data();
      // Skip soft-deleted books
      if (bookData.deletedAt) continue;

      const bookGenres = bookData.genres || [];

      for (const genreId of bookGenres) {
        if (genreCounts.has(genreId)) {
          genreCounts.set(genreId, genreCounts.get(genreId) + 1);
        }
      }
    }

    // Update genres with new counts
    const batch = writeBatch(db);
    let genresUpdated = 0;

    for (const genre of genres) {
      const newCount = genreCounts.get(genre.id) || 0;
      if (newCount !== (genre.bookCount || 0)) {
        const genreRef = doc(db, 'users', userId, 'genres', genre.id);
        batch.update(genreRef, {
          bookCount: newCount,
          updatedAt: serverTimestamp()
        });
        genresUpdated++;
      }
    }

    if (genresUpdated > 0) {
      await batch.commit();
    }

    // Invalidate cache
    genresCache = null;

    // Count only active (non-deleted) books
    const activeBookCount = booksSnapshot.docs.filter(d => !d.data().deletedAt).length;
    return {
      genresUpdated,
      totalBooks: activeBookCount
    };
  } catch (error) {
    console.error('Error recalculating genre book counts:', error);
    throw error;
  }
}

/**
 * Create a lookup map from genre IDs to genre objects
 * @param {Array} genres - Array of genre objects
 * @returns {Map} Map of genreId -> genre object
 */
export function createGenreLookup(genres) {
  return new Map(genres.map(g => [g.id, g]));
}
