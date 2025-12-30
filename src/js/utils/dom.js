// DOM Utilities - DOM manipulation and UI helpers

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
 * Initialize Lucide icons (call sparingly)
 * @param {HTMLElement} [container] - Optional container to scope icon initialization
 */
export function initIcons(container) {
  if (typeof lucide !== 'undefined') {
    const options = container ? { root: container } : undefined;
    lucide.createIcons(options);
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
 * Check if viewport is mobile-sized (matches Tailwind's md breakpoint)
 * @returns {boolean} True if mobile
 */
export function isMobile() {
  return window.innerWidth < 768;
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
