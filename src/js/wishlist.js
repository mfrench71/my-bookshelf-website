// Wishlist Management Module
import { db } from '/js/firebase-config.js';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeText, lookupISBN } from './utils.js';

// In-memory cache for wishlist items (with TTL)
let wishlistCache = null;
let wishlistCacheUserId = null;
let wishlistCacheTime = 0;
const WISHLIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all wishlist items for a user
 * @param {string} userId - The user's ID
 * @param {boolean} forceRefresh - Force reload from Firestore
 * @returns {Promise<Array>} Array of wishlist item objects
 */
export async function loadWishlistItems(userId, forceRefresh = false) {
  const now = Date.now();
  const cacheValid = wishlistCache &&
                     wishlistCacheUserId === userId &&
                     (now - wishlistCacheTime) < WISHLIST_CACHE_TTL;

  if (!forceRefresh && cacheValid) {
    return wishlistCache;
  }

  try {
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const q = query(wishlistRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    wishlistCache = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    wishlistCacheUserId = userId;
    wishlistCacheTime = Date.now();

    return wishlistCache;
  } catch (error) {
    console.error('Error loading wishlist:', error);
    throw error;
  }
}

/**
 * Get wishlist item count for a user (for header badge)
 * @param {string} userId - The user's ID
 * @returns {Promise<number>} Number of items in wishlist
 */
export async function getWishlistCount(userId) {
  try {
    const items = await loadWishlistItems(userId);
    return items.length;
  } catch (error) {
    console.error('Error getting wishlist count:', error);
    return 0;
  }
}

/**
 * Check for duplicate wishlist item
 * @param {string} userId - The user's ID
 * @param {string} isbn - ISBN to check (optional)
 * @param {string} title - Title to check
 * @param {string} author - Author to check
 * @returns {Promise<Object|null>} Existing item if duplicate found, null otherwise
 */
export async function checkWishlistDuplicate(userId, isbn, title, author) {
  try {
    const items = await loadWishlistItems(userId);

    // Check by ISBN first (if provided)
    if (isbn) {
      const byIsbn = items.find(item => item.isbn === isbn);
      if (byIsbn) return byIsbn;
    }

    // Check by normalised title + author
    const normalizedTitle = normalizeText(title);
    const normalizedAuthor = normalizeText(author);

    const byTitleAuthor = items.find(item => {
      const itemTitle = normalizeText(item.title);
      const itemAuthor = normalizeText(item.author);
      return itemTitle === normalizedTitle && itemAuthor === normalizedAuthor;
    });

    return byTitleAuthor || null;
  } catch (error) {
    console.error('Error checking wishlist duplicate:', error);
    return null;
  }
}

/**
 * Add an item to the wishlist
 * @param {string} userId - The user's ID
 * @param {Object} itemData - Wishlist item data
 * @returns {Promise<Object>} Created wishlist item with ID
 * @throws {Error} If item already exists in wishlist
 */
export async function addWishlistItem(userId, itemData) {
  // Check for duplicate
  const existing = await checkWishlistDuplicate(
    userId,
    itemData.isbn,
    itemData.title,
    itemData.author
  );

  if (existing) {
    throw new Error(`"${existing.title}" is already in your wishlist`);
  }

  const wishlistData = {
    title: itemData.title.trim(),
    author: itemData.author.trim(),
    isbn: itemData.isbn || null,
    coverImageUrl: itemData.coverImageUrl || null,
    covers: itemData.covers || null,
    publisher: itemData.publisher || null,
    publishedDate: itemData.publishedDate || null,
    pageCount: itemData.pageCount || null,
    priority: itemData.priority || null,
    notes: itemData.notes || null,
    addedFrom: itemData.addedFrom || 'manual',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const docRef = await addDoc(wishlistRef, wishlistData);

    // Invalidate cache and notify
    clearWishlistCache();
    notifyWishlistUpdated();

    return { id: docRef.id, ...wishlistData };
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    throw error;
  }
}

/**
 * Update an existing wishlist item
 * @param {string} userId - The user's ID
 * @param {string} itemId - The wishlist item ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated item
 */
export async function updateWishlistItem(userId, itemId, updates) {
  const updateData = { updatedAt: serverTimestamp() };

  // Only update allowed fields
  const allowedFields = ['priority', 'notes', 'coverImageUrl'];
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  try {
    const itemRef = doc(db, 'users', userId, 'wishlist', itemId);
    await updateDoc(itemRef, updateData);

    // Invalidate cache and notify
    clearWishlistCache();
    notifyWishlistUpdated();

    return { id: itemId, ...updateData };
  } catch (error) {
    console.error('Error updating wishlist item:', error);
    throw error;
  }
}

/**
 * Delete a wishlist item
 * @param {string} userId - The user's ID
 * @param {string} itemId - The wishlist item ID
 * @returns {Promise<void>}
 */
export async function deleteWishlistItem(userId, itemId) {
  try {
    const itemRef = doc(db, 'users', userId, 'wishlist', itemId);
    await deleteDoc(itemRef);

    // Invalidate cache and notify
    clearWishlistCache();
    notifyWishlistUpdated();
  } catch (error) {
    console.error('Error deleting wishlist item:', error);
    throw error;
  }
}

/**
 * Move a wishlist item to the library (user bought the book)
 * Creates a new book document and deletes the wishlist item
 * If ISBN is available, enriches data from APIs before creating book
 * @param {string} userId - The user's ID
 * @param {string} itemId - The wishlist item ID
 * @returns {Promise<Object>} Created book document
 */
export async function moveToLibrary(userId, itemId) {
  try {
    // Get the wishlist item
    const itemRef = doc(db, 'users', userId, 'wishlist', itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error('Wishlist item not found');
    }

    const item = itemSnap.data();

    // Try to enrich data from APIs if we have an ISBN
    let enrichedData = {};
    if (item.isbn) {
      try {
        const apiData = await lookupISBN(item.isbn);
        if (apiData) {
          enrichedData = {
            coverImageUrl: apiData.coverImageUrl || item.coverImageUrl,
            covers: apiData.covers || item.covers,
            publisher: apiData.publisher || item.publisher,
            publishedDate: apiData.publishedDate || item.publishedDate,
            physicalFormat: apiData.physicalFormat || '',
            pageCount: apiData.pageCount || item.pageCount
          };
        }
      } catch (e) {
        console.warn('ISBN lookup failed during move to library:', e.message);
        // Continue with wishlist data if lookup fails
      }
    }

    // Create book data from wishlist item, enriched with API data
    const bookData = {
      title: item.title,
      author: item.author,
      isbn: item.isbn || '',
      coverImageUrl: enrichedData.coverImageUrl || item.coverImageUrl || '',
      covers: enrichedData.covers || item.covers || null,
      publisher: enrichedData.publisher || item.publisher || '',
      publishedDate: enrichedData.publishedDate || item.publishedDate || '',
      physicalFormat: enrichedData.physicalFormat || '',
      pageCount: enrichedData.pageCount || item.pageCount || null,
      rating: null,
      notes: item.notes || '',
      genres: [],
      seriesId: null,
      seriesPosition: null,
      reads: [],
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add to books collection
    const booksRef = collection(db, 'users', userId, 'books');
    const bookDocRef = await addDoc(booksRef, bookData);

    // Delete from wishlist
    await deleteDoc(itemRef);

    // Invalidate caches and notify
    clearWishlistCache();
    notifyWishlistUpdated();
    // Note: Books cache should be cleared by the calling code if needed

    return { id: bookDocRef.id, ...bookData };
  } catch (error) {
    console.error('Error moving to library:', error);
    throw error;
  }
}

/**
 * Clear the wishlist cache
 */
export function clearWishlistCache() {
  wishlistCache = null;
  wishlistCacheUserId = null;
  wishlistCacheTime = 0;
}

/**
 * Notify other modules that wishlist has been updated
 */
function notifyWishlistUpdated() {
  window.dispatchEvent(new CustomEvent('wishlist-updated'));
}

/**
 * Create a lookup map of wishlist items by ISBN
 * @param {Array} items - Array of wishlist items
 * @returns {Map} Map of ISBN -> wishlist item
 */
export function createWishlistLookup(items) {
  const lookup = new Map();
  for (const item of items) {
    if (item.isbn) {
      lookup.set(item.isbn, item);
    }
  }
  return lookup;
}
