// Book Sorters - Pure sort functions for book arrays

/**
 * Extract surname from author name for sorting
 * Handles formats like "First Last", "First Middle Last", "Last, First"
 * @param {string} author - Author name
 * @returns {string} Lowercase surname for comparison
 */
export function getAuthorSurname(author) {
  if (!author) return '';
  const trimmed = author.trim();

  // Handle "Last, First" format
  if (trimmed.includes(',')) {
    return trimmed.split(',')[0].trim().toLowerCase();
  }

  // Handle "First Last" or "First Middle Last" - take last word
  const parts = trimmed.split(/\s+/);
  return (parts[parts.length - 1] || '').toLowerCase();
}

/**
 * Sort books by the specified sort key
 * @param {Array} books - Array of books to sort
 * @param {string} sortKey - Sort key in format "field-direction" (e.g., "title-asc", "rating-desc")
 * @returns {Array} New sorted array (does not mutate original)
 */
export function sortBooks(books, sortKey) {
  // Special case: series order (sort by position, nulls at end)
  if (sortKey === 'seriesPosition-asc') {
    return [...books].sort((a, b) => {
      const aPos = a.seriesPosition;
      const bPos = b.seriesPosition;
      if (aPos === null && bPos === null) return 0;
      if (aPos === null) return 1;
      if (bPos === null) return -1;
      return aPos - bPos;
    });
  }

  const [field, direction] = sortKey.split('-');
  return [...books].sort((a, b) => {
    let aVal, bVal;
    switch (field) {
      case 'title':
        aVal = (a.title || '').toLowerCase();
        bVal = (b.title || '').toLowerCase();
        break;
      case 'author':
        // Sort by surname (last word of author name)
        aVal = getAuthorSurname(a.author);
        bVal = getAuthorSurname(b.author);
        break;
      case 'rating':
        aVal = a.rating || 0;
        bVal = b.rating || 0;
        break;
      default: // createdAt
        aVal = a.createdAt || 0;
        bVal = b.createdAt || 0;
    }
    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Available sort options
 */
export const SORT_OPTIONS = [
  { value: 'createdAt-desc', label: 'Date Added (Newest)' },
  { value: 'createdAt-asc', label: 'Date Added (Oldest)' },
  { value: 'title-asc', label: 'Title (A-Z)' },
  { value: 'title-desc', label: 'Title (Z-A)' },
  { value: 'author-asc', label: 'Author (A-Z)' },
  { value: 'author-desc', label: 'Author (Z-A)' },
  { value: 'rating-desc', label: 'Rating (High-Low)' },
  { value: 'rating-asc', label: 'Rating (Low-High)' },
  { value: 'seriesPosition-asc', label: 'Series Order' },
];

/**
 * Default sort key
 */
export const DEFAULT_SORT = 'createdAt-desc';
