// Shared Utilities Module

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

  setTimeout(() => toast.classList.add('hidden'), duration);
}

/**
 * Initialize Lucide icons (call sparingly)
 */
export function initIcons() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}
