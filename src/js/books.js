// Books List Page Logic
import { auth, db } from './firebase-config.js';
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
import { showToast, initIcons, CACHE_KEY, CACHE_TTL, serializeTimestamp, clearBooksCache } from './utils.js';
import { bookCard } from './book-card.js';
import { loadUserGenres, createGenreLookup } from './genres.js';

// Initialize icons once on load
initIcons();

// Constants
const BOOKS_PER_PAGE = 20;

// State
let currentUser = null;
let books = [];
let currentSort = 'createdAt-desc';
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

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const bookList = document.getElementById('book-list');
const sortSelect = document.getElementById('sort-select');
const ratingFilterSelect = document.getElementById('rating-filter');
const genreFilterSelect = document.getElementById('genre-filter');
const resetFiltersBtn = document.getElementById('reset-filters');
const refreshBtn = document.getElementById('refresh-btn');

// Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Load genres first (needed for genre indicators), then books
    await loadGenres();
    await loadBooks();
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

    // Use getDocsFromServer on manual refresh to bypass Firestore cache
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

function setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !isLoading) {
      loadMore();
    }
  }, { rootMargin: '100px' });
}

setupScrollObserver();

// Sorting function (client-side for cached data)
function sortBooks(booksArray, sortKey) {
  const [field, direction] = sortKey.split('-');
  return [...booksArray].sort((a, b) => {
    let aVal, bVal;
    switch (field) {
      case 'title':
        aVal = (a.title || '').toLowerCase();
        bVal = (b.title || '').toLowerCase();
        break;
      case 'author':
        aVal = (a.author || '').toLowerCase();
        bVal = (b.author || '').toLowerCase();
        break;
      case 'rating':
        aVal = a.rating || 0;
        bVal = b.rating || 0;
        break;
      default: // createdAt
        aVal = a.createdAt || 0;
        bVal = b.createdAt || 0;
    }
    return direction === 'asc'
      ? (aVal < bVal ? -1 : aVal > bVal ? 1 : 0)
      : (aVal > bVal ? -1 : aVal < bVal ? 1 : 0);
  });
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

// Get filtered and sorted books (with caching)
function getFilteredBooks() {
  if (cachedFilteredBooks) return cachedFilteredBooks;
  let filtered = filterByRating(books, ratingFilter);
  filtered = filterByGenre(filtered, genreFilter);
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
    emptyState.classList.remove('hidden');
    bookList.innerHTML = '';
    initIcons();
    return;
  }

  emptyState.classList.add('hidden');
  const visible = filtered.slice(0, displayLimit);
  const hasMoreToDisplay = filtered.length > displayLimit;

  bookList.innerHTML = visible.map(book => bookCard(book, { showDate: true, genreLookup })).join('');

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

// Refresh - clear cache and reload from Firebase
async function refreshBooks() {
  refreshBtn.classList.add('animate-spin');

  try {
    clearCache();
    displayLimit = BOOKS_PER_PAGE;
    // Reload both genres and books
    await Promise.all([
      loadGenres(),
      loadBooks(true)
    ]);
    showToast('Books refreshed');
  } finally {
    refreshBtn.classList.remove('animate-spin');
  }
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

// Refresh button
refreshBtn.addEventListener('click', refreshBooks);

// Show/hide reset button based on filter state
function updateResetButton() {
  const isDefault = currentSort === 'createdAt-desc' && ratingFilter === 0 && genreFilter === '';
  resetFiltersBtn.classList.toggle('hidden', isDefault);
}

// Reset filters to defaults
resetFiltersBtn.addEventListener('click', async () => {
  const needsRefetch = currentSort !== 'createdAt-desc';

  currentSort = 'createdAt-desc';
  ratingFilter = 0;
  genreFilter = '';
  sortSelect.value = 'createdAt-desc';
  ratingFilterSelect.value = '0';
  if (genreFilterSelect) genreFilterSelect.value = '';
  displayLimit = BOOKS_PER_PAGE;
  invalidateFilteredCache(); // Re-filter with reset values
  updateResetButton();

  if (needsRefetch) {
    clearCache();
    await loadBooks(true);
  } else {
    renderBooks();
  }
});

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

function handleTouchMove(e) {
  if (!isPulling || isLoading) return;

  pullCurrentY = e.touches[0].clientY;
  const pullDistance = pullCurrentY - pullStartY;

  // Only activate when pulling down and at top of page
  if (pullDistance > 0 && window.scrollY === 0) {
    // Prevent default scrolling behavior when pulling
    e.preventDefault();

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
