// Home Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initIcons, CACHE_KEY, serializeTimestamp, showToast, setupVisibilityRefresh, setLastRefreshTime } from './utils.js';
import { loadUserGenres, createGenreLookup } from './genres.js';
import { loadUserSeries, createSeriesLookup } from './series.js';
import { loadWidgetSettings } from './utils/widget-settings.js';
import { renderWidgets, renderWidgetSkeletons } from './widgets/widget-renderer.js';
// Import widgets to ensure they're registered
import './widgets/index.js';

// Initialize icons
initIcons();

// State
let currentUser = null;
let books = [];
let genres = [];
let genreLookup = null;
let series = [];
let seriesLookup = null;

// DOM Elements
const widgetContainer = document.getElementById('widget-container');

// Email Verification Elements
const verifyEmailBanner = document.getElementById('verify-email-banner');
const resendVerificationBtn = document.getElementById('resend-verification-btn');
const dismissVerifyBanner = document.getElementById('dismiss-verify-banner');
const VERIFY_BANNER_DISMISSED_KEY = 'verifyBannerDismissed';

// Auth Check
onAuthStateChanged(auth, async (user) => {
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

// Silent refresh for auto-sync on tab focus
async function silentRefreshDashboard() {
  await loadDashboard();
  showToast('Library synced', { type: 'info' });
}

// Email Verification Banner
function checkEmailVerification() {
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
  verifyEmailBanner.classList.add('hidden');
});

// Resend verification email
resendVerificationBtn?.addEventListener('click', async () => {
  if (!currentUser) return;

  resendVerificationBtn.disabled = true;
  resendVerificationBtn.textContent = 'Sending...';

  try {
    await sendEmailVerification(currentUser);
    resendVerificationBtn.textContent = 'Email sent!';
    setTimeout(() => {
      resendVerificationBtn.textContent = 'Resend verification email';
      resendVerificationBtn.disabled = false;
    }, 3000);
  } catch (error) {
    console.error('Error sending verification email:', error);
    if (error.code === 'auth/too-many-requests') {
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

// Load all user data
async function loadDashboard() {
  try {
    // Show skeleton loading state
    if (widgetContainer) {
      renderWidgetSkeletons(widgetContainer, 4);
    }

    // Load genres, series, books, and widget settings in parallel
    const [genresResult, seriesResult, booksResult, widgetSettings] = await Promise.all([
      loadGenresData(),
      loadSeriesData(),
      loadBooksData(),
      loadWidgetSettings(currentUser.uid)
    ]);

    genres = genresResult;
    genreLookup = createGenreLookup(genres);
    series = seriesResult;
    seriesLookup = createSeriesLookup(series);
    books = booksResult;

    // Render widgets
    if (widgetContainer) {
      renderWidgets(widgetContainer, books, widgetSettings, genreLookup, seriesLookup);
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

// Load genres
async function loadGenresData() {
  try {
    return await loadUserGenres(currentUser.uid);
  } catch (e) {
    console.error('Error loading genres:', e);
    return [];
  }
}

// Load series
async function loadSeriesData() {
  try {
    return await loadUserSeries(currentUser.uid);
  } catch (e) {
    console.error('Error loading series:', e);
    return [];
  }
}

// Load books (from cache or Firebase)
async function loadBooksData() {
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
  } catch (e) {
    console.warn('Cache read error on home page:', e.message);
  }

  // Fetch from Firebase
  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const q = query(booksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt),
        startedAt: serializeTimestamp(data.startedAt),
        finishedAt: serializeTimestamp(data.finishedAt)
      };
    });
  } catch (error) {
    console.error('Error fetching books for home page:', error);
    return []; // Return empty array to allow page to render without books
  }
}

