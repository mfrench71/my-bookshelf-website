// Home Page Logic
import { auth } from '/js/firebase-config.js';
import {
  onAuthStateChanged,
  sendEmailVerification,
  User,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  initIcons,
  CACHE_KEY,
  serializeTimestamp,
  showToast,
  setupVisibilityRefresh,
  setLastRefreshTime,
} from './utils.js';
import { loadUserGenres, createGenreLookup } from './genres.js';
import { loadUserSeries, createSeriesLookup } from './series.js';
import { loadWidgetSettings } from './utils/widget-settings.js';
import { renderWidgets, renderWidgetSkeletons } from './widgets/widget-renderer.js';
import { wishlistRepository } from './repositories/wishlist-repository.js';
import { bookRepository } from './repositories/book-repository.js';
// Import widgets to ensure they're registered
import './widgets/index.js';

/** Book data structure */
interface BookData {
  id: string;
  title: string;
  author?: string;
  deletedAt?: number | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  startedAt?: unknown;
  finishedAt?: unknown;
  [key: string]: unknown;
}

/** Genre data structure */
interface GenreData {
  id: string;
  name: string;
  color: string;
  bookCount?: number;
  [key: string]: unknown;
}

/** Series data structure */
interface SeriesData {
  id: string;
  name: string;
  [key: string]: unknown;
}

/** Wishlist item data structure */
interface WishlistItemData {
  id: string;
  title?: string;
  author?: string;
  [key: string]: unknown;
}

/** Genre lookup map type */
type GenreLookup = Map<string, GenreData>;

/** Series lookup map type */
type SeriesLookup = Map<string, SeriesData>;

// Initialize icons
initIcons();

// State
let currentUser: User | null = null;
let books: BookData[] = [];
let genres: GenreData[] = [];
let genreLookup: GenreLookup | null = null;
let series: SeriesData[] = [];
let seriesLookup: SeriesLookup | null = null;
let wishlistItems: WishlistItemData[] = [];

// DOM Elements
const widgetContainer = document.getElementById('widget-container');

// Email Verification Elements
const verifyEmailBanner = document.getElementById('verify-email-banner');
const resendVerificationBtn = document.getElementById('resend-verification-btn') as HTMLButtonElement | null;
const dismissVerifyBanner = document.getElementById('dismiss-verify-banner');
const VERIFY_BANNER_DISMISSED_KEY = 'verifyBannerDismissed';

// Auth Check
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    currentUser = user;
    checkEmailVerification();
    await loadDashboard();

    // Mark this as an initial load for visibility refresh cooldown
    setLastRefreshTime();

    // Set up auto-refresh when tab becomes visible
    setupVisibilityRefresh(silentRefreshDashboard);
  }
});

/**
 * Silent refresh for auto-sync on tab focus
 */
async function silentRefreshDashboard(): Promise<void> {
  await loadDashboard();
  showToast('Library synced', { type: 'info' });
}

/**
 * Check email verification status and show banner if needed
 */
function checkEmailVerification(): void {
  if (!currentUser || !verifyEmailBanner) return;

  // Check if email is verified or banner was dismissed this session
  const dismissed = sessionStorage.getItem(VERIFY_BANNER_DISMISSED_KEY);

  if (!currentUser.emailVerified && !dismissed) {
    verifyEmailBanner.classList.remove('hidden');
    initIcons();
  } else {
    verifyEmailBanner.classList.add('hidden');
  }
}

// Dismiss banner (for this session only)
dismissVerifyBanner?.addEventListener('click', () => {
  sessionStorage.setItem(VERIFY_BANNER_DISMISSED_KEY, 'true');
  verifyEmailBanner?.classList.add('hidden');
});

// Resend verification email
resendVerificationBtn?.addEventListener('click', async () => {
  if (!currentUser || !resendVerificationBtn) return;

  resendVerificationBtn.disabled = true;
  resendVerificationBtn.textContent = 'Sending...';

  try {
    await sendEmailVerification(currentUser);
    resendVerificationBtn.textContent = 'Email sent!';
    setTimeout(() => {
      resendVerificationBtn.textContent = 'Resend verification email';
      resendVerificationBtn.disabled = false;
    }, 3000);
  } catch (error: unknown) {
    console.error('Error sending verification email:', error);
    const firebaseError = error as { code?: string };
    if (firebaseError.code === 'auth/too-many-requests') {
      resendVerificationBtn.textContent = 'Please wait before resending';
    } else {
      resendVerificationBtn.textContent = 'Error sending email';
    }
    setTimeout(() => {
      resendVerificationBtn.textContent = 'Resend verification email';
      resendVerificationBtn.disabled = false;
    }, 3000);
  }
});

/**
 * Load all user data for dashboard
 */
async function loadDashboard(): Promise<void> {
  if (!currentUser) return;

  try {
    // Show skeleton loading state
    if (widgetContainer) {
      renderWidgetSkeletons(widgetContainer, 4);
    }

    // Load genres, series, books, wishlist, and widget settings in parallel
    const [genresResult, seriesResult, booksResult, wishlistResult, widgetSettings] = await Promise.all([
      loadGenresData(),
      loadSeriesData(),
      loadBooksData(),
      loadWishlistData(),
      loadWidgetSettings(currentUser.uid),
    ]);

    genres = genresResult;
    genreLookup = createGenreLookup(genres as Parameters<typeof createGenreLookup>[0]);
    series = seriesResult;
    seriesLookup = createSeriesLookup(series as Parameters<typeof createSeriesLookup>[0]);
    books = booksResult;
    wishlistItems = wishlistResult;

    // Render widgets
    if (widgetContainer) {
      renderWidgets(
        widgetContainer,
        books as unknown as Parameters<typeof renderWidgets>[1],
        widgetSettings,
        genreLookup as unknown as Parameters<typeof renderWidgets>[3],
        seriesLookup as unknown as Parameters<typeof renderWidgets>[4],
        wishlistItems as unknown as Parameters<typeof renderWidgets>[5]
      );
    }

    initIcons();
  } catch (error) {
    console.error('Error loading dashboard:', error);
    if (widgetContainer) {
      widgetContainer.innerHTML = `
        <div class="text-center py-8">
          <p class="text-red-500">Error loading dashboard</p>
          <button onclick="location.reload()" class="mt-2 text-primary hover:underline">Retry</button>
        </div>
      `;
    }
  }
}

/**
 * Load genres data
 */
async function loadGenresData(): Promise<GenreData[]> {
  if (!currentUser) return [];

  try {
    return await loadUserGenres(currentUser.uid);
  } catch (e) {
    console.error('Error loading genres:', e);
    return [];
  }
}

/**
 * Load series data
 */
async function loadSeriesData(): Promise<SeriesData[]> {
  if (!currentUser) return [];

  try {
    return await loadUserSeries(currentUser.uid);
  } catch (e) {
    console.error('Error loading series:', e);
    return [];
  }
}

/**
 * Load wishlist items
 */
async function loadWishlistData(): Promise<WishlistItemData[]> {
  if (!currentUser) return [];

  try {
    return (await wishlistRepository.getAll(currentUser.uid)) as WishlistItemData[];
  } catch (e) {
    console.error('Error loading wishlist:', e);
    return [];
  }
}

/**
 * Load books (from cache or repository)
 */
async function loadBooksData(): Promise<BookData[]> {
  if (!currentUser) return [];

  // Try cache first
  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const cachedBooks = parsed.books || parsed || [];
      const hasMore = parsed.hasMore ?? true;

      if (cachedBooks.length > 0 && !hasMore) {
        return cachedBooks;
      }
    }
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.warn('Cache read error on home page:', error.message);
  }

  // Fetch via repository
  try {
    const fetchedBooks = await bookRepository.getWithOptions(currentUser.uid, {
      orderByField: 'createdAt',
      orderDirection: 'desc',
    });

    return fetchedBooks
      .map(book => {
        const data = book as BookData;
        return {
          ...data,
          createdAt: serializeTimestamp(data.createdAt as Parameters<typeof serializeTimestamp>[0]),
          updatedAt: serializeTimestamp(data.updatedAt as Parameters<typeof serializeTimestamp>[0]),
          startedAt: serializeTimestamp(data.startedAt as Parameters<typeof serializeTimestamp>[0]),
          finishedAt: serializeTimestamp(data.finishedAt as Parameters<typeof serializeTimestamp>[0]),
        } as BookData;
      })
      .filter(book => !book.deletedAt); // Exclude soft-deleted books
  } catch (error) {
    console.error('Error fetching books for home page:', error);
    return []; // Return empty array to allow page to render without books
  }
}
