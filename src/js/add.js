// Add Book Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeHtml, escapeAttr, debounce, showToast, initIcons } from './utils.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let currentRating = 0;
let scannerRunning = false;
let formDirty = false;
let fetchedBookData = {};

// DOM Elements
const scanBtn = document.getElementById('scan-btn');
const scannerModal = document.getElementById('scanner-modal');
const closeScannerBtn = document.getElementById('close-scanner');
const scannerContainer = document.getElementById('scanner-container');
const isbnInput = document.getElementById('isbn-input');
const lookupBtn = document.getElementById('lookup-btn');
const lookupStatus = document.getElementById('lookup-status');
const bookSearchInput = document.getElementById('book-search');
const searchResultsDiv = document.getElementById('book-search-results');
const bookForm = document.getElementById('book-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const coverPreview = document.getElementById('cover-preview');
const coverImg = document.getElementById('cover-img');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submit-btn');
const starBtns = document.querySelectorAll('.star-btn');

// Auth Check - header.js handles redirect, just capture user
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
  }
});

// Rating Stars
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentRating = parseInt(btn.dataset.rating);
    updateRatingStars();
    formDirty = true;
  });
});

function updateRatingStars() {
  starBtns.forEach(btn => {
    const rating = parseInt(btn.dataset.rating);
    btn.classList.toggle('active', rating <= currentRating);
  });
  initIcons();
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
      fetchedBookData = {
        publisher: bookData.publisher || '',
        publishedDate: bookData.publishedDate || '',
        physicalFormat: bookData.physicalFormat || ''
      };
      showStatus('Book found!', 'success');
      formDirty = true;
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
        coverImageUrl: book.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
        publisher: book.publisher || '',
        publishedDate: book.publishedDate || '',
        physicalFormat: ''
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
        coverImageUrl: book.cover?.medium || '',
        publisher: book.publishers?.[0]?.name || '',
        publishedDate: book.publish_date || '',
        physicalFormat: book.physical_format || ''
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

// Book Search by Title/Author
async function searchBooks(query) {
  if (!query || query.length < 2) {
    searchResultsDiv.classList.add('hidden');
    searchResultsDiv.innerHTML = '';
    return;
  }

  searchResultsDiv.innerHTML = '<p class="text-sm text-gray-500">Searching...</p>';
  searchResultsDiv.classList.remove('hidden');

  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`);
    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      searchResultsDiv.innerHTML = '<p class="text-sm text-gray-500">No books found</p>';
      return;
    }

    searchResultsDiv.innerHTML = data.items.map(item => {
      const book = item.volumeInfo;
      const cover = book.imageLinks?.thumbnail?.replace('http:', 'https:') || '';
      const title = book.title || 'Unknown Title';
      const author = book.authors?.join(', ') || 'Unknown Author';
      const publisher = book.publisher || '';
      const publishedDate = book.publishedDate || '';
      const pageCount = book.pageCount || '';

      return `
        <div class="search-result flex gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-100"
             data-title="${escapeAttr(title)}"
             data-author="${escapeAttr(author)}"
             data-cover="${escapeAttr(cover)}"
             data-publisher="${escapeAttr(publisher)}"
             data-published="${escapeAttr(publishedDate)}"
             data-isbn="${escapeAttr(book.industryIdentifiers?.[0]?.identifier || '')}">
          ${cover
            ? `<img src="${cover}" alt="" class="w-12 h-18 object-cover rounded flex-shrink-0">`
            : `<div class="w-12 h-18 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center"><i data-lucide="book" class="w-6 h-6 text-gray-400"></i></div>`
          }
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 truncate">${escapeHtml(title)}</p>
            <p class="text-sm text-gray-500 truncate">${escapeHtml(author)}</p>
            <p class="text-xs text-gray-400 truncate">
              ${[publisher, publishedDate, pageCount ? `${pageCount} pages` : ''].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      `;
    }).join('');

    initIcons();

    // Use event delegation for search results
    searchResultsDiv.onclick = (e) => {
      const result = e.target.closest('.search-result');
      if (result) selectSearchResult(result);
    };

  } catch (error) {
    console.error('Search error:', error);
    searchResultsDiv.innerHTML = '<p class="text-sm text-red-500">Search failed</p>';
  }
}

function selectSearchResult(el) {
  const { title, author, cover, publisher, published, isbn } = el.dataset;

  titleInput.value = title;
  authorInput.value = author;
  if (cover) {
    coverUrlInput.value = cover;
    coverImg.src = cover;
    coverPreview.classList.remove('hidden');
  }
  if (isbn) {
    isbnInput.value = isbn;
  }

  fetchedBookData = {
    publisher: publisher || '',
    publishedDate: published || '',
    physicalFormat: ''
  };

  bookSearchInput.value = '';
  searchResultsDiv.classList.add('hidden');
  searchResultsDiv.innerHTML = '';

  showToast('Book selected!', { type: 'success' });
  formDirty = true;
}

// Debounced search
const debouncedSearch = debounce(searchBooks, 300);
bookSearchInput.addEventListener('input', () => {
  debouncedSearch(bookSearchInput.value.trim());
});

// Barcode Scanner using Quagga2 - optimized for iOS
scanBtn.addEventListener('click', openScanner);
closeScannerBtn.addEventListener('click', closeScanner);

async function openScanner() {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('Camera requires HTTPS. Use the deployed site.', { type: 'error' });
    return;
  }

  scannerModal.classList.remove('hidden');
  initIcons();

  try {
    console.log('Requesting camera permission...');
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    console.log('Camera permission granted');
    stream.getTracks().forEach(track => track.stop());
    await startQuagga();
  } catch (err) {
    console.error('Scanner error:', err);
    closeScanner();

    const errorMessages = {
      NotAllowedError: 'Camera permission denied. Allow camera access.',
      NotFoundError: 'No camera found.',
      NotReadableError: 'Camera in use by another app.'
    };
    showToast(errorMessages[err.name] || `Scanner error: ${err.message || err}`, { type: 'error' });
  }
}

function startQuagga() {
  return new Promise((resolve, reject) => {
    Quagga.init({
      inputStream: {
        name: 'Live',
        type: 'LiveStream',
        target: scannerContainer,
        constraints: { facingMode: 'environment' }
      },
      locator: { patchSize: 'medium', halfSample: true },
      numOfWorkers: 0,
      frequency: 10,
      decoder: {
        readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader']
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
      if (!result?.codeResult?.code) return;

      const errors = result.codeResult.decodedCodes
        .filter(x => x.error !== undefined)
        .map(x => x.error);
      const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;

      if (avgError > 0.1) {
        console.log('Low confidence scan rejected:', result.codeResult.code, 'error:', avgError);
        return;
      }

      const code = result.codeResult.code;
      if (!/^\d{10,13}$/.test(code)) {
        console.log('Invalid ISBN format rejected:', code);
        return;
      }

      if (navigator.vibrate) navigator.vibrate(100);

      closeScanner();
      isbnInput.value = code;
      showToast('Scanned: ' + code, { type: 'success' });
      lookupISBN();
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
    showToast('Please sign in first', { type: 'error' });
    return;
  }

  const title = titleInput.value.trim();
  const author = authorInput.value.trim();

  if (!title || !author) {
    showToast('Title and author are required', { type: 'error' });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Adding...';

  const bookData = {
    title,
    author,
    coverImageUrl: coverUrlInput.value.trim(),
    rating: currentRating || null,
    notes: notesInput.value.trim(),
    isbn: isbnInput.value.trim().replace(/-/g, ''),
    genres: [],
    publisher: fetchedBookData.publisher || '',
    publishedDate: fetchedBookData.publishedDate || '',
    physicalFormat: fetchedBookData.physicalFormat || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    await addDoc(booksRef, bookData);
    formDirty = false;
    showToast('Book added!', { type: 'success' });
    setTimeout(() => {
      window.location.href = '/books/';
    }, 1000);
  } catch (error) {
    console.error('Error adding book:', error);
    showToast('Error adding book', { type: 'error' });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Add Book';
  }
});

// Track unsaved changes
document.querySelectorAll('#book-form input, #book-form textarea, #book-form select')
  .forEach(el => el.addEventListener('input', () => formDirty = true));

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (formDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
