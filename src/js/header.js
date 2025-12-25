// Common Header Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeText, showToast, debounce, initIcons, CACHE_KEY, serializeTimestamp, isMobile, clearBooksCache, isValidImageUrl } from './utils.js';
import { bookCard } from './components/book-card.js';
import { loadUserGenres, createGenreLookup } from './genres.js';
import { loadUserSeries, createSeriesLookup } from './series.js';
import { getGravatarUrl } from './md5.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let books = [];
let allBooksLoaded = false;
let isLoadingBooks = false;
let genres = [];
let genreLookup = null;
let series = [];
let seriesLookup = null;

// DOM Elements
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
const menuPanel = document.getElementById('menu-panel');
const closeMenuBtn = document.getElementById('close-menu');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const menuAvatar = document.getElementById('menu-avatar');
const searchBtn = document.getElementById('search-btn');
const searchOverlay = document.getElementById('search-overlay');
const closeSearchBtn = document.getElementById('close-search');
const searchInput = document.getElementById('search-input');
const clearSearchInputBtn = document.getElementById('clear-search-input');
const searchResults = document.getElementById('search-results');
const offlineBanner = document.getElementById('offline-banner');

// Offline Detection
function updateOnlineStatus() {
  const isOffline = !navigator.onLine;
  if (offlineBanner) {
    offlineBanner.classList.toggle('hidden', !isOffline);
    initIcons();
  }
}

// Initial check
updateOnlineStatus();

// Listen for online/offline events
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (userEmail) userEmail.textContent = user.email;
    // Update menu avatar
    if (menuAvatar) {
      await updateMenuAvatar(user);
    }
    // Don't load all books upfront - load when search opens
  } else {
    window.location.href = '/login/';
  }
});

// Update menu avatar with user photo, Gravatar, or initial
async function updateMenuAvatar(user) {
  const initial = user.email ? user.email.charAt(0).toUpperCase() : '?';

  // Try to load user profile photo from Firestore
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    if (userData.photoUrl && isValidImageUrl(userData.photoUrl)) {
      // Use createElement to prevent XSS
      const img = document.createElement('img');
      img.src = userData.photoUrl;
      img.alt = 'Profile';
      img.className = 'w-full h-full object-cover';
      menuAvatar.innerHTML = '';
      menuAvatar.appendChild(img);
      return;
    }
  } catch (e) {
    console.warn('Failed to load user profile photo:', e.message);
  }

  // Try Gravatar (with localStorage cache to avoid repeated HEAD requests)
  const gravatarUrl = getGravatarUrl(user.email, 80);
  const gravatarCacheKey = `gravatar_exists_${user.uid}`;
  const gravatarCacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  try {
    // Check cache first
    const cached = localStorage.getItem(gravatarCacheKey);
    let gravatarExists = false;

    if (cached) {
      const { exists, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < gravatarCacheTTL) {
        gravatarExists = exists;
      }
    }

    // If not cached or expired, check Gravatar
    if (!cached || Date.now() - JSON.parse(cached).timestamp >= gravatarCacheTTL) {
      const response = await fetch(gravatarUrl, { method: 'HEAD' });
      gravatarExists = response.ok;
      localStorage.setItem(gravatarCacheKey, JSON.stringify({
        exists: gravatarExists,
        timestamp: Date.now()
      }));
    }

    if (gravatarExists) {
      // Use createElement to prevent XSS
      const img = document.createElement('img');
      img.src = gravatarUrl;
      img.alt = 'Profile';
      img.className = 'w-full h-full object-cover';
      menuAvatar.innerHTML = '';
      menuAvatar.appendChild(img);
      return;
    }
  } catch (e) {
    console.warn('Gravatar check failed:', e.message);
  }

  // Fall back to initial
  menuAvatar.textContent = initial;
}

// Load all books for search - called when search opens
async function loadAllBooksForSearch() {
  if (allBooksLoaded || isLoadingBooks) return;

  isLoadingBooks = true;

  // Load genres and series in parallel with books
  const genresPromise = loadUserGenres(currentUser.uid).then(g => {
    genres = g;
    genreLookup = createGenreLookup(genres);
  }).catch(e => {
    console.error('Error loading genres for search:', e);
    genres = [];
    genreLookup = new Map();
  });

  const seriesPromise = loadUserSeries(currentUser.uid).then(s => {
    series = s;
    seriesLookup = createSeriesLookup(series);
  }).catch(e => {
    console.error('Error loading series for search:', e);
    series = [];
    seriesLookup = new Map();
  });

  // Try cache first (check if it has all books via hasMore flag)
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const cachedBooks = parsed.books || parsed || [];
      const hasMore = parsed.hasMore ?? true;

      if (cachedBooks.length > 0) {
        // Add pre-normalized fields if not present (for cached data)
        books = cachedBooks.map(b => ({
          ...b,
          _normalizedTitle: b._normalizedTitle || normalizeText(b.title),
          _normalizedAuthor: b._normalizedAuthor || normalizeText(b.author)
        }));
        if (!hasMore) {
          // Cache has all books
          await Promise.all([genresPromise, seriesPromise]); // Wait for genres and series before returning
          allBooksLoaded = true;
          isLoadingBooks = false;
          return;
        }
      }
    }
  } catch (e) {
    console.warn('Cache read error in search:', e.message);
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
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        // Pre-normalize for faster search
        _normalizedTitle: normalizeText(data.title),
        _normalizedAuthor: normalizeText(data.author)
      };
    });
    await Promise.all([genresPromise, seriesPromise]); // Wait for genres and series
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

// Refresh Library
const refreshLibraryBtn = document.getElementById('refresh-library-btn');
if (refreshLibraryBtn) {
  refreshLibraryBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    // Show loading state
    const icon = refreshLibraryBtn.querySelector('svg');
    if (icon) icon.classList.add('animate-spin');
    refreshLibraryBtn.disabled = true;

    try {
      // Clear the cache
      clearBooksCache(currentUser.uid);

      // Close menu
      closeMenu();

      // Show toast
      showToast('Library refreshed', { type: 'success' });

      // Reload page to fetch fresh data
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing library:', error);
      showToast('Failed to refresh', { type: 'error' });
      if (icon) icon.classList.remove('animate-spin');
      refreshLibraryBtn.disabled = false;
    }
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

  // Use pre-normalized fields for faster search
  const results = books.filter(b =>
    (b._normalizedTitle || '').includes(queryText) ||
    (b._normalizedAuthor || '').includes(queryText)
  );

  let html = results.length
    ? results.map(book => bookCard(book, { showDate: true, genreLookup, seriesLookup })).join('')
    : `<div class="py-8 text-center">
        <i data-lucide="search-x" class="w-12 h-12 text-gray-300 mx-auto"></i>
        <p class="text-gray-500 mt-3">No books found</p>
        <p class="text-gray-400 text-sm mt-1">Try a different search term</p>
      </div>`;

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
  if (!isMobile()) searchInput.focus();
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

