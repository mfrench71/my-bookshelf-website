// Utils Index - Re-exports all utilities for convenient importing

// Format utilities
export {
  serializeTimestamp,
  parseTimestamp,
  formatDate,
  normalizeText,
  normalizeGenreName,
  normalizeTitle,
  normalizeAuthor,
  normalizePublisher,
  normalizePublishedDate,
  renderStars,
} from './format.js';

// DOM utilities
export {
  escapeHtml,
  escapeAttr,
  lockBodyScroll,
  unlockBodyScroll,
  initIcons,
  updateRatingStars,
  isMobile,
  getContrastColor,
} from './dom.js';

// Helper utilities
export { debounce, throttle, checkPasswordStrength, isOnline, isValidImageUrl } from './helpers.js';

// Cache utilities
export {
  CACHE_VERSION,
  CACHE_KEY,
  CACHE_TTL,
  clearBooksCache,
  getHomeSettings,
  saveHomeSettings,
  getCachedUserProfile,
  clearUserProfileCache,
  getISBNCache,
  setISBNCache,
} from './cache.js';

// API utilities
export { fetchWithTimeout, lookupISBN, searchBooks } from './api.js';

// Reading utilities
export { migrateBookReads, getCurrentRead, getBookStatus } from './reading.js';

// Validation utilities
export {
  validateField,
  validateForm,
  showFieldError,
  clearFormErrors,
  showFormErrors,
  getFormData,
  setupFieldValidation,
} from './validation.js';
