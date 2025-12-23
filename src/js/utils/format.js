// Format Utilities - Date and text formatting

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
 * Render star rating as SVG HTML
 */
export function renderStars(rating) {
  const filledStar = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  const emptyStar = '<svg class="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  return Array.from({ length: 5 }, (_, i) =>
    i < rating ? filledStar : emptyStar
  ).join('');
}
