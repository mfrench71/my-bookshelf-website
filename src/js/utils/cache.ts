// Cache Utilities - Local storage caching

import type { ISBNLookupResult, UserProfile } from '../types/index.d.ts';

// Books cache constants
export const CACHE_VERSION = 7;
export const CACHE_KEY = `mybookshelf_books_cache_v${CACHE_VERSION}`;
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the books cache for a user
 */
export function clearBooksCache(userId: string): void {
  try {
    localStorage.removeItem(`${CACHE_KEY}_${userId}`);
  } catch {
    // Ignore cache clear errors
  }
}

/** Home section settings */
export interface HomeSectionSettings {
  enabled: boolean;
  count: number;
}

/** Home page settings structure */
export interface HomeSettings {
  currentlyReading: HomeSectionSettings;
  recentlyAdded: HomeSectionSettings;
  topRated: HomeSectionSettings;
  recentlyFinished: HomeSectionSettings;
}

// Home settings constants
const HOME_SETTINGS_KEY = 'homeSettings';
const DEFAULT_HOME_SETTINGS: HomeSettings = {
  currentlyReading: { enabled: true, count: 6 },
  recentlyAdded: { enabled: true, count: 6 },
  topRated: { enabled: true, count: 6 },
  recentlyFinished: { enabled: true, count: 6 },
};

/**
 * Get home page settings from localStorage
 * @returns Home settings with defaults applied
 */
export function getHomeSettings(): HomeSettings {
  try {
    const stored = localStorage.getItem(HOME_SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_HOME_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (err) {
    console.warn('Error loading home settings:', err);
  }
  return { ...DEFAULT_HOME_SETTINGS };
}

/**
 * Save home page settings to localStorage
 * @param settings - Settings to save
 */
export function saveHomeSettings(settings: HomeSettings): void {
  try {
    localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Error saving home settings:', err);
  }
}

// User profile cache
let userProfileCache: UserProfile | null = null;
let userProfileCacheUserId: string | null = null;
const USER_PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let userProfileCacheTime = 0;

/**
 * Get cached user profile or fetch from Firestore
 * @param fetchFn - Function to fetch profile from Firestore
 * @param userId - User ID
 * @param forceRefresh - Force refresh from Firestore
 * @returns User profile data
 */
export async function getCachedUserProfile(
  fetchFn: () => Promise<UserProfile | null>,
  userId: string,
  forceRefresh = false
): Promise<UserProfile | null> {
  const now = Date.now();
  if (
    !forceRefresh &&
    userProfileCache &&
    userProfileCacheUserId === userId &&
    now - userProfileCacheTime < USER_PROFILE_CACHE_TTL
  ) {
    return userProfileCache;
  }

  userProfileCache = await fetchFn();
  userProfileCacheUserId = userId;
  userProfileCacheTime = now;
  return userProfileCache;
}

/**
 * Clear the user profile cache
 */
export function clearUserProfileCache(): void {
  userProfileCache = null;
  userProfileCacheUserId = null;
  userProfileCacheTime = 0;
}

// ISBN lookup cache constants
const ISBN_CACHE_KEY = 'mybookshelf_isbn_cache';
const ISBN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/** Cached ISBN data structure */
interface ISBNCacheEntry {
  data: ISBNLookupResult | null;
  timestamp: number;
}

/**
 * Get cached ISBN lookup result
 * @param isbn - ISBN to look up
 * @returns Cached result or null
 */
export function getISBNCache(isbn: string): ISBNLookupResult | null {
  try {
    const cached = localStorage.getItem(`${ISBN_CACHE_KEY}_${isbn}`);
    if (!cached) return null;

    const { data, timestamp }: ISBNCacheEntry = JSON.parse(cached);
    if (Date.now() - timestamp < ISBN_CACHE_TTL) {
      return data;
    }
    // Expired, remove it
    localStorage.removeItem(`${ISBN_CACHE_KEY}_${isbn}`);
  } catch (err) {
    console.warn('ISBN cache read error:', (err as Error).message);
  }
  return null;
}

/**
 * Cache ISBN lookup result
 * @param isbn - ISBN
 * @param data - Result to cache
 */
export function setISBNCache(isbn: string, data: ISBNLookupResult | null): void {
  try {
    localStorage.setItem(
      `${ISBN_CACHE_KEY}_${isbn}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      } as ISBNCacheEntry)
    );
  } catch (err) {
    console.warn('ISBN cache write error:', (err as Error).message);
  }
}
