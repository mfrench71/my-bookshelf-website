// Home Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initIcons, escapeHtml, CACHE_KEY, serializeTimestamp, getHomeSettings } from './utils.js';
import { loadUserGenres, createGenreLookup } from './genres.js';

// Initialize icons
initIcons();

// State
let currentUser = null;
let books = [];
let genres = [];
let genreLookup = null;

// DOM Elements
const welcomeText = document.getElementById('welcome-text');
const statsText = document.getElementById('stats-text');
const loadingState = document.getElementById('loading-state');
const dashboardSections = document.getElementById('dashboard-sections');

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
  }
});

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
    // Load genres and books in parallel
    const [genresResult, booksResult] = await Promise.all([
      loadGenresData(),
      loadBooksData()
    ]);

    genres = genresResult;
    genreLookup = createGenreLookup(genres);
    books = booksResult;

    // Update welcome message
    updateWelcomeMessage();

    // Hide loading, show dashboard
    loadingState.classList.add('hidden');
    dashboardSections.classList.remove('hidden');

    // Render sections based on settings
    const settings = getHomeSettings();
    renderSections(settings);

    initIcons();
  } catch (error) {
    console.error('Error loading dashboard:', error);
    loadingState.innerHTML = `
      <p class="text-red-500">Error loading dashboard</p>
      <button onclick="location.reload()" class="mt-2 text-primary hover:underline">Retry</button>
    `;
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
}

// Update welcome message
function updateWelcomeMessage() {
  // Calculate stats
  const totalBooks = books.length;
  const thisYear = new Date().getFullYear();
  const booksThisYear = books.filter(b => {
    const date = new Date(b.createdAt);
    return date.getFullYear() === thisYear;
  }).length;

  welcomeText.textContent = 'Welcome back!';
  statsText.textContent = `${totalBooks} book${totalBooks !== 1 ? 's' : ''} in your library`;
  if (booksThisYear > 0) {
    statsText.textContent += ` · ${booksThisYear} added this year`;
  }
}

// Render all sections
function renderSections(settings) {
  // Currently Reading
  if (settings.currentlyReading?.enabled) {
    const reading = books.filter(b => b.status === 'reading');
    renderSection('currentlyReading', reading, settings.currentlyReading.count);
  }

  // Recently Added
  if (settings.recentlyAdded?.enabled) {
    const recent = [...books].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderSection('recentlyAdded', recent, settings.recentlyAdded.count);
  }

  // Top Rated
  if (settings.topRated?.enabled) {
    const topRated = books
      .filter(b => b.rating && b.rating >= 4)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
    renderSection('topRated', topRated, settings.topRated.count);
  }

  // Recently Finished
  if (settings.recentlyFinished?.enabled) {
    const finished = books
      .filter(b => b.status === 'finished')
      .sort((a, b) => (b.finishedAt || b.updatedAt || 0) - (a.finishedAt || a.updatedAt || 0));
    renderSection('recentlyFinished', finished, settings.recentlyFinished.count);
  }
}

// Render a single section
function renderSection(sectionId, sectionBooks, maxCount) {
  const section = document.getElementById(`section-${sectionId}`);
  const booksContainer = document.getElementById(`books-${sectionId}`);
  const countSpan = document.getElementById(`count-${sectionId}`);
  const emptyMsg = document.getElementById(`empty-${sectionId}`);

  if (!section) return;

  section.classList.remove('hidden');

  const displayBooks = sectionBooks.slice(0, maxCount);

  if (countSpan) {
    countSpan.textContent = `(${sectionBooks.length})`;
  }

  if (displayBooks.length === 0) {
    booksContainer.innerHTML = '';
    if (emptyMsg) emptyMsg.classList.remove('hidden');
    return;
  }

  if (emptyMsg) emptyMsg.classList.add('hidden');

  // Add spacer at start, books, and spacer at end for proper carousel padding
  const spacer = '<div class="carousel-spacer"></div>';
  booksContainer.innerHTML = spacer + displayBooks.map(book => renderBookCard(book)).join('') + spacer;
  initIcons();
}

// Render a compact book card for horizontal scroll
function renderBookCard(book) {
  const cover = book.coverImageUrl
    ? `<div class="relative w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center overflow-hidden">
        <i data-lucide="book" class="w-8 h-8 text-white"></i>
        <img src="${escapeHtml(book.coverImageUrl)}" alt="" class="w-full h-full object-cover absolute inset-0" loading="lazy" onerror="this.style.display='none'">
      </div>`
    : `<div class="w-24 h-36 bg-primary rounded-lg shadow-md flex items-center justify-center">
        <i data-lucide="book" class="w-8 h-8 text-white"></i>
      </div>`;

  return `
    <a href="/book/?id=${book.id}" class="flex-shrink-0 w-24 snap-start">
      ${cover}
      <h3 class="text-sm font-medium text-gray-900 mt-2 line-clamp-2">${escapeHtml(book.title)}</h3>
      <p class="text-xs text-gray-500 truncate">${escapeHtml(book.author || 'Unknown')}</p>
    </a>
  `;
}

