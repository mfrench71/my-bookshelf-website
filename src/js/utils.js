// Shared Utilities Module
// This file re-exports from focused modules for backwards compatibility
// New code should import directly from utils/[module].js

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
  renderStars
} from './utils/format.js';

// DOM utilities
export {
  escapeHtml,
  escapeAttr,
  lockBodyScroll,
  unlockBodyScroll,
  initIcons,
  updateRatingStars,
  isMobile,
  getContrastColor
} from './utils/dom.js';

// Helper utilities
export {
  debounce,
  throttle,
  checkPasswordStrength,
  isOnline,
  isValidImageUrl
} from './utils/helpers.js';

// Cache utilities
export {
  CACHE_VERSION,
  CACHE_KEY,
  CACHE_TTL,
  clearBooksCache,
  getHomeSettings,
  saveHomeSettings,
  getCachedUserProfile,
  clearUserProfileCache
} from './utils/cache.js';

// API utilities
export {
  fetchWithTimeout,
  lookupISBN,
  searchBooks
} from './utils/api.js';

// Reading utilities
export {
  migrateBookReads,
  getCurrentRead,
  getBookStatus
} from './utils/reading.js';

// Toast (re-exported from stores for backwards compatibility)
export { showToast } from './stores/toast.js';

// Sync settings
export {
  getSyncSettings,
  saveSyncSettings,
  resetSyncSettings,
  getDefaultSyncSettings
} from './utils/sync-settings.js';

// Visibility-based refresh
export {
  setupVisibilityRefresh,
  getLastRefreshTime,
  setLastRefreshTime
} from './utils/visibility-refresh.js';
