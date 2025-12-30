// Books List Page Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDocsFromServer,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  showToast,
  initIcons,
  CACHE_KEY,
  CACHE_TTL,
  serializeTimestamp,
  clearBooksCache,
  throttle,
  getBookStatus,
  setupVisibilityRefresh,
  setLastRefreshTime,
  lockBodyScroll,
  unlockBodyScroll,
  escapeHtml,
  escapeAttr,
} from '../utils.js';
import { bookCard } from '../components/book-card.js';
import { loadUserGenres, createGenreLookup } from '../genres.js';
import { loadUserSeries, createSeriesLookup } from '../series.js';
import { filterActivebooks } from '../bin.js';
import { FilterPanel } from '../components/filter-panel.js';

// Initialize icons once on load
initIcons();

// Constants
const BOOKS_PER_PAGE = 20;

// State
let currentUser = null;
let books = [];
let currentSort = 'createdAt-desc';
let previousSort = null; // Store sort before switching to series order
let ratingFilter = 0;
let displayLimit = BOOKS_PER_PAGE;
let lastDoc = null;
let hasMoreFromFirebase = true;
let isLoading = false;
let forceServerFetch = false;
let cachedFilteredBooks = null; // Cache for filtered/sorted results
let isInitialLoad = true; // Flag to skip rendering during initial load (prevents double render)
let hasTriggeredInitialFade = false; // Flag to trigger content fade-in only once
let genres = []; // All user genres
let genreLookup = null; // Map of genreId -> genre object
let genreFilters = []; // Array of selected genre IDs for filtering (multi-select)
let statusFilters = []; // Array of selected statuses for filtering (multi-select)
let seriesFilters = []; // Array of selected series IDs for filtering (multi-select)
let authorFilter = ''; // Currently selected author for filtering (URL param only)
let series = []; // All user series
let seriesLookup = null; // Map of seriesId -> series object
let lastFilterCount = null; // Track previous filter count for pulse animation

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const noResultsState = document.getElementById('no-results-state');
const noResultsTitle = document.getElementById('no-results-title');
const clearFiltersLink = document.getElementById('clear-filters-link');
const bookList = document.getElementById('book-list');
const bookCountMobile = document.getElementById('book-count-mobile');
const bookCountDesktop = document.getElementById('book-count-desktop');

// Mobile elements
const filterTriggerBtn = document.getElementById('filter-trigger');
const filterCountBadge = document.getElementById('filter-count-badge');
const sortSelectMobile = document.getElementById('sort-select-mobile');
const filterSheet = document.getElementById('filter-sheet');
const filterSheetContent = document.getElementById('filter-sheet-content');
const applyFiltersMobileBtn = document.getElementById('apply-filters-mobile');

// Desktop sidebar
const filterSidebar = document.getElementById('filter-sidebar');
const filterSidebarSkeleton = document.getElementById('filter-sidebar-skeleton');

// Active filter chips containers (both mobile and desktop)
const activeFiltersMobile = document.getElementById('active-filters-mobile');
const activeFiltersDesktop = document.getElementById('active-filters-desktop');

// FilterPanel instances
let sidebarPanel = null;
let mobilePanel = null;

/**
 * Parse URL parameters and apply filter state
 * Supports sort, rating, status, genres, series, and author filters
 */
function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);

  // Status filter (comma-separated for multi-select)
  const status = params.get('status');
  if (status) {
    statusFilters = status.split(',').filter(Boolean);
  }

  // Rating filter (supports 'unrated')
  const rating = params.get('rating');
  if (rating) {
    ratingFilter = rating === 'unrated' ? 'unrated' : parseInt(rating, 10) || 0;
  }

  // Sort order
  const sort = params.get('sort');
  if (sort) {
    currentSort = sort;
    if (sortSelectMobile) sortSelectMobile.value = sort;
  }

  // Genre filter (comma-separated for multi-select)
  const genres = params.get('genres');
  if (genres) {
    genreFilters = genres.split(',').filter(Boolean);
  }

  // Series filter (comma-separated for multi-select)
  const seriesParam = params.get('series');
  if (seriesParam) {
    seriesFilters = seriesParam.split(',').filter(Boolean);
  }

  // Author filter (URL param only)
  const author = params.get('author');
  if (author) {
    authorFilter = author;
  }

  // Update author filter badge visibility
  renderActiveFilterChips();
}

/**
 * Build URLSearchParams from current filter state
 * Only includes non-default values for clean URLs
 * @returns {URLSearchParams} URL parameters object
 */
function buildFilterParams() {
  const params = new URLSearchParams();

  // Only add non-default values to keep URLs clean
  if (currentSort !== 'createdAt-desc') {
    params.set('sort', currentSort);
  }
  if (ratingFilter && ratingFilter !== 0) {
    params.set('rating', ratingFilter);
  }
  if (statusFilters.length > 0) {
    params.set('status', statusFilters.join(','));
  }
  if (genreFilters.length > 0) {
    params.set('genres', genreFilters.join(','));
  }
  if (seriesFilters.length > 0) {
    params.set('series', seriesFilters.join(','));
  }
  if (authorFilter) {
    params.set('author', authorFilter);
  }

  return params;
}

/**
 * Update browser URL with current filters without page reload
 * Uses replaceState to avoid adding to history
 */
function updateUrlWithFilters() {
  const params = buildFilterParams();
  const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;

  window.history.replaceState({}, '', newUrl);
}

// Apply URL filters on page load
applyUrlFilters();

// Auth State
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    // Load genres, series, and books in parallel for faster initial load
    await Promise.all([loadGenres(), loadSeries(), loadBooks()]);

    // Initialize filter panels with loaded data
    initializeFilterPanels();

    // If exactly one series filter was set via URL param, set up Series Order sort
    // Must be done BEFORE renderBooks() so books display in correct order
    if (seriesFilters.length === 1) {
      updateSeriesOrderOption(true);
      switchToSeriesOrder();
    }

    // Render now that all data is ready (genres, series, books loaded in parallel)
    renderBooks();

    // Mark initial load as complete (prevents duplicate renders on subsequent loadBooks calls)
    isInitialLoad = false;

    // Mark this as an initial load for visibility refresh cooldown
    setLastRefreshTime();

    // Set up auto-refresh when tab becomes visible
    setupVisibilityRefresh(silentRefreshBooks);

    // Update filter count badge and chips
    updateFilterCountBadge();
    renderActiveFilterChips();
  }
});

/**
 * Load user genres from Firebase and update filter panels
 * @returns {Promise<void>}
 */
async function loadGenres() {
  try {
    genres = await loadUserGenres(currentUser.uid);
    genreLookup = createGenreLookup(genres);
    // Update filter panels if already initialized
    if (sidebarPanel) sidebarPanel.setGenres(genres);
    if (mobilePanel) mobilePanel.setGenres(genres);
  } catch (error) {
    console.error('Error loading genres:', error);
    genres = [];
    genreLookup = new Map();
  }
}

/**
 * Load user series from Firebase and update filter panels
 * Handles URL param matching by series name or ID
 * @returns {Promise<void>}
 */
async function loadSeries() {
  try {
    series = await loadUserSeries(currentUser.uid);
    seriesLookup = createSeriesLookup(series);

    // Handle URL param with series name (from widget links)
    // If seriesFilters has entries that are not valid series IDs, try to match by name
    seriesFilters = seriesFilters.map(filterVal => {
      if (!seriesLookup.has(filterVal)) {
        const matchedSeries = series.find(
          s =>
            s.name.toLowerCase() === filterVal.toLowerCase() ||
            s.normalizedName === filterVal.toLowerCase().replace(/[^a-z0-9]/g, '')
        );
        return matchedSeries ? matchedSeries.id : filterVal;
      }
      return filterVal;
    });

    // Update filter panels if already initialized
    if (sidebarPanel) sidebarPanel.setSeries(series);
    if (mobilePanel) mobilePanel.setSeries(series);
  } catch (error) {
    console.error('Error loading series:', error);
    series = [];
    seriesLookup = new Map();
  }
}

/**
 * Get cached books from localStorage
 * Returns null if cache is expired or sort order doesn't match
 * @returns {{books: Array, hasMore: boolean}|null} Cached books or null
 */
function getCachedBooks() {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (!cached) return null;

    const { books: cachedBooks, timestamp, sort, hasMore } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    // Return cache if fresh and same sort order
    if (age < CACHE_TTL && sort === currentSort) {
      return { books: cachedBooks, hasMore: hasMore ?? true };
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  return null;
}

/**
 * Save books to localStorage cache
 * @param {Array} booksData - Array of book objects to cache
 * @param {boolean} hasMore - Whether more books exist in Firebase
 */
function setCachedBooks(booksData, hasMore) {
  try {
    const cacheData = {
      books: booksData,
      timestamp: Date.now(),
      sort: currentSort,
      hasMore: hasMore,
    };
    localStorage.setItem(`${CACHE_KEY}_${currentUser.uid}`, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

/**
 * Clear both localStorage and in-memory caches
 */
function clearCache() {
  clearBooksCache(currentUser.uid);
  cachedFilteredBooks = null;
}

/**
 * Convert Firestore document to serializable format
 * @param {DocumentSnapshot} doc - Firestore document snapshot
 * @returns {Object} Book object with serialized timestamps
 */
function serializeBook(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt),
  };
}

/**
 * Load books from cache or Firebase
 * Fetches all pages to get complete data for client-side filtering
 * @param {boolean} [forceRefresh=false] - Force reload from Firebase
 * @returns {Promise<void>}
 */
async function loadBooks(forceRefresh = false) {
  if (isLoading) return;

  // Invalidate filtered cache when loading new data
  cachedFilteredBooks = null;

  // Try cache first (unless forcing refresh)
  // Only use cache if it's complete (hasMore = false), otherwise fetch fresh
  const cached = getCachedBooks();
  const hasCachedBooks = cached && cached.books && cached.books.length > 0;

  if (!forceRefresh && hasCachedBooks && !cached.hasMore) {
    books = cached.books;
    lastDoc = null;
    hasMoreFromFirebase = false;
    loadingState.classList.add('hidden');
    // Skip rendering during initial load - let the main init render handle it
    // This prevents double rendering when genres/series load in parallel
    if (!isInitialLoad) renderBooks();
    return;
  }

  // If offline, use any cached data we have
  if (!navigator.onLine) {
    if (hasCachedBooks) {
      books = cached.books;
      lastDoc = null;
      hasMoreFromFirebase = false;
      loadingState.classList.add('hidden');
      if (!isInitialLoad) renderBooks();
      showToast('Showing cached books (offline)', { type: 'info' });
      return;
    } else {
      loadingState.classList.add('hidden');
      showToast('No cached books available offline', { type: 'error' });
      return;
    }
  }

  // Fetch from Firebase
  isLoading = true;
  loadingState.classList.remove('hidden');
  bookList.innerHTML = '';

  try {
    books = [];
    lastDoc = null;
    hasMoreFromFirebase = true;
    forceServerFetch = forceRefresh; // Force server fetch on manual refresh

    // Fetch all pages to get complete data
    while (hasMoreFromFirebase) {
      await fetchNextPage();
    }

    forceServerFetch = false; // Reset after fetch

    loadingState.classList.add('hidden');
    if (!isInitialLoad) renderBooks();
  } catch (error) {
    console.error('Error loading books:', error);
    loadingState.classList.add('hidden');

    // If Firebase fails and we have cached data, use it
    if (hasCachedBooks) {
      books = cached.books;
      lastDoc = null;
      hasMoreFromFirebase = false;
      if (!isInitialLoad) renderBooks();
      showToast('Using cached books (connection error)', { type: 'info' });
    } else {
      // User-friendly error message instead of raw error
      const userMessage =
        error.code === 'permission-denied'
          ? 'Permission denied. Please log in again.'
          : 'Unable to load books. Please check your connection.';
      showToast(userMessage, { type: 'error' });
      console.error('Error loading books:', error);
    }
  } finally {
    isLoading = false;
  }
}

/**
 * Fetch next page of books from Firebase
 * Updates books array, lastDoc cursor, and hasMoreFromFirebase flag
 * @returns {Promise<void>}
 */
async function fetchNextPage() {
  if (!hasMoreFromFirebase) {
    return;
  }
  const [field, direction] = currentSort.split('-');

  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    let q;

    if (lastDoc) {
      q = query(
        booksRef,
        orderBy(field === 'createdAt' ? 'createdAt' : field, direction === 'asc' ? 'asc' : 'desc'),
        startAfter(lastDoc),
        limit(BOOKS_PER_PAGE)
      );
    } else {
      q = query(
        booksRef,
        orderBy(field === 'createdAt' ? 'createdAt' : field, direction === 'asc' ? 'asc' : 'desc'),
        limit(BOOKS_PER_PAGE)
      );
    }

    // Use getDocsFromServer on refresh to bypass Firestore's offline cache for all pages
    const snapshot = forceServerFetch ? await getDocsFromServer(q) : await getDocs(q);
    const newBooks = snapshot.docs.map(serializeBook);

    // Deduplicate - filter out books already in the array
    const existingIds = new Set(books.map(b => b.id));
    const uniqueNewBooks = newBooks.filter(b => !existingIds.has(b.id));

    books = [...books, ...uniqueNewBooks];
    cachedFilteredBooks = null; // Invalidate filtered cache when books change
    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    // If we got a full page but no new unique books, we've caught up - no more to fetch
    if (snapshot.docs.length === BOOKS_PER_PAGE && uniqueNewBooks.length === 0) {
      hasMoreFromFirebase = false;
    } else {
      hasMoreFromFirebase = snapshot.docs.length === BOOKS_PER_PAGE;
    }

    // Update cache with all loaded books
    setCachedBooks(books, hasMoreFromFirebase);
  } catch (error) {
    console.error('Error fetching page:', error);
    throw error;
  }
}

// Intersection Observer for infinite scroll
let scrollObserver = null;

/**
 * Set up IntersectionObserver for infinite scroll
 * Triggers loadMore when scroll sentinel enters viewport
 */
function setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver(
    entries => {
      if (entries[0].isIntersecting && !isLoading) {
        loadMore();
      }
    },
    { rootMargin: '100px' }
  );
}

setupScrollObserver();

/**
 * Extract surname (last word) for author sorting
 * @param {string} author - Full author name
 * @returns {string} Lowercase surname
 */
function getAuthorSurname(author) {
  if (!author) return '';
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Sort books array by specified key
 * @param {Array} booksArray - Array of book objects
 * @param {string} sortKey - Sort key in format 'field-direction' (e.g., 'title-asc')
 * @returns {Array} New sorted array (does not mutate original)
 */
function sortBooks(booksArray, sortKey) {
  // Special case: series order (sort by position, nulls at end)
  if (sortKey === 'seriesPosition-asc') {
    return [...booksArray].sort((a, b) => {
      const aPos = a.seriesPosition;
      const bPos = b.seriesPosition;
      if (aPos === null && bPos === null) return 0;
      if (aPos === null) return 1;
      if (bPos === null) return -1;
      return aPos - bPos;
    });
  }

  const [field, direction] = sortKey.split('-');
  return [...booksArray].sort((a, b) => {
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
 * Show or hide the Series Order sort option in dropdowns
 * @param {boolean} showOption - Whether to show the option
 */
function updateSeriesOrderOption(showOption) {
  // Update mobile sort select
  if (sortSelectMobile) {
    const mobileOption = sortSelectMobile.querySelector('.series-sort-option');
    if (mobileOption) {
      mobileOption.classList.toggle('hidden', !showOption);
    }
  }
}

/**
 * Switch to series order sort
 * Stores previous sort for restoration when series filter is cleared
 */
function switchToSeriesOrder() {
  if (currentSort !== 'seriesPosition-asc') {
    previousSort = currentSort;
    currentSort = 'seriesPosition-asc';
    if (sortSelectMobile) sortSelectMobile.value = 'seriesPosition-asc';
    // Update sidebar panel sort if it exists
    if (sidebarPanel) {
      sidebarPanel.setFilters({ sort: 'seriesPosition-asc' });
    }
    invalidateFilteredCache();
  }
}

/**
 * Restore previous sort order after series filter is cleared
 */
function restorePreviousSort() {
  if (previousSort && currentSort === 'seriesPosition-asc') {
    currentSort = previousSort;
    if (sortSelectMobile) sortSelectMobile.value = previousSort;
    // Update sidebar panel sort if it exists
    if (sidebarPanel) {
      sidebarPanel.setFilters({ sort: previousSort });
    }
    previousSort = null;
    invalidateFilteredCache();
  }
}

/**
 * Filter books by rating (minimum threshold or unrated)
 * @param {Array} booksArray - Array of books to filter
 * @param {number|string} ratingValue - Minimum rating (1-5), 0 for all, or 'unrated'
 * @returns {Array} Filtered books array
 */
function filterByRating(booksArray, ratingValue) {
  if (ratingValue === 0) return booksArray;
  if (ratingValue === 'unrated') {
    return booksArray.filter(b => !b.rating || b.rating === 0);
  }
  return booksArray.filter(b => (b.rating || 0) >= ratingValue);
}

/**
 * Filter books by genre IDs (OR logic - any selected genre matches)
 * @param {Array} booksArray - Array of books to filter
 * @param {Array<string>} genreIds - Array of genre IDs to filter by
 * @returns {Array} Filtered books array
 */
function filterByGenres(booksArray, genreIds) {
  if (!genreIds || genreIds.length === 0) return booksArray;
  return booksArray.filter(b => b.genres && b.genres.some(gId => genreIds.includes(gId)));
}

/**
 * Filter books by reading status (OR logic - any selected status matches)
 * @param {Array} booksArray - Array of books to filter
 * @param {Array<string>} statuses - Array of statuses ('reading', 'finished')
 * @returns {Array} Filtered books array
 */
function filterByStatuses(booksArray, statuses) {
  if (!statuses || statuses.length === 0) return booksArray;
  return booksArray.filter(b => statuses.includes(getBookStatus(b)));
}

/**
 * Filter books by series IDs (OR logic - any selected series matches)
 * @param {Array} booksArray - Array of books to filter
 * @param {Array<string>} seriesIds - Array of series IDs to filter by
 * @returns {Array} Filtered books array
 */
function filterBySeriesIds(booksArray, seriesIds) {
  if (!seriesIds || seriesIds.length === 0) return booksArray;
  return booksArray.filter(b => b.seriesId && seriesIds.includes(b.seriesId));
}

/**
 * Filter books by author name (case-insensitive exact match)
 * @param {Array} booksArray - Array of books to filter
 * @param {string} author - Author name to filter by
 * @returns {Array} Filtered books array
 */
function filterByAuthor(booksArray, author) {
  if (!author) return booksArray;
  const authorLower = author.toLowerCase();
  return booksArray.filter(b => b.author?.toLowerCase() === authorLower);
}

/**
 * Extract unique authors from books list
 * @returns {Array<string>} Sorted array of unique author names
 */
function getUniqueAuthors() {
  const authorSet = new Set(books.filter(b => !b.deletedAt && b.author?.trim()).map(b => b.author.trim()));
  return Array.from(authorSet).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

/**
 * Get filtered and sorted books (with memoization)
 * Applies all active filters and current sort order
 * @returns {Array} Filtered and sorted books array
 */
function getFilteredBooks() {
  if (cachedFilteredBooks) return cachedFilteredBooks;
  // First filter out binned (soft-deleted) books
  let filtered = filterActivebooks(books);
  filtered = filterByRating(filtered, ratingFilter);
  filtered = filterByGenres(filtered, genreFilters);
  filtered = filterByStatuses(filtered, statusFilters);
  filtered = filterBySeriesIds(filtered, seriesFilters);
  filtered = filterByAuthor(filtered, authorFilter);
  cachedFilteredBooks = sortBooks(filtered, currentSort);
  return cachedFilteredBooks;
}

/**
 * Invalidate filtered books cache
 * Call when filters or books data changes
 */
function invalidateFilteredCache() {
  cachedFilteredBooks = null;
}

/**
 * Calculate faceted filter counts for filter options
 * Each count shows books that would match if that option were selected
 * @param {Object} [filterOverrides] - Optional filter values to use instead of globals
 * @returns {Object} Counts for ratings, genres, status, series, authors
 */
function calculateFilterCounts(filterOverrides = null) {
  // Use overrides if provided, otherwise use global filter state
  const activeRating = filterOverrides?.rating ?? ratingFilter;
  const activeGenres = filterOverrides?.genres ?? genreFilters;
  const activeStatuses = filterOverrides?.statuses ?? statusFilters;
  const activeSeriesIds = filterOverrides?.seriesIds ?? seriesFilters;
  const activeAuthor = filterOverrides?.author ?? authorFilter;

  const activeBooks = filterActivebooks(books);

  // For rating counts: apply all filters EXCEPT rating
  let booksForRating = activeBooks;
  booksForRating = filterByGenres(booksForRating, activeGenres);
  booksForRating = filterByStatuses(booksForRating, activeStatuses);
  booksForRating = filterBySeriesIds(booksForRating, activeSeriesIds);
  booksForRating = filterByAuthor(booksForRating, activeAuthor);

  const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unrated: 0 };
  booksForRating.forEach(b => {
    const r = b.rating || 0;
    if (r >= 1 && r <= 5) {
      ratings[r]++;
    } else {
      ratings.unrated++;
    }
  });
  // "All Ratings" count = total books matching other filters
  const ratingTotal = booksForRating.length;

  // For genre counts: apply all filters EXCEPT genres
  let booksForGenre = activeBooks;
  booksForGenre = filterByRating(booksForGenre, activeRating);
  booksForGenre = filterByStatuses(booksForGenre, activeStatuses);
  booksForGenre = filterBySeriesIds(booksForGenre, activeSeriesIds);
  booksForGenre = filterByAuthor(booksForGenre, activeAuthor);

  const genresCounts = {};
  booksForGenre.forEach(b => {
    if (b.genres && Array.isArray(b.genres)) {
      b.genres.forEach(gId => {
        genresCounts[gId] = (genresCounts[gId] || 0) + 1;
      });
    }
  });
  // "All Genres" count = total books matching other filters
  const genreTotal = booksForGenre.length;

  // For status counts: apply all filters EXCEPT statuses
  let booksForStatus = activeBooks;
  booksForStatus = filterByRating(booksForStatus, activeRating);
  booksForStatus = filterByGenres(booksForStatus, activeGenres);
  booksForStatus = filterBySeriesIds(booksForStatus, activeSeriesIds);
  booksForStatus = filterByAuthor(booksForStatus, activeAuthor);

  const statusCounts = { reading: 0, finished: 0 };
  booksForStatus.forEach(b => {
    const status = getBookStatus(b);
    if (status === 'reading') statusCounts.reading++;
    else if (status === 'finished') statusCounts.finished++;
  });
  // "All Status" count = total books matching other filters
  const statusTotal = booksForStatus.length;

  // For series counts: apply all filters EXCEPT series
  let booksForSeries = activeBooks;
  booksForSeries = filterByRating(booksForSeries, activeRating);
  booksForSeries = filterByGenres(booksForSeries, activeGenres);
  booksForSeries = filterByStatuses(booksForSeries, activeStatuses);
  booksForSeries = filterByAuthor(booksForSeries, activeAuthor);

  const seriesCounts = {};
  booksForSeries.forEach(b => {
    if (b.seriesId) {
      seriesCounts[b.seriesId] = (seriesCounts[b.seriesId] || 0) + 1;
    }
  });
  // "All Series" count = total books matching other filters
  const seriesTotal = booksForSeries.length;

  // For author counts: apply all filters EXCEPT author
  let booksForAuthor = activeBooks;
  booksForAuthor = filterByRating(booksForAuthor, activeRating);
  booksForAuthor = filterByGenres(booksForAuthor, activeGenres);
  booksForAuthor = filterByStatuses(booksForAuthor, activeStatuses);
  booksForAuthor = filterBySeriesIds(booksForAuthor, activeSeriesIds);

  const authorCounts = {};
  booksForAuthor.forEach(b => {
    if (b.author?.trim()) {
      const author = b.author.trim();
      authorCounts[author] = (authorCounts[author] || 0) + 1;
    }
  });

  return {
    ratingTotal,
    genreTotal,
    statusTotal,
    seriesTotal,
    ratings,
    genres: genresCounts,
    status: statusCounts,
    series: seriesCounts,
    authors: authorCounts,
  };
}

/**
 * Update filter panel counts and author list
 * Recalculates faceted counts and updates both panels
 */
function updateFilterCounts() {
  const counts = calculateFilterCounts();
  const authors = getUniqueAuthors();
  if (sidebarPanel) {
    sidebarPanel.setAuthors(authors);
    sidebarPanel.setBookCounts(counts);
  }
  if (mobilePanel) {
    mobilePanel.setAuthors(authors);
    mobilePanel.setBookCounts(counts);
  }
}

/**
 * Update book count display in header
 * Shows filtered count vs total when filters are active
 */
function updateBookCount() {
  const filtered = getFilteredBooks();
  const total = filterActivebooks(books).length;
  const hasFilters = hasActiveFilters();

  let countText;
  if (hasFilters && filtered.length !== total) {
    countText = `${filtered.length} of ${total} book${total !== 1 ? 's' : ''}`;
  } else {
    countText = `${total} book${total !== 1 ? 's' : ''}`;
  }

  [bookCountMobile, bookCountDesktop].forEach(el => {
    if (el) {
      el.textContent = countText;
      el.classList.remove('hidden');
    }
  });
}

/**
 * Render books list to DOM
 * Shows book cards, empty states, and scroll sentinel for infinite scroll
 */
function renderBooks() {
  const filtered = getFilteredBooks();
  updateBookCount();

  if (filtered.length === 0) {
    bookList.innerHTML = '';

    // Check if we have books but filters don't match
    if (books.length > 0 && hasActiveFilters()) {
      // Show "no results" state with filter context
      emptyState.classList.add('hidden');
      if (noResultsState) {
        noResultsState.classList.remove('hidden');
        if (noResultsTitle) {
          noResultsTitle.textContent = `No books match ${getActiveFilterDescription()}`;
        }
      }
    } else {
      // Show "no books yet" empty state
      if (noResultsState) noResultsState.classList.add('hidden');
      emptyState.classList.remove('hidden');
    }

    initIcons();
    return;
  }

  emptyState.classList.add('hidden');
  if (noResultsState) noResultsState.classList.add('hidden');
  const visible = filtered.slice(0, displayLimit);
  const hasMoreToDisplay = filtered.length > displayLimit;

  bookList.innerHTML = visible.map(book => bookCard(book, { showDate: true, genreLookup, seriesLookup })).join('');

  // Trigger fade-in animation on first content render
  if (!hasTriggeredInitialFade) {
    bookList.classList.add('content-fade-in');
    hasTriggeredInitialFade = true;
  }

  if (hasMoreToDisplay) {
    bookList.innerHTML += `
      <div id="scroll-sentinel" class="py-6 flex justify-center">
        <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    `;
    const sentinel = document.getElementById('scroll-sentinel');
    if (sentinel) scrollObserver.observe(sentinel);
  }

  initIcons();
}

/**
 * Load more books for infinite scroll
 * Appends new books to the list instead of re-rendering entire list
 */
function loadMore() {
  const filtered = getFilteredBooks();
  const previousLimit = displayLimit;

  // If we have more loaded data to display
  if (displayLimit < filtered.length) {
    displayLimit += BOOKS_PER_PAGE;

    // Get only the new books to append
    const newBooks = filtered.slice(previousLimit, displayLimit);
    const hasMoreToDisplay = filtered.length > displayLimit;

    // Remove the old scroll sentinel
    const oldSentinel = document.getElementById('scroll-sentinel');
    if (oldSentinel) oldSentinel.remove();

    // Append new book cards
    const newCardsHtml = newBooks.map(book => bookCard(book, { showDate: true, genreLookup, seriesLookup })).join('');
    bookList.insertAdjacentHTML('beforeend', newCardsHtml);

    // Add new scroll sentinel if more to load
    if (hasMoreToDisplay) {
      bookList.insertAdjacentHTML(
        'beforeend',
        `
        <div id="scroll-sentinel" class="py-6 flex justify-center">
          <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
        </div>
      `
      );
      const sentinel = document.getElementById('scroll-sentinel');
      if (sentinel) scrollObserver.observe(sentinel);
    }

    initIcons();
  }
}

/**
 * Refresh books from Firebase (used by pull-to-refresh)
 * Clears cache and reloads all data
 * @returns {Promise<void>}
 */
async function refreshBooks() {
  clearCache();
  displayLimit = BOOKS_PER_PAGE;
  // Reload genres, series, and books
  await Promise.all([loadGenres(), loadSeries(), loadBooks(true)]);
  showToast('Books refreshed', { type: 'success' });
}

/**
 * Silent refresh for auto-sync when tab becomes visible
 * Same as refreshBooks but with quieter notification
 * @returns {Promise<void>}
 */
async function silentRefreshBooks() {
  clearCache();
  displayLimit = BOOKS_PER_PAGE;
  await Promise.all([loadGenres(), loadSeries(), loadBooks(true)]);
  showToast('Library synced', { type: 'info' });
}

// ==================== Filter Panel Initialization ====================

/**
 * Initialize FilterPanel instances for desktop sidebar and mobile bottom sheet
 * Sets up both panels with initial filter state from URL params
 */
function initializeFilterPanels() {
  // Get initial filter state from URL params (arrays for multi-select)
  const initialFilters = {
    sort: currentSort,
    rating: ratingFilter,
    genres: genreFilters,
    statuses: statusFilters,
    seriesIds: seriesFilters,
    author: authorFilter,
  };

  // Desktop sidebar panel
  if (filterSidebar) {
    sidebarPanel = new FilterPanel({
      container: filterSidebar,
      genres,
      series,
      authors: getUniqueAuthors(),
      showSort: true,
      initialFilters,
      onChange: handleSidebarFilterChange,
    });

    // Hide skeleton, show actual filters
    if (filterSidebarSkeleton) {
      filterSidebarSkeleton.classList.add('hidden');
    }
    filterSidebar.classList.remove('hidden');
  }

  // Mobile bottom sheet panel (no sort, that's in the header)
  const mobileContainer = document.getElementById('filter-panel-mobile');
  if (mobileContainer) {
    mobilePanel = new FilterPanel({
      container: mobileContainer,
      genres,
      series,
      authors: getUniqueAuthors(),
      showSort: false,
      initialFilters,
      // Update counts live as user interacts, but don't apply filters until Apply button
      onChange: filters => {
        const counts = calculateFilterCounts(filters);
        mobilePanel.setBookCounts(counts);
      },
    });
  }

  // Update filter counts
  updateFilterCounts();

  initIcons();
}

/**
 * Handle filter changes from desktop sidebar (immediate apply)
 * @param {Object} filters - Filter state from FilterPanel
 * @returns {Promise<void>}
 */
async function handleSidebarFilterChange(filters) {
  const sortChanged = filters.sort !== currentSort;
  const wasSeriesFiltered = seriesFilters.length > 0;
  const hasSingleSeries = filters.seriesIds.length === 1;

  // Update global filter state (arrays for multi-select)
  currentSort = filters.sort;
  ratingFilter = filters.rating;
  genreFilters = [...filters.genres];
  statusFilters = [...filters.statuses];
  seriesFilters = [...filters.seriesIds];
  authorFilter = filters.author || '';
  displayLimit = BOOKS_PER_PAGE;

  // Handle series filter change (auto-switch to Series Order only if exactly one series)
  if (hasSingleSeries && !wasSeriesFiltered) {
    updateSeriesOrderOption(true);
    switchToSeriesOrder();
  } else if (!hasSingleSeries && wasSeriesFiltered && seriesFilters.length !== 1) {
    restorePreviousSort();
    updateSeriesOrderOption(false);
  }

  // If sort changed significantly, refetch from Firebase
  if (sortChanged && currentSort !== 'seriesPosition-asc') {
    clearCache();
    await loadBooks(true);
  } else {
    invalidateFilteredCache();
    renderBooks();
  }

  // Scroll to top so user sees filtered results
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Sync mobile sort dropdown
  if (sortSelectMobile) {
    sortSelectMobile.value = currentSort;
  }

  updateFilterCountBadge();
  renderActiveFilterChips();
  updateFilterCounts();
  updateUrlWithFilters();
}

/**
 * Apply filters from mobile bottom sheet
 * @param {boolean} [keepSheetOpen=false] - If true, don't close the sheet (used by Reset)
 * @returns {Promise<void>}
 */
async function applyMobileFilters(keepSheetOpen = false) {
  if (!mobilePanel) return;

  const filters = mobilePanel.getFilters();
  const wasSeriesFiltered = seriesFilters.length > 0;
  const hasSingleSeries = filters.seriesIds.length === 1;

  // Update global filter state (sort comes from mobile header, not panel)
  ratingFilter = filters.rating;
  genreFilters = [...filters.genres];
  statusFilters = [...filters.statuses];
  seriesFilters = [...filters.seriesIds];
  authorFilter = filters.author || '';
  displayLimit = BOOKS_PER_PAGE;

  // Handle series filter change (auto-switch to Series Order only if exactly one series)
  if (hasSingleSeries && !wasSeriesFiltered) {
    updateSeriesOrderOption(true);
    switchToSeriesOrder();
  } else if (!hasSingleSeries && wasSeriesFiltered && seriesFilters.length !== 1) {
    restorePreviousSort();
    updateSeriesOrderOption(false);
  }

  // Sync to desktop sidebar panel
  if (sidebarPanel) {
    sidebarPanel.setFilters({
      sort: currentSort,
      rating: ratingFilter,
      genres: genreFilters,
      statuses: statusFilters,
      seriesIds: seriesFilters,
      author: authorFilter,
    });
  }

  invalidateFilteredCache();
  renderBooks();
  updateFilterCountBadge();
  renderActiveFilterChips();
  updateFilterCounts();
  updateUrlWithFilters();

  // Scroll to top so user sees filtered results
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (!keepSheetOpen) {
    closeFilterSheet();
  }
}

// Mobile sort select handler
if (sortSelectMobile) {
  sortSelectMobile.addEventListener('change', async () => {
    const newSort = sortSelectMobile.value;

    if (newSort !== currentSort) {
      currentSort = newSort;
      displayLimit = BOOKS_PER_PAGE;

      // Sync to desktop sidebar panel
      if (sidebarPanel) {
        sidebarPanel.setFilters({ sort: newSort });
      }

      // Refetch if sort changed (except seriesPosition which is client-side)
      if (newSort !== 'seriesPosition-asc') {
        clearCache();
        await loadBooks(true);
      } else {
        invalidateFilteredCache();
        renderBooks();
      }

      // Scroll to top so user sees sorted results
      window.scrollTo({ top: 0, behavior: 'smooth' });

      updateFilterCountBadge();
      updateUrlWithFilters();
    }
  });
}

/**
 * Check if any filters are active (excluding sort)
 * @returns {boolean} True if any filter is active
 */
function hasActiveFilters() {
  return (
    (ratingFilter !== 0 && ratingFilter !== '') ||
    genreFilters.length > 0 ||
    statusFilters.length > 0 ||
    seriesFilters.length > 0 ||
    authorFilter !== ''
  );
}

/**
 * Update filter count badge on mobile trigger button
 * Shows total number of active filter selections with pulse animation on change
 */
function updateFilterCountBadge() {
  if (!filterCountBadge) return;

  // Count individual selections (not filter types)
  const count =
    (ratingFilter !== 0 ? 1 : 0) +
    genreFilters.length +
    statusFilters.length +
    seriesFilters.length +
    (authorFilter !== '' ? 1 : 0);

  const countChanged = lastFilterCount !== null && lastFilterCount !== count;

  filterCountBadge.textContent = count.toString();
  filterCountBadge.classList.toggle('hidden', count === 0);

  // Pulse animation when count changes (not on initial load)
  if (countChanged && count > 0) {
    filterCountBadge.classList.remove('badge-pulse');
    void filterCountBadge.offsetWidth; // Force reflow to restart animation
    filterCountBadge.classList.add('badge-pulse');
  }

  lastFilterCount = count;
}

/**
 * Render active filter chips (both mobile and desktop)
 * Supports multiple chips per filter type for multi-select
 */
function renderActiveFilterChips() {
  const chips = [];

  // Rating (single-select)
  if (ratingFilter === 'unrated') {
    chips.push({ type: 'rating', value: 'unrated', label: 'Unrated' });
  } else if (ratingFilter > 0) {
    chips.push({ type: 'rating', value: ratingFilter, label: `${ratingFilter}+ Stars` });
  }

  // Genres (multi-select)
  for (const genreId of genreFilters) {
    const genre = genreLookup?.get(genreId);
    if (genre) {
      chips.push({ type: 'genre', value: genreId, label: genre.name });
    }
  }

  // Statuses (multi-select)
  const statusLabels = { reading: 'Reading', finished: 'Finished' };
  for (const status of statusFilters) {
    chips.push({ type: 'status', value: status, label: statusLabels[status] || status });
  }

  // Series (multi-select)
  for (const seriesId of seriesFilters) {
    const s = seriesLookup?.get(seriesId);
    if (s) {
      chips.push({ type: 'series', value: seriesId, label: s.name });
    }
  }

  // Author (single from URL)
  if (authorFilter) {
    chips.push({ type: 'author', value: authorFilter, label: authorFilter });
  }

  // Render to both containers
  [activeFiltersMobile, activeFiltersDesktop].forEach(container => {
    if (!container) return;
    const chipsContainer = container.querySelector('div');
    if (!chipsContainer) return;

    if (chips.length === 0) {
      container.classList.add('hidden');
      chipsContainer.innerHTML = '';
      return;
    }

    container.classList.remove('hidden');

    // Colour classes by filter type
    const chipColours = {
      rating: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
      genre: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
      status: 'bg-green-100 text-green-800 hover:bg-green-200',
      series: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      author: 'bg-rose-100 text-rose-800 hover:bg-rose-200',
    };

    // Render chips with value attribute for targeted removal
    let html = chips
      .map((chip, index) => {
        const colours = chipColours[chip.type] || 'bg-gray-100 text-gray-800 hover:bg-gray-200';
        const delay = index * 50; // Stagger animation delay
        return `
        <button data-filter-type="${escapeAttr(chip.type)}" data-filter-value="${escapeAttr(chip.value)}" class="chip-enter inline-flex items-center gap-1 px-3 py-2 min-h-[44px] ${colours} rounded-full text-sm font-medium transition-colors" style="animation-delay: ${delay}ms" aria-label="Remove ${escapeAttr(chip.label)} filter">
          <span>${escapeHtml(chip.label)}</span>
          <i data-lucide="x" class="w-3.5 h-3.5" aria-hidden="true"></i>
        </button>
      `;
      })
      .join('');

    // Add "Clear all" if more than one filter
    if (chips.length > 1) {
      html += `
        <button data-filter-type="all" class="inline-flex items-center gap-1 px-3 py-2 min-h-[44px] text-gray-500 hover:text-gray-700 text-sm transition-colors">
          Clear all
        </button>
      `;
    }

    chipsContainer.innerHTML = html;
    initIcons();
  });
}

/**
 * Clear a single filter value or all values of a filter type
 * @param {string} filterType - Filter type ('rating', 'genre', 'status', 'series', 'author', 'all')
 * @param {string} [filterValue=null] - Specific value to clear, or null to clear all of type
 * @returns {Promise<void>}
 */
async function clearFilter(filterType, filterValue = null) {
  switch (filterType) {
    case 'rating':
      ratingFilter = 0;
      break;
    case 'genre':
      if (filterValue) {
        // Remove specific genre from array
        genreFilters = genreFilters.filter(id => id !== filterValue);
      } else {
        genreFilters = [];
      }
      break;
    case 'status':
      if (filterValue) {
        // Remove specific status from array
        statusFilters = statusFilters.filter(s => s !== filterValue);
      } else {
        statusFilters = [];
      }
      break;
    case 'series':
      if (filterValue) {
        // Remove specific series from array
        seriesFilters = seriesFilters.filter(id => id !== filterValue);
      } else {
        seriesFilters = [];
      }
      // Update series sort if no longer filtering by exactly one series
      if (seriesFilters.length !== 1) {
        restorePreviousSort();
        updateSeriesOrderOption(false);
      }
      break;
    case 'author':
      authorFilter = '';
      break;
    case 'all':
      await resetAllFilters();
      return; // resetAllFilters handles everything
  }

  // Update filter panels
  if (sidebarPanel) {
    sidebarPanel.setFilters({
      rating: ratingFilter,
      genres: genreFilters,
      statuses: statusFilters,
      seriesIds: seriesFilters,
      author: authorFilter,
    });
  }
  if (mobilePanel) {
    mobilePanel.setFilters({
      rating: ratingFilter,
      genres: genreFilters,
      statuses: statusFilters,
      seriesIds: seriesFilters,
      author: authorFilter,
    });
  }

  invalidateFilteredCache();
  updateFilterCountBadge();
  renderActiveFilterChips();
  renderBooks();
  updateFilterCounts();
  updateUrlWithFilters();
}

// Event delegation for filter chip clicks
[activeFiltersMobile, activeFiltersDesktop].forEach(container => {
  if (!container) return;
  container.addEventListener('click', e => {
    const button = e.target.closest('button[data-filter-type]');
    if (button) {
      clearFilter(button.dataset.filterType, button.dataset.filterValue);
    }
  });
});

/**
 * Get human-readable description of active filters
 * Used in no-results messages
 * @returns {string} Description like '"Fiction" and "4+ stars"'
 */
function getActiveFilterDescription() {
  const parts = [];

  // Statuses (multi-select)
  const statusLabels = { reading: 'Reading', finished: 'Finished' };
  for (const status of statusFilters) {
    parts.push(statusLabels[status] || status);
  }

  if (ratingFilter === 'unrated') {
    parts.push('unrated');
  } else if (ratingFilter) {
    parts.push(`${ratingFilter}+ stars`);
  }

  // Genres (multi-select)
  for (const genreId of genreFilters) {
    const genre = genreLookup?.get(genreId);
    if (genre) {
      parts.push(genre.name);
    }
  }

  // Series (multi-select)
  for (const seriesId of seriesFilters) {
    const seriesObj = seriesLookup?.get(seriesId);
    if (seriesObj) {
      parts.push(`${seriesObj.name} series`);
    }
  }

  if (authorFilter) {
    parts.push(`by ${authorFilter}`);
  }

  if (parts.length === 0) return 'your filters';
  if (parts.length === 1) return `"${parts[0]}"`;
  return parts.map(p => `"${p}"`).join(' and ');
}

/**
 * Reset all filters to default values
 * Clears URL params and refreshes books list
 * @returns {Promise<void>}
 */
async function resetAllFilters() {
  // Check if we need to refetch (ignore seriesPosition-asc as it's client-side only)
  const needsRefetch = currentSort !== 'createdAt-desc' && currentSort !== 'seriesPosition-asc';

  // Clean up Series Order sort option and state
  updateSeriesOrderOption(false);
  previousSort = null;

  currentSort = 'createdAt-desc';
  ratingFilter = 0;
  genreFilters = [];
  statusFilters = [];
  seriesFilters = [];
  authorFilter = '';

  // Reset mobile sort select
  if (sortSelectMobile) sortSelectMobile.value = 'createdAt-desc';

  // Reset filter panels
  if (sidebarPanel) sidebarPanel.reset();
  if (mobilePanel) mobilePanel.reset();

  displayLimit = BOOKS_PER_PAGE;
  invalidateFilteredCache();
  updateFilterCountBadge();
  renderActiveFilterChips();

  // Clear URL params (including series)
  if (window.location.search) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  if (needsRefetch) {
    clearCache();
    await loadBooks(true);
  } else {
    renderBooks();
  }
  updateFilterCounts();
}

// Clear filters link in no-results state
if (clearFiltersLink) {
  clearFiltersLink.addEventListener('click', resetAllFilters);
}

// ==================== Bottom Sheet for Mobile Filters ====================

/**
 * Open the filter bottom sheet (mobile)
 * Syncs mobile panel to current filter state before opening
 */
function openFilterSheet() {
  if (!filterSheet || !filterSheetContent) return;

  // Sync mobile panel to current filter state before opening
  if (mobilePanel) {
    mobilePanel.setFilters({
      rating: ratingFilter,
      genres: genreFilters,
      statuses: statusFilters,
      seriesIds: seriesFilters,
      author: authorFilter,
    });
  }

  // Update counts to ensure they're fresh when sheet opens
  updateFilterCounts();

  filterSheet.classList.remove('hidden');
  lockBodyScroll();

  // Animate in
  requestAnimationFrame(() => {
    filterSheetContent.classList.remove('translate-y-full');
  });

  initIcons();
}

/**
 * Close the filter bottom sheet (mobile)
 * Animates out and unlocks body scroll
 */
function closeFilterSheet() {
  if (!filterSheet || !filterSheetContent) return;

  filterSheetContent.classList.add('translate-y-full');

  setTimeout(() => {
    filterSheet.classList.add('hidden');
    unlockBodyScroll();
  }, 300);
}

// Filter trigger button opens bottom sheet
if (filterTriggerBtn) {
  filterTriggerBtn.addEventListener('click', openFilterSheet);
}

// Apply filters button in bottom sheet
if (applyFiltersMobileBtn) {
  applyFiltersMobileBtn.addEventListener('click', () => applyMobileFilters());
}

// Reset button in mobile bottom sheet - apply but keep sheet open
const mobileFilterPanel = document.getElementById('filter-panel-mobile');
if (mobileFilterPanel) {
  mobileFilterPanel.addEventListener('click', e => {
    if (e.target.closest('.filter-reset')) {
      // Panel already reset via its own handler, now apply to update counts
      applyMobileFilters(true); // keepSheetOpen = true
    }
  });
}

// Close on backdrop click - apply filters before closing
if (filterSheet) {
  filterSheet.addEventListener('click', e => {
    if (e.target === filterSheet) {
      applyMobileFilters();
    }
  });
}

// Swipe to dismiss bottom sheet
let sheetStartY = 0;
let sheetCurrentY = 0;
let isDragging = false;

if (filterSheetContent) {
  const filterPanelMobile = document.getElementById('filter-panel-mobile');

  filterSheetContent.addEventListener(
    'touchstart',
    e => {
      // Get the handle element
      const handle = filterSheetContent.querySelector('.bottom-sheet-handle');
      const isHandle = handle && handle.contains(e.target);
      const isScrolledToTop = !filterPanelMobile || filterPanelMobile.scrollTop === 0;

      // Only start drag from handle or if content is scrolled to top
      if (isHandle || (filterPanelMobile?.contains(e.target) && isScrolledToTop)) {
        isDragging = true;
        sheetStartY = e.touches[0].clientY;
        filterSheetContent.style.transition = 'none';
      }
    },
    { passive: true }
  );

  filterSheetContent.addEventListener(
    'touchmove',
    e => {
      if (!isDragging) return;

      sheetCurrentY = e.touches[0].clientY;
      const deltaY = sheetCurrentY - sheetStartY;

      // Only allow dragging down
      if (deltaY > 0) {
        filterSheetContent.style.transform = `translateY(${deltaY}px)`;
      }
    },
    { passive: true }
  );

  filterSheetContent.addEventListener(
    'touchend',
    () => {
      if (!isDragging) return;

      isDragging = false;
      filterSheetContent.style.transition = '';

      const deltaY = sheetCurrentY - sheetStartY;

      // If dragged more than 100px down, apply filters and close
      if (deltaY > 100) {
        applyMobileFilters();
      } else {
        // Snap back
        filterSheetContent.style.transform = '';
      }

      sheetStartY = 0;
      sheetCurrentY = 0;
    },
    { passive: true }
  );
}

// ==================== Pull to Refresh ====================

const pullIndicator = document.getElementById('pull-indicator');
const pullIcon = document.getElementById('pull-icon');
const pullText = document.getElementById('pull-text');
const mainContent = document.getElementById('main-content');

// Pull-to-refresh state
let pullStartY = 0;
let pullCurrentY = 0;
let isPulling = false;
const pullThreshold = 80; // Pixels to pull before triggering refresh
let touchListenersAttached = false;

// Only enable on touch devices (with guard to prevent duplicates)
if ('ontouchstart' in window && pullIndicator && mainContent && !touchListenersAttached) {
  touchListenersAttached = true;
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
  // Don't start pull if filter sheet is open
  if (filterSheet && !filterSheet.classList.contains('hidden')) return;

  // Only start pull if at top of page
  if (window.scrollY === 0 && !isLoading) {
    pullStartY = e.touches[0].clientY;
    isPulling = true;
  }
}

// Throttled UI update for pull-to-refresh (16ms = 60fps)
const updatePullUI = throttle(pullDistance => {
  // Calculate display height (with resistance)
  const displayHeight = Math.min(pullDistance * 0.5, pullThreshold + 20);

  // Show and size the indicator
  pullIndicator.classList.remove('hidden');
  pullIndicator.style.height = `${displayHeight}px`;

  // Update icon rotation and text based on pull distance
  if (pullDistance >= pullThreshold) {
    pullIcon.style.transform = 'rotate(180deg)';
    pullText.textContent = 'Release to refresh';
    pullIcon.setAttribute('data-lucide', 'arrow-up');
  } else {
    pullIcon.style.transform = 'rotate(0deg)';
    pullText.textContent = 'Pull to refresh';
    pullIcon.setAttribute('data-lucide', 'arrow-down');
  }
  initIcons();
}, 16);

function handleTouchMove(e) {
  if (!isPulling || isLoading) return;

  pullCurrentY = e.touches[0].clientY;
  const pullDistance = pullCurrentY - pullStartY;

  // Only activate when pulling down and at top of page
  if (pullDistance > 0 && window.scrollY === 0) {
    // Prevent default scrolling behavior when pulling
    e.preventDefault();
    // Use throttled UI update
    updatePullUI(pullDistance);
  }
}

async function handleTouchEnd() {
  if (!isPulling) return;

  const pullDistance = pullCurrentY - pullStartY;
  isPulling = false;

  if (pullDistance >= pullThreshold && window.scrollY === 0 && !isLoading) {
    // Show loading state
    pullText.textContent = 'Refreshing...';
    pullIcon.setAttribute('data-lucide', 'loader-2');
    pullIcon.classList.add('animate-spin');
    initIcons();

    // Trigger refresh
    await refreshBooks();

    // Reset icon
    pullIcon.classList.remove('animate-spin');
  }

  // Hide the indicator
  pullIndicator.style.height = '0px';
  setTimeout(() => {
    pullIndicator.classList.add('hidden');
    pullIndicator.style.height = '';
    pullText.textContent = 'Pull to refresh';
    pullIcon.setAttribute('data-lucide', 'arrow-down');
    pullIcon.style.transform = '';
    initIcons();
  }, 200);

  pullStartY = 0;
  pullCurrentY = 0;
}
