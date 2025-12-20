// Add Book Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize icons
lucide.createIcons();

// State
let currentUser = null;
let currentRating = 0;
let html5QrCode = null;

// DOM Elements
const scanBtn = document.getElementById('scan-btn');
const scannerModal = document.getElementById('scanner-modal');
const closeScannerBtn = document.getElementById('close-scanner');
const scannerContainer = document.getElementById('scanner-container');
const isbnInput = document.getElementById('isbn-input');
const lookupBtn = document.getElementById('lookup-btn');
const lookupStatus = document.getElementById('lookup-status');
const bookForm = document.getElementById('book-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const coverPreview = document.getElementById('cover-preview');
const coverImg = document.getElementById('cover-img');
const statusSelect = document.getElementById('status');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submit-btn');
const starBtns = document.querySelectorAll('.star-btn');
const toast = document.getElementById('toast');

// Auth Check
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  } else {
    window.location.href = '/';
  }
});

// Rating Stars
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentRating = parseInt(btn.dataset.rating);
    updateRatingStars();
  });
});

function updateRatingStars() {
  starBtns.forEach(btn => {
    const rating = parseInt(btn.dataset.rating);
    if (rating <= currentRating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  lucide.createIcons();
}

// Cover Preview
coverUrlInput.addEventListener('input', () => {
  const url = coverUrlInput.value.trim();
  if (url) {
    coverImg.src = url;
    coverPreview.classList.remove('hidden');
    coverImg.onerror = () => coverPreview.classList.add('hidden');
  } else {
    coverPreview.classList.add('hidden');
  }
});

// ISBN Lookup
lookupBtn.addEventListener('click', lookupISBN);
isbnInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    lookupISBN();
  }
});

async function lookupISBN() {
  const isbn = isbnInput.value.trim().replace(/-/g, '');
  if (!isbn) {
    showStatus('Please enter an ISBN', 'error');
    return;
  }

  lookupBtn.disabled = true;
  lookupBtn.textContent = 'Looking up...';
  showStatus('Searching...', 'info');

  try {
    const bookData = await fetchBookByISBN(isbn);
    if (bookData) {
      titleInput.value = bookData.title || '';
      authorInput.value = bookData.author || '';
      if (bookData.coverImageUrl) {
        coverUrlInput.value = bookData.coverImageUrl;
        coverImg.src = bookData.coverImageUrl;
        coverPreview.classList.remove('hidden');
      }
      showStatus('Book found!', 'success');
    } else {
      showStatus('Book not found. Try entering details manually.', 'error');
    }
  } catch (error) {
    console.error('Lookup error:', error);
    showStatus('Error looking up ISBN', 'error');
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = 'Lookup';
  }
}

async function fetchBookByISBN(isbn) {
  // Try Google Books first
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await response.json();

    if (data.items?.length > 0) {
      const book = data.items[0].volumeInfo;
      return {
        title: book.title,
        author: book.authors?.join(', ') || '',
        coverImageUrl: book.imageLinks?.thumbnail?.replace('http:', 'https:') || ''
      };
    }
  } catch (e) {
    console.error('Google Books error:', e);
  }

  // Fallback to Open Library
  try {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const data = await response.json();
    const book = data[`ISBN:${isbn}`];

    if (book) {
      return {
        title: book.title,
        author: book.authors?.map(a => a.name).join(', ') || '',
        coverImageUrl: book.cover?.medium || ''
      };
    }
  } catch (e) {
    console.error('Open Library error:', e);
  }

  return null;
}

function showStatus(message, type) {
  lookupStatus.textContent = message;
  lookupStatus.classList.remove('hidden', 'text-gray-500', 'text-green-600', 'text-red-600');
  lookupStatus.classList.add(
    type === 'success' ? 'text-green-600' :
    type === 'error' ? 'text-red-600' : 'text-gray-500'
  );
}

// Barcode Scanner
scanBtn.addEventListener('click', openScanner);
closeScannerBtn.addEventListener('click', closeScanner);

async function openScanner() {
  // Check if HTTPS (required for camera)
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('Camera requires HTTPS. Use the deployed site.');
    return;
  }

  scannerModal.classList.remove('hidden');
  lucide.createIcons();

  try {
    html5QrCode = new Html5Qrcode("scanner-container");

    await html5QrCode.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0,
        formatsToSupport: [ Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8 ]
      },
      (decodedText) => {
        // Success
        closeScanner();
        isbnInput.value = decodedText;
        lookupISBN();
      },
      () => {
        // Ignore scan errors (continuous scanning)
      }
    );
  } catch (err) {
    console.error('Scanner error:', err);
    closeScanner();

    if (err.toString().includes('NotAllowedError')) {
      showToast('Camera permission denied. Allow camera access and try again.');
    } else if (err.toString().includes('NotFoundError')) {
      showToast('No camera found on this device.');
    } else {
      showToast('Could not start camera: ' + err.message);
    }
  }
}

function closeScanner() {
  scannerModal.classList.add('hidden');
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
}

// Form Submit
bookForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showToast('Please sign in first');
    return;
  }

  const title = titleInput.value.trim();
  const author = authorInput.value.trim();

  if (!title || !author) {
    showToast('Title and author are required');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding...';

  const bookData = {
    title,
    author,
    coverImageUrl: coverUrlInput.value.trim(),
    status: statusSelect.value,
    rating: currentRating || null,
    notes: notesInput.value.trim(),
    isbn: isbnInput.value.trim().replace(/-/g, ''),
    genres: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    await addDoc(booksRef, bookData);
    showToast('Book added!');
    setTimeout(() => {
      window.location.href = '/books.html';
    }, 1000);
  } catch (error) {
    console.error('Error adding book:', error);
    showToast('Error adding book');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Book';
  }
});

// Toast
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}
