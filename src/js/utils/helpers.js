// Helper Utilities - Misc helper functions

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
