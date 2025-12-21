// MyBookShelf - Main App

const {
  initializeApp,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} = window.firebaseModules;

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCUXsgRk9htRXIAyvmC4SDfAche_5YQZZ0",
  authDomain: "book-tracker-b786e.firebaseapp.com",
  projectId: "book-tracker-b786e",
  storageBucket: "book-tracker-b786e.firebasestorage.app",
  messagingSenderId: "168297986996",
  appId: "1:168297986996:web:582183909a294db03fd0e1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// App State
let currentUser = null;
let books = [];
let currentFilter = 'all';
let currentRating = 0;
let unsubscribeBooks = null;
let html5QrCode = null;

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showRegisterBtn = document.getElementById('show-register');
const showLoginBtn = document.getElementById('show-login');
const showLoginContainer = document.getElementById('show-login-container');
const authError = document.getElementById('auth-error');
const bookList = document.getElementById('book-list');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const addBookFab = document.getElementById('add-book-fab');
const addBookModal = document.getElementById('add-book-modal');
const closeAddModal = document.getElementById('close-add-modal');
const addBookForm = document.getElementById('add-book-form');
const scanBarcodeBtn = document.getElementById('scan-barcode-btn');
const scannerModal = document.getElementById('scanner-modal');
const closeScanner = document.getElementById('close-scanner');
const scannerContainer = document.getElementById('scanner-container');
const isbnInput = document.getElementById('isbn-input');
const lookupIsbnBtn = document.getElementById('lookup-isbn-btn');
const menuBtn = document.getElementById('menu-btn');
const menuModal = document.getElementById('menu-modal');
const closeMenuBtn = document.getElementById('close-menu');
const logoutBtn = document.getElementById('logout-btn');
const userEmail = document.getElementById('user-email');
const bookDetailModal = document.getElementById('book-detail-modal');
const closeDetailBtn = document.getElementById('close-detail');
const bookDetailContent = document.getElementById('book-detail-content');
const toast = document.getElementById('toast');
const filterChips = document.querySelectorAll('.filter-chip');

// Initialize Lucide Icons
lucide.createIcons();

// Auth State Observer
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    showApp();
    loadBooks();
  } else {
    currentUser = null;
    showAuth();
    if (unsubscribeBooks) {
      unsubscribeBooks();
      unsubscribeBooks = null;
    }
  }
});

// Show/Hide Screens
function showAuth() {
  authScreen.classList.remove('hidden');
  appScreen.classList.add('hidden');
}

function showApp() {
  authScreen.classList.add('hidden');
  appScreen.classList.remove('hidden');
  userEmail.textContent = currentUser.email;
}

// Auth Forms Toggle
showRegisterBtn.addEventListener('click', () => {
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  showRegisterBtn.classList.add('hidden');
  showLoginContainer.classList.remove('hidden');
  authError.classList.add('hidden');
});

showLoginBtn.addEventListener('click', () => {
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  showLoginContainer.classList.add('hidden');
  showRegisterBtn.classList.remove('hidden');
  authError.classList.add('hidden');
});

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showAuthError(getErrorMessage(error.code));
  }
});

// Register
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: name });
  } catch (error) {
    showAuthError(getErrorMessage(error.code));
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  closeModal(menuModal);
  await signOut(auth);
});

function showAuthError(message) {
  authError.textContent = message;
  authError.classList.remove('hidden');
}

function getErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Invalid email address',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/weak-password': 'Password should be at least 6 characters',
    'auth/invalid-credential': 'Invalid email or password'
  };
  return messages[code] || 'An error occurred. Please try again.';
}

// Load Books from Firestore
function loadBooks() {
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  bookList.innerHTML = '';

  const booksRef = collection(db, 'users', currentUser.uid, 'books');
  const q = query(booksRef, orderBy('createdAt', 'desc'));

  unsubscribeBooks = onSnapshot(q, (snapshot) => {
    books = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

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
  const filteredBooks = currentFilter === 'all'
    ? books
    : books.filter(book => book.status === currentFilter);

  if (filteredBooks.length === 0) {
    emptyState.classList.remove('hidden');
    bookList.innerHTML = '';
    return;
  }

  emptyState.classList.add('hidden');
  bookList.innerHTML = filteredBooks.map(book => createBookCard(book)).join('');

  // Reinitialize icons for new elements
  lucide.createIcons();

  // Add click handlers
  document.querySelectorAll('.book-card').forEach(card => {
    card.addEventListener('click', () => {
      const bookId = card.dataset.id;
      const book = books.find(b => b.id === bookId);
      if (book) showBookDetail(book);
    });
  });
}

function createBookCard(book) {
  const statusLabels = {
    wantToRead: 'Want to Read',
    reading: 'Reading',
    finished: 'Finished'
  };

  const coverHtml = book.coverImageUrl
    ? `<img src="${book.coverImageUrl}" alt="${book.title}" class="book-cover" loading="lazy">`
    : `<div class="book-cover-placeholder"><i data-lucide="book"></i></div>`;

  const ratingHtml = book.rating
    ? `<div class="rating-stars">${renderStars(book.rating)}</div>`
    : '';

  return `
    <div class="book-card" data-id="${book.id}">
      ${coverHtml}
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate">${escapeHtml(book.title)}</h3>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(book.author)}</p>
        <div class="flex items-center gap-2 mt-2">
          <span class="status-badge ${book.status}">${statusLabels[book.status] || book.status}</span>
          ${ratingHtml}
        </div>
      </div>
    </div>
  `;
}

function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rating) {
      html += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    } else {
      html += '<svg class="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
    }
  }
  return html;
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

// Add Book Modal
addBookFab.addEventListener('click', () => {
  openModal(addBookModal);
  resetAddBookForm();
});

closeAddModal.addEventListener('click', () => {
  closeModal(addBookModal);
});

addBookModal.addEventListener('click', (e) => {
  if (e.target === addBookModal) closeModal(addBookModal);
});

function resetAddBookForm() {
  addBookForm.reset();
  isbnInput.value = '';
  currentRating = 0;
  updateRatingStars();
}

// Rating Stars
document.querySelectorAll('.star-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    currentRating = parseInt(btn.dataset.rating);
    updateRatingStars();
  });
});

function updateRatingStars() {
  document.querySelectorAll('.star-btn').forEach(btn => {
    const rating = parseInt(btn.dataset.rating);
    if (rating <= currentRating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  lucide.createIcons();
}

// ISBN Lookup
lookupIsbnBtn.addEventListener('click', async () => {
  const isbn = isbnInput.value.trim().replace(/-/g, '');
  if (!isbn) {
    showToast('Please enter an ISBN');
    return;
  }

  lookupIsbnBtn.disabled = true;
  lookupIsbnBtn.textContent = 'Looking up...';

  try {
    const bookData = await lookupISBN(isbn);
    if (bookData) {
      document.getElementById('book-title').value = bookData.title || '';
      document.getElementById('book-author').value = bookData.author || '';
      document.getElementById('book-cover').value = bookData.coverImageUrl || '';
      showToast('Book found!');
    } else {
      showToast('Book not found');
    }
  } catch (error) {
    console.error('ISBN lookup error:', error);
    showToast('Error looking up ISBN');
  } finally {
    lookupIsbnBtn.disabled = false;
    lookupIsbnBtn.textContent = 'Lookup';
  }
});

async function lookupISBN(isbn) {
  // Try Google Books first
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const book = data.items[0].volumeInfo;
      return {
        title: book.title,
        author: book.authors ? book.authors.join(', ') : '',
        coverImageUrl: book.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
        isbn: isbn
      };
    }
  } catch (error) {
    console.error('Google Books API error:', error);
  }

  // Fallback to Open Library
  try {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const data = await response.json();
    const bookData = data[`ISBN:${isbn}`];

    if (bookData) {
      return {
        title: bookData.title,
        author: bookData.authors ? bookData.authors.map(a => a.name).join(', ') : '',
        coverImageUrl: bookData.cover?.medium || '',
        isbn: isbn
      };
    }
  } catch (error) {
    console.error('Open Library API error:', error);
  }

  return null;
}

// Add Book Form Submit
addBookForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('book-title').value.trim();
  const author = document.getElementById('book-author').value.trim();
  const coverImageUrl = document.getElementById('book-cover').value.trim();
  const status = document.getElementById('book-status').value;
  const notes = document.getElementById('book-notes').value.trim();
  const isbn = isbnInput.value.trim().replace(/-/g, '');

  const bookData = {
    title,
    author,
    coverImageUrl,
    status,
    notes,
    isbn,
    rating: currentRating || null,
    genres: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    await addDoc(booksRef, bookData);
    closeModal(addBookModal);
    showToast('Book added!');
  } catch (error) {
    console.error('Error adding book:', error);
    showToast('Error adding book');
  }
});

// Barcode Scanner
scanBarcodeBtn.addEventListener('click', () => {
  closeModal(addBookModal);
  openScanner();
});

closeScanner.addEventListener('click', () => {
  closeScanner_();
});

function openScanner() {
  scannerModal.classList.remove('hidden');

  html5QrCode = new Html5Qrcode("scanner-container");

  html5QrCode.start(
    { facingMode: "environment" },
    {
      fps: 10,
      qrbox: { width: 250, height: 150 },
      aspectRatio: 1.0
    },
    async (decodedText) => {
      // Success - barcode scanned
      closeScanner_();
      isbnInput.value = decodedText;
      openModal(addBookModal);

      // Auto-lookup
      lookupIsbnBtn.click();
    },
    (errorMessage) => {
      // Ignore scan errors (continuous scanning)
    }
  ).catch((err) => {
    console.error('Scanner error:', err);
    closeScanner_();
    showToast('Could not access camera');
    openModal(addBookModal);
  });

  lucide.createIcons();
}

function closeScanner_() {
  scannerModal.classList.add('hidden');
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
}

// Menu Modal
menuBtn.addEventListener('click', () => {
  openModal(menuModal);
});

closeMenuBtn.addEventListener('click', () => {
  closeModal(menuModal);
});

menuModal.addEventListener('click', (e) => {
  if (e.target === menuModal) closeModal(menuModal);
});

// Book Detail Modal
function showBookDetail(book) {
  const statusLabels = {
    wantToRead: 'Want to Read',
    reading: 'Reading',
    finished: 'Finished'
  };

  const coverHtml = book.coverImageUrl
    ? `<img src="${book.coverImageUrl}" alt="${book.title}" class="w-32 h-48 object-cover rounded-lg mx-auto">`
    : `<div class="w-32 h-48 bg-primary rounded-lg flex items-center justify-center mx-auto"><i data-lucide="book" class="w-12 h-12 text-white"></i></div>`;

  bookDetailContent.innerHTML = `
    <div class="text-center mb-6">
      ${coverHtml}
    </div>
    <h3 class="text-xl font-bold text-center">${escapeHtml(book.title)}</h3>
    <p class="text-gray-500 text-center mb-4">${escapeHtml(book.author)}</p>

    <div class="flex justify-center gap-2 mb-4">
      <span class="status-badge ${book.status}">${statusLabels[book.status] || book.status}</span>
      ${book.rating ? `<div class="rating-stars">${renderStars(book.rating)}</div>` : ''}
    </div>

    ${book.notes ? `<div class="bg-gray-50 p-3 rounded-lg mb-4"><p class="text-sm text-gray-600">${escapeHtml(book.notes)}</p></div>` : ''}

    <div class="flex gap-2 mt-6">
      <button onclick="editBook('${book.id}')" class="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50">
        Edit
      </button>
      <button onclick="deleteBook('${book.id}')" class="flex-1 py-2 px-4 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
        Delete
      </button>
    </div>
  `;

  lucide.createIcons();
  openModal(bookDetailModal);
}

closeDetailBtn.addEventListener('click', () => {
  closeModal(bookDetailModal);
});

bookDetailModal.addEventListener('click', (e) => {
  if (e.target === bookDetailModal) closeModal(bookDetailModal);
});

// Edit Book (simplified - opens add modal with data)
window.editBook = async function(bookId) {
  const book = books.find(b => b.id === bookId);
  if (!book) return;

  closeModal(bookDetailModal);
  openModal(addBookModal);

  // Fill form with existing data
  document.getElementById('book-title').value = book.title || '';
  document.getElementById('book-author').value = book.author || '';
  document.getElementById('book-cover').value = book.coverImageUrl || '';
  document.getElementById('book-status').value = book.status || 'wantToRead';
  document.getElementById('book-notes').value = book.notes || '';
  isbnInput.value = book.isbn || '';
  currentRating = book.rating || 0;
  updateRatingStars();

  // Change form to update mode
  const submitBtn = addBookForm.querySelector('button[type="submit"]');
  submitBtn.textContent = 'Update Book';

  // Replace submit handler temporarily
  const originalSubmit = addBookForm.onsubmit;
  addBookForm.onsubmit = async (e) => {
    e.preventDefault();

    const updatedData = {
      title: document.getElementById('book-title').value.trim(),
      author: document.getElementById('book-author').value.trim(),
      coverImageUrl: document.getElementById('book-cover').value.trim(),
      status: document.getElementById('book-status').value,
      notes: document.getElementById('book-notes').value.trim(),
      isbn: isbnInput.value.trim().replace(/-/g, ''),
      rating: currentRating || null,
      updatedAt: serverTimestamp()
    };

    try {
      const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
      await updateDoc(bookRef, updatedData);
      closeModal(addBookModal);
      showToast('Book updated!');
      submitBtn.textContent = 'Add Book';
      addBookForm.onsubmit = null;
    } catch (error) {
      console.error('Error updating book:', error);
      showToast('Error updating book');
    }
  };
};

// Delete Book
window.deleteBook = async function(bookId) {
  if (!confirm('Are you sure you want to delete this book?')) return;

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await deleteDoc(bookRef);
    closeModal(bookDetailModal);
    showToast('Book deleted');
  } catch (error) {
    console.error('Error deleting book:', error);
    showToast('Error deleting book');
  }
};

// Modal Helpers
function openModal(modal) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(modal) {
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// Toast
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

// Utility
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(() => {
        // Service worker registration failed silently
      });
  });
}
