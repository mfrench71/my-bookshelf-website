// Books List Page Logic
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDocsFromServer
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast, initIcons, CACHE_KEY, CACHE_TTL, serializeTimestamp, clearBooksCache, throttle, getBookStatus } from '../utils.js';
import { bookCard } from '../components/book-card.js';
import { loadUserGenres, createGenreLookup } from '../genres.js';
import { loadUserSeries, createSeriesLookup } from '../series.js';
import { normalizeSeriesName } from '../utils/series-parser.js';

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
let genres = []; // All user genres
let genreLookup = null; // Map of genreId -> genre object
let genreFilter = ''; // Currently selected genre ID for filtering
let statusFilter = ''; // Currently selected status for filtering
let seriesFilter = ''; // Currently selected series ID for filtering
let authorFilter = ''; // Currently selected author for filtering (URL param only)
let series = []; // All user series
let seriesLookup = null; // Map of seriesId -> series object

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const noResultsState = document.getElementById('no-results-state');
const noResultsTitle = document.getElementById('no-results-title');
const clearFiltersLink = document.getElementById('clear-filters-link');
const bookList = document.getElementById('book-list');
const sortSelect = document.getElementById('sort-select');
const ratingFilterSelect = document.getElementById('rating-filter');
const genreFilterSelect = document.getElementById('genre-filter');
const statusFilterSelect = document.getElementById('status-filter');
const seriesFilterSelect = document.getElementById('series-filter');
const resetFiltersBtn = document.getElementById('reset-filters');
const authorFilterBadge = document.getElementById('author-filter-badge');
const authorFilterName = document.getElementById('author-filter-name');
const clearAuthorFilterBtn = document.getElementById('clear-author-filter');

// Parse URL parameters and apply filters
function applyUrlFilters() {
  const params = new URLSearchParams(window.location.search);

  // Status filter
  const status = params.get('status');
  if (status && statusFilterSelect) {
    statusFilter = status;
    statusFilterSelect.value = status;
  }

  // Rating filter
  const rating = params.get('rating');
  if (rating && ratingFilterSelect) {
    ratingFilter = parseInt(rating, 10) || 0;
    ratingFilterSelect.value = ratingFilter;
  }

  // Sort order
  const sort = params.get('sort');
  if (sort && sortSelect) {
    currentSort = sort;
    sortSelect.value = sort;
  }

  // Series filter (URL param only, no dropdown)
  const series = params.get('series');
  if (series) {
    seriesFilter = series;
  }

  // Author filter (URL param only, no dropdown)
  const author = params.get('author');
  if (author) {
    authorFilter = author;
  }

  // Update filter highlights for URL params
  updateFilterHighlights();
}

// Apply URL filters on page load
applyUrlFilters();

// Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Load genres, series, and books in parallel for faster initial load
    await Promise.all([loadGenres(), loadSeries(), loadBooks()]);

    // If series filter was set via URL param, set up Series Order sort
    if (seriesFilter) {
      updateSeriesOrderOption(true);
      switchToSeriesOrder();
      updateResetButton(); // Show reset button
      renderBooks(); // Re-render with new sort
    }

    // If author filter was set via URL param, show reset button and re-render
    // (re-render needed because loadBooks may have rendered before seriesLookup was ready)
    if (authorFilter) {
      updateResetButton();
      renderBooks();
    }
  }
});

// Load user genres
async function loadGenres() {
  try {
    genres = await loadUserGenres(currentUser.uid);
    genreLookup = createGenreLookup(genres);
    populateGenreFilter();
  } catch (error) {
    console.error('Error loading genres:', error);
    genres = [];
    genreLookup = new Map();
  }
}

// Load user series
async function loadSeries() {
  try {
    series = await loadUserSeries(currentUser.uid);
    seriesLookup = createSeriesLookup(series);
    populateSeriesFilter();
  } catch (error) {
    console.error('Error loading series:', error);
    series = [];
    seriesLookup = new Map();
  }
}

// Populate series filter dropdown
function populateSeriesFilter() {
  if (!seriesFilterSelect) return;

  // Keep the "All Series" option
  seriesFilterSelect.innerHTML = '<option value="">All Series</option>';

  // Sort series by name for the dropdown
  const sortedSeries = [...series].sort((a, b) => a.name.localeCompare(b.name));

  // Add options for each series
  sortedSeries.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = s.name;
    if (s.id === seriesFilter) {
      option.selected = true;
    }
    seriesFilterSelect.appendChild(option);
  });

  // Handle URL param with series name (from widget links)
  // If seriesFilter is set but not a valid series ID, try to match by name
  if (seriesFilter && !seriesLookup.has(seriesFilter)) {
    const matchedSeries = series.find(s =>
      s.name.toLowerCase() === seriesFilter.toLowerCase() ||
      s.normalizedName === seriesFilter.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    if (matchedSeries) {
      seriesFilter = matchedSeries.id;
      seriesFilterSelect.value = matchedSeries.id;
    }
  }
}

// Populate genre filter dropdown
function populateGenreFilter() {
  if (!genreFilterSelect) return;

  // Keep the "All Genres" option
  genreFilterSelect.innerHTML = '<option value="">All Genres</option>';

  // Add options for each genre
  genres.forEach(genre => {
    const option = document.createElement('option');
    option.value = genre.id;
    option.textContent = genre.name;
    if (genre.id === genreFilter) {
      option.selected = true;
    }
    genreFilterSelect.appendChild(option);
  });
}

// Cache functions
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

function setCachedBooks(booksData, hasMore) {
  try {
    const cacheData = {
      books: booksData,
      timestamp: Date.now(),
      sort: currentSort,
      hasMore: hasMore
    };
    localStorage.setItem(`${CACHE_KEY}_${currentUser.uid}`, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

function clearCache() {
  clearBooksCache(currentUser.uid);
  cachedFilteredBooks = null; // Also clear filtered cache
}

// Convert Firestore document to serializable format
function serializeBook(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: serializeTimestamp(data.createdAt),
    updatedAt: serializeTimestamp(data.updatedAt)
  };
}

// Load Books - tries cache first, then Firebase
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
    renderBooks();
    return;
  }

  // If offline, use any cached data we have
  if (!navigator.onLine) {
    if (hasCachedBooks) {
      books = cached.books;
      lastDoc = null;
      hasMoreFromFirebase = false;
      loadingState.classList.add('hidden');
      renderBooks();
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
    renderBooks();
  } catch (error) {
    console.error('Error loading books:', error);
    loadingState.classList.add('hidden');

    // If Firebase fails and we have cached data, use it
    if (hasCachedBooks) {
      books = cached.books;
      lastDoc = null;
      hasMoreFromFirebase = false;
      renderBooks();
      showToast('Using cached books (connection error)', { type: 'info' });
    } else {
      showToast('Error loading books: ' + error.message, { type: 'error' });
    }
  } finally {
    isLoading = false;
  }
}

// Fetch next page from Firebase
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

    // Use getDocsFromServer on manual refresh to bypass Firestore cache (first page only)
    const useServerFetch = forceServerFetch && !lastDoc; // Only force server on first page
    const snapshot = useServerFetch ? await getDocsFromServer(q) : await getDocs(q);
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

function setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading) {
      loadMore();
    }
  }, { rootMargin: '100px' });
}

setupScrollObserver();

// Extract surname (last word) for author sorting
function getAuthorSurname(author) {
  if (!author) return '';
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

// Sorting function (client-side for cached data)
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

// Manage Series Order sort option visibility
function updateSeriesOrderOption(showOption) {
  if (!sortSelect) return;

  const existingOption = sortSelect.querySelector('option[value="seriesPosition-asc"]');

  if (showOption && !existingOption) {
    // Add Series Order option at the top
    const option = document.createElement('option');
    option.value = 'seriesPosition-asc';
    option.textContent = 'Series Order';
    sortSelect.insertBefore(option, sortSelect.firstChild);
  } else if (!showOption && existingOption) {
    // Remove Series Order option
    existingOption.remove();
  }
}

// Switch to series order sort (stores previous sort for restoration)
function switchToSeriesOrder() {
  if (currentSort !== 'seriesPosition-asc') {
    previousSort = currentSort;
    currentSort = 'seriesPosition-asc';
    sortSelect.value = 'seriesPosition-asc';
    invalidateFilteredCache();
  }
}

// Restore previous sort (when series filter is cleared)
function restorePreviousSort() {
  if (previousSort && currentSort === 'seriesPosition-asc') {
    currentSort = previousSort;
    sortSelect.value = previousSort;
    previousSort = null;
    invalidateFilteredCache();
  }
}

// Rating filter function
function filterByRating(booksArray, minRating) {
  if (minRating === 0) return booksArray;
  return booksArray.filter(b => (b.rating || 0) >= minRating);
}

// Genre filter function
function filterByGenre(booksArray, genreId) {
  if (!genreId) return booksArray;
  return booksArray.filter(b => b.genres && b.genres.includes(genreId));
}

// Status filter function (uses inferred status from reads array)
function filterByStatus(booksArray, status) {
  if (!status) return booksArray;
  return booksArray.filter(b => getBookStatus(b) === status);
}

// Series filter function (matches by series ID)
function filterBySeries(booksArray, seriesId) {
  if (!seriesId) return booksArray;
  return booksArray.filter(b => b.seriesId === seriesId);
}

// Author filter function (case-insensitive match)
function filterByAuthor(booksArray, author) {
  if (!author) return booksArray;
  const authorLower = author.toLowerCase();
  return booksArray.filter(b => b.author?.toLowerCase() === authorLower);
}

// Get filtered and sorted books (with caching)
function getFilteredBooks() {
  if (cachedFilteredBooks) return cachedFilteredBooks;
  let filtered = filterByRating(books, ratingFilter);
  filtered = filterByGenre(filtered, genreFilter);
  filtered = filterByStatus(filtered, statusFilter);
  filtered = filterBySeries(filtered, seriesFilter);
  filtered = filterByAuthor(filtered, authorFilter);
  cachedFilteredBooks = sortBooks(filtered, currentSort);
  return cachedFilteredBooks;
}

// Invalidate filtered cache when filters change
function invalidateFilteredCache() {
  cachedFilteredBooks = null;
}

// Render Books
function renderBooks() {
  const filtered = getFilteredBooks();

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

// Load more - display more of the already loaded books
function loadMore() {
  const filtered = getFilteredBooks();

  // If we have more loaded data to display
  if (displayLimit < filtered.length) {
    displayLimit += BOOKS_PER_PAGE;
    renderBooks();
  }
}

// Refresh - clear cache and reload from Firebase (used by pull-to-refresh)
async function refreshBooks() {
  clearCache();
  displayLimit = BOOKS_PER_PAGE;
  // Reload genres, series, and books
  await Promise.all([
    loadGenres(),
    loadSeries(),
    loadBooks(true)
  ]);
  showToast('Books refreshed');
}

// Sort & Filter Controls
sortSelect.addEventListener('change', async () => {
  const newSort = sortSelect.value;

  // If sort changed, need to refetch from Firebase with new order
  if (newSort !== currentSort) {
    currentSort = newSort;
    displayLimit = BOOKS_PER_PAGE;
    clearCache();
    await loadBooks(true);
  }

  updateResetButton();
});

ratingFilterSelect.addEventListener('change', () => {
  ratingFilter = parseInt(ratingFilterSelect.value) || 0;
  displayLimit = BOOKS_PER_PAGE;
  invalidateFilteredCache(); // Re-filter with new rating
  updateResetButton();
  renderBooks();
});

// Genre filter
if (genreFilterSelect) {
  genreFilterSelect.addEventListener('change', () => {
    genreFilter = genreFilterSelect.value;
    displayLimit = BOOKS_PER_PAGE;
    invalidateFilteredCache(); // Re-filter with new genre
    updateResetButton();
    renderBooks();
  });
}

// Status filter
if (statusFilterSelect) {
  statusFilterSelect.addEventListener('change', () => {
    statusFilter = statusFilterSelect.value;
    displayLimit = BOOKS_PER_PAGE;
    invalidateFilteredCache(); // Re-filter with new status
    updateResetButton();
    renderBooks();
  });
}

// Series filter
if (seriesFilterSelect) {
  seriesFilterSelect.addEventListener('change', () => {
    const newSeriesFilter = seriesFilterSelect.value;
    const wasFiltered = seriesFilter !== '';
    const isFiltered = newSeriesFilter !== '';

    seriesFilter = newSeriesFilter;
    displayLimit = BOOKS_PER_PAGE;

    // Manage Series Order sort option and auto-switch
    if (isFiltered && !wasFiltered) {
      // Switching to series filter: show option and auto-select
      updateSeriesOrderOption(true);
      switchToSeriesOrder();
    } else if (!isFiltered && wasFiltered) {
      // Clearing series filter: restore previous sort and hide option
      restorePreviousSort();
      updateSeriesOrderOption(false);
    }

    invalidateFilteredCache();
    updateResetButton();
    renderBooks();
  });
}

// Check if any filters are active
function hasActiveFilters() {
  return ratingFilter !== 0 || genreFilter !== '' || statusFilter !== '' || seriesFilter !== '' || authorFilter !== '';
}

// Show/hide reset button and update filter highlights
function updateResetButton() {
  const isDefault = currentSort === 'createdAt-desc' && !hasActiveFilters();
  resetFiltersBtn.classList.toggle('hidden', isDefault);
  updateFilterHighlights();
}

// Highlight active filter dropdowns
function updateFilterHighlights() {
  // Rating filter
  if (ratingFilterSelect) {
    const isActive = ratingFilter !== 0;
    ratingFilterSelect.classList.toggle('border-primary', isActive);
    ratingFilterSelect.classList.toggle('border-gray-200', !isActive);
  }
  // Genre filter
  if (genreFilterSelect) {
    const isActive = genreFilter !== '';
    genreFilterSelect.classList.toggle('border-primary', isActive);
    genreFilterSelect.classList.toggle('border-gray-200', !isActive);
  }
  // Status filter
  if (statusFilterSelect) {
    const isActive = statusFilter !== '';
    statusFilterSelect.classList.toggle('border-primary', isActive);
    statusFilterSelect.classList.toggle('border-gray-200', !isActive);
  }
  // Series filter
  if (seriesFilterSelect) {
    const isActive = seriesFilter !== '';
    seriesFilterSelect.classList.toggle('border-primary', isActive);
    seriesFilterSelect.classList.toggle('border-gray-200', !isActive);
  }
  // Author filter badge
  updateAuthorFilterBadge();
}

// Update author filter badge visibility
function updateAuthorFilterBadge() {
  if (!authorFilterBadge || !authorFilterName) return;

  if (authorFilter) {
    authorFilterName.textContent = authorFilter;
    authorFilterBadge.classList.remove('hidden');
    initIcons();
  } else {
    authorFilterBadge.classList.add('hidden');
  }
}

// Clear author filter handler
if (clearAuthorFilterBtn) {
  clearAuthorFilterBtn.addEventListener('click', () => {
    authorFilter = '';
    invalidateFilteredCache();
    updateResetButton();
    // Clear URL param
    const url = new URL(window.location);
    url.searchParams.delete('author');
    window.history.replaceState({}, '', url);
    renderBooks();
  });
}

// Get a human-readable description of active filters
function getActiveFilterDescription() {
  const parts = [];

  if (statusFilter) {
    const statusLabels = {
      'reading': 'Reading',
      'finished': 'Finished'
    };
    parts.push(statusLabels[statusFilter] || statusFilter);
  }

  if (ratingFilter) {
    parts.push(`${ratingFilter}+ stars`);
  }

  if (genreFilter && genreLookup) {
    const genre = genreLookup.get(genreFilter);
    if (genre) {
      parts.push(genre.name);
    }
  }

  if (seriesFilter && seriesLookup) {
    const seriesObj = seriesLookup.get(seriesFilter);
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

// Helper to reset all filters
async function resetAllFilters() {
  // Check if we need to refetch (ignore seriesPosition-asc as it's client-side only)
  const needsRefetch = currentSort !== 'createdAt-desc' && currentSort !== 'seriesPosition-asc';

  // Clean up Series Order sort option and state
  updateSeriesOrderOption(false);
  previousSort = null;

  currentSort = 'createdAt-desc';
  ratingFilter = 0;
  genreFilter = '';
  statusFilter = '';
  seriesFilter = '';
  authorFilter = '';
  sortSelect.value = 'createdAt-desc';
  ratingFilterSelect.value = '0';
  if (genreFilterSelect) genreFilterSelect.value = '';
  if (statusFilterSelect) statusFilterSelect.value = '';
  if (seriesFilterSelect) seriesFilterSelect.value = '';
  displayLimit = BOOKS_PER_PAGE;
  invalidateFilteredCache(); // Re-filter with reset values
  updateResetButton();

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
}

resetFiltersBtn.addEventListener('click', resetAllFilters);

// Clear filters link in no-results state
if (clearFiltersLink) {
  clearFiltersLink.addEventListener('click', resetAllFilters);
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
let pullThreshold = 80; // Pixels to pull before triggering refresh

// Only enable on touch devices
if ('ontouchstart' in window && pullIndicator && mainContent) {
  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
  // Only start pull if at top of page
  if (window.scrollY === 0 && !isLoading) {
    pullStartY = e.touches[0].clientY;
    isPulling = true;
  }
}

// Throttled UI update for pull-to-refresh (16ms = 60fps)
const updatePullUI = throttle((pullDistance) => {
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
