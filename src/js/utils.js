// Shared Utilities Module

// Cache Constants - shared across all modules
export const CACHE_VERSION = 7;
export const CACHE_KEY = `mybookshelf_books_cache_v${CACHE_VERSION}`;
export const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
 * - Converts ALL CAPS to Title Case
 */
export function normalizeTitle(title) {
  if (!title) return '';

  let normalized = title.trim();

  // Remove trailing periods (but not ellipsis)
  normalized = normalized.replace(/\.+$/, '');

  // Convert ALL CAPS to Title Case
  if (isAllCaps(normalized)) {
    normalized = toTitleCase(normalized);
  }

  return normalized;
}

/**
 * Normalize an author name
 * - Trims whitespace
 * - Converts ALL CAPS to Title Case
 */
export function normalizeAuthor(author) {
  if (!author) return '';

  let normalized = author.trim();

  if (isAllCaps(normalized)) {
    normalized = toTitleCase(normalized);
  }

  return normalized;
}

/**
 * Normalize a publisher name
 * - Trims whitespace
 * - Converts ALL CAPS to Title Case
 */
export function normalizePublisher(publisher) {
  if (!publisher) return '';

  let normalized = publisher.trim();

  if (isAllCaps(normalized)) {
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
