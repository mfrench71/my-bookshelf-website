// Cache Utilities - Local storage caching

// Books cache constants
export const CACHE_VERSION = 7;
export const CACHE_KEY = `mybookshelf_books_cache_v${CACHE_VERSION}`;
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Clear the books cache for a user
 */
export function clearBooksCache(userId) {
  try {
    localStorage.removeItem(`${CACHE_KEY}_${userId}`);
  } catch (_e) {
    // Ignore cache clear errors
  }
}

// Home settings constants
const HOME_SETTINGS_KEY = 'homeSettings';
const DEFAULT_HOME_SETTINGS = {
  currentlyReading: { enabled: true, count: 6 },
  recentlyAdded: { enabled: true, count: 6 },
  topRated: { enabled: true, count: 6 },
  recentlyFinished: { enabled: true, count: 6 },
};

/**
 * Get home page settings from localStorage
 * @returns {Object} Home settings with defaults applied
 */
export function getHomeSettings() {
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
 * @param {Object} settings - Settings to save
 */
export function saveHomeSettings(settings) {
  try {
    localStorage.setItem(HOME_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Error saving home settings:', err);
  }
}

// User profile cache
let userProfileCache = null;
let userProfileCacheUserId = null;
const USER_PROFILE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let userProfileCacheTime = 0;

/**
 * Get cached user profile or fetch from Firestore
 * @param {Function} fetchFn - Function to fetch profile from Firestore
 * @param {string} userId - User ID
 * @param {boolean} forceRefresh - Force refresh from Firestore
 * @returns {Promise<Object>} User profile data
 */
export async function getCachedUserProfile(fetchFn, userId, forceRefresh = false) {
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
export function clearUserProfileCache() {
  userProfileCache = null;
  userProfileCacheUserId = null;
  userProfileCacheTime = 0;
}

// ISBN lookup cache constants
const ISBN_CACHE_KEY = 'mybookshelf_isbn_cache';
const ISBN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached ISBN lookup result
 * @param {string} isbn - ISBN to look up
 * @returns {Object|null} Cached result or null
 */
export function getISBNCache(isbn) {
  try {
    const cached = localStorage.getItem(`${ISBN_CACHE_KEY}_${isbn}`);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < ISBN_CACHE_TTL) {
      return data;
    }
    // Expired, remove it
    localStorage.removeItem(`${ISBN_CACHE_KEY}_${isbn}`);
  } catch (err) {
    console.warn('ISBN cache read error:', err.message);
  }
  return null;
}

/**
 * Cache ISBN lookup result
 * @param {string} isbn - ISBN
 * @param {Object|null} data - Result to cache
 */
export function setISBNCache(isbn, data) {
  try {
    localStorage.setItem(
      `${ISBN_CACHE_KEY}_${isbn}`,
      JSON.stringify({
        data,
        timestamp: Date.now(),
      })
    );
  } catch (err) {
    console.warn('ISBN cache write error:', err.message);
  }
}
