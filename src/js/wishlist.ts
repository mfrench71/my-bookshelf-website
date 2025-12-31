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
  orderBy,
  serverTimestamp,
  DocumentData,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeText, lookupISBN } from './utils.js';

/** Cover URLs from different sources */
interface BookCovers {
  googleBooks?: string;
  openLibrary?: string;
  [key: string]: string | undefined;
}

/** Wishlist item data structure */
export interface WishlistItem {
  id: string;
  title: string;
  author: string;
  isbn?: string | null;
  coverImageUrl?: string | null;
  covers?: BookCovers | null;
  publisher?: string | null;
  publishedDate?: string | null;
  pageCount?: number | null;
  priority?: 'high' | 'medium' | 'low' | null;
  notes?: string | null;
  addedFrom?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Input data for creating a wishlist item */
interface WishlistItemInput {
  title: string;
  author: string;
  isbn?: string | null;
  coverImageUrl?: string | null;
  covers?: BookCovers | null;
  publisher?: string | null;
  publishedDate?: string | null;
  pageCount?: number | null;
  priority?: 'high' | 'medium' | 'low' | null;
  notes?: string | null;
  addedFrom?: string;
}

/** Update data for wishlist item */
interface WishlistItemUpdate {
  priority?: 'high' | 'medium' | 'low' | null;
  notes?: string | null;
  coverImageUrl?: string | null;
}

/** API lookup result for enriching data */
interface APILookupResult {
  coverImageUrl?: string;
  covers?: BookCovers;
  publisher?: string;
  publishedDate?: string;
  physicalFormat?: string;
  pageCount?: number | null;
}

/** Book data created from wishlist item */
interface BookData {
  title: string;
  author: string;
  isbn: string;
  coverImageUrl: string;
  covers: BookCovers | null;
  publisher: string;
  publishedDate: string;
  physicalFormat: string;
  pageCount: number | null;
  rating: number | null;
  notes: string;
  genres: string[];
  seriesId: string | null;
  seriesPosition: number | null;
  reads: unknown[];
  deletedAt: number | null;
  createdAt: unknown;
  updatedAt: unknown;
}

/** Wishlist lookup map type */
export type WishlistLookup = Map<string, WishlistItem>;

// In-memory cache for wishlist items (with TTL)
let wishlistCache: WishlistItem[] | null = null;
let wishlistCacheUserId: string | null = null;
let wishlistCacheTime = 0;
const WISHLIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all wishlist items for a user
 * @param userId - The user's ID
 * @param forceRefresh - Force reload from Firestore
 * @returns Array of wishlist item objects
 */
export async function loadWishlistItems(userId: string, forceRefresh = false): Promise<WishlistItem[]> {
  const now = Date.now();
  const cacheValid = wishlistCache && wishlistCacheUserId === userId && now - wishlistCacheTime < WISHLIST_CACHE_TTL;

  if (!forceRefresh && cacheValid) {
    return wishlistCache!;
  }

  try {
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const q = query(wishlistRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    wishlistCache = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as WishlistItem[];
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
 * @param userId - The user's ID
 * @returns Number of items in wishlist
 */
export async function getWishlistCount(userId: string): Promise<number> {
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
 * @param userId - The user's ID
 * @param isbn - ISBN to check (optional)
 * @param title - Title to check
 * @param author - Author to check
 * @returns Existing item if duplicate found, null otherwise
 */
export async function checkWishlistDuplicate(
  userId: string,
  isbn: string | undefined | null,
  title: string,
  author: string
): Promise<WishlistItem | null> {
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
 * @param userId - The user's ID
 * @param itemData - Wishlist item data
 * @returns Created wishlist item with ID
 * @throws Error if item already exists in wishlist
 */
export async function addWishlistItem(userId: string, itemData: WishlistItemInput): Promise<WishlistItem> {
  // Check for duplicate
  const existing = await checkWishlistDuplicate(userId, itemData.isbn, itemData.title, itemData.author);

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
    updatedAt: serverTimestamp(),
  };

  try {
    const wishlistRef = collection(db, 'users', userId, 'wishlist');
    const docRef = await addDoc(wishlistRef, wishlistData);

    // Invalidate cache and notify
    clearWishlistCache();
    notifyWishlistUpdated();

    return { id: docRef.id, ...wishlistData } as WishlistItem;
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    throw error;
  }
}

/**
 * Update an existing wishlist item
 * @param userId - The user's ID
 * @param itemId - The wishlist item ID
 * @param updates - Fields to update
 * @returns Updated item
 */
export async function updateWishlistItem(
  userId: string,
  itemId: string,
  updates: WishlistItemUpdate
): Promise<{ id: string; [key: string]: unknown }> {
  const updateData: DocumentData = { updatedAt: serverTimestamp() };

  // Only update allowed fields
  const allowedFields: (keyof WishlistItemUpdate)[] = ['priority', 'notes', 'coverImageUrl'];
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
 * @param userId - The user's ID
 * @param itemId - The wishlist item ID
 */
export async function deleteWishlistItem(userId: string, itemId: string): Promise<void> {
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
 * @param userId - The user's ID
 * @param itemId - The wishlist item ID
 * @returns Created book document
 */
export async function moveToLibrary(userId: string, itemId: string): Promise<{ id: string } & BookData> {
  try {
    // Get the wishlist item
    const itemRef = doc(db, 'users', userId, 'wishlist', itemId);
    const itemSnap = await getDoc(itemRef);

    if (!itemSnap.exists()) {
      throw new Error('Wishlist item not found');
    }

    const item = itemSnap.data() as WishlistItem;

    // Try to enrich data from APIs if we have an ISBN
    let enrichedData: Partial<APILookupResult> = {};
    if (item.isbn) {
      try {
        const apiData = await lookupISBN(item.isbn);
        if (apiData) {
          enrichedData = {
            coverImageUrl: apiData.coverImageUrl || item.coverImageUrl || undefined,
            covers: apiData.covers || item.covers || undefined,
            publisher: apiData.publisher || item.publisher || undefined,
            publishedDate: apiData.publishedDate || item.publishedDate || undefined,
            physicalFormat: apiData.physicalFormat || '',
            pageCount: apiData.pageCount || item.pageCount,
          };
        }
      } catch (e: unknown) {
        const error = e as { message?: string };
        console.warn('ISBN lookup failed during move to library:', error.message);
        // Continue with wishlist data if lookup fails
      }
    }

    // Create book data from wishlist item, enriched with API data
    const bookData: BookData = {
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
      updatedAt: serverTimestamp(),
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
export function clearWishlistCache(): void {
  wishlistCache = null;
  wishlistCacheUserId = null;
  wishlistCacheTime = 0;
}

/**
 * Notify other modules that wishlist has been updated
 */
function notifyWishlistUpdated(): void {
  window.dispatchEvent(new CustomEvent('wishlist-updated'));
}

/**
 * Create a lookup map of wishlist items by ISBN
 * @param items - Array of wishlist items
 * @returns Map of ISBN -> wishlist item
 */
export function createWishlistLookup(items: WishlistItem[]): WishlistLookup {
  const lookup = new Map<string, WishlistItem>();
  for (const item of items) {
    if (item.isbn) {
      lookup.set(item.isbn, item);
    }
  }
  return lookup;
}
