// Series Parser Utility
// Extracts series name and position from Open Library series data

/**
 * Common patterns for series position in strings
 * Ordered by specificity (more specific patterns first)
 */
const POSITION_PATTERNS = [
  // "#1", "# 1"
  /^(.+?)\s*#\s*(\d+(?:\.\d+)?)\s*$/,
  // "Book 1", "Book One"
  /^(.+?),?\s+Book\s+(\d+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\s*$/i,
  // "Vol. 1", "Vol 1", "Volume 1"
  /^(.+?),?\s+Vol(?:ume)?\.?\s*(\d+(?:\.\d+)?)\s*$/i,
  // "Part 1"
  /^(.+?),?\s+Part\s+(\d+)\s*$/i,
  // "(1)", "( 1 )"
  /^(.+?)\s*\(\s*(\d+)\s*\)\s*$/,
  // ", 1" or ": 1" at the end
  /^(.+?)\s*[,:]\s*(\d+)\s*$/,
];

/**
 * Word numbers to digits mapping
 */
const WORD_TO_NUMBER = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
};

/**
 * Parse a position string (number or word) to a number
 * @param {string} positionStr - Position as string
 * @returns {number|null} Position as number or null
 */
function parsePosition(positionStr) {
  if (!positionStr) return null;

  const lower = positionStr.toLowerCase().trim();

  // Check for word numbers
  if (WORD_TO_NUMBER[lower] !== undefined) {
    return WORD_TO_NUMBER[lower];
  }

  // Parse as number (handles decimals like 1.5)
  const num = parseFloat(positionStr);
  return isNaN(num) ? null : num;
}

/**
 * Parse a single series string to extract name and position
 * @param {string} seriesStr - Series string like "Harry Potter #4"
 * @returns {{ name: string, position: number|null }} Parsed series info
 */
export function parseSeriesString(seriesStr) {
  if (!seriesStr || typeof seriesStr !== 'string') {
    return { name: '', position: null };
  }

  const trimmed = seriesStr.trim();
  if (!trimmed) {
    return { name: '', position: null };
  }

  // Try each pattern
  for (const pattern of POSITION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const name = match[1].trim();
      const position = parsePosition(match[2]);
      if (name && position !== null) {
        return { name, position };
      }
    }
  }

  // No position found - return the whole string as name
  return { name: trimmed, position: null };
}

/**
 * Parse series data from Open Library API response
 * Open Library returns series as an array of strings
 * @param {string|string[]|undefined} seriesData - Series data from API
 * @returns {{ name: string, position: number|null }|null} Primary series info or null
 */
export function parseSeriesFromAPI(seriesData) {
  if (!seriesData) return null;

  // Handle string (single series)
  if (typeof seriesData === 'string') {
    const parsed = parseSeriesString(seriesData);
    return parsed.name ? parsed : null;
  }

  // Handle array (multiple series - take first with position, or first overall)
  if (Array.isArray(seriesData) && seriesData.length > 0) {
    // First pass: look for one with a position
    for (const s of seriesData) {
      const parsed = parseSeriesString(s);
      if (parsed.name && parsed.position !== null) {
        return parsed;
      }
    }

    // Second pass: take first valid name
    for (const s of seriesData) {
      const parsed = parseSeriesString(s);
      if (parsed.name) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Normalize a series name for comparison/grouping
 * Handles variations like "HP" vs "Harry Potter"
 * @param {string} name - Series name
 * @returns {string} Normalized name (lowercase, trimmed)
 */
export function normalizeSeriesName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['']/g, "'")  // Normalize quotes
    .replace(/\s+/g, ' ')   // Normalize whitespace
    .trim();
}

/**
 * Check if two series names likely refer to the same series
 * @param {string} name1 - First series name
 * @param {string} name2 - Second series name
 * @returns {boolean} True if names match
 */
export function seriesNamesMatch(name1, name2) {
  const n1 = normalizeSeriesName(name1);
  const n2 = normalizeSeriesName(name2);

  if (!n1 || !n2) return false;

  // Exact match
  if (n1 === n2) return true;

  // One contains the other (handles "Harry Potter" vs "Harry Potter Series")
  if (n1.includes(n2) || n2.includes(n1)) return true;

  return false;
}

/**
 * Format series info for display
 * @param {string} name - Series name
 * @param {number|null} position - Position in series
 * @returns {string} Formatted string like "Harry Potter #4"
 */
export function formatSeriesDisplay(name, position) {
  if (!name) return '';
  if (position === null || position === undefined) return name;

  // Use # format for integers, keep decimal for half-books
  const posStr = Number.isInteger(position) ? `#${position}` : `#${position}`;
  return `${name} ${posStr}`;
}
