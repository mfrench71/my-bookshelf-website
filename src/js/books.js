// Books List Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast, initIcons } from './utils.js';
import { bookCard } from './book-card.js';

// Initialize icons once on load
initIcons();

// Constants
const BOOKS_PER_PAGE = 20;
const CACHE_KEY = 'mybookshelf_books_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// State
let currentUser = null;
let books = [];
let currentSort = 'createdAt-desc';
let ratingFilter = 0;
let displayLimit = BOOKS_PER_PAGE;
let lastDoc = null;
let hasMoreFromFirebase = true;
let isLoading = false;

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const bookList = document.getElementById('book-list');
const sortSelect = document.getElementById('sort-select');
const ratingFilterSelect = document.getElementById('rating-filter');
const resetFiltersBtn = document.getElementById('reset-filters');
const refreshBtn = document.getElementById('refresh-btn');

// Auth State
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadBooks();
  }
});

// Cache functions
function getCachedBooks() {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (!cached) return null;

    const { books: cachedBooks, timestamp, sort } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    // Return cache if fresh and same sort order
    if (age < CACHE_TTL && sort === currentSort) {
      return cachedBooks;
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }
  return null;
}

function setCachedBooks(booksData) {
  try {
    const cacheData = {
      books: booksData,
      timestamp: Date.now(),
      sort: currentSort
    };
    localStorage.setItem(`${CACHE_KEY}_${currentUser.uid}`, JSON.stringify(cacheData));
  } catch (e) {
    console.warn('Cache write error:', e);
  }
}

function clearCache() {
  try {
    localStorage.removeItem(`${CACHE_KEY}_${currentUser.uid}`);
  } catch (e) {
    console.warn('Cache clear error:', e);
  }
}

// Convert Firestore timestamp to serializable format
function serializeBook(doc) {
  const data = doc.data();
  return {
    id: doc.id,
    ...data,
    createdAt: data.createdAt?.toMillis?.() || data.createdAt?.seconds * 1000 || null,
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt?.seconds * 1000 || null
  };
}

// Load Books - tries cache first, then Firebase
async function loadBooks(forceRefresh = false) {
  if (isLoading) return;

  // Try cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = getCachedBooks();
    if (cached && cached.length > 0) {
      books = cached;
      loadingState.classList.add('hidden');
      renderBooks();
      console.log('Loaded from cache:', cached.length, 'books');
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

    await fetchNextPage();

    loadingState.classList.add('hidden');
    renderBooks();
  } catch (error) {
    console.error('Error loading books:', error);
    loadingState.classList.add('hidden');
    showToast('Error loading books', { type: 'error' });
  } finally {
    isLoading = false;
  }
}

// Fetch next page from Firebase
async function fetchNextPage() {
  if (!hasMoreFromFirebase || isLoading) return;

  isLoading = true;
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

    const snapshot = await getDocs(q);
    const newBooks = snapshot.docs.map(serializeBook);

    books = [...books, ...newBooks];
    lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;
    hasMoreFromFirebase = snapshot.docs.length === BOOKS_PER_PAGE;

    // Update cache with all loaded books
    setCachedBooks(books);

    console.log('Fetched from Firebase:', newBooks.length, 'books. Total:', books.length);
  } catch (error) {
    console.error('Error fetching page:', error);
    throw error;
  } finally {
    isLoading = false;
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

// Render Books
function renderBooks() {
  let filtered = filterByRating(books, ratingFilter);
  filtered = sortBooks(filtered, currentSort);

  if (filtered.length === 0 && !hasMoreFromFirebase) {
    emptyState.classList.remove('hidden');
    bookList.innerHTML = '';
    initIcons();
    return;
  }

  emptyState.classList.add('hidden');
  const visible = filtered.slice(0, displayLimit);
  const hasMoreToDisplay = filtered.length > displayLimit || hasMoreFromFirebase;

  bookList.innerHTML = visible.map(book => bookCard(book, { showDate: true })).join('');

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

// Load more - either from already loaded data or fetch from Firebase
async function loadMore() {
  let filtered = filterByRating(books, ratingFilter);
  filtered = sortBooks(filtered, currentSort);

  // If we have more loaded data to display
  if (displayLimit < filtered.length) {
    displayLimit += BOOKS_PER_PAGE;
    renderBooks();
    return;
  }

  // If we need to fetch more from Firebase
  if (hasMoreFromFirebase && !isLoading) {
    await fetchNextPage();
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
    await loadBooks(true);
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
  updateResetButton();
  renderBooks();
});

// Refresh button
refreshBtn.addEventListener('click', refreshBooks);

// Show/hide reset button based on filter state
function updateResetButton() {
  const isDefault = currentSort === 'createdAt-desc' && ratingFilter === 0;
  resetFiltersBtn.classList.toggle('hidden', isDefault);
}

// Reset filters to defaults
resetFiltersBtn.addEventListener('click', async () => {
  const needsRefetch = currentSort !== 'createdAt-desc';

  currentSort = 'createdAt-desc';
  ratingFilter = 0;
  sortSelect.value = 'createdAt-desc';
  ratingFilterSelect.value = '0';
  displayLimit = BOOKS_PER_PAGE;
  updateResetButton();

  if (needsRefetch) {
    clearCache();
    await loadBooks(true);
  } else {
    renderBooks();
  }
});
