// Genre Management Module
import { db } from '/js/firebase-config.js';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeGenreName } from './utils.js';

// Predefined colour palette for genres (~150 colours) - rainbow order
// Expanded with Tailwind 200-800 shades for extensive genre lists
export const GENRE_COLORS = [
  // Reds (7 shades)
  '#fecaca', // red-200
  '#fca5a5', // red-300
  '#f87171', // red-400
  '#ef4444', // red-500
  '#dc2626', // red-600
  '#b91c1c', // red-700
  '#991b1b', // red-800
  // Roses (6 shades)
  '#fecdd3', // rose-200
  '#fda4af', // rose-300
  '#fb7185', // rose-400
  '#f43f5e', // rose-500
  '#e11d48', // rose-600
  '#be123c', // rose-700
  // Oranges (7 shades)
  '#fed7aa', // orange-200
  '#fdba74', // orange-300
  '#fb923c', // orange-400
  '#f97316', // orange-500
  '#ea580c', // orange-600
  '#c2410c', // orange-700
  '#9a3412', // orange-800
  // Ambers (6 shades)
  '#fde68a', // amber-200
  '#fcd34d', // amber-300
  '#fbbf24', // amber-400
  '#f59e0b', // amber-500
  '#d97706', // amber-600
  '#b45309', // amber-700
  // Yellows (5 shades)
  '#fef08a', // yellow-200
  '#fde047', // yellow-300
  '#facc15', // yellow-400
  '#eab308', // yellow-500
  '#ca8a04', // yellow-600
  // Limes (6 shades)
  '#d9f99d', // lime-200
  '#bef264', // lime-300
  '#a3e635', // lime-400
  '#84cc16', // lime-500
  '#65a30d', // lime-600
  '#4d7c0f', // lime-700
  // Greens (7 shades)
  '#bbf7d0', // green-200
  '#86efac', // green-300
  '#4ade80', // green-400
  '#22c55e', // green-500
  '#16a34a', // green-600
  '#15803d', // green-700
  '#166534', // green-800
  // Emeralds (6 shades)
  '#a7f3d0', // emerald-200
  '#6ee7b7', // emerald-300
  '#34d399', // emerald-400
  '#10b981', // emerald-500
  '#059669', // emerald-600
  '#047857', // emerald-700
  // Teals (6 shades)
  '#99f6e4', // teal-200
  '#5eead4', // teal-300
  '#2dd4bf', // teal-400
  '#14b8a6', // teal-500
  '#0d9488', // teal-600
  '#0f766e', // teal-700
  // Cyans (6 shades)
  '#a5f3fc', // cyan-200
  '#67e8f9', // cyan-300
  '#22d3ee', // cyan-400
  '#06b6d4', // cyan-500
  '#0891b2', // cyan-600
  '#0e7490', // cyan-700
  // Skys (6 shades)
  '#bae6fd', // sky-200
  '#7dd3fc', // sky-300
  '#38bdf8', // sky-400
  '#0ea5e9', // sky-500
  '#0284c7', // sky-600
  '#0369a1', // sky-700
  // Blues (7 shades)
  '#bfdbfe', // blue-200
  '#93c5fd', // blue-300
  '#60a5fa', // blue-400
  '#3b82f6', // blue-500
  '#2563eb', // blue-600
  '#1d4ed8', // blue-700
  '#1e40af', // blue-800
  // Indigos (6 shades)
  '#c7d2fe', // indigo-200
  '#a5b4fc', // indigo-300
  '#818cf8', // indigo-400
  '#6366f1', // indigo-500
  '#4f46e5', // indigo-600
  '#4338ca', // indigo-700
  // Violets (7 shades)
  '#ddd6fe', // violet-200
  '#c4b5fd', // violet-300
  '#a78bfa', // violet-400
  '#8b5cf6', // violet-500
  '#7c3aed', // violet-600
  '#6d28d9', // violet-700
  '#5b21b6', // violet-800
  // Purples (7 shades)
  '#e9d5ff', // purple-200
  '#d8b4fe', // purple-300
  '#c084fc', // purple-400
  '#a855f7', // purple-500
  '#9333ea', // purple-600
  '#7e22ce', // purple-700
  '#6b21a8', // purple-800
  // Fuchsias (6 shades)
  '#f5d0fe', // fuchsia-200
  '#f0abfc', // fuchsia-300
  '#e879f9', // fuchsia-400
  '#d946ef', // fuchsia-500
  '#c026d3', // fuchsia-600
  '#a21caf', // fuchsia-700
  // Pinks (6 shades)
  '#fbcfe8', // pink-200
  '#f9a8d4', // pink-300
  '#f472b6', // pink-400
  '#ec4899', // pink-500
  '#db2777', // pink-600
  '#be185d', // pink-700
  // Neutrals - Stone (5 shades)
  '#e7e5e4', // stone-200
  '#d6d3d1', // stone-300
  '#a8a29e', // stone-400
  '#78716c', // stone-500
  '#57534e', // stone-600
  // Neutrals - Zinc (5 shades)
  '#e4e4e7', // zinc-200
  '#d4d4d8', // zinc-300
  '#a1a1aa', // zinc-400
  '#71717a', // zinc-500
  '#52525b', // zinc-600
  // Neutrals - Slate (5 shades)
  '#e2e8f0', // slate-200
  '#cbd5e1', // slate-300
  '#94a3b8', // slate-400
  '#64748b', // slate-500
  '#475569', // slate-600
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
  const cacheValid = genresCache && genresCacheUserId === userId && now - genresCacheTime < GENRES_CACHE_TTL;

  if (!forceRefresh && cacheValid) {
    return genresCache;
  }

  try {
    const genresRef = collection(db, 'users', userId, 'genres');
    const q = query(genresRef, orderBy('name', 'asc'));
    const snapshot = await getDocs(q);

    genresCache = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
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
  return new Set(genres.filter(g => g.id !== excludeGenreId).map(g => g.color?.toLowerCase()));
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

    // Validate or auto-assign colour
    if (color) {
      // Check if colour is already used
      if (usedColors.has(color.toLowerCase())) {
        throw new Error('This colour is already used by another genre');
      }
    } else {
      // Auto-assign random available colour for visual variety
      const availableColors = GENRE_COLORS.filter(c => !usedColors.has(c.toLowerCase()));
      color =
        availableColors.length > 0
          ? availableColors[Math.floor(Math.random() * availableColors.length)]
          : GENRE_COLORS[Math.floor(Math.random() * GENRE_COLORS.length)];
    }

    const genreData = {
      name: name.trim(),
      normalizedName,
      color,
      bookCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
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
      // Check for duplicate colour (excluding self)
      const usedColors = getUsedColors(genres, genreId);
      if (usedColors.has(updates.color.toLowerCase())) {
        throw new Error('This colour is already used by another genre');
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
        updatedAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
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
          updatedAt: serverTimestamp(),
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
      totalBooks: activeBookCount,
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

/**
 * Merge one genre into another
 * All books with source genre get target genre added (if not present)
 * Source genre is then deleted
 * @param {string} userId - The user's ID
 * @param {string} sourceGenreId - Genre to merge from (will be deleted)
 * @param {string} targetGenreId - Genre to merge into (will be kept)
 * @returns {Promise<Object>} Results { booksUpdated }
 */
export async function mergeGenres(userId, sourceGenreId, targetGenreId) {
  if (sourceGenreId === targetGenreId) {
    throw new Error('Cannot merge a genre into itself');
  }

  const genres = await loadUserGenres(userId, true);
  const sourceGenre = genres.find(g => g.id === sourceGenreId);
  const targetGenre = genres.find(g => g.id === targetGenreId);

  if (!sourceGenre) throw new Error('Source genre not found');
  if (!targetGenre) throw new Error('Target genre not found');

  try {
    const batch = writeBatch(db);

    // Find all books with the source genre
    const booksRef = collection(db, 'users', userId, 'books');
    const q = query(booksRef, where('genres', 'array-contains', sourceGenreId));
    const snapshot = await getDocs(q);

    let booksUpdated = 0;

    // Update books: remove source genre, add target if not present
    snapshot.docs.forEach(bookDoc => {
      const bookData = bookDoc.data();
      if (bookData.deletedAt) return; // Skip soft-deleted books

      const currentGenres = bookData.genres || [];
      const hasTarget = currentGenres.includes(targetGenreId);

      // Build new genres array
      const newGenres = currentGenres.filter(g => g !== sourceGenreId);
      if (!hasTarget) {
        newGenres.push(targetGenreId);
      }

      const bookRef = doc(db, 'users', userId, 'books', bookDoc.id);
      batch.update(bookRef, {
        genres: newGenres,
        updatedAt: serverTimestamp(),
      });
      booksUpdated++;
    });

    // Update target genre bookCount
    // Only add books that didn't already have the target genre
    const booksWithoutTarget = snapshot.docs.filter(d => {
      const data = d.data();
      return !data.deletedAt && !(data.genres || []).includes(targetGenreId);
    }).length;

    const targetGenreRef = doc(db, 'users', userId, 'genres', targetGenreId);
    batch.update(targetGenreRef, {
      bookCount: (targetGenre.bookCount || 0) + booksWithoutTarget,
      updatedAt: serverTimestamp(),
    });

    // Delete source genre
    const sourceGenreRef = doc(db, 'users', userId, 'genres', sourceGenreId);
    batch.delete(sourceGenreRef);

    await batch.commit();

    // Invalidate cache
    genresCache = null;

    return { booksUpdated };
  } catch (error) {
    console.error('Error merging genres:', error);
    throw error;
  }
}
