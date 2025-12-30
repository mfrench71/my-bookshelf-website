// Book Sorters - Pure sort functions for book arrays

/** Book type for sorting */
interface Book {
  id?: string;
  title?: string;
  author?: string;
  rating?: number;
  seriesPosition?: number | null;
  createdAt?: Date | string | number;
}

/** Sort option configuration */
interface SortOption {
  value: string;
  label: string;
}

/**
 * Extract surname from author name for sorting
 * Handles formats like "First Last", "First Middle Last", "Last, First"
 * @param author - Author name
 * @returns Lowercase surname for comparison
 */
export function getAuthorSurname(author: string | undefined | null): string {
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
 * @param books - Array of books to sort
 * @param sortKey - Sort key in format "field-direction" (e.g., "title-asc", "rating-desc")
 * @returns New sorted array (does not mutate original)
 */
export function sortBooks(books: Book[], sortKey: string): Book[] {
  // Special case: series order (sort by position, nulls at end)
  if (sortKey === 'seriesPosition-asc') {
    return [...books].sort((a, b) => {
      const aPos = a.seriesPosition;
      const bPos = b.seriesPosition;
      if (aPos == null && bPos == null) return 0;
      if (aPos == null) return 1;
      if (bPos == null) return -1;
      return aPos - bPos;
    });
  }

  const [field, direction] = sortKey.split('-');
  return [...books].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

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
        aVal = (a.createdAt as number) || 0;
        bVal = (b.createdAt as number) || 0;
    }

    const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Available sort options
 */
export const SORT_OPTIONS: SortOption[] = [
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
