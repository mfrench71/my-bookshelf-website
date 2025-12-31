// Common Header Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged, signOut, User } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  normalizeText,
  showToast,
  debounce,
  initIcons,
  CACHE_KEY,
  serializeTimestamp,
  isMobile,
  isValidImageUrl,
  escapeHtml,
  escapeAttr,
} from './utils.js';
import { bookCard } from './components/book-card.js';
import { loadUserGenres, createGenreLookup } from './genres.js';
import { loadUserSeries, createSeriesLookup } from './series.js';
import { getGravatarUrl } from './md5.js';
import { getWishlistCount, clearWishlistCache } from './wishlist.js';
import { getRecentSearches, saveRecentSearch, clearRecentSearches } from './utils/recent-searches.js';
import { initCacheInvalidation, clearAllCaches } from './utils/cache-invalidation.js';

/** Book data structure for search */
interface BookData {
  id: string;
  title?: string;
  author?: string;
  isbn?: string;
  publisher?: string;
  notes?: string;
  seriesId?: string;
  deletedAt?: number | null;
  _normalizedTitle?: string;
  _normalizedAuthor?: string;
  _normalizedPublisher?: string;
  _normalizedNotes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

/** Genre data structure */
interface GenreData {
  id: string;
  name: string;
  color: string;
  bookCount?: number;
}

/** Series data structure */
interface SeriesData {
  id: string;
  name: string;
  [key: string]: unknown;
}

/** Genre lookup map type */
type GenreLookup = Map<string, GenreData>;

/** Series lookup map type */
type SeriesLookup = Map<string, SeriesData>;

// Initialize icons once on load
initIcons();

// State
let currentUser: User | null = null;
let books: BookData[] = [];
let allBooksLoaded = false;
let isLoadingBooks = false;
let genres: GenreData[] = [];
let genreLookup: GenreLookup | null = null;
let series: SeriesData[] = [];
let seriesLookup: SeriesLookup | null = null;
let onlineListenersAttached = false;

/**
 * Render recent searches section
 * @returns HTML string for recent searches
 */
function renderRecentSearches(): string {
  const searches = getRecentSearches();
  if (searches.length === 0) return '';

  const searchItems = searches
    .map(
      (searchQuery: string) => `
    <button type="button" class="recent-search-item flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-gray-100 rounded-lg transition-colors" data-query="${escapeAttr(searchQuery)}">
      <i data-lucide="history" class="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true"></i>
      <span class="text-gray-700 truncate">${escapeHtml(searchQuery)}</span>
    </button>
  `
    )
    .join('');

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
function showRecentSearches(): void {
  if (!searchResults) return;

  const html = renderRecentSearches();
  if (html) {
    searchResults.innerHTML = html;
    initIcons();
    attachRecentSearchListeners();
  } else {
    // Show empty state prompt
    searchResults.innerHTML = `
      <div class="py-8 text-center empty-state-animate">
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
function attachRecentSearchListeners(): void {
  if (!searchResults || !searchInput) return;

  // Click on recent search item
  searchResults.querySelectorAll<HTMLButtonElement>('.recent-search-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemQuery = item.dataset.query;
      if (itemQuery && searchInput) {
        searchInput.value = itemQuery;
        if (clearSearchInputBtn) clearSearchInputBtn.classList.remove('hidden');
        performSearch(normalizeText(itemQuery));
      }
    });
  });

  // Clear recent searches button
  const clearBtn = document.getElementById('clear-recent-searches');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearRecentSearches();
      if (searchResults) searchResults.innerHTML = '';
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
const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
const clearSearchInputBtn = document.getElementById('clear-search-input');
const searchResults = document.getElementById('search-results');
const searchLoading = document.getElementById('search-loading');
const searchResultCount = document.getElementById('search-result-count');
const searchHeader = document.getElementById('search-header');
const offlineBanner = document.getElementById('offline-banner');
// Wishlist count badges
const wishlistCountMobile = document.getElementById('wishlist-count-mobile');
const wishlistCountDesktop = document.getElementById('wishlist-count-desktop');

/**
 * Update online/offline status banner
 */
function updateOnlineStatus(): void {
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
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    currentUser = user;
    // Initialize event-driven cache invalidation
    initCacheInvalidation(user.uid);
    // Set email in both mobile and desktop menus
    if (userEmail) userEmail.textContent = user.email;
    if (userEmailMobile) userEmailMobile.textContent = user.email;
    // Update menu avatars (both mobile and desktop)
    await updateMenuAvatar(user);
    // Load wishlist count for badge
    await updateWishlistBadge(user.uid);
    // Don't load all books upfront - load when search opens
  } else {
    // Clear caches on logout
    clearAllCaches();
    window.location.href = '/login/';
  }
});

// Update wishlist count badge in menu
let lastWishlistCount: number | null = null;

/**
 * Update wishlist count badge
 * @param userId - User ID
 */
async function updateWishlistBadge(userId: string): Promise<void> {
  try {
    const count = await getWishlistCount(userId);
    const badges = [wishlistCountMobile, wishlistCountDesktop].filter(Boolean) as HTMLElement[];
    const countChanged = lastWishlistCount !== null && lastWishlistCount !== count;

    badges.forEach(badge => {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.classList.remove('hidden');
        // Pulse animation when count changes
        if (countChanged) {
          badge.classList.remove('badge-pulse');
          void badge.offsetWidth; // Force reflow to restart animation
          badge.classList.add('badge-pulse');
        }
      } else {
        badge.classList.add('hidden');
      }
    });

    lastWishlistCount = count;
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.warn('Failed to load wishlist count:', error.message);
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

/**
 * Update menu avatar with user photo, Gravatar, or initial
 * @param user - Firebase user
 */
async function updateMenuAvatar(user: User): Promise<void> {
  const initial = user.email ? user.email.charAt(0).toUpperCase() : '?';
  const avatars = [menuAvatar, menuAvatarMobile].filter(Boolean) as HTMLElement[];

  // Helper to set avatar content
  function setAvatarImage(src: string): void {
    avatars.forEach(avatar => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Profile';
      img.className = 'w-full h-full object-cover';
      avatar.innerHTML = '';
      avatar.appendChild(img);
    });
  }

  function setAvatarInitial(): void {
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
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.warn('Failed to load user profile photo:', error.message);
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
      localStorage.setItem(
        gravatarCacheKey,
        JSON.stringify({
          exists: gravatarExists,
          timestamp: Date.now(),
        })
      );
    }

    if (gravatarExists) {
      setAvatarImage(gravatarUrl);
      return;
    }
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.warn('Gravatar check failed:', error.message);
  }

  // Fall back to initial
  setAvatarInitial();
}

/**
 * Load all books for search - called when search opens
 */
async function loadAllBooksForSearch(): Promise<void> {
  if (allBooksLoaded || isLoadingBooks || !currentUser) return;

  isLoadingBooks = true;

  // Load genres and series in parallel with books
  const genresPromise = loadUserGenres(currentUser.uid)
    .then((g: GenreData[]) => {
      genres = g;
      genreLookup = createGenreLookup(genres);
    })
    .catch(e => {
      console.error('Error loading genres for search:', e);
      genres = [];
      genreLookup = new Map();
    });

  const seriesPromise = loadUserSeries(currentUser.uid)
    .then((s: SeriesData[]) => {
      series = s;
      seriesLookup = createSeriesLookup(series);
    })
    .catch(e => {
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
        books = cachedBooks.map((b: BookData) => ({
          ...b,
          _normalizedTitle: b._normalizedTitle || normalizeText(b.title),
          _normalizedAuthor: b._normalizedAuthor || normalizeText(b.author),
          _normalizedPublisher: b._normalizedPublisher || normalizeText(b.publisher),
          _normalizedNotes: b._normalizedNotes || normalizeText(b.notes),
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
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.warn('Cache read error in search:', error.message);
  }

  // Fetch all from Firebase
  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const q = query(booksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    books = snapshot.docs
      .map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: serializeTimestamp(data.createdAt),
          updatedAt: serializeTimestamp(data.updatedAt),
          // Pre-normalize for faster search
          _normalizedTitle: normalizeText(data.title),
          _normalizedAuthor: normalizeText(data.author),
          _normalizedPublisher: normalizeText(data.publisher),
          _normalizedNotes: normalizeText(data.notes),
        } as BookData;
      })
      .filter(book => !book.deletedAt); // Exclude soft-deleted books
    await Promise.all([genresPromise, seriesPromise]); // Wait for genres and series
    allBooksLoaded = true;
  } catch (error) {
    console.error('Error loading books for search:', error);
  } finally {
    isLoadingBooks = false;
    // Re-run search if user typed while loading
    if (currentSearchQuery) {
      performSearch(currentSearchQuery);
    }
  }
}

/**
 * Check if viewport is mobile
 */
function isMobileViewport(): boolean {
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
  menuOverlay.addEventListener('click', (e: Event) => {
    if (e.target === menuOverlay) closeMenu();
  });
}

/**
 * Open menu (mobile bottom sheet or desktop slide-out)
 */
function openMenu(): void {
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

/**
 * Close menu
 */
function closeMenu(): void {
  if (isMobileViewport()) {
    // Mobile: slide bottom sheet down
    menuPanelMobile?.classList.remove('translate-y-0');
    menuPanelMobile?.classList.add('translate-y-full');
    if (menuPanelMobile) menuPanelMobile.style.transform = ''; // Clear any inline transform from swipe
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

  menuPanelMobile.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      currentY = startY;
      isDragging = true;
      menuPanelMobile.style.transition = 'none'; // Disable transition during drag
    },
    { passive: true }
  );

  menuPanelMobile.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;

      // Only allow dragging downward (positive deltaY)
      if (deltaY > 0) {
        menuPanelMobile.style.transform = `translateY(${deltaY}px)`;
      }
    },
    { passive: true }
  );

  menuPanelMobile.addEventListener(
    'touchend',
    () => {
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
    },
    { passive: true }
  );
}

/**
 * Handle logout
 */
async function handleLogout(): Promise<void> {
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

/**
 * Perform search across books
 * @param queryText - Normalized search query
 */
function performSearch(queryText: string): void {
  currentSearchQuery = queryText;

  if (!queryText) {
    // Show recent searches when query is cleared (never show loading here)
    if (searchLoading) searchLoading.classList.add('hidden');
    if (searchResults) searchResults.classList.remove('hidden');
    showRecentSearches();
    // Hide result count when no query
    if (searchResultCount) {
      searchResultCount.classList.add('hidden');
      searchResultCount.textContent = '';
    }
    return;
  }

  // Show skeleton while books are still loading
  if (isLoadingBooks && books.length === 0) {
    if (searchLoading) searchLoading.classList.remove('hidden');
    if (searchResults) searchResults.classList.add('hidden');
    if (searchResultCount) searchResultCount.classList.add('hidden');
    return;
  }

  // Hide skeleton, show results with fade-in animation
  if (searchLoading) searchLoading.classList.add('hidden');
  if (searchResults) {
    searchResults.classList.remove('hidden');
    // Trigger fade-in animation
    searchResults.classList.remove('content-fade-in');
    void searchResults.offsetWidth; // Force reflow to restart animation
    searchResults.classList.add('content-fade-in');
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
      const seriesData = seriesLookup.get(b.seriesId);
      if (seriesData && normalizeText(seriesData.name).includes(queryText)) return true;
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
    ? results
        .map((book, index) =>
          bookCard(book, {
            showDate: true,
            genreLookup,
            seriesLookup,
            highlightQuery: queryText,
            className: 'card-animate',
            animationDelay: Math.min(index * 50, 250), // Stagger animation, max 250ms
          })
        )
        .join('')
    : `<div class="py-8 text-center empty-state-animate">
        <i data-lucide="search-x" class="w-12 h-12 text-gray-300 mx-auto"></i>
        <p class="text-gray-500 mt-3">No books found</p>
        <p class="text-gray-400 text-sm mt-1">Try a different search term</p>
      </div>`;

  // Show loading indicator if still loading more books
  if (isLoadingBooks) {
    html +=
      '<p class="text-gray-400 text-center text-sm py-2"><span class="inline-block animate-spin w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full mr-1"></span>Loading more books...</p>';
  }

  if (searchResults) {
    searchResults.innerHTML = html;
  }
  initIcons();

  // Save search when user clicks a result (not on every keystroke)
  if (results.length > 0 && searchResults) {
    searchResults.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener(
        'click',
        () => {
          const originalQuery = searchInput?.value?.trim();
          if (originalQuery) {
            saveRecentSearch(originalQuery);
          }
        },
        { once: true }
      );
    });
  }
}

if (searchBtn && searchOverlay && closeSearchBtn && searchInput && searchResults) {
  searchBtn.addEventListener('click', openSearch);
  closeSearchBtn.addEventListener('click', closeSearch);

  // Debounced search handler
  const debouncedSearch = debounce((queryText: string) => performSearch(queryText), 150);

  searchInput.addEventListener('input', () => {
    const inputQuery = searchInput.value.trim();
    // Show/hide clear button
    if (clearSearchInputBtn) {
      clearSearchInputBtn.classList.toggle('hidden', !inputQuery);
    }
    debouncedSearch(normalizeText(inputQuery));
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

/**
 * Open search overlay
 */
async function openSearch(): Promise<void> {
  if (!searchOverlay || !searchInput) return;

  // Fade in the search overlay
  searchOverlay.classList.remove('opacity-0', 'invisible', 'pointer-events-none');
  searchOverlay.classList.add('opacity-100', 'visible', 'pointer-events-auto');
  document.body.style.overflow = 'hidden'; // Prevent body scroll

  // Animate search header sliding down
  if (searchHeader) {
    searchHeader.classList.remove('search-header-exit');
    searchHeader.classList.add('search-header-enter');
  }

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

/**
 * Close search overlay
 */
function closeSearch(): void {
  if (!searchOverlay || !searchInput || !searchResults) return;

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
