// Wishlist Management Module
// Thin wrapper around wishlistRepository for backward compatibility
// New code should import from repositories/wishlist-repository.ts directly

import {
  wishlistRepository,
  type WishlistItem,
  type WishlistItemInput,
  type WishlistItemUpdate,
} from './repositories/wishlist-repository.js';

// Re-export types for backward compatibility
export type { WishlistItem, WishlistItemInput, WishlistItemUpdate };

/** Wishlist lookup map type */
export type WishlistLookup = Map<string, WishlistItem>;

/**
 * Get all wishlist items for a user
 * @param userId - The user's ID
 * @param forceRefresh - Force reload from Firestore
 * @returns Array of wishlist item objects
 */
export async function loadWishlistItems(userId: string, forceRefresh = false): Promise<WishlistItem[]> {
  return wishlistRepository.getAll(userId, forceRefresh);
}

/**
 * Get wishlist item count for a user (for header badge)
 * @param userId - The user's ID
 * @returns Number of items in wishlist (0 on error)
 */
export async function getWishlistCount(userId: string): Promise<number> {
  try {
    return await wishlistRepository.getCount(userId);
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
  return wishlistRepository.checkDuplicate(userId, isbn, title, author);
}

/**
 * Add an item to the wishlist
 * @param userId - The user's ID
 * @param itemData - Wishlist item data
 * @returns Created wishlist item with ID
 * @throws Error if item already exists in wishlist
 */
export async function addWishlistItem(userId: string, itemData: WishlistItemInput): Promise<WishlistItem> {
  return wishlistRepository.add(userId, itemData);
}

/**
 * Update an existing wishlist item
 * @param userId - The user's ID
 * @param itemId - The wishlist item ID
 * @param updates - Fields to update
 * @returns Object with id and updated fields
 */
export async function updateWishlistItem(
  userId: string,
  itemId: string,
  updates: WishlistItemUpdate
): Promise<{ id: string; [key: string]: unknown }> {
  await wishlistRepository.updateItem(userId, itemId, updates);
  // Return format expected by callers for backward compatibility
  const result: { id: string; [key: string]: unknown } = { id: itemId };
  if (updates.priority !== undefined) result.priority = updates.priority;
  if (updates.notes !== undefined) result.notes = updates.notes;
  if (updates.coverImageUrl !== undefined) result.coverImageUrl = updates.coverImageUrl;
  return result;
}

/**
 * Delete a wishlist item
 * @param userId - The user's ID
 * @param itemId - The wishlist item ID
 */
export async function deleteWishlistItem(userId: string, itemId: string): Promise<void> {
  await wishlistRepository.remove(userId, itemId);
}

/**
 * Move a wishlist item to the library (user bought the book)
 * Creates a new book document and deletes the wishlist item
 * If ISBN is available, enriches data from APIs before creating book
 * @param userId - The user's ID
 * @param itemId - The wishlist item ID
 * @returns Created book document
 */
export async function moveToLibrary(userId: string, itemId: string): Promise<{ id: string; [key: string]: unknown }> {
  return wishlistRepository.moveToLibrary(userId, itemId);
}

/**
 * Clear the wishlist cache
 */
export function clearWishlistCache(): void {
  wishlistRepository.clearCache();
}

/**
 * Create a lookup map of wishlist items by ISBN
 * @param items - Array of wishlist items
 * @returns Map of ISBN -> wishlist item
 */
export function createWishlistLookup(items: WishlistItem[]): WishlistLookup {
  return wishlistRepository.createLookup(items);
}
