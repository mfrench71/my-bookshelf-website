// Wishlist Repository - Data access layer for wishlist items
// Extends BaseRepository with wishlist-specific operations

import { BaseRepository } from './base-repository.js';
import { normalizeText, lookupISBN } from '../utils.js';
import { eventBus, Events } from '../utils/event-bus.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from '/js/firebase-config.js';

/** Cover URLs from different sources */
interface BookCovers {
  googleBooks?: string;
  openLibrary?: string;
  [key: string]: string | undefined;
}

/** Wishlist item entity */
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
export interface WishlistItemInput {
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
export interface WishlistItemUpdate {
  priority?: 'high' | 'medium' | 'low' | null;
  notes?: string | null;
  coverImageUrl?: string | null;
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

// In-memory cache
let cache: WishlistItem[] | null = null;
let cacheUserId: string | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Repository for wishlist operations
 */
class WishlistRepository extends BaseRepository<WishlistItem> {
  constructor() {
    super('wishlist');
  }

  /**
   * Get all wishlist items for a user (with caching)
   * @param userId - The user's ID
   * @param forceRefresh - Force reload from Firestore
   * @returns Array of wishlist items
   */
  async getAll(userId: string, forceRefresh = false): Promise<WishlistItem[]> {
    const now = Date.now();
    const cacheValid = cache && cacheUserId === userId && now - cacheTime < CACHE_TTL;

    if (!forceRefresh && cacheValid) {
      return cache!;
    }

    const items = await this.getWithOptions(userId, {
      orderByField: 'createdAt',
      orderDirection: 'desc',
    });

    cache = items;
    cacheUserId = userId;
    cacheTime = Date.now();

    return items;
  }

  /**
   * Get wishlist item count
   * @param userId - The user's ID
   * @returns Number of items
   */
  async getCount(userId: string): Promise<number> {
    const items = await this.getAll(userId);
    return items.length;
  }

  /**
   * Check for duplicate wishlist item
   * @param userId - The user's ID
   * @param isbn - ISBN to check
   * @param title - Title to check
   * @param author - Author to check
   * @returns Existing item if duplicate found
   */
  async checkDuplicate(
    userId: string,
    isbn: string | null | undefined,
    title: string,
    author: string
  ): Promise<WishlistItem | null> {
    const items = await this.getAll(userId);

    // Check by ISBN first
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
  }

  /**
   * Add item to wishlist
   * @param userId - The user's ID
   * @param itemData - Wishlist item data
   * @returns Created item
   * @throws Error if duplicate exists
   */
  async add(userId: string, itemData: WishlistItemInput): Promise<WishlistItem> {
    // Check for duplicate
    const existing = await this.checkDuplicate(userId, itemData.isbn, itemData.title, itemData.author);
    if (existing) {
      throw new Error(`"${existing.title}" is already in your wishlist`);
    }

    const item = await this.create(userId, {
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
    } as Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>);

    this.clearCache();
    eventBus.emit(Events.BOOK_SAVED, { type: 'wishlist', item });

    return item;
  }

  /**
   * Update wishlist item
   * @param userId - The user's ID
   * @param itemId - The item ID
   * @param updates - Fields to update
   */
  async updateItem(userId: string, itemId: string, updates: WishlistItemUpdate): Promise<void> {
    const allowedFields: (keyof WishlistItemUpdate)[] = ['priority', 'notes', 'coverImageUrl'];
    const filteredUpdates: Partial<WishlistItem> = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        (filteredUpdates as Record<string, unknown>)[field] = updates[field];
      }
    }

    await this.update(userId, itemId, filteredUpdates);
    this.clearCache();
  }

  /**
   * Delete wishlist item
   * @param userId - The user's ID
   * @param itemId - The item ID
   */
  async remove(userId: string, itemId: string): Promise<void> {
    await this.delete(userId, itemId);
    this.clearCache();
    eventBus.emit(Events.BOOK_DELETED, { type: 'wishlist', itemId });
  }

  /**
   * Move wishlist item to library
   * @param userId - The user's ID
   * @param itemId - The item ID
   * @returns Created book
   */
  async moveToLibrary(userId: string, itemId: string): Promise<{ id: string } & BookData> {
    const item = await this.getById(userId, itemId);
    if (!item) {
      throw new Error('Wishlist item not found');
    }

    // Try to enrich data from APIs if we have an ISBN
    let enrichedData: Partial<{
      coverImageUrl: string;
      covers: BookCovers;
      publisher: string;
      publishedDate: string;
      physicalFormat: string;
      pageCount: number | null;
    }> = {};

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
      }
    }

    // Create book data
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
    await this.delete(userId, itemId);
    this.clearCache();

    eventBus.emit(Events.BOOK_SAVED, { type: 'book', id: bookDocRef.id });

    return { id: bookDocRef.id, ...bookData };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    cache = null;
    cacheUserId = null;
    cacheTime = 0;
    // Dispatch event for backward compatibility
    window.dispatchEvent(new CustomEvent('wishlist-updated'));
  }

  /**
   * Create a lookup map by ISBN
   * @param items - Wishlist items
   * @returns Map of ISBN -> item
   */
  createLookup(items: WishlistItem[]): Map<string, WishlistItem> {
    const lookup = new Map<string, WishlistItem>();
    for (const item of items) {
      if (item.isbn) {
        lookup.set(item.isbn, item);
      }
    }
    return lookup;
  }
}

// Export singleton instance
export const wishlistRepository = new WishlistRepository();
