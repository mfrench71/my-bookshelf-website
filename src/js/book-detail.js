// Book Detail Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { parseTimestamp, formatDate, showToast, initIcons, clearBooksCache, updateRatingStars as updateStars, normalizeTitle, normalizeAuthor, normalizePublisher, normalizePublishedDate, lockBodyScroll, unlockBodyScroll, lookupISBN, fetchWithTimeout, migrateBookReads, getCurrentRead, getBookStatus } from './utils.js';
import { GenrePicker } from './genre-picker.js';
import { updateGenreBookCounts, clearGenresCache } from './genres.js';

// Initialize icons once on load
initIcons();

// Back button - smart navigation
const backBtn = document.getElementById('back-btn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    if (history.length > 1) {
      history.back();
    } else {
      window.location.href = '/books/';
    }
  });
}

// State
let currentUser = null;
let bookId = null;
let book = null;
let currentRating = 0;
let genrePicker = null;
let originalGenres = [];
let originalValues = {};
let formDirty = false;
let currentReads = []; // Array of {startedAt, finishedAt} objects

// Get book ID from URL
const urlParams = new URLSearchParams(window.location.search);
bookId = urlParams.get('id');

if (!bookId) {
  window.location.href = '/books/';
}

// DOM Elements
const loading = document.getElementById('loading');
const content = document.getElementById('content');
const coverContainer = document.getElementById('cover-container');
const bookTitle = document.getElementById('book-title');
const bookAuthor = document.getElementById('book-author');
const bookIsbn = document.getElementById('book-isbn');
const bookPages = document.getElementById('book-pages');
const bookDates = document.getElementById('book-dates');
const editForm = document.getElementById('edit-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const publisherInput = document.getElementById('publisher');
const publishedDateInput = document.getElementById('published-date');
const physicalFormatInput = document.getElementById('physical-format');
const pageCountInput = document.getElementById('page-count');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const refreshDataBtn = document.getElementById('refresh-data-btn');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const starBtns = document.querySelectorAll('.star-btn');
const genrePickerContainer = document.getElementById('genre-picker-container');

// Reading Dates Elements
const startedDateInput = document.getElementById('started-date');
const finishedDateInput = document.getElementById('finished-date');
const readingDateError = document.getElementById('reading-date-error');
const rereadBtn = document.getElementById('reread-btn');
const readingStatusBadge = document.getElementById('reading-status-badge');
const readHistorySection = document.getElementById('read-history-section');
const toggleHistoryBtn = document.getElementById('toggle-history');
const historyChevron = document.getElementById('history-chevron');
const historyCount = document.getElementById('history-count');
const readHistoryList = document.getElementById('read-history-list');

// Auth Check - header.js handles redirect, just load book
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadBook();
  }
});

// Initialize Genre Picker
async function initGenrePicker() {
  if (genrePicker) return;

  genrePicker = new GenrePicker({
    container: genrePickerContainer,
    userId: currentUser.uid,
    onChange: () => {
      updateSaveButtonState();
    }
  });

  await genrePicker.init();

  // Set the book's existing genres
  if (book && book.genres) {
    originalGenres = [...book.genres];
    genrePicker.setSelected(book.genres);
  }

  // Fetch genre suggestions from API if book has ISBN
  if (book && book.isbn) {
    fetchGenreSuggestions(book.isbn);
  }
}

// Fetch genre suggestions from Google Books API
async function fetchGenreSuggestions(isbn) {
  try {
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
      {},
      5000 // 5 second timeout for suggestions (non-critical)
    );
    if (!response.ok) return;

    const data = await response.json();

    if (data.items?.length > 0) {
      const categories = data.items[0].volumeInfo.categories || [];
      if (categories.length > 0 && genrePicker) {
        genrePicker.setSuggestions(categories);
      }
    }
  } catch (e) {
    // Non-critical - log but don't show error to user
    console.warn('Genre suggestions unavailable:', e.message);
  }
}

// Load Book
async function loadBook() {
  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    const bookSnap = await getDoc(bookRef);

    if (!bookSnap.exists()) {
      showToast('Book not found', { type: 'error' });
      setTimeout(() => window.location.href = '/books/', 1500);
      return;
    }

    book = { id: bookSnap.id, ...bookSnap.data() };
    renderBook();
  } catch (error) {
    console.error('Error loading book:', error);
    showToast('Error loading book', { type: 'error' });
  }
}

function renderBook() {
  // Cover - use createElement to prevent XSS
  const fallbackHtml = `
    <div class="w-40 h-60 bg-primary rounded-xl shadow-lg flex items-center justify-center">
      <i data-lucide="book" class="w-16 h-16 text-white"></i>
    </div>
  `;

  if (book.coverImageUrl) {
    // Create wrapper with fallback behind image - explicit dimensions prevent collapse
    coverContainer.innerHTML = fallbackHtml;
    coverContainer.firstElementChild.classList.add('absolute', 'inset-0');
    coverContainer.classList.add('relative', 'w-40', 'h-60');

    const img = document.createElement('img');
    img.src = book.coverImageUrl;
    img.alt = '';
    img.className = 'w-40 h-60 object-cover rounded-xl shadow-lg absolute inset-0';
    img.onerror = () => { img.style.display = 'none'; };
    coverContainer.appendChild(img);
  } else {
    coverContainer.innerHTML = fallbackHtml;
  }

  // Info
  bookTitle.textContent = book.title;
  bookAuthor.textContent = book.author || 'Unknown author';
  bookIsbn.textContent = book.isbn ? `ISBN: ${book.isbn}` : '';
  bookPages.textContent = book.pageCount ? `${book.pageCount} pages` : '';

  // Dates
  const dateAdded = parseTimestamp(book.createdAt);
  const dateModified = parseTimestamp(book.updatedAt);
  const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };

  let datesHtml = '';
  if (dateAdded) {
    datesHtml += `<div>Added ${dateAdded.toLocaleDateString(undefined, dateOptions)}</div>`;
  }
  if (dateModified && dateModified.getTime() !== dateAdded?.getTime()) {
    datesHtml += `<div>Modified ${dateModified.toLocaleDateString(undefined, dateOptions)}</div>`;
  }
  bookDates.innerHTML = datesHtml;

  // Form
  titleInput.value = book.title || '';
  authorInput.value = book.author || '';
  coverUrlInput.value = book.coverImageUrl || '';
  publisherInput.value = book.publisher || '';
  publishedDateInput.value = book.publishedDate || '';
  physicalFormatInput.value = book.physicalFormat || '';
  pageCountInput.value = book.pageCount || '';
  notesInput.value = book.notes || '';
  currentRating = book.rating || 0;
  updateRatingStars();

  // Migrate old format to reads array if needed
  const migratedBook = migrateBookReads(book);
  currentReads = migratedBook.reads ? [...migratedBook.reads.map(r => ({...r}))] : [];

  // Populate reading dates from current read (last in array)
  updateReadingDatesUI();

  // Store original values for dirty checking
  originalValues = {
    title: book.title || '',
    author: book.author || '',
    coverImageUrl: book.coverImageUrl || '',
    publisher: book.publisher || '',
    publishedDate: book.publishedDate || '',
    physicalFormat: book.physicalFormat || '',
    pageCount: book.pageCount || '',
    notes: book.notes || '',
    rating: book.rating || 0,
    genres: book.genres ? [...book.genres] : [],
    reads: JSON.stringify(currentReads) // Serialize for comparison
  };
  formDirty = false;
  updateSaveButtonState();

  // Show content
  loading.classList.add('hidden');
  content.classList.remove('hidden');
  initIcons();

  // Initialize genre picker after content is shown
  initGenrePicker();
}

// Rating Stars
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const clickedRating = parseInt(btn.dataset.rating);
    // Toggle off if clicking the same rating (allows clearing)
    currentRating = currentRating === clickedRating ? 0 : clickedRating;
    updateRatingStars();
    updateSaveButtonState();
  });
});

function updateRatingStars() {
  updateStars(starBtns, currentRating);
}

// Reading Dates Handlers
function formatDateForInput(timestamp) {
  const date = parseTimestamp(timestamp);
  if (!date) return '';
  // Format as YYYY-MM-DD for date input
  return date.toISOString().split('T')[0];
}

function updateReadingDatesUI() {
  const currentRead = currentReads.length > 0 ? currentReads[currentReads.length - 1] : null;

  // Set date inputs
  startedDateInput.value = currentRead ? formatDateForInput(currentRead.startedAt) : '';
  finishedDateInput.value = currentRead ? formatDateForInput(currentRead.finishedAt) : '';

  // Update status badge
  const status = getBookStatus({ reads: currentReads });
  if (status === 'reading') {
    readingStatusBadge.textContent = 'Reading';
    readingStatusBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800';
  } else if (status === 'finished') {
    readingStatusBadge.textContent = 'Finished';
    readingStatusBadge.className = 'px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800';
  } else {
    readingStatusBadge.textContent = '';
    readingStatusBadge.className = 'px-2 py-0.5 text-xs rounded-full';
  }

  // Re-read button: disabled if no current read or current read not finished
  const canReread = currentRead && currentRead.finishedAt;
  rereadBtn.disabled = !canReread;

  // Show read history if there are previous reads
  const previousReads = currentReads.slice(0, -1);
  if (previousReads.length > 0) {
    readHistorySection.classList.remove('hidden');
    historyCount.textContent = previousReads.length;
    renderReadHistory(previousReads);
  } else {
    readHistorySection.classList.add('hidden');
  }

  initIcons();
}

function renderReadHistory(previousReads) {
  // Render in reverse chronological order (most recent first)
  const html = previousReads.slice().reverse().map(read => {
    const started = formatDate(read.startedAt) || 'Unknown';
    const finished = formatDate(read.finishedAt) || 'In progress';
    return `<div class="text-gray-500">${started} - ${finished}</div>`;
  }).join('');
  readHistoryList.innerHTML = html;
}

// Date input change handlers
startedDateInput.addEventListener('change', () => {
  const startedValue = startedDateInput.value;

  // Validation: finished date can't be before started date
  if (finishedDateInput.value && startedValue && finishedDateInput.value < startedValue) {
    readingDateError.textContent = 'Finished date cannot be before started date';
    readingDateError.classList.remove('hidden');
    return;
  }
  readingDateError.classList.add('hidden');

  // Update current read or create new one
  if (currentReads.length === 0) {
    if (startedValue) {
      currentReads.push({ startedAt: new Date(startedValue).getTime(), finishedAt: null });
    }
  } else {
    const lastRead = currentReads[currentReads.length - 1];
    lastRead.startedAt = startedValue ? new Date(startedValue).getTime() : null;
  }

  updateReadingDatesUI();
  updateSaveButtonState();
});

finishedDateInput.addEventListener('change', () => {
  const finishedValue = finishedDateInput.value;

  // Validation: can't have finished without started
  if (finishedValue && !startedDateInput.value) {
    readingDateError.textContent = 'Please set a start date first';
    readingDateError.classList.remove('hidden');
    return;
  }

  // Validation: finished date can't be before started date
  if (finishedValue && startedDateInput.value && finishedValue < startedDateInput.value) {
    readingDateError.textContent = 'Finished date cannot be before started date';
    readingDateError.classList.remove('hidden');
    return;
  }
  readingDateError.classList.add('hidden');

  // Update current read
  if (currentReads.length > 0) {
    const lastRead = currentReads[currentReads.length - 1];
    lastRead.finishedAt = finishedValue ? new Date(finishedValue).getTime() : null;
  }

  updateReadingDatesUI();
  updateSaveButtonState();
});

// Re-read button handler
rereadBtn.addEventListener('click', () => {
  // Add new read entry with today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  currentReads.push({ startedAt: today.getTime(), finishedAt: null });

  updateReadingDatesUI();
  updateSaveButtonState();
  showToast('Started new read!', { type: 'success' });
});

// Toggle history visibility
toggleHistoryBtn.addEventListener('click', () => {
  const isHidden = readHistoryList.classList.contains('hidden');
  readHistoryList.classList.toggle('hidden');
  historyChevron.style.transform = isHidden ? 'rotate(90deg)' : '';
});

// Check if form has actual changes
function checkFormDirty() {
  if (titleInput.value.trim() !== originalValues.title) return true;
  if (authorInput.value.trim() !== originalValues.author) return true;
  if (coverUrlInput.value.trim() !== originalValues.coverImageUrl) return true;
  if (publisherInput.value.trim() !== originalValues.publisher) return true;
  if (publishedDateInput.value.trim() !== originalValues.publishedDate) return true;
  if (physicalFormatInput.value.trim() !== originalValues.physicalFormat) return true;
  if ((pageCountInput.value || '') !== String(originalValues.pageCount || '')) return true;
  if (notesInput.value.trim() !== originalValues.notes) return true;
  if (currentRating !== originalValues.rating) return true;

  // Check reads array
  if (JSON.stringify(currentReads) !== originalValues.reads) return true;

  // Check genres (if picker not ready yet, use original genres to avoid false positive)
  const currentGenres = genrePicker ? genrePicker.getSelected() : originalValues.genres;
  if (currentGenres.length !== originalValues.genres.length) return true;
  if (!currentGenres.every(g => originalValues.genres.includes(g))) return true;

  return false;
}

// Update save button state based on form changes
function updateSaveButtonState() {
  formDirty = checkFormDirty();
  saveBtn.disabled = !formDirty;
  saveBtn.classList.toggle('opacity-50', !formDirty);
  saveBtn.classList.toggle('cursor-not-allowed', !formDirty);
}

// Save Changes
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  // Get selected genres from picker
  const selectedGenres = genrePicker ? genrePicker.getSelected() : [];

  const updates = {
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    coverImageUrl: coverUrlInput.value.trim(),
    publisher: publisherInput.value.trim(),
    publishedDate: publishedDateInput.value.trim(),
    physicalFormat: physicalFormatInput.value.trim(),
    pageCount: pageCountInput.value ? parseInt(pageCountInput.value, 10) : null,
    rating: currentRating || null,
    notes: notesInput.value.trim(),
    genres: selectedGenres,
    reads: currentReads,
    updatedAt: serverTimestamp()
  };

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await updateDoc(bookRef, updates);

    // Update genre book counts for changed genres
    const addedGenres = selectedGenres.filter(g => !originalGenres.includes(g));
    const removedGenres = originalGenres.filter(g => !selectedGenres.includes(g));

    if (addedGenres.length > 0 || removedGenres.length > 0) {
      await updateGenreBookCounts(currentUser.uid, addedGenres, removedGenres);
      originalGenres = [...selectedGenres];
    }

    // Clear caches so changes appear on the list page
    clearBooksCache(currentUser.uid);
    clearGenresCache();

    showToast('Changes saved!', { type: 'success' });

    // Clear dirty state before re-render (renderBook will reset it)
    formDirty = false;

    // Update local data and re-render
    // Use actual Date for local display (serverTimestamp() is a sentinel, not a real timestamp)
    book = { ...book, ...updates, updatedAt: new Date() };
    renderBook();
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error saving changes', { type: 'error' });
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
});

// Delete
deleteBtn.addEventListener('click', () => {
  deleteModal.classList.remove('hidden');
  lockBodyScroll();
});

cancelDeleteBtn.addEventListener('click', () => {
  deleteModal.classList.add('hidden');
  unlockBodyScroll();
});

deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.add('hidden');
    unlockBodyScroll();
  }
});

confirmDeleteBtn.addEventListener('click', async () => {
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Deleting...';

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await deleteDoc(bookRef);

    // Decrement genre book counts for this book's genres
    const bookGenres = book.genres || [];
    if (bookGenres.length > 0) {
      await updateGenreBookCounts(currentUser.uid, [], bookGenres);
    }

    // Clear caches so the deleted book disappears from the list
    clearBooksCache(currentUser.uid);
    clearGenresCache();

    showToast('Book deleted', { type: 'success' });
    setTimeout(() => window.location.href = '/books/', 1000);
  } catch (error) {
    console.error('Error deleting:', error);
    showToast('Error deleting book', { type: 'error' });
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Delete';
    deleteModal.classList.add('hidden');
    unlockBodyScroll();
  }
});

// Track unsaved changes on form inputs (coverUrlInput excluded - read-only)
[titleInput, authorInput, publisherInput, publishedDateInput, physicalFormatInput, pageCountInput, notesInput].forEach(el => {
  el.addEventListener('input', () => {
    updateSaveButtonState();
  });
});

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (formDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Refresh Data from APIs
async function fetchBookDataFromAPI(isbn, title, author) {
  // Validate parameters - need at least ISBN or title+author to search
  if (!isbn && !title) {
    return null;
  }

  // Try ISBN lookup first (uses shared utility with both Google Books and Open Library)
  if (isbn) {
    const result = await lookupISBN(isbn);
    if (result) {
      return result;
    }
  }

  // Fallback to title/author search via Google Books
  if (title) {
    try {
      const searchQuery = author ? `intitle:${title}+inauthor:${author}` : `intitle:${title}`;
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      if (data.items?.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        return {
          title: normalizeTitle(volumeInfo.title || ''),
          author: normalizeAuthor(volumeInfo.authors?.join(', ') || ''),
          coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
          publisher: normalizePublisher(volumeInfo.publisher || ''),
          publishedDate: normalizePublishedDate(volumeInfo.publishedDate),
          physicalFormat: ''
        };
      }
    } catch (e) {
      console.error('Google Books search error:', e);
    }
  }

  return null;
}

refreshDataBtn.addEventListener('click', async () => {
  refreshDataBtn.disabled = true;
  const originalHtml = refreshDataBtn.innerHTML;
  refreshDataBtn.innerHTML = `
    <div class="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
    <span class="text-sm">Refreshing...</span>
  `;

  // Clear any existing highlights
  document.querySelectorAll('.field-changed').forEach(el => {
    el.classList.remove('field-changed');
  });
  document.querySelectorAll('.field-changed-cover').forEach(el => {
    el.classList.remove('field-changed-cover');
  });

  try {
    const changedFields = [];

    // Helper to normalize existing field value
    const normalizeField = (input, normalizeFn, fieldName) => {
      const currentValue = input.value.trim();
      if (currentValue) {
        const normalized = normalizeFn(currentValue);
        if (normalized !== currentValue) {
          input.value = normalized;
          input.classList.add('field-changed');
          changedFields.push(fieldName);
        }
      }
    };

    // Normalize existing values first
    normalizeField(titleInput, normalizeTitle, 'title');
    normalizeField(authorInput, normalizeAuthor, 'author');
    normalizeField(publisherInput, normalizePublisher, 'publisher');
    normalizeField(publishedDateInput, normalizePublishedDate, 'published date');

    const apiData = await fetchBookDataFromAPI(book.isbn, book.title, book.author);

    if (apiData) {
      // Helper to fill ONLY empty fields (preserve existing data)
      const fillEmptyField = (input, newValue, fieldName) => {
        if (newValue && !input.value.trim()) {
          input.value = newValue;
          input.classList.add('field-changed');
          if (!changedFields.includes(fieldName)) {
            changedFields.push(fieldName);
          }
        }
      };

      // Fill only empty form fields with API data
      fillEmptyField(titleInput, apiData.title, 'title');
      fillEmptyField(authorInput, apiData.author, 'author');
      fillEmptyField(publisherInput, apiData.publisher, 'publisher');
      fillEmptyField(publishedDateInput, apiData.publishedDate, 'published date');
      fillEmptyField(physicalFormatInput, apiData.physicalFormat, 'format');
      fillEmptyField(pageCountInput, apiData.pageCount, 'pages');

      // Cover image - only fill if empty
      if (apiData.coverImageUrl && !coverUrlInput.value.trim()) {
        coverUrlInput.value = apiData.coverImageUrl;
        coverUrlInput.classList.add('field-changed');
        // Use createElement to prevent XSS
        const img = document.createElement('img');
        img.src = apiData.coverImageUrl;
        img.alt = '';
        img.className = 'w-40 h-60 object-cover rounded-xl shadow-lg mx-auto field-changed-cover';
        coverContainer.innerHTML = '';
        coverContainer.appendChild(img);
        changedFields.push('cover');
      }

      // Update book object with all refreshed values
      book.title = titleInput.value;
      book.author = authorInput.value;
      book.coverImageUrl = coverUrlInput.value;
      book.publisher = publisherInput.value;
      book.publishedDate = publishedDateInput.value;
      book.physicalFormat = physicalFormatInput.value;
      book.pageCount = pageCountInput.value ? parseInt(pageCountInput.value, 10) : null;

      // Update header display
      bookTitle.textContent = book.title;
      bookAuthor.textContent = book.author || 'Unknown author';

      // Remove highlights after 3 seconds
      if (changedFields.length > 0) {
        setTimeout(() => {
          document.querySelectorAll('.field-changed').forEach(el => {
            el.classList.remove('field-changed');
          });
          document.querySelectorAll('.field-changed-cover').forEach(el => {
            el.classList.remove('field-changed-cover');
          });
        }, 3000);
      }

      // Show appropriate toast
      if (changedFields.length > 0) {
        updateSaveButtonState();
        showToast(`Updated: ${changedFields.join(', ')}`, { type: 'success' });
      } else {
        showToast('No new data found', { type: 'info' });
      }
    } else {
      // Even without API data, normalization may have changed fields
      if (changedFields.length > 0) {
        // Update book object with normalized values
        book.title = titleInput.value;
        book.author = authorInput.value;
        book.publisher = publisherInput.value;
        book.publishedDate = publishedDateInput.value;

        // Update header display
        bookTitle.textContent = book.title;
        bookAuthor.textContent = book.author || 'Unknown author';

        // Remove highlights after 3 seconds
        setTimeout(() => {
          document.querySelectorAll('.field-changed').forEach(el => {
            el.classList.remove('field-changed');
          });
        }, 3000);

        updateSaveButtonState();
        showToast(`Normalized: ${changedFields.join(', ')}`, { type: 'success' });
      } else {
        showToast('No data found from APIs', { type: 'info' });
      }
    }
  } catch (error) {
    console.error('Error refreshing book data:', error);
    showToast('Error fetching book data', { type: 'error' });
  } finally {
    refreshDataBtn.disabled = false;
    refreshDataBtn.innerHTML = originalHtml;
    initIcons();
  }
});
