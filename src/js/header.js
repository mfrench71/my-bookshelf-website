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
    loadBooksForSearch();
  } else {
    window.location.href = '/';
  }
});

// Get cached books (shared with books.js)
function getCachedBooks() {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    // Handle both old format (books array directly) and new format ({ books, hasMore })
    return parsed.books || parsed || null;
  } catch (e) {
    return null;
  }
}

// Load books for search - uses cache first, falls back to Firebase
async function loadBooksForSearch() {
  // Try cache first
  const cached = getCachedBooks();
  if (cached && cached.length > 0) {
    books = cached;
    console.log('Search using cached books:', books.length);
    return;
  }

  // Fallback to Firebase if no cache
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
    console.log('Search fetched from Firebase:', books.length);
  } catch (error) {
    console.error('Error loading books for search:', error);
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
if (searchBtn && searchOverlay && closeSearchBtn && searchInput && searchResults) {
  searchBtn.addEventListener('click', openSearch);
  closeSearchBtn.addEventListener('click', closeSearch);

  // Debounced search handler
  const performSearch = debounce((queryText) => {
    if (!queryText) {
      searchResults.innerHTML = '';
      return;
    }

    const results = books.filter(b =>
      normalizeText(b.title).includes(queryText) ||
      normalizeText(b.author).includes(queryText)
    );

    searchResults.innerHTML = results.length
      ? results.map(book => bookCard(book, { showDate: true })).join('')
      : '<p class="text-gray-500 text-center">No books found</p>';
    initIcons();
  }, 150);

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    // Show/hide clear button
    if (clearSearchInputBtn) {
      clearSearchInputBtn.classList.toggle('hidden', !query);
    }
    performSearch(normalizeText(query));
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

function openSearch() {
  searchOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Prevent body scroll
  searchInput.focus();
  initIcons();
}

function closeSearch() {
  searchOverlay.classList.add('hidden');
  document.body.style.overflow = ''; // Restore body scroll
  searchInput.value = '';
  searchResults.innerHTML = '';
  if (clearSearchInputBtn) clearSearchInputBtn.classList.add('hidden');
}

// Export
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    closeMenu();
    exportBooks();
  });
}

function exportBooks() {
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
