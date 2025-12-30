// Recent Searches Utility
// Manages recent search queries in localStorage

const RECENT_SEARCHES_KEY = 'mybookshelf_recent_searches';
const MAX_RECENT_SEARCHES = 5;

/**
 * Get recent searches from localStorage
 * @returns Array of recent search queries
 */
export function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a search to recent searches
 * Adds to beginning, removes duplicates, keeps max limit
 * @param query - Search query to save
 */
export function saveRecentSearch(query: string): void {
  if (!query || query.length < 2) return;

  try {
    let searches = getRecentSearches();
    // Remove if already exists (to move to top)
    searches = searches.filter(s => s !== query);
    // Add to beginning
    searches.unshift(query);
    // Keep only max
    searches = searches.slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear all recent searches
 */
export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Check if there are any recent searches
 * @returns True if there are saved searches
 */
export function hasRecentSearches(): boolean {
  return getRecentSearches().length > 0;
}

/**
 * Remove a specific search from recent searches
 * @param query - Search query to remove
 */
export function removeRecentSearch(query: string): void {
  try {
    let searches = getRecentSearches();
    searches = searches.filter(s => s !== query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
  } catch {
    // Ignore storage errors
  }
}

// Export constants for testing
export { RECENT_SEARCHES_KEY, MAX_RECENT_SEARCHES };
