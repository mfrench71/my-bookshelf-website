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
let scannerRunning = false;

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

// Barcode Scanner using Quagga2 - optimized for iOS
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
    // Request camera permission explicitly first
    console.log('Requesting camera permission...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    console.log('Camera permission granted');

    // Stop the stream - Quagga will create its own
    stream.getTracks().forEach(track => track.stop());

    await startQuagga();
  } catch (err) {
    console.error('Scanner error:', err);
    closeScanner();

    if (err.name === 'NotAllowedError') {
      showToast('Camera permission denied. Allow camera access.');
    } else if (err.name === 'NotFoundError') {
      showToast('No camera found.');
    } else if (err.name === 'NotReadableError') {
      showToast('Camera in use by another app.');
    } else {
      showToast('Scanner error: ' + (err.message || err));
    }
  }
}

function startQuagga() {
  return new Promise((resolve, reject) => {
    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: scannerContainer,
        constraints: {
          facingMode: 'environment'
        }
      },
      locator: {
        patchSize: 'medium',
        halfSample: true
      },
      numOfWorkers: 0, // Disable workers for iOS compatibility
      frequency: 10,
      decoder: {
        readers: [
          'ean_reader',
          'ean_8_reader',
          'upc_reader',
          'upc_e_reader'
        ]
      },
      locate: true
    }, function(err) {
      if (err) {
        reject(err);
        return;
      }

      Quagga.start();
      scannerRunning = true;
      resolve();
    });

    Quagga.onDetected(function(result) {
      if (result && result.codeResult && result.codeResult.code) {
        // Check confidence - only accept high-confidence scans
        const errors = result.codeResult.decodedCodes
          .filter(x => x.error !== undefined)
          .map(x => x.error);
        const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;

        // Reject low-confidence reads (high error = bad read)
        if (avgError > 0.1) {
          console.log('Low confidence scan rejected:', result.codeResult.code, 'error:', avgError);
          return;
        }

        const code = result.codeResult.code;

        // Validate ISBN format (10 or 13 digits, or UPC 12 digits)
        if (!/^\d{10,13}$/.test(code)) {
          console.log('Invalid ISBN format rejected:', code);
          return;
        }

        // Vibrate on detection
        if (navigator.vibrate) navigator.vibrate(100);

        closeScanner();
        isbnInput.value = code;
        showToast('Scanned: ' + code);
        lookupISBN();
      }
    });
  });
}

function closeScanner() {
  scannerModal.classList.add('hidden');

  if (scannerRunning) {
    try {
      Quagga.stop();
      Quagga.offDetected();
    } catch (e) {
      // Ignore stop errors
    }
    scannerRunning = false;
  }

  scannerContainer.innerHTML = '';
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
