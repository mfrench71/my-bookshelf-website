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
import { renderStars, parseTimestamp, showToast, initIcons, clearBooksCache, updateRatingStars as updateStars, normalizeTitle, normalizeAuthor, normalizePublisher, normalizePublishedDate, lockBodyScroll, unlockBodyScroll } from './utils.js';
import { GenrePicker } from './genre-picker.js';
import { updateGenreBookCounts, clearGenresCache } from './genres.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let bookId = null;
let book = null;
let currentRating = 0;
let currentStatus = null;
let genrePicker = null;
let originalGenres = [];
let originalValues = {};
let formDirty = false;

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
const bookRating = document.getElementById('book-rating');
const bookDates = document.getElementById('book-dates');
const bookDetails = document.getElementById('book-details');
const editForm = document.getElementById('edit-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const publisherInput = document.getElementById('publisher');
const publishedDateInput = document.getElementById('published-date');
const physicalFormatInput = document.getElementById('physical-format');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const refreshDataBtn = document.getElementById('refresh-data-btn');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const starBtns = document.querySelectorAll('.star-btn');
const statusBtns = document.querySelectorAll('.status-btn');
const genrePickerContainer = document.getElementById('genre-picker-container');

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
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await response.json();

    if (data.items?.length > 0) {
      const categories = data.items[0].volumeInfo.categories || [];
      if (categories.length > 0 && genrePicker) {
        genrePicker.setSuggestions(categories);
      }
    }
  } catch (e) {
    console.error('Error fetching genre suggestions:', e);
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
  if (book.coverImageUrl) {
    const img = document.createElement('img');
    img.src = book.coverImageUrl;
    img.alt = '';
    img.className = 'w-40 h-60 object-cover rounded-xl shadow-lg mx-auto';
    coverContainer.innerHTML = '';
    coverContainer.appendChild(img);
  } else {
    coverContainer.innerHTML = `
      <div class="w-40 h-60 bg-primary rounded-xl shadow-lg mx-auto flex items-center justify-center">
        <i data-lucide="book" class="w-16 h-16 text-white"></i>
      </div>
    `;
  }

  // Info
  bookTitle.textContent = book.title;
  bookAuthor.textContent = book.author || 'Unknown author';
  bookIsbn.textContent = book.isbn ? `ISBN: ${book.isbn}` : '';

  // Rating
  bookRating.innerHTML = book.rating ? renderStars(book.rating) : '';

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

  // Book Details (publisher, published date, physical format)
  let detailsHtml = '';
  if (book.publisher) {
    detailsHtml += `<div><span class="text-gray-400">Publisher:</span> ${book.publisher}</div>`;
  }
  if (book.publishedDate) {
    detailsHtml += `<div><span class="text-gray-400">Published:</span> ${book.publishedDate}</div>`;
  }
  if (book.physicalFormat) {
    detailsHtml += `<div><span class="text-gray-400">Format:</span> ${book.physicalFormat}</div>`;
  }
  bookDetails.innerHTML = detailsHtml;

  // Form
  titleInput.value = book.title || '';
  authorInput.value = book.author || '';
  coverUrlInput.value = book.coverImageUrl || '';
  publisherInput.value = book.publisher || '';
  publishedDateInput.value = book.publishedDate || '';
  physicalFormatInput.value = book.physicalFormat || '';
  notesInput.value = book.notes || '';
  currentRating = book.rating || 0;
  currentStatus = book.status || null;
  updateRatingStars();
  updateStatusButtons();

  // Store original values for dirty checking
  originalValues = {
    title: book.title || '',
    author: book.author || '',
    coverImageUrl: book.coverImageUrl || '',
    publisher: book.publisher || '',
    publishedDate: book.publishedDate || '',
    physicalFormat: book.physicalFormat || '',
    notes: book.notes || '',
    rating: book.rating || 0,
    status: book.status || null,
    genres: book.genres ? [...book.genres] : []
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

// Status Buttons
statusBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const clickedStatus = btn.dataset.status;
    // Toggle off if clicking the same status (allows clearing)
    currentStatus = currentStatus === clickedStatus ? null : clickedStatus;
    updateStatusButtons();
    updateSaveButtonState();
  });
});

function updateStatusButtons() {
  statusBtns.forEach(btn => {
    const isSelected = btn.dataset.status === currentStatus;
    btn.classList.toggle('bg-primary', isSelected);
    btn.classList.toggle('text-white', isSelected);
    btn.classList.toggle('border-primary', isSelected);
    btn.classList.toggle('border-gray-300', !isSelected);
    btn.classList.toggle('text-gray-700', !isSelected);
  });
}

// Check if form has actual changes
function checkFormDirty() {
  if (titleInput.value.trim() !== originalValues.title) return true;
  if (authorInput.value.trim() !== originalValues.author) return true;
  if (coverUrlInput.value.trim() !== originalValues.coverImageUrl) return true;
  if (publisherInput.value.trim() !== originalValues.publisher) return true;
  if (publishedDateInput.value.trim() !== originalValues.publishedDate) return true;
  if (physicalFormatInput.value.trim() !== originalValues.physicalFormat) return true;
  if (notesInput.value.trim() !== originalValues.notes) return true;
  if (currentRating !== originalValues.rating) return true;
  if (currentStatus !== originalValues.status) return true;

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
    rating: currentRating || null,
    status: currentStatus,
    notes: notesInput.value.trim(),
    genres: selectedGenres,
    updatedAt: serverTimestamp()
  };

  // Auto-set startedAt when status changes to 'reading'
  if (currentStatus === 'reading' && originalValues.status !== 'reading') {
    updates.startedAt = serverTimestamp();
  }

  // Auto-set finishedAt when status changes to 'finished'
  if (currentStatus === 'finished' && originalValues.status !== 'finished') {
    updates.finishedAt = serverTimestamp();
  }

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
    book = { ...book, ...updates };
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
[titleInput, authorInput, publisherInput, publishedDateInput, physicalFormatInput, notesInput].forEach(el => {
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

  let result = null;

  // Try Google Books API first (by ISBN if available)
  if (isbn) {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      if (data.items?.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        result = {
          title: normalizeTitle(volumeInfo.title || ''),
          author: normalizeAuthor(volumeInfo.authors?.join(', ') || ''),
          coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
          publisher: normalizePublisher(volumeInfo.publisher || ''),
          publishedDate: normalizePublishedDate(volumeInfo.publishedDate),
          physicalFormat: ''
        };
      }
    } catch (e) {
      console.error('Google Books API error:', e);
    }
  }

  // Try Google Books by title/author search if no result yet
  if (!result && title) {
    try {
      const searchQuery = author ? `intitle:${title}+inauthor:${author}` : `intitle:${title}`;
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.items?.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        result = {
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

  // Try Open Library by ISBN (as fallback, or to supplement missing fields)
  if (isbn) {
    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const data = await response.json();
      const bookData = data[`ISBN:${isbn}`];
      if (bookData) {
        if (result) {
          // Supplement missing fields from Open Library
          if (!result.publisher) result.publisher = normalizePublisher(bookData.publishers?.[0]?.name || '');
          if (!result.publishedDate) result.publishedDate = normalizePublishedDate(bookData.publish_date);
          if (!result.physicalFormat) result.physicalFormat = bookData.physical_format || '';
          if (!result.coverImageUrl) result.coverImageUrl = bookData.cover?.medium || bookData.cover?.small || '';
        } else {
          // Use Open Library as primary source
          result = {
            title: normalizeTitle(bookData.title || ''),
            author: normalizeAuthor(bookData.authors?.[0]?.name || ''),
            coverImageUrl: bookData.cover?.medium || bookData.cover?.small || '',
            publisher: normalizePublisher(bookData.publishers?.[0]?.name || ''),
            publishedDate: normalizePublishedDate(bookData.publish_date),
            physicalFormat: bookData.physical_format || ''
          };
        }
      }
    } catch (e) {
      console.error('Open Library API error:', e);
    }
  }

  return result;
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

      // Update header display
      bookTitle.textContent = book.title;
      bookAuthor.textContent = book.author || 'Unknown author';

      let detailsHtml = '';
      if (book.publisher) {
        detailsHtml += `<div><span class="text-gray-400">Publisher:</span> ${book.publisher}</div>`;
      }
      if (book.publishedDate) {
        detailsHtml += `<div><span class="text-gray-400">Published:</span> ${book.publishedDate}</div>`;
      }
      if (book.physicalFormat) {
        detailsHtml += `<div><span class="text-gray-400">Format:</span> ${book.physicalFormat}</div>`;
      }
      bookDetails.innerHTML = detailsHtml;

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

        // Update book details display
        let detailsHtml = '';
        if (book.publisher) {
          detailsHtml += `<div><span class="text-gray-400">Publisher:</span> ${book.publisher}</div>`;
        }
        if (book.publishedDate) {
          detailsHtml += `<div><span class="text-gray-400">Published:</span> ${book.publishedDate}</div>`;
        }
        if (book.physicalFormat) {
          detailsHtml += `<div><span class="text-gray-400">Format:</span> ${book.physicalFormat}</div>`;
        }
        bookDetails.innerHTML = detailsHtml;

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
