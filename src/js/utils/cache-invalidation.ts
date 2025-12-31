// Cache Invalidation - Event-driven cache clearing
// Listens to event bus events and invalidates relevant caches

import { eventBus, Events } from './event-bus.js';
import { clearBooksCache } from './cache.js';
import { clearGenresCache } from '../genres.js';
import { clearSeriesCache } from '../series.js';
import { clearWishlistCache } from '../wishlist.js';

let initialized = false;

/**
 * Initialize cache invalidation listeners
 * Should be called once on app startup (e.g., in header.js after auth)
 * @param userId - Current user ID for book cache
 */
export function initCacheInvalidation(userId: string): void {
  if (initialized) return;

  // Book events → clear books cache
  eventBus.on(Events.BOOK_SAVED, () => {
    clearBooksCache(userId);
  });

  eventBus.on(Events.BOOK_DELETED, () => {
    clearBooksCache(userId);
  });

  eventBus.on(Events.BOOK_RESTORED, () => {
    clearBooksCache(userId);
  });

  // Genre events → clear genres cache
  eventBus.on(Events.GENRE_CREATED, () => {
    clearGenresCache();
  });

  eventBus.on(Events.GENRE_UPDATED, () => {
    clearGenresCache();
  });

  eventBus.on(Events.GENRE_DELETED, () => {
    clearGenresCache();
  });

  // Series events → clear series cache
  eventBus.on(Events.SERIES_CREATED, () => {
    clearSeriesCache();
  });

  eventBus.on(Events.SERIES_UPDATED, () => {
    clearSeriesCache();
  });

  eventBus.on(Events.SERIES_DELETED, () => {
    clearSeriesCache();
  });

  initialized = true;
}

/**
 * Clear all caches (useful on logout or user switch)
 * @param userId - Current user ID for book cache
 */
export function clearAllCaches(userId?: string): void {
  if (userId) {
    clearBooksCache(userId);
  }
  clearGenresCache();
  clearSeriesCache();
  clearWishlistCache();
}

/**
 * Reset the initialization flag (for testing)
 */
export function resetCacheInvalidation(): void {
  initialized = false;
  eventBus.clear();
}
