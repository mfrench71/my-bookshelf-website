// Common Header Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { normalizeText, showToast, debounce, initIcons, CACHE_KEY, serializeTimestamp, isMobile, isValidImageUrl, escapeHtml, escapeAttr } from './utils.js';
import { bookCard } from './components/book-card.js';
import { loadUserGenres, createGenreLookup } from './genres.js';
import { loadUserSeries, createSeriesLookup } from './series.js';
import { getGravatarUrl } from './md5.js';
import { getWishlistCount, clearWishlistCache } from './wishlist.js';

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
let onlineListenersAttached = false;

// Recent searches
const RECENT_SEARCHES_KEY = 'mybookshelf_recent_searches';
const MAX_RECENT_SEARCHES = 5;

/**
 * Get recent searches from localStorage
 * @returns {Array<string>} Array of recent search queries
 */
function getRecentSearches() {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save a search to recent searches
 * @param {string} query - Search query to save
 */
function saveRecentSearch(query) {
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
function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Render recent searches section
 * @returns {string} HTML string for recent searches
 */
function renderRecentSearches() {
  const searches = getRecentSearches();
  if (searches.length === 0) return '';

  const searchItems = searches.map(query => `
    <button type="button" class="recent-search-item flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded-lg transition-colors" data-query="${escapeAttr(query)}">
      <i data-lucide="history" class="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true"></i>
      <span class="text-gray-700 truncate">${escapeHtml(query)}</span>
    </button>
  `).join('');

  return `
    <div id="recent-searches-section" class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-medium text-gray-500">Recent searches</h3>
        <button type="button" id="clear-recent-searches" class="text-xs text-gray-400 hover:text-gray-600">Clear</button>
      </div>
      <div class="space-y-1">${searchItems}</div>
    </div>
  `;
}

/**
 * Show recent searches in the search results area
 */
function showRecentSearches() {
  const html = renderRecentSearches();
  if (html) {
    searchResults.innerHTML = html;
    initIcons();
    attachRecentSearchListeners();
  } else {
    // Show empty state prompt
    searchResults.innerHTML = `
      <div class="py-8 text-center">
        <i data-lucide="search" class="w-12 h-12 text-gray-300 mx-auto"></i>
        <p class="text-gray-500 mt-3">Search your library</p>
        <p class="text-gray-400 text-sm mt-1">Find books by title, author, ISBN, series, notes or publisher</p>
      </div>
    `;
    initIcons();
  }
}

/**
 * Attach click listeners to recent search items
 */
function attachRecentSearchListeners() {
  // Click on recent search item
  searchResults.querySelectorAll('.recent-search-item').forEach(item => {
    item.addEventListener('click', () => {
      const query = item.dataset.query;
      searchInput.value = query;
      if (clearSearchInputBtn) clearSearchInputBtn.classList.remove('hidden');
      performSearch(normalizeText(query));
    });
  });

  // Clear recent searches button
  const clearBtn = document.getElementById('clear-recent-searches');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearRecentSearches();
      searchResults.innerHTML = '';
    });
  }
}

// DOM Elements
const menuBtn = document.getElementById('menu-btn');
const menuOverlay = document.getElementById('menu-overlay');
// Mobile bottom sheet elements
const menuPanelMobile = document.getElementById('menu-panel-mobile');
const logoutBtnMobile = document.getElementById('logout-btn-mobile');
const userEmailMobile = document.getElementById('user-email-mobile');
const menuAvatarMobile = document.getElementById('menu-avatar-mobile');
// Desktop slide-out elements
const menuPanelDesktop = document.getElementById('menu-panel-desktop');
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
const searchResultCount = document.getElementById('search-result-count');
const offlineBanner = document.getElementById('offline-banner');
// Wishlist count badges
const wishlistCountMobile = document.getElementById('wishlist-count-mobile');
const wishlistCountDesktop = document.getElementById('wishlist-count-desktop');

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

// Listen for online/offline events (with guard to prevent duplicates)
if (!onlineListenersAttached) {
  onlineListenersAttached = true;
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
}

// Auth State
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Set email in both mobile and desktop menus
    if (userEmail) userEmail.textContent = user.email;
    if (userEmailMobile) userEmailMobile.textContent = user.email;
    // Update menu avatars (both mobile and desktop)
    await updateMenuAvatar(user);
    // Load wishlist count for badge
    await updateWishlistBadge(user.uid);
    // Don't load all books upfront - load when search opens
  } else {
    window.location.href = '/login/';
  }
});

// Update wishlist count badge in menu
async function updateWishlistBadge(userId) {
  try {
    const count = await getWishlistCount(userId);
    const badges = [wishlistCountMobile, wishlistCountDesktop].filter(Boolean);

    badges.forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    });
  } catch (e) {
    console.warn('Failed to load wishlist count:', e.message);
  }
}

// Listen for wishlist updates from other modules
window.addEventListener('wishlist-updated', async () => {
  if (currentUser) {
    // Clear local cache (each bundle has its own copy)
    clearWishlistCache();
    try {
      await updateWishlistBadge(currentUser.uid);
    } catch (e) {
      console.error('Error updating wishlist badge:', e);
    }
  }
});

// Update menu avatar with user photo, Gravatar, or initial
async function updateMenuAvatar(user) {
  const initial = user.email ? user.email.charAt(0).toUpperCase() : '?';
  const avatars = [menuAvatar, menuAvatarMobile].filter(Boolean);

  // Helper to set avatar content
  function setAvatarImage(src) {
    avatars.forEach(avatar => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Profile';
      img.className = 'w-full h-full object-cover';
      avatar.innerHTML = '';
      avatar.appendChild(img);
    });
  }

  function setAvatarInitial() {
    avatars.forEach(avatar => {
      avatar.textContent = initial;
    });
  }

  // Try to load user profile photo from Firestore
  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.exists() ? userDoc.data() : {};

    if (userData.photoUrl && isValidImageUrl(userData.photoUrl)) {
      setAvatarImage(userData.photoUrl);
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
      setAvatarImage(gravatarUrl);
      return;
    }
  } catch (e) {
    console.warn('Gravatar check failed:', e.message);
  }

  // Fall back to initial
  setAvatarInitial();
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
          _normalizedAuthor: b._normalizedAuthor || normalizeText(b.author),
          _normalizedPublisher: b._normalizedPublisher || normalizeText(b.publisher),
          _normalizedNotes: b._normalizedNotes || normalizeText(b.notes)
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
    books = snapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt),
          // Pre-normalize for faster search
          _normalizedTitle: normalizeText(data.title),
          _normalizedAuthor: normalizeText(data.author),
          _normalizedPublisher: normalizeText(data.publisher),
          _normalizedNotes: normalizeText(data.notes)
        };
      })
      .filter(book => !book.deletedAt); // Exclude soft-deleted books
    await Promise.all([genresPromise, seriesPromise]); // Wait for genres and series
    allBooksLoaded = true;
  } catch (error) {
    console.error('Error loading books for search:', error);
  } finally {
    isLoadingBooks = false;
  }
}

// Menu - Mobile uses bottom sheet, Desktop uses slide-out
function isMobileViewport() {
  return window.matchMedia('(max-width: 767px)').matches;
}

if (menuBtn && menuOverlay) {
  menuBtn.addEventListener('click', openMenu);
}

// Desktop close button and backdrop click
if (closeMenuBtn) {
  closeMenuBtn.addEventListener('click', closeMenu);
}
if (menuOverlay) {
  menuOverlay.addEventListener('click', (e) => {
    if (e.target === menuOverlay) closeMenu();
  });
}

function openMenu() {
  // Show overlay with fade animation
  menuOverlay?.classList.remove('opacity-0', 'invisible', 'pointer-events-none');
  menuOverlay?.classList.add('opacity-100', 'visible', 'pointer-events-auto');
  document.body.style.overflow = 'hidden';

  if (isMobileViewport()) {
    // Mobile: show bottom sheet (slide up from bottom)
    menuPanelDesktop?.classList.add('hidden');
    requestAnimationFrame(() => {
      menuPanelMobile?.classList.remove('translate-y-full');
      menuPanelMobile?.classList.add('translate-y-0');
    });
  } else {
    // Desktop: show slide-out panel (slide in from right)
    menuPanelMobile?.classList.add('translate-y-full');
    menuPanelDesktop?.classList.remove('hidden');
    requestAnimationFrame(() => {
      menuPanelDesktop?.classList.remove('translate-x-full');
      menuPanelDesktop?.classList.add('translate-x-0');
    });
  }
  initIcons();
}

function closeMenu() {
  if (isMobileViewport()) {
    // Mobile: slide bottom sheet down
    menuPanelMobile?.classList.remove('translate-y-0');
    menuPanelMobile?.classList.add('translate-y-full');
    menuPanelMobile.style.transform = ''; // Clear any inline transform from swipe
    document.body.style.overflow = '';
    // Fade out overlay after panel slides down
    setTimeout(() => {
      menuOverlay?.classList.remove('opacity-100', 'visible', 'pointer-events-auto');
      menuOverlay?.classList.add('opacity-0', 'invisible', 'pointer-events-none');
    }, 200);
  } else {
    // Desktop: slide out panel to right
    menuPanelDesktop?.classList.remove('translate-x-0');
    menuPanelDesktop?.classList.add('translate-x-full');
    document.body.style.overflow = '';
    // Fade out overlay after panel slides out
    setTimeout(() => {
      menuPanelDesktop?.classList.add('hidden');
      menuOverlay?.classList.remove('opacity-100', 'visible', 'pointer-events-auto');
      menuOverlay?.classList.add('opacity-0', 'invisible', 'pointer-events-none');
    }, 200);
  }
}

// Swipe-to-close for mobile menu bottom sheet
if (menuPanelMobile) {
  let startY = 0;
  let currentY = 0;
  let isDragging = false;

  menuPanelMobile.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    currentY = startY;
    isDragging = true;
    menuPanelMobile.style.transition = 'none'; // Disable transition during drag
  }, { passive: true });

  menuPanelMobile.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;

    // Only allow dragging downward (positive deltaY)
    if (deltaY > 0) {
      menuPanelMobile.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: true });

  menuPanelMobile.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;

    const deltaY = currentY - startY;
    menuPanelMobile.style.transition = ''; // Re-enable transition
    menuPanelMobile.style.transform = ''; // Clear inline transform

    // Close if dragged more than 100px or 30% of panel height
    const threshold = Math.min(100, menuPanelMobile.offsetHeight * 0.3);
    if (deltaY > threshold) {
      closeMenu();
    }
  }, { passive: true });
}

// Logout (both mobile and desktop buttons)
async function handleLogout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    showToast('Error signing out. Please try again.', { type: 'error' });
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', handleLogout);
}
if (logoutBtnMobile) {
  logoutBtnMobile.addEventListener('click', handleLogout);
}

// Search
let currentSearchQuery = '';

function performSearch(queryText) {
  currentSearchQuery = queryText;

  if (!queryText) {
    // Show recent searches when query is cleared (never show loading here)
    showRecentSearches();
    // Hide result count when no query
    if (searchResultCount) {
      searchResultCount.classList.add('hidden');
      searchResultCount.textContent = '';
    }
    return;
  }

  // Search across multiple fields (title, author, ISBN, series, notes, publisher)
  const results = books.filter(b => {
    // Check pre-normalized fields
    if ((b._normalizedTitle || '').includes(queryText)) return true;
    if ((b._normalizedAuthor || '').includes(queryText)) return true;
    if ((b._normalizedPublisher || '').includes(queryText)) return true;
    if ((b._normalizedNotes || '').includes(queryText)) return true;
    // Check ISBN (exact or partial match, no normalization needed)
    if (b.isbn && b.isbn.includes(queryText)) return true;
    // Check series name (lookup from seriesLookup)
    if (b.seriesId && seriesLookup) {
      const series = seriesLookup.get(b.seriesId);
      if (series && normalizeText(series.name).includes(queryText)) return true;
    }
    return false;
  });

  // Update result count badge
  if (searchResultCount) {
    if (results.length > 0) {
      searchResultCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
      searchResultCount.classList.remove('hidden');
    } else {
      searchResultCount.classList.add('hidden');
      searchResultCount.textContent = '';
    }
  }

  let html = results.length
    ? results.map(book => bookCard(book, { showDate: true, genreLookup, seriesLookup, highlightQuery: queryText })).join('')
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

  // Save search when user clicks a result (not on every keystroke)
  if (results.length > 0) {
    searchResults.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener('click', () => {
        const originalQuery = searchInput?.value?.trim();
        if (originalQuery) {
          saveRecentSearch(originalQuery);
        }
      }, { once: true });
    });
  }
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
      // Clear result count
      if (searchResultCount) {
        searchResultCount.classList.add('hidden');
        searchResultCount.textContent = '';
      }
      searchInput.focus();
    });
  }
}

async function openSearch() {
  // Fade in the search overlay
  searchOverlay.classList.remove('opacity-0', 'invisible', 'pointer-events-none');
  searchOverlay.classList.add('opacity-100', 'visible', 'pointer-events-auto');
  document.body.style.overflow = 'hidden'; // Prevent body scroll
  if (!isMobile()) searchInput.focus();
  initIcons();

  // Show recent searches if no current query
  if (!currentSearchQuery) {
    showRecentSearches();
  }

  // Start loading books in background if not already loaded (silently, no spinner)
  if (!allBooksLoaded && !isLoadingBooks) {
    await loadAllBooksForSearch();

    // Re-run search with current query after loading completes
    if (currentSearchQuery) {
      performSearch(currentSearchQuery);
    }
  }
}

function closeSearch() {
  // Fade out the search overlay
  searchOverlay.classList.remove('opacity-100', 'visible', 'pointer-events-auto');
  searchOverlay.classList.add('opacity-0', 'invisible', 'pointer-events-none');
  document.body.style.overflow = ''; // Restore body scroll
  searchInput.value = '';
  searchResults.innerHTML = '';
  currentSearchQuery = '';
  if (clearSearchInputBtn) clearSearchInputBtn.classList.add('hidden');
  // Clear result count
  if (searchResultCount) {
    searchResultCount.classList.add('hidden');
    searchResultCount.textContent = '';
  }
}

