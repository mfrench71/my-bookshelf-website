// Shared Utilities Module

// Cache Constants - shared across all modules
export const CACHE_VERSION = 7;
export const CACHE_KEY = `mybookshelf_books_cache_v${CACHE_VERSION}`;
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Lock body scroll (for modals)
 */
export function lockBodyScroll() {
  document.body.style.overflow = 'hidden';
}

/**
 * Unlock body scroll (when modal closes)
 */
export function unlockBodyScroll() {
  document.body.style.overflow = '';
}

/**
 * Clear the books cache for a user
 */
export function clearBooksCache(userId) {
  try {
    localStorage.removeItem(`${CACHE_KEY}_${userId}`);
  } catch (e) {
    // Ignore cache clear errors
  }
}

/**
 * Serialize a Firestore timestamp to milliseconds
 * Handles: toMillis(), seconds, number, ISO string
 */
export function serializeTimestamp(raw) {
  if (!raw) return null;
  if (typeof raw.toMillis === 'function') return raw.toMillis();
  if (raw.seconds) return raw.seconds * 1000;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const date = new Date(raw);
    return isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape attribute values for safe HTML insertion
 */
export function escapeAttr(text) {
  if (!text) return '';
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Normalize text for search (handles apostrophes and diacritics)
 */
export function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Normalize genre name for duplicate checking
 * Lowercase, trim, collapse multiple spaces
 */
export function normalizeGenreName(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Check if a string is all uppercase (ignoring non-letters)
 */
function isAllCaps(str) {
  const letters = str.replace(/[^a-zA-Z]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase();
}

/**
 * Check if a string is all lowercase (ignoring non-letters)
 */
function isAllLowercase(str) {
  const letters = str.replace(/[^a-zA-Z]/g, '');
  return letters.length > 0 && letters === letters.toLowerCase();
}

/**
 * Check if a title/name needs Title Case normalization
 * Returns true if: ALL CAPS, all lowercase, or any significant word starts lowercase
 */
function needsTitleCase(str) {
  if (!str || str.length === 0) return false;

  // Check for ALL CAPS or all lowercase
  if (isAllCaps(str) || isAllLowercase(str)) {
    return true;
  }

  // Check if any significant word starts with lowercase
  // (words that should be capitalized but aren't)
  const lowercaseWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet'];
  const words = str.split(' ');

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;

    const firstLetter = word.match(/[a-zA-Z]/);
    if (!firstLetter) continue;

    const startsLowercase = firstLetter[0] === firstLetter[0].toLowerCase();
    const isSmallWord = lowercaseWords.includes(word.toLowerCase());

    // First word should always be capitalized
    // Other words should be capitalized unless they're small words
    if (startsLowercase && (i === 0 || !isSmallWord)) {
      return true;
    }
  }

  return false;
}

/**
 * Convert string to Title Case
 * Keeps small words lowercase unless they're the first word
 */
function toTitleCase(str) {
  const lowercaseWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'yet'];

  return str.toLowerCase().split(' ').map((word, index) => {
    if (index === 0 || !lowercaseWords.includes(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word;
  }).join(' ');
}

/**
 * Normalize a book title
 * - Trims whitespace
 * - Removes trailing periods
 * - Converts to Title Case if improperly formatted
 */
export function normalizeTitle(title) {
  if (!title) return '';

  let normalized = title.trim();

  // Remove trailing periods (but not ellipsis)
  normalized = normalized.replace(/\.+$/, '');

  // Convert to Title Case if needed (ALL CAPS, all lowercase, or starts with lowercase)
  if (needsTitleCase(normalized)) {
    normalized = toTitleCase(normalized);
  }

  return normalized;
}

/**
 * Normalize an author name
 * - Trims whitespace
 * - Converts to Title Case if improperly formatted
 */
export function normalizeAuthor(author) {
  if (!author) return '';

  let normalized = author.trim();

  if (needsTitleCase(normalized)) {
    normalized = toTitleCase(normalized);
  }

  return normalized;
}

/**
 * Normalize a publisher name
 * - Trims whitespace
 * - Converts to Title Case if improperly formatted
 */
export function normalizePublisher(publisher) {
  if (!publisher) return '';

  let normalized = publisher.trim();

  if (needsTitleCase(normalized)) {
    normalized = toTitleCase(normalized);
  }

  return normalized;
}

/**
 * Normalize a published date to year only
 * Extracts 4-digit year from various formats
 */
export function normalizePublishedDate(date) {
  if (!date) return '';

  const str = String(date).trim();

  // Match 4-digit year (1000-2999)
  const yearMatch = str.match(/\b(1\d{3}|2\d{3})\b/);

  return yearMatch ? yearMatch[1] : str;
}

/**
 * Get contrasting text color (black or white) for a given background hex color
 * Uses relative luminance formula for accessibility
 */
export function getContrastColor(hex) {
  if (!hex || typeof hex !== 'string') return '#000000';

  // Remove # if present
  hex = hex.replace('#', '');

  // Parse RGB values
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;

  // Calculate relative luminance using sRGB formula
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Return white for dark backgrounds, black for light
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Debounce function calls
 */
export function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Parse Firestore timestamp or date string to Date object
 */
export function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (typeof timestamp === 'string') {
    const date = new Date(timestamp);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Format a timestamp for display
 */
export function formatDate(timestamp) {
  const date = parseTimestamp(timestamp);
  if (!date) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Render star rating as SVG HTML
 */
export function renderStars(rating) {
  const filledStar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const emptyStar = '<svg class="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  return Array.from({ length: 5 }, (_, i) =>
    i < rating ? filledStar : emptyStar
  ).join('');
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {Object} options - Optional settings
 * @param {number} options.duration - Duration in ms (default: 3000)
 * @param {string} options.type - 'success', 'error', or 'info' (default: 'info')
 */
// Track toast timeout to clear it when showing a new toast
let toastTimeout = null;

export function showToast(message, options = {}) {
  const { duration = 3000, type = 'info' } = typeof options === 'number'
    ? { duration: options }
    : options;

  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  // Clear any existing timeout to prevent premature hiding
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  // Base classes
  const baseClasses = 'fixed bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 px-4 py-3 rounded-lg shadow-lg z-50';

  // Type-specific colors
  const typeClasses = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white'
  };

  toast.className = `${baseClasses} ${typeClasses[type] || typeClasses.info}`;
  toast.textContent = message;

  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    toastTimeout = null;
  }, duration);
}

/**
 * Initialize Lucide icons (call sparingly)
 */
export function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

/**
 * Update rating star buttons to reflect current rating
 * @param {NodeList|Array} starBtns - Star button elements with data-rating attribute
 * @param {number} currentRating - Current rating value (1-5)
 */
export function updateRatingStars(starBtns, currentRating) {
  starBtns.forEach(btn => {
    const rating = parseInt(btn.dataset.rating);
    btn.classList.toggle('active', rating <= currentRating);
  });
  initIcons();
}

/**
 * Check if the browser is online
 * @returns {boolean} True if online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Validate an image URL for safe use in img src attributes
 * Only allows http: and https: protocols
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid and safe
 */
export function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Throttle function calls to max once per delay
 * @param {Function} fn - Function to throttle
 * @param {number} delay - Minimum time between calls in ms
 * @returns {Function} Throttled function
 */
export function throttle(fn, delay) {
  let lastCall = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  };
}

/**
 * Check if viewport is mobile-sized (matches Tailwind's md breakpoint)
 * @returns {boolean} True if mobile
 */
export function isMobile() {
  return window.innerWidth < 768;
}

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

// ISBN lookup cache constants
const ISBN_CACHE_KEY = 'mybookshelf_isbn_cache';
const ISBN_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached ISBN lookup result
 * @param {string} isbn - ISBN to look up
 * @returns {Object|null} Cached result or null
 */
function getISBNCache(isbn) {
  try {
    const cached = localStorage.getItem(`${ISBN_CACHE_KEY}_${isbn}`);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < ISBN_CACHE_TTL) {
      return data;
    }
    // Expired, remove it
    localStorage.removeItem(`${ISBN_CACHE_KEY}_${isbn}`);
  } catch (e) {
    console.warn('ISBN cache read error:', e.message);
  }
  return null;
}

/**
 * Cache ISBN lookup result
 * @param {string} isbn - ISBN
 * @param {Object|null} data - Result to cache
 */
function setISBNCache(isbn, data) {
  try {
    localStorage.setItem(`${ISBN_CACHE_KEY}_${isbn}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('ISBN cache write error:', e.message);
  }
}

/**
 * Look up book data by ISBN from Google Books and Open Library APIs
 * Results are cached for 24 hours to reduce API calls
 * @param {string} isbn - ISBN to look up
 * @returns {Promise<Object|null>} Book data or null if not found
 */
export async function lookupISBN(isbn) {
  if (!isbn) return null;

  // Check cache first
  const cached = getISBNCache(isbn);
  if (cached !== null) {
    // If cached result is missing physicalFormat, try to fetch it
    if (cached && !cached.physicalFormat) {
      try {
        const editionResponse = await fetchWithTimeout(
          `https://openlibrary.org/isbn/${isbn}.json`
        );
        const edition = await editionResponse.json();
        if (edition.physical_format) {
          cached.physicalFormat = edition.physical_format
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          // Update cache with new data
          setISBNCache(isbn, cached);
        }
      } catch (e) {
        // Edition endpoint may not exist for all ISBNs
      }
    }
    return cached;
  }

  let result = null;

  // Try Google Books first
  try {
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );
    const data = await response.json();

    if (data.items?.length > 0) {
      const book = data.items[0].volumeInfo;
      result = {
        title: normalizeTitle(book.title || ''),
        author: normalizeAuthor(book.authors?.join(', ') || ''),
        coverImageUrl: book.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
        publisher: normalizePublisher(book.publisher || ''),
        publishedDate: normalizePublishedDate(book.publishedDate),
        physicalFormat: '',
        pageCount: book.pageCount || null,
        genres: book.categories || []
      };
    }
  } catch (e) {
    console.error('Google Books API error:', e);
  }

  // Try Open Library (as fallback or to supplement missing fields)
  try {
    const response = await fetchWithTimeout(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const data = await response.json();
    const book = data[`ISBN:${isbn}`];

    if (book) {
      const genres = book.subjects?.map(s => s.name || s).slice(0, 5) || [];

      if (result) {
        // Supplement missing fields from Open Library
        if (!result.publisher) result.publisher = normalizePublisher(book.publishers?.[0]?.name || '');
        if (!result.publishedDate) result.publishedDate = normalizePublishedDate(book.publish_date);
        if (!result.coverImageUrl) result.coverImageUrl = book.cover?.medium || '';
        if (!result.pageCount && book.number_of_pages) result.pageCount = book.number_of_pages;
        // Add Open Library genres to suggestions
        if (result.genres.length === 0 && genres.length > 0) {
          result.genres = genres;
        }
      } else {
        // Use Open Library as primary source
        result = {
          title: normalizeTitle(book.title || ''),
          author: normalizeAuthor(book.authors?.map(a => a.name).join(', ') || ''),
          coverImageUrl: book.cover?.medium || '',
          publisher: normalizePublisher(book.publishers?.[0]?.name || ''),
          publishedDate: normalizePublishedDate(book.publish_date),
          physicalFormat: '',
          pageCount: book.number_of_pages || null,
          genres
        };
      }
    }
  } catch (e) {
    console.error('Open Library API error:', e);
  }

  // Try Open Library edition endpoint for physical_format and page count (not in jscmd=data)
  if (result && (!result.physicalFormat || !result.pageCount)) {
    try {
      const editionResponse = await fetchWithTimeout(
        `https://openlibrary.org/isbn/${isbn}.json`
      );
      const edition = await editionResponse.json();
      if (!result.physicalFormat && edition.physical_format) {
        // Normalize to title case to match select options (e.g., "paperback" -> "Paperback")
        result.physicalFormat = edition.physical_format
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      }
      if (!result.pageCount && edition.number_of_pages) {
        result.pageCount = edition.number_of_pages;
      }
    } catch (e) {
      // Edition endpoint may not exist for all ISBNs
    }
  }

  // Cache the result (including null for not found)
  setISBNCache(isbn, result);

  return result;
}

/**
 * Search for books by title/author from Google Books and Open Library APIs
 * @param {string} query - Search query (title and/or author)
 * @param {Object} options - Search options
 * @param {number} options.startIndex - Starting index for pagination (default: 0)
 * @param {number} options.maxResults - Max results to return (default: 10)
 * @param {boolean} options.useOpenLibrary - Force use of Open Library (default: false)
 * @returns {Promise<{books: Array, hasMore: boolean, totalItems: number, useOpenLibrary: boolean}>}
 */
export async function searchBooks(query, options = {}) {
  const { startIndex = 0, maxResults = 10, useOpenLibrary = false } = options;
  let books = [];
  let hasMore = false;
  let totalItems = 0;
  let shouldUseOpenLibrary = useOpenLibrary;

  // Try Google Books first (unless forcing Open Library)
  if (!useOpenLibrary) {
    try {
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&startIndex=${startIndex}&maxResults=${maxResults}`
      );
      if (response.ok) {
        const data = await response.json();
        totalItems = data.totalItems || 0;
        if (data.items?.length > 0) {
          books = data.items.map(item => {
            const book = item.volumeInfo;
            return {
              title: normalizeTitle(book.title) || 'Unknown Title',
              author: normalizeAuthor(book.authors?.join(', ') || '') || 'Unknown Author',
              cover: book.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
              publisher: normalizePublisher(book.publisher || ''),
              publishedDate: normalizePublishedDate(book.publishedDate),
              pageCount: book.pageCount || '',
              isbn: book.industryIdentifiers?.[0]?.identifier || '',
              categories: book.categories || []
            };
          });
          hasMore = (startIndex + books.length) < totalItems;
        }
      } else {
        shouldUseOpenLibrary = true;
      }
    } catch (error) {
      console.warn('Google Books API failed:', error.message);
      shouldUseOpenLibrary = true;
    }
  }

  // Fallback to Open Library
  if (books.length === 0 && shouldUseOpenLibrary) {
    try {
      const response = await fetchWithTimeout(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&offset=${startIndex}&limit=${maxResults}`
      );
      if (response.ok) {
        const data = await response.json();
        totalItems = data.numFound || 0;
        if (data.docs?.length > 0) {
          books = data.docs.map(doc => ({
            title: normalizeTitle(doc.title) || 'Unknown Title',
            author: normalizeAuthor(doc.author_name?.join(', ') || '') || 'Unknown Author',
            cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
            publisher: normalizePublisher(doc.publisher?.[0] || ''),
            publishedDate: normalizePublishedDate(doc.first_publish_year),
            pageCount: doc.number_of_pages_median || '',
            isbn: doc.isbn?.[0] || '',
            categories: doc.subject?.slice(0, 5) || []
          }));
          hasMore = (startIndex + books.length) < totalItems;
        }
      }
    } catch (error) {
      console.error('Open Library API failed:', error.message);
    }
  }

  return { books, hasMore, totalItems, useOpenLibrary: shouldUseOpenLibrary };
}

/**
 * Check password strength
 * @param {string} password - Password to check
 * @returns {{checks: Object, score: number}} Strength checks and score (0-4)
 */
export function checkPasswordStrength(password) {
  const checks = {
    length: password.length >= 6,
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    lowercase: /[a-z]/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  let score = 0;
  if (checks.length) score++;
  if (checks.uppercase && checks.lowercase) score++;
  if (checks.number) score++;
  if (checks.special || password.length >= 10) score++;

  return { checks, score };
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
  if (!forceRefresh &&
      userProfileCache &&
      userProfileCacheUserId === userId &&
      now - userProfileCacheTime < USER_PROFILE_CACHE_TTL) {
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

// Home settings constants
const HOME_SETTINGS_KEY = 'homeSettings';
const DEFAULT_HOME_SETTINGS = {
  currentlyReading: { enabled: true, count: 6 },
  recentlyAdded: { enabled: true, count: 6 },
  topRated: { enabled: true, count: 6 },
  recentlyFinished: { enabled: true, count: 6 }
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
  } catch (e) {
    console.warn('Error loading home settings:', e);
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
  } catch (e) {
    console.warn('Error saving home settings:', e);
  }
}

/**
 * Migrate a book from old startedAt/finishedAt/status format to reads array
 * @param {Object} book - Book object (may have old or new format)
 * @returns {Object} Book with reads array
 */
export function migrateBookReads(book) {
  // Already migrated
  if (Array.isArray(book.reads)) {
    return book;
  }

  const reads = [];

  // Convert old format to new reads array
  if (book.startedAt || book.finishedAt) {
    reads.push({
      startedAt: book.startedAt || null,
      finishedAt: book.finishedAt || null
    });
  }

  // Return book with reads array (don't modify original)
  const { startedAt, finishedAt, status, ...rest } = book;
  return { ...rest, reads };
}

/**
 * Get the current read entry (last in reads array)
 * @param {Object} book - Book with reads array
 * @returns {Object|null} Current read entry or null
 */
export function getCurrentRead(book) {
  const migrated = migrateBookReads(book);
  if (!migrated.reads || migrated.reads.length === 0) {
    return null;
  }
  return migrated.reads[migrated.reads.length - 1];
}

/**
 * Infer reading status from book's reads array
 * @param {Object} book - Book object (can be old or new format)
 * @returns {string|null} 'reading', 'finished', or null (unread)
 */
export function getBookStatus(book) {
  const currentRead = getCurrentRead(book);

  if (!currentRead) {
    return null; // No reads = unread
  }

  if (currentRead.startedAt && currentRead.finishedAt) {
    return 'finished';
  }

  if (currentRead.startedAt) {
    return 'reading';
  }

  return null; // Has read entry but no dates = unread
}
