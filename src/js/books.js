// Books List Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize icons
lucide.createIcons();

// State
let currentUser = null;
let books = [];
let currentFilter = 'all';
let unsubscribeBooks = null;

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const bookList = document.getElementById('book-list');
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
const searchResults = document.getElementById('search-results');
const statsBtn = document.getElementById('stats-btn');
const statsModal = document.getElementById('stats-modal');
const statsContent = document.getElementById('stats-content');
const closeStatsBtn = document.getElementById('close-stats');
const exportBtn = document.getElementById('export-btn');
const filterChips = document.querySelectorAll('.filter-chip');
const toast = document.getElementById('toast');

// Auth State
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userEmail.textContent = user.email;
    loadBooks();
  } else {
    window.location.href = '/';
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

// Render Books
function renderBooks() {
  const filtered = currentFilter === 'all'
    ? books
    : books.filter(b => b.status === currentFilter);

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    bookList.innerHTML = '';
    lucide.createIcons();
    return;
  }

  emptyState.classList.add('hidden');
  bookList.innerHTML = filtered.map(book => bookCard(book)).join('');
  lucide.createIcons();
}

function bookCard(book) {
  const statusLabels = {
    wantToRead: 'Want to Read',
    reading: 'Reading',
    finished: 'Finished'
  };

  const cover = book.coverImageUrl
    ? `<img src="${book.coverImageUrl}" alt="" class="book-cover" loading="lazy">`
    : `<div class="book-cover-placeholder"><i data-lucide="book"></i></div>`;

  const rating = book.rating
    ? `<div class="rating-stars">${renderStars(book.rating)}</div>`
    : '';

  return `
    <a href="/book/?id=${book.id}" class="book-card">
      ${cover}
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate">${escapeHtml(book.title)}</h3>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(book.author || 'Unknown author')}</p>
        <div class="flex items-center gap-2 mt-2">
          <span class="status-badge ${book.status}">${statusLabels[book.status] || 'Unknown'}</span>
          ${rating}
        </div>
      </div>
    </a>
  `;
}

function renderStars(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    i < rating
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      : '<svg class="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  ).join('');
}

// Filter Chips
filterChips.forEach(chip => {
  chip.addEventListener('click', () => {
    filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    renderBooks();
  });
});

// Menu
menuBtn.addEventListener('click', openMenu);
closeMenuBtn.addEventListener('click', closeMenu);
menuOverlay.addEventListener('click', (e) => {
  if (e.target === menuOverlay) closeMenu();
});

function openMenu() {
  menuOverlay.classList.remove('hidden');
  setTimeout(() => menuPanel.classList.remove('translate-x-full'), 10);
  lucide.createIcons();
}

function closeMenu() {
  menuPanel.classList.add('translate-x-full');
  setTimeout(() => menuOverlay.classList.add('hidden'), 200);
}

// Logout
logoutBtn.addEventListener('click', async () => {
  if (unsubscribeBooks) unsubscribeBooks();
  await signOut(auth);
});

// Search
searchBtn.addEventListener('click', openSearch);
closeSearchBtn.addEventListener('click', closeSearch);

function openSearch() {
  searchOverlay.classList.remove('hidden');
  searchInput.focus();
  lucide.createIcons();
}

function closeSearch() {
  searchOverlay.classList.add('hidden');
  searchInput.value = '';
  searchResults.innerHTML = '';
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) {
    searchResults.innerHTML = '';
    return;
  }

  const results = books.filter(b =>
    b.title?.toLowerCase().includes(query) ||
    b.author?.toLowerCase().includes(query)
  );

  searchResults.innerHTML = results.length
    ? results.map(book => bookCard(book)).join('')
    : '<p class="text-gray-500 text-center">No books found</p>';
  lucide.createIcons();
});

// Statistics
statsBtn.addEventListener('click', () => {
  closeMenu();
  showStats();
});

closeStatsBtn.addEventListener('click', () => {
  statsModal.classList.add('hidden');
});

statsModal.addEventListener('click', (e) => {
  if (e.target === statsModal) statsModal.classList.add('hidden');
});

function showStats() {
  const total = books.length;
  const wantToRead = books.filter(b => b.status === 'wantToRead').length;
  const reading = books.filter(b => b.status === 'reading').length;
  const finished = books.filter(b => b.status === 'finished').length;
  const rated = books.filter(b => b.rating).length;
  const avgRating = rated ? (books.reduce((sum, b) => sum + (b.rating || 0), 0) / rated).toFixed(1) : '-';

  statsContent.innerHTML = `
    <div class="flex justify-between py-2 border-b">
      <span class="text-gray-600">Total Books</span>
      <span class="font-medium">${total}</span>
    </div>
    <div class="flex justify-between py-2 border-b">
      <span class="text-gray-600">Want to Read</span>
      <span class="font-medium">${wantToRead}</span>
    </div>
    <div class="flex justify-between py-2 border-b">
      <span class="text-gray-600">Currently Reading</span>
      <span class="font-medium">${reading}</span>
    </div>
    <div class="flex justify-between py-2 border-b">
      <span class="text-gray-600">Finished</span>
      <span class="font-medium">${finished}</span>
    </div>
    <div class="flex justify-between py-2">
      <span class="text-gray-600">Average Rating</span>
      <span class="font-medium">${avgRating}</span>
    </div>
  `;

  statsModal.classList.remove('hidden');
}

// Export
exportBtn.addEventListener('click', () => {
  closeMenu();
  exportBooks();
});

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

// Toast
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}

// Utilities
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
