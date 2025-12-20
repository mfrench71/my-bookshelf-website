// Books List Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast, initIcons } from './utils.js';
import { bookCard } from './book-card.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let books = [];
let currentSort = 'createdAt-desc';
let ratingFilter = 0;
let unsubscribeBooks = null;
const BOOKS_PER_PAGE = 20;
let displayLimit = BOOKS_PER_PAGE;

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const bookList = document.getElementById('book-list');
const sortSelect = document.getElementById('sort-select');
const ratingFilterSelect = document.getElementById('rating-filter');
const resetFiltersBtn = document.getElementById('reset-filters');

// Auth State - just load books, header.js handles auth redirect
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadBooks();
  }
});

// Load Books
function loadBooks() {
  const booksRef = collection(db, 'users', currentUser.uid, 'books');
  const q = query(booksRef, orderBy('createdAt', 'desc'));

  unsubscribeBooks = onSnapshot(q, (snapshot) => {
    books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    loadingState.classList.add('hidden');
    renderBooks();
  }, (error) => {
    console.error('Error loading books:', error);
    loadingState.classList.add('hidden');
    showToast('Error loading books');
  });
}

// Intersection Observer for infinite scroll
let scrollObserver = null;

function setupScrollObserver() {
  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      loadMore();
    }
  }, { rootMargin: '100px' });
}

setupScrollObserver();

// Sorting function
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
        aVal = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
        bVal = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
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

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    bookList.innerHTML = '';
    initIcons();
    return;
  }

  emptyState.classList.add('hidden');
  const visible = filtered.slice(0, displayLimit);
  const hasMore = filtered.length > displayLimit;

  bookList.innerHTML = visible.map(book => bookCard(book, { showDate: true })).join('');

  if (hasMore) {
    bookList.innerHTML += `
      <div id="scroll-sentinel" class="py-6 flex justify-center">
        <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    `;
    scrollObserver.observe(document.getElementById('scroll-sentinel'));
  }

  initIcons();
}

function loadMore() {
  let filtered = filterByRating(books, ratingFilter);
  filtered = sortBooks(filtered, currentSort);

  if (displayLimit >= filtered.length) return;

  displayLimit += BOOKS_PER_PAGE;
  renderBooks();
}

// Sort & Filter Controls
sortSelect.addEventListener('change', () => {
  currentSort = sortSelect.value;
  displayLimit = BOOKS_PER_PAGE;
  updateResetButton();
  renderBooks();
});

ratingFilterSelect.addEventListener('change', () => {
  ratingFilter = parseInt(ratingFilterSelect.value) || 0;
  displayLimit = BOOKS_PER_PAGE;
  updateResetButton();
  renderBooks();
});

// Show/hide reset button based on filter state
function updateResetButton() {
  const isDefault = currentSort === 'createdAt-desc' && ratingFilter === 0;
  resetFiltersBtn.classList.toggle('hidden', isDefault);
}

// Reset filters to defaults
resetFiltersBtn.addEventListener('click', () => {
  currentSort = 'createdAt-desc';
  ratingFilter = 0;
  sortSelect.value = 'createdAt-desc';
  ratingFilterSelect.value = '0';
  displayLimit = BOOKS_PER_PAGE;
  updateResetButton();
  renderBooks();
});
