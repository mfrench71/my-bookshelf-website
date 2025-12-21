// Add Book Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeHtml, escapeAttr, debounce, showToast, initIcons, clearBooksCache, updateRatingStars as updateStars, normalizeText, normalizeTitle, normalizeAuthor, normalizePublisher, normalizePublishedDate, isOnline, lockBodyScroll, unlockBodyScroll, lookupISBN, searchBooks as searchBooksAPI } from './utils.js';
import { GenrePicker } from './genre-picker.js';
import { updateGenreBookCounts, clearGenresCache } from './genres.js';

// Initialize icons once on load
initIcons();

// Max books to check for title/author duplicates (prevents excessive reads on large libraries)
const DUPLICATE_CHECK_LIMIT = 500;

/**
 * Check if a book with the same ISBN or title/author already exists
 * @param {string} userId - The user's ID
 * @param {string} isbn - ISBN to check (optional)
 * @param {string} title - Title to check
 * @param {string} author - Author to check
 * @returns {Promise<{isDuplicate: boolean, matchType: string, existingBook: Object|null}>}
 */
async function checkForDuplicate(userId, isbn, title, author) {
  const booksRef = collection(db, 'users', userId, 'books');

  // Check by ISBN first (most reliable - uses indexed query)
  if (isbn) {
    const isbnQuery = query(booksRef, where('isbn', '==', isbn), limit(1));
    const isbnSnapshot = await getDocs(isbnQuery);
    if (!isbnSnapshot.empty) {
      const existingBook = { id: isbnSnapshot.docs[0].id, ...isbnSnapshot.docs[0].data() };
      return { isDuplicate: true, matchType: 'isbn', existingBook };
    }
  }

  // Check by normalized title + author (limited to prevent excessive reads)
  const normalizedTitle = normalizeText(title);
  const normalizedAuthor = normalizeText(author);

  // Fetch limited books and check client-side (Firestore doesn't support case-insensitive queries)
  const limitedQuery = query(booksRef, limit(DUPLICATE_CHECK_LIMIT));
  const booksSnapshot = await getDocs(limitedQuery);
  for (const doc of booksSnapshot.docs) {
    const bookData = doc.data();
    const bookNormalizedTitle = normalizeText(bookData.title || '');
    const bookNormalizedAuthor = normalizeText(bookData.author || '');

    if (bookNormalizedTitle === normalizedTitle && bookNormalizedAuthor === normalizedAuthor) {
      return { isDuplicate: true, matchType: 'title-author', existingBook: { id: doc.id, ...bookData } };
    }
  }

  return { isDuplicate: false, matchType: null, existingBook: null };
}

// State
let currentUser = null;
let currentRating = 0;
let scannerRunning = false;
let formDirty = false;
let fetchedBookData = {};
let genrePicker = null;
let apiGenreSuggestions = [];
let duplicateCheckBypassed = false; // Track if user confirmed adding duplicate

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
const clearSearchBtn = document.getElementById('clear-search');
const bookForm = document.getElementById('book-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const coverPreview = document.getElementById('cover-preview');
const coverImg = document.getElementById('cover-img');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submit-btn');
const starBtns = document.querySelectorAll('.star-btn');
const genrePickerContainer = document.getElementById('genre-picker-container');

// Auth Check - header.js handles redirect, just capture user
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    initGenrePicker();
  }
});

// Initialize Genre Picker
async function initGenrePicker() {
  if (genrePicker) return;

  genrePicker = new GenrePicker({
    container: genrePickerContainer,
    userId: currentUser.uid,
    onChange: () => {
      formDirty = true;
    }
  });

  await genrePicker.init();
}

// Update genre suggestions from API responses
function updateGenreSuggestions(genres) {
  if (!genres || !genres.length) return;

  // Add new suggestions, avoiding duplicates
  genres.forEach(genre => {
    if (!apiGenreSuggestions.includes(genre)) {
      apiGenreSuggestions.push(genre);
    }
  });

  // Update picker with suggestions
  if (genrePicker) {
    genrePicker.setSuggestions(apiGenreSuggestions);
  }
}

// Rating Stars
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const clickedRating = parseInt(btn.dataset.rating);
    // Toggle off if clicking the same rating (allows clearing)
    currentRating = currentRating === clickedRating ? 0 : clickedRating;
    updateRatingStars();
    formDirty = true;
  });
});

function updateRatingStars() {
  updateStars(starBtns, currentRating);
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
  const result = await lookupISBN(isbn);
  if (result && result.genres) {
    updateGenreSuggestions(result.genres);
  }
  return result;
}

function showStatus(message, type) {
  lookupStatus.textContent = message;
  lookupStatus.classList.remove('hidden', 'text-gray-500', 'text-green-600', 'text-red-600');
  lookupStatus.classList.add(
    type === 'success' ? 'text-green-600' :
    type === 'error' ? 'text-red-600' : 'text-gray-500'
  );
}

// Book Search State
let searchState = {
  query: '',
  startIndex: 0,
  useOpenLibrary: false,
  hasMore: true,
  loading: false,
  totalItems: 0
};
const SEARCH_PAGE_SIZE = 10;

// Intersection Observer for lazy loading search results
let searchScrollObserver = null;

function setupSearchScrollObserver() {
  if (searchScrollObserver) searchScrollObserver.disconnect();

  searchScrollObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !searchState.loading && searchState.hasMore) {
      loadMoreSearchResults();
    }
  }, { root: searchResultsDiv, rootMargin: '50px' });
}

setupSearchScrollObserver();

// Book Search by Title/Author - tries Google Books, falls back to Open Library
async function searchBooks(query) {
  if (!query || query.length < 2) {
    searchResultsDiv.classList.add('hidden');
    searchResultsDiv.innerHTML = '';
    return;
  }

  // Reset search state for new query
  searchState = {
    query,
    startIndex: 0,
    useOpenLibrary: false,
    hasMore: true,
    loading: true,
    totalItems: 0
  };

  // Clear accumulated genre suggestions from previous searches
  apiGenreSuggestions = [];

  searchResultsDiv.innerHTML = '<p class="text-sm text-gray-500">Searching...</p>';
  searchResultsDiv.classList.remove('hidden');

  const result = await fetchSearchResults();

  if (!result.books.length) {
    searchResultsDiv.innerHTML = '<p class="text-sm text-gray-500">No books found</p>';
    return;
  }

  renderSearchResults(result.books, false);
  searchState.startIndex = SEARCH_PAGE_SIZE;
  searchState.hasMore = result.hasMore;
  searchState.loading = false;
}

async function fetchSearchResults() {
  const { query, startIndex, useOpenLibrary } = searchState;

  const result = await searchBooksAPI(query, {
    startIndex,
    maxResults: SEARCH_PAGE_SIZE,
    useOpenLibrary
  });

  // Update search state with API results
  searchState.totalItems = result.totalItems;
  searchState.useOpenLibrary = result.useOpenLibrary;

  return { books: result.books, hasMore: result.hasMore };
}

async function loadMoreSearchResults() {
  if (searchState.loading || !searchState.hasMore) return;

  searchState.loading = true;

  // Add loading indicator
  const sentinel = searchResultsDiv.querySelector('#search-sentinel');
  if (sentinel) {
    sentinel.innerHTML = '<div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>';
  }

  const result = await fetchSearchResults();

  if (result.books.length > 0) {
    renderSearchResults(result.books, true);
    searchState.startIndex += result.books.length;
  }

  searchState.hasMore = result.hasMore;
  searchState.loading = false;
}

function renderSearchResults(books, append = false) {
  const html = books.map(book => `
    <div class="search-result flex gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-100"
         data-title="${escapeAttr(book.title)}"
         data-author="${escapeAttr(book.author)}"
         data-cover="${escapeAttr(book.cover)}"
         data-publisher="${escapeAttr(book.publisher)}"
         data-published="${escapeAttr(book.publishedDate)}"
         data-isbn="${escapeAttr(book.isbn)}"
         data-categories="${escapeAttr(JSON.stringify(book.categories || []))}">
      ${book.cover
        ? `<img src="${book.cover}" alt="" class="w-12 h-18 object-cover rounded flex-shrink-0">`
        : `<div class="w-12 h-18 bg-gray-200 rounded flex-shrink-0 flex items-center justify-center"><i data-lucide="book" class="w-6 h-6 text-gray-400"></i></div>`
      }
      <div class="flex-1 min-w-0">
        <p class="font-medium text-gray-900 truncate">${escapeHtml(book.title)}</p>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(book.author)}</p>
        <p class="text-xs text-gray-400 truncate">
          ${[book.publisher, book.publishedDate, book.pageCount ? `${book.pageCount} pages` : ''].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  `).join('');

  // Remove old sentinel if appending
  if (append) {
    const oldSentinel = searchResultsDiv.querySelector('#search-sentinel');
    if (oldSentinel) oldSentinel.remove();
  }

  if (append) {
    searchResultsDiv.insertAdjacentHTML('beforeend', html);
  } else {
    searchResultsDiv.innerHTML = html;

    // Set up click delegation once
    searchResultsDiv.onclick = (e) => {
      const result = e.target.closest('.search-result');
      if (result) selectSearchResult(result);
    };
  }

  // Add sentinel for infinite scroll if there are more results
  if (searchState.hasMore) {
    searchResultsDiv.insertAdjacentHTML('beforeend', `
      <div id="search-sentinel" class="py-3 text-center text-xs text-gray-400">
        Scroll for more...
      </div>
    `);
    const sentinel = searchResultsDiv.querySelector('#search-sentinel');
    if (sentinel) searchScrollObserver.observe(sentinel);
  }

  initIcons();
}

async function selectSearchResult(el) {
  const { title, author, cover, publisher, published, isbn, categories } = el.dataset;

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

  // Extract and suggest genres from categories
  if (categories) {
    try {
      const categoryList = JSON.parse(categories);
      if (categoryList.length > 0) {
        updateGenreSuggestions(categoryList);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  fetchedBookData = {
    publisher: publisher || '',
    publishedDate: published || '',
    physicalFormat: ''
  };

  // Supplement missing data from Open Library if we have an ISBN
  if (isbn) {
    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const data = await response.json();
      const book = data[`ISBN:${isbn}`];
      if (book) {
        // Supplement missing fields
        if (!fetchedBookData.publisher) fetchedBookData.publisher = book.publishers?.[0]?.name || '';
        if (!fetchedBookData.publishedDate) fetchedBookData.publishedDate = book.publish_date || '';
        if (!fetchedBookData.physicalFormat) fetchedBookData.physicalFormat = book.physical_format || '';
        if (!coverUrlInput.value && book.cover?.medium) {
          coverUrlInput.value = book.cover.medium;
          coverImg.src = book.cover.medium;
          coverPreview.classList.remove('hidden');
        }
        // Add Open Library genres/subjects to suggestions
        const genres = book.subjects?.map(s => s.name || s).slice(0, 5) || [];
        updateGenreSuggestions(genres);
      }
    } catch (e) {
      console.error('Open Library supplement error:', e);
    }
  }

  bookSearchInput.value = '';
  searchResultsDiv.classList.add('hidden');
  searchResultsDiv.innerHTML = '';

  showToast('Book selected!', { type: 'success' });
  formDirty = true;
}

// Debounced search with error handling
const debouncedSearch = debounce(async (query) => {
  try {
    await searchBooks(query);
  } catch (error) {
    console.error('Search error:', error);
    searchResultsDiv.innerHTML = '<p class="text-sm text-red-500">Search failed. Please try again.</p>';
  }
}, 300);
bookSearchInput.addEventListener('input', () => {
  const query = bookSearchInput.value.trim();
  debouncedSearch(query);
  // Show/hide clear button
  clearSearchBtn.classList.toggle('hidden', !query);
});

// Clear search button
clearSearchBtn.addEventListener('click', () => {
  bookSearchInput.value = '';
  searchResultsDiv.classList.add('hidden');
  searchResultsDiv.innerHTML = '';
  clearSearchBtn.classList.add('hidden');
  // Reset search state
  searchState = {
    query: '',
    startIndex: 0,
    useOpenLibrary: false,
    hasMore: true,
    loading: false,
    totalItems: 0
  };
  bookSearchInput.focus();
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
  lockBodyScroll();
  initIcons();

  try {
    // Add 10s timeout for camera access to prevent indefinite waiting
    const cameraPromise = navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Camera access timed out')), 10000)
    );
    const stream = await Promise.race([cameraPromise, timeoutPromise]);
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

      // Reject scans with high error rate (lower is better, 0.1 is acceptable threshold)
      if (avgError >= 0.1) {
        return;
      }

      const code = result.codeResult.code;
      if (!/^\d{10,13}$/.test(code)) {
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
  unlockBodyScroll();

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

  // Check for offline before attempting Firebase operation
  if (!isOnline()) {
    showToast('You are offline. Please check your connection.', { type: 'error' });
    return;
  }

  if (!currentUser) {
    showToast('Please sign in first', { type: 'error' });
    return;
  }

  const title = titleInput.value.trim();
  const author = authorInput.value.trim();
  const isbn = isbnInput.value.trim().replace(/-/g, '');

  if (!title || !author) {
    showToast('Title and author are required', { type: 'error' });
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Checking...';

  // Check for duplicates (unless already bypassed)
  if (!duplicateCheckBypassed) {
    try {
      const { isDuplicate, matchType, existingBook } = await checkForDuplicate(
        currentUser.uid, isbn, title, author
      );

      if (isDuplicate) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add Anyway';
        duplicateCheckBypassed = true;

        const matchDesc = matchType === 'isbn'
          ? `A book with ISBN "${isbn}" already exists`
          : `"${existingBook.title}" by ${existingBook.author} already exists`;

        showToast(`${matchDesc}. Click "Add Anyway" to add duplicate.`, { type: 'error', duration: 5000 });
        return;
      }
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      // Continue with add if duplicate check fails
    }
  }

  submitBtn.textContent = 'Adding...';

  // Get selected genres from picker
  const selectedGenres = genrePicker ? genrePicker.getSelected() : [];

  const bookData = {
    title,
    author,
    coverImageUrl: coverUrlInput.value.trim(),
    rating: currentRating || null,
    notes: notesInput.value.trim(),
    isbn,
    genres: selectedGenres,
    publisher: fetchedBookData.publisher || '',
    publishedDate: fetchedBookData.publishedDate || '',
    physicalFormat: fetchedBookData.physicalFormat || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    await addDoc(booksRef, bookData);

    // Update genre book counts
    if (selectedGenres.length > 0) {
      await updateGenreBookCounts(currentUser.uid, selectedGenres, []);
    }

    formDirty = false;
    duplicateCheckBypassed = false;

    // Clear caches so the new book appears on the list page
    clearBooksCache(currentUser.uid);
    clearGenresCache();

    showToast('Book added!', { type: 'success' });
    setTimeout(() => {
      window.location.href = '/books/';
    }, 1000);
  } catch (error) {
    console.error('Error adding book:', error);
    showToast('Error adding book', { type: 'error' });
    submitBtn.disabled = false;
    submitBtn.textContent = duplicateCheckBypassed ? 'Add Anyway' : 'Add Book';
  }
});

// Track unsaved changes and reset duplicate bypass when form changes
document.querySelectorAll('#book-form input, #book-form textarea, #book-form select')
  .forEach(el => el.addEventListener('input', () => {
    formDirty = true;
    // Reset duplicate bypass if user changes title, author, or ISBN
    if (['title', 'author', 'isbn-input'].includes(el.id)) {
      if (duplicateCheckBypassed) {
        duplicateCheckBypassed = false;
        submitBtn.textContent = 'Add Book';
      }
    }
  }));

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (formDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});
