// URL State Management Utility
// Handles parsing, building, and updating URL parameters for filter state

/**
 * Filter state object for URL serialization
 */
export interface FilterState {
  sort: string;
  rating: number | 'unrated';
  statuses: string[];
  genres: string[];
  series: string[];
  author: string;
}

/**
 * Default filter values (used to determine which params to include in URL)
 */
export const DEFAULT_FILTER_STATE: FilterState = {
  sort: 'createdAt-desc',
  rating: 0,
  statuses: [],
  genres: [],
  series: [],
  author: '',
};

/**
 * Parse URL search parameters into a partial filter state
 * Only returns non-default values that were present in the URL
 * @param search - URL search string (e.g., window.location.search)
 * @returns Partial filter state with values from URL
 */
export function parseUrlFilters(search: string): Partial<FilterState> {
  const params = new URLSearchParams(search);
  const state: Partial<FilterState> = {};

  // Status filter (comma-separated for multi-select)
  const status = params.get('status');
  if (status) {
    state.statuses = status.split(',').filter(Boolean);
  }

  // Rating filter (supports 'unrated')
  const rating = params.get('rating');
  if (rating) {
    state.rating = rating === 'unrated' ? 'unrated' : parseInt(rating, 10) || 0;
  }

  // Sort order
  const sort = params.get('sort');
  if (sort) {
    state.sort = sort;
  }

  // Genre filter (comma-separated for multi-select)
  const genres = params.get('genres');
  if (genres) {
    state.genres = genres.split(',').filter(Boolean);
  }

  // Series filter (comma-separated for multi-select)
  const series = params.get('series');
  if (series) {
    state.series = series.split(',').filter(Boolean);
  }

  // Author filter
  const author = params.get('author');
  if (author) {
    state.author = author;
  }

  return state;
}

/**
 * Build URLSearchParams from filter state
 * Only includes non-default values for clean URLs
 * @param state - Current filter state
 * @param defaults - Default values to compare against (optional)
 * @returns URLSearchParams object
 */
export function buildFilterParams(state: FilterState, defaults: FilterState = DEFAULT_FILTER_STATE): URLSearchParams {
  const params = new URLSearchParams();

  // Only add non-default values to keep URLs clean
  if (state.sort !== defaults.sort) {
    params.set('sort', state.sort);
  }

  if (state.rating && state.rating !== 0) {
    params.set('rating', String(state.rating));
  }

  if (state.statuses.length > 0) {
    params.set('status', state.statuses.join(','));
  }

  if (state.genres.length > 0) {
    params.set('genres', state.genres.join(','));
  }

  if (state.series.length > 0) {
    params.set('series', state.series.join(','));
  }

  if (state.author) {
    params.set('author', state.author);
  }

  return params;
}

/**
 * Build a URL string from filter state
 * @param pathname - Base pathname (e.g., '/books/')
 * @param state - Current filter state
 * @param defaults - Default values to compare against (optional)
 * @returns Full URL string
 */
export function buildFilterUrl(
  pathname: string,
  state: FilterState,
  defaults: FilterState = DEFAULT_FILTER_STATE
): string {
  const params = buildFilterParams(state, defaults);
  return params.toString() ? `${pathname}?${params}` : pathname;
}

/**
 * Update browser URL with filter state without page reload
 * Uses replaceState to avoid adding to browser history
 * @param state - Current filter state
 * @param defaults - Default values to compare against (optional)
 */
export function updateUrlWithFilters(state: FilterState, defaults: FilterState = DEFAULT_FILTER_STATE): void {
  const newUrl = buildFilterUrl(window.location.pathname, state, defaults);
  window.history.replaceState({}, '', newUrl);
}

/**
 * Clear all filter parameters from the URL
 * Keeps the pathname, removes all query parameters
 */
export function clearUrlFilters(): void {
  if (window.location.search) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

/**
 * Check if URL has any filter parameters
 * @param search - URL search string (e.g., window.location.search)
 * @returns True if any filter parameters are present
 */
export function hasUrlFilters(search: string): boolean {
  const params = new URLSearchParams(search);
  return (
    params.has('sort') ||
    params.has('rating') ||
    params.has('status') ||
    params.has('genres') ||
    params.has('series') ||
    params.has('author')
  );
}

/**
 * Get a single filter value from URL
 * @param search - URL search string
 * @param key - Parameter key to get
 * @returns Parameter value or null
 */
export function getUrlFilter(search: string, key: string): string | null {
  const params = new URLSearchParams(search);
  return params.get(key);
}

/**
 * Merge URL state with existing state
 * URL values override existing values
 * @param existing - Existing filter state
 * @param urlState - Partial state from URL
 * @returns Merged filter state
 */
export function mergeWithUrlState(existing: FilterState, urlState: Partial<FilterState>): FilterState {
  return {
    ...existing,
    ...urlState,
  };
}
