// Common Header Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeText, showToast, debounce, initIcons } from './utils.js';
import { bookCard } from './book-card.js';

// Initialize icons once on load
initIcons();

// Constants
const CACHE_VERSION = 7; // Must match books.js version
const CACHE_KEY = `mybookshelf_books_cache_v${CACHE_VERSION}`;

// State
let currentUser = null;
let books = [];
let allBooksLoaded = false;
let isLoadingBooks = false;

// DOM Elements
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const menuPanel = document.getElementById('menu-panel');
const closeMenuBtn = document.getElementById('close-menu');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const searchBtn = document.getElementById('search-btn');
const searchOverlay = document.getElementById('search-overlay');
const closeSearchBtn = document.getElementById('close-search');
const searchInput = document.getElementById('search-input');
const clearSearchInputBtn = document.getElementById('clear-search-input');
const searchResults = document.getElementById('search-results');
const exportBtn = document.getElementById('export-btn');

// Auth State
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    if (userEmail) userEmail.textContent = user.email;
    // Don't load all books upfront - load when search opens
  } else {
    window.location.href = '/';
  }
});

// Load all books for search - called when search opens
async function loadAllBooksForSearch() {
  if (allBooksLoaded || isLoadingBooks) return;

  isLoadingBooks = true;

  // Try cache first (check if it has all books via hasMore flag)
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const cachedBooks = parsed.books || parsed || [];
      const hasMore = parsed.hasMore ?? true;

      if (cachedBooks.length > 0) {
        books = cachedBooks;
        if (!hasMore) {
          // Cache has all books
          allBooksLoaded = true;
          isLoadingBooks = false;
          return;
        }
      }
    }
  } catch (e) {
    // Ignore cache errors
  }

  // Fetch all from Firebase
  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const q = query(booksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    books = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis?.() || data.createdAt?.seconds * 1000 || null,
        updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt?.seconds * 1000 || null
      };
    });
    allBooksLoaded = true;
  } catch (error) {
    console.error('Error loading books for search:', error);
  } finally {
    isLoadingBooks = false;
  }
}

// Menu
if (menuBtn && menuOverlay && menuPanel && closeMenuBtn) {
  menuBtn.addEventListener('click', openMenu);
  closeMenuBtn.addEventListener('click', closeMenu);
  menuOverlay.addEventListener('click', (e) => {
    if (e.target === menuOverlay) closeMenu();
  });
}

function openMenu() {
  menuOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent body scroll
  setTimeout(() => menuPanel.classList.remove('translate-x-full'), 10);
  initIcons();
}

function closeMenu() {
  menuPanel.classList.add('translate-x-full');
  document.body.style.overflow = ''; // Restore body scroll
  setTimeout(() => menuOverlay.classList.add('hidden'), 200);
}

// Logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
  });
}

// Search
let currentSearchQuery = '';

function performSearch(queryText) {
  currentSearchQuery = queryText;

  if (!queryText) {
    if (isLoadingBooks) {
      searchResults.innerHTML = '<p class="text-gray-500 text-center py-4"><span class="inline-block animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></span>Loading books...</p>';
    } else {
      searchResults.innerHTML = '';
    }
    return;
  }

  const results = books.filter(b =>
    normalizeText(b.title).includes(queryText) ||
    normalizeText(b.author).includes(queryText)
  );

  let html = results.length
    ? results.map(book => bookCard(book, { showDate: true })).join('')
    : '<p class="text-gray-500 text-center">No books found</p>';

  // Show loading indicator if still loading more books
  if (isLoadingBooks) {
    html += '<p class="text-gray-400 text-center text-sm py-2"><span class="inline-block animate-spin w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full mr-1"></span>Loading more books...</p>';
  }

  searchResults.innerHTML = html;
  initIcons();
}

if (searchBtn && searchOverlay && closeSearchBtn && searchInput && searchResults) {
  searchBtn.addEventListener('click', openSearch);
  closeSearchBtn.addEventListener('click', closeSearch);

  // Debounced search handler
  const debouncedSearch = debounce((queryText) => performSearch(queryText), 150);

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    // Show/hide clear button
    if (clearSearchInputBtn) {
      clearSearchInputBtn.classList.toggle('hidden', !query);
    }
    debouncedSearch(normalizeText(query));
  });

  // Clear search button
  if (clearSearchInputBtn) {
    clearSearchInputBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchResults.innerHTML = '';
      clearSearchInputBtn.classList.add('hidden');
      searchInput.focus();
    });
  }
}

async function openSearch() {
  searchOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent body scroll
  searchInput.focus();
  initIcons();

  // Start loading books in background if not already loaded
  if (!allBooksLoaded && !isLoadingBooks) {
    // Show initial loading state
    if (books.length === 0) {
      searchResults.innerHTML = '<p class="text-gray-500 text-center py-4"><span class="inline-block animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mr-2"></span>Loading books...</p>';
    }

    await loadAllBooksForSearch();

    // Re-run search with current query after loading completes
    if (currentSearchQuery) {
      performSearch(currentSearchQuery);
    } else {
      searchResults.innerHTML = '';
    }
  }
}

function closeSearch() {
  searchOverlay.classList.add('hidden');
  document.body.style.overflow = ''; // Restore body scroll
  searchInput.value = '';
  searchResults.innerHTML = '';
  currentSearchQuery = '';
  if (clearSearchInputBtn) clearSearchInputBtn.classList.add('hidden');
}

// Export
if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    closeMenu();
    await exportBooks();
  });
}

async function exportBooks() {
  // Load all books if not already loaded
  if (!allBooksLoaded) {
    showToast('Loading books...');
    await loadAllBooksForSearch();
  }

  if (books.length === 0) {
    showToast('No books to export', { type: 'error' });
    return;
  }

  const data = books.map(({ id, ...book }) => book);
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `mybookshelf-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
  showToast('Books exported!');
}
