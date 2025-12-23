// Book Edit Page Logic
import { auth, db } from '../firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { parseTimestamp, formatDate, showToast, initIcons, clearBooksCache, normalizeTitle, normalizeAuthor, normalizePublisher, normalizePublishedDate, lookupISBN, fetchWithTimeout, migrateBookReads, getBookStatus } from '../utils.js';
import { GenrePicker } from '../components/genre-picker.js';
import { RatingInput } from '../components/rating-input.js';
import { updateGenreBookCounts, clearGenresCache } from '../genres.js';
import { BookFormSchema } from '../schemas/book.js';
import { validateForm, showFieldError, clearFormErrors } from '../utils/validation.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let bookId = null;
let book = null;
let ratingInput = null;
let genrePicker = null;
let originalGenres = [];
let originalValues = {};
let formDirty = false;
let currentReads = [];
let availableCovers = {};

// Get book ID from URL
const urlParams = new URLSearchParams(window.location.search);
bookId = urlParams.get('id');

if (!bookId) {
  window.location.href = '/books/';
}

// DOM Elements
const loading = document.getElementById('loading');
const content = document.getElementById('main-content');
const pageTitle = document.getElementById('page-title');
const backBtn = document.getElementById('back-btn');
const cancelBtn = document.getElementById('cancel-btn');
const editForm = document.getElementById('edit-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const coverPicker = document.getElementById('cover-picker');
const coverPickerHint = document.getElementById('cover-picker-hint');
const coverOptionGoogle = document.getElementById('cover-option-google');
const coverOptionOpenLibrary = document.getElementById('cover-option-openlibrary');
const noCoverMsg = document.getElementById('no-cover-msg');
const publisherInput = document.getElementById('publisher');
const publishedDateInput = document.getElementById('published-date');
const physicalFormatInput = document.getElementById('physical-format');
const pageCountInput = document.getElementById('page-count');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('save-btn');
const refreshDataBtn = document.getElementById('refresh-data-btn');
const ratingInputContainer = document.getElementById('rating-input');
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

// Navigation
function goToViewPage() {
  window.location.href = `/books/view/?id=${bookId}`;
}

backBtn.addEventListener('click', goToViewPage);
cancelBtn.addEventListener('click', goToViewPage);

// Cover Picker Functions
function renderCoverPicker(covers, currentCoverUrl) {
  availableCovers = covers || {};
  const hasGoogle = availableCovers.googleBooks;
  const hasOpenLibrary = availableCovers.openLibrary;
  const hasAnyCovers = hasGoogle || hasOpenLibrary;
  const hasMultipleCovers = hasGoogle && hasOpenLibrary;

  // Reset UI
  coverPicker.classList.add('hidden');
  noCoverMsg.classList.add('hidden');
  coverOptionGoogle.classList.add('hidden');
  coverOptionOpenLibrary.classList.add('hidden');
  coverOptionGoogle.classList.remove('border-primary', 'bg-primary/5');
  coverOptionOpenLibrary.classList.remove('border-primary', 'bg-primary/5');
  if (coverPickerHint) coverPickerHint.classList.add('hidden');

  if (!hasAnyCovers) {
    if (!currentCoverUrl) {
      noCoverMsg.classList.remove('hidden');
    }
    return;
  }

  coverPicker.classList.remove('hidden');

  if (hasGoogle) {
    coverOptionGoogle.classList.remove('hidden');
    coverOptionGoogle.querySelector('img').src = availableCovers.googleBooks;
    coverOptionGoogle.querySelector('img').onerror = () => {
      coverOptionGoogle.classList.add('hidden');
    };
  }

  if (hasOpenLibrary) {
    coverOptionOpenLibrary.classList.remove('hidden');
    coverOptionOpenLibrary.querySelector('img').src = availableCovers.openLibrary;
    coverOptionOpenLibrary.querySelector('img').onerror = () => {
      coverOptionOpenLibrary.classList.add('hidden');
    };
  }

  // Show hint only if there are multiple covers to choose from
  if (hasMultipleCovers && coverPickerHint) {
    coverPickerHint.classList.remove('hidden');
  }

  // Highlight currently selected
  const googleBadge = coverOptionGoogle.querySelector('.cover-selected-badge');
  const openLibraryBadge = coverOptionOpenLibrary.querySelector('.cover-selected-badge');

  if (currentCoverUrl === availableCovers.googleBooks) {
    coverOptionGoogle.classList.add('border-primary', 'bg-primary/5');
    googleBadge?.classList.remove('hidden');
  } else if (currentCoverUrl === availableCovers.openLibrary) {
    coverOptionOpenLibrary.classList.add('border-primary', 'bg-primary/5');
    openLibraryBadge?.classList.remove('hidden');
  } else if (hasGoogle) {
    coverOptionGoogle.classList.add('border-primary', 'bg-primary/5');
    googleBadge?.classList.remove('hidden');
  } else if (hasOpenLibrary) {
    coverOptionOpenLibrary.classList.add('border-primary', 'bg-primary/5');
    openLibraryBadge?.classList.remove('hidden');
  }

  initIcons();
}

function selectCover(source) {
  const url = availableCovers[source];
  if (!url) return;

  coverUrlInput.value = url;

  coverOptionGoogle.classList.toggle('border-primary', source === 'googleBooks');
  coverOptionGoogle.classList.toggle('bg-primary/5', source === 'googleBooks');
  coverOptionOpenLibrary.classList.toggle('border-primary', source === 'openLibrary');
  coverOptionOpenLibrary.classList.toggle('bg-primary/5', source === 'openLibrary');

  updateSaveButtonState();
}

coverOptionGoogle.addEventListener('click', () => selectCover('googleBooks'));
coverOptionOpenLibrary.addEventListener('click', () => selectCover('openLibrary'));

// Auth Check
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

  if (book && book.genres) {
    originalGenres = [...book.genres];
    genrePicker.setSelected(book.genres);
  }

  if (book && book.isbn) {
    fetchGenreSuggestions(book.isbn);
  }
}

async function fetchGenreSuggestions(isbn) {
  try {
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
      {},
      5000
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
    renderForm();
  } catch (error) {
    console.error('Error loading book:', error);
    showToast('Error loading book', { type: 'error' });
  }
}

function renderForm() {
  // Page title
  pageTitle.textContent = `Edit: ${book.title}`;

  // Form fields
  titleInput.value = book.title || '';
  authorInput.value = book.author || '';
  coverUrlInput.value = book.coverImageUrl || '';
  publisherInput.value = book.publisher || '';
  publishedDateInput.value = book.publishedDate || '';
  physicalFormatInput.value = book.physicalFormat || '';
  pageCountInput.value = book.pageCount || '';
  notesInput.value = book.notes || '';
  initRatingInput(book.rating || 0);

  // Reading dates
  const migratedBook = migrateBookReads(book);
  currentReads = migratedBook.reads ? [...migratedBook.reads.map(r => ({...r}))] : [];
  updateReadingDatesUI();

  // Store original values
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
    reads: JSON.stringify(currentReads)
  };
  formDirty = false;
  updateSaveButtonState();

  // Show content
  loading.classList.add('hidden');
  content.classList.remove('hidden');
  initIcons();

  // Initialize pickers
  initGenrePicker();

  // Cover picker
  if (book.covers && Object.keys(book.covers).length > 0) {
    renderCoverPicker(book.covers, book.coverImageUrl);
  } else if (book.isbn) {
    fetchBookCovers(book.isbn);
  }
}

async function fetchBookCovers(isbn) {
  try {
    const result = await lookupISBN(isbn);
    if (result && result.covers) {
      renderCoverPicker(result.covers, book.coverImageUrl);
    }
  } catch (e) {
    console.warn('Error fetching covers:', e);
  }
}

// Rating Input
function initRatingInput(initialValue = 0) {
  if (ratingInput) {
    ratingInput.setValue(initialValue);
    return;
  }

  ratingInput = new RatingInput({
    container: ratingInputContainer,
    value: initialValue,
    onChange: () => {
      updateSaveButtonState();
    }
  });
}

// Reading Dates
function formatDateForInput(timestamp) {
  const date = parseTimestamp(timestamp);
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

function updateReadingDatesUI() {
  const currentRead = currentReads.length > 0 ? currentReads[currentReads.length - 1] : null;

  startedDateInput.value = currentRead ? formatDateForInput(currentRead.startedAt) : '';
  finishedDateInput.value = currentRead ? formatDateForInput(currentRead.finishedAt) : '';

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

  const canReread = currentRead && currentRead.finishedAt;
  rereadBtn.disabled = !canReread;

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
  const html = previousReads.slice().reverse().map(read => {
    const started = formatDate(read.startedAt) || 'Unknown';
    const finished = formatDate(read.finishedAt) || 'In progress';
    return `<div class="text-gray-500">${started} - ${finished}</div>`;
  }).join('');
  readHistoryList.innerHTML = html;
}

startedDateInput.addEventListener('change', () => {
  const startedValue = startedDateInput.value;

  if (finishedDateInput.value && startedValue && finishedDateInput.value < startedValue) {
    readingDateError.textContent = 'Finished date cannot be before started date';
    readingDateError.classList.remove('hidden');
    return;
  }
  readingDateError.classList.add('hidden');

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

  if (finishedValue && !startedDateInput.value) {
    readingDateError.textContent = 'Please set a start date first';
    readingDateError.classList.remove('hidden');
    return;
  }

  if (finishedValue && startedDateInput.value && finishedValue < startedDateInput.value) {
    readingDateError.textContent = 'Finished date cannot be before started date';
    readingDateError.classList.remove('hidden');
    return;
  }
  readingDateError.classList.add('hidden');

  if (currentReads.length > 0) {
    const lastRead = currentReads[currentReads.length - 1];
    lastRead.finishedAt = finishedValue ? new Date(finishedValue).getTime() : null;
  }

  updateReadingDatesUI();
  updateSaveButtonState();
});

rereadBtn.addEventListener('click', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  currentReads.push({ startedAt: today.getTime(), finishedAt: null });

  updateReadingDatesUI();
  updateSaveButtonState();
  showToast('Started new read!', { type: 'success' });
});

toggleHistoryBtn.addEventListener('click', () => {
  const isHidden = readHistoryList.classList.contains('hidden');
  readHistoryList.classList.toggle('hidden');
  historyChevron.style.transform = isHidden ? 'rotate(90deg)' : '';
});

// Form dirty checking
function checkFormDirty() {
  if (titleInput.value.trim() !== originalValues.title) return true;
  if (authorInput.value.trim() !== originalValues.author) return true;
  if (coverUrlInput.value.trim() !== originalValues.coverImageUrl) return true;
  if (publisherInput.value.trim() !== originalValues.publisher) return true;
  if (publishedDateInput.value.trim() !== originalValues.publishedDate) return true;
  if (physicalFormatInput.value.trim() !== originalValues.physicalFormat) return true;
  if ((pageCountInput.value || '') !== String(originalValues.pageCount || '')) return true;
  if (notesInput.value.trim() !== originalValues.notes) return true;
  const currentRating = ratingInput ? ratingInput.getValue() : 0;
  if (currentRating !== originalValues.rating) return true;
  if (JSON.stringify(currentReads) !== originalValues.reads) return true;

  const currentGenres = genrePicker ? genrePicker.getSelected() : originalValues.genres;
  if (currentGenres.length !== originalValues.genres.length) return true;
  if (!currentGenres.every(g => originalValues.genres.includes(g))) return true;

  return false;
}

function updateSaveButtonState() {
  formDirty = checkFormDirty();
  saveBtn.disabled = !formDirty;
  saveBtn.classList.toggle('opacity-50', !formDirty);
  saveBtn.classList.toggle('cursor-not-allowed', !formDirty);
}

// Save Changes
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  clearFormErrors(editForm);

  const selectedGenres = genrePicker ? genrePicker.getSelected() : [];

  const formData = {
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    coverImageUrl: coverUrlInput.value.trim(),
    publisher: publisherInput.value.trim(),
    publishedDate: publishedDateInput.value.trim(),
    physicalFormat: physicalFormatInput.value.trim(),
    pageCount: pageCountInput.value,
    rating: ratingInput ? ratingInput.getValue() : null,
    notes: notesInput.value.trim()
  };

  const validation = validateForm(BookFormSchema, formData);
  if (!validation.success) {
    if (validation.errors.title) showFieldError(titleInput, validation.errors.title);
    if (validation.errors.author) showFieldError(authorInput, validation.errors.author);
    if (validation.errors.coverImageUrl) showFieldError(coverUrlInput, validation.errors.coverImageUrl);
    if (validation.errors.pageCount) showFieldError(pageCountInput, validation.errors.pageCount);
    if (validation.errors.notes) showFieldError(notesInput, validation.errors.notes);
    showToast('Please fix the errors above', { type: 'error' });
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const updates = {
    title: validation.data.title,
    author: validation.data.author,
    coverImageUrl: validation.data.coverImageUrl || '',
    covers: Object.keys(availableCovers).length > 0 ? availableCovers : null,
    publisher: validation.data.publisher || '',
    publishedDate: validation.data.publishedDate || '',
    physicalFormat: validation.data.physicalFormat || '',
    pageCount: validation.data.pageCount || null,
    rating: validation.data.rating || null,
    notes: validation.data.notes || '',
    genres: selectedGenres,
    reads: currentReads,
    updatedAt: serverTimestamp()
  };

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await updateDoc(bookRef, updates);

    const addedGenres = selectedGenres.filter(g => !originalGenres.includes(g));
    const removedGenres = originalGenres.filter(g => !selectedGenres.includes(g));

    if (addedGenres.length > 0 || removedGenres.length > 0) {
      await updateGenreBookCounts(currentUser.uid, addedGenres, removedGenres);
    }

    clearBooksCache(currentUser.uid);
    clearGenresCache();

    // Reset dirty flag before redirect to prevent "leave site?" prompt
    formDirty = false;

    showToast('Changes saved!', { type: 'success' });

    // Redirect to view page after save
    setTimeout(() => goToViewPage(), 1000);
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error saving changes', { type: 'error' });
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
});

// Track input changes
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
  if (!isbn && !title) {
    return null;
  }

  if (isbn) {
    const result = await lookupISBN(isbn);
    if (result) {
      return result;
    }
  }

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

  document.querySelectorAll('.field-changed').forEach(el => {
    el.classList.remove('field-changed');
  });

  try {
    const changedFields = [];

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

    normalizeField(titleInput, normalizeTitle, 'title');
    normalizeField(authorInput, normalizeAuthor, 'author');
    normalizeField(publisherInput, normalizePublisher, 'publisher');
    normalizeField(publishedDateInput, normalizePublishedDate, 'published date');

    const apiData = await fetchBookDataFromAPI(book.isbn, book.title, book.author);

    if (apiData) {
      const fillEmptyField = (input, newValue, fieldName) => {
        if (newValue && !input.value.trim()) {
          input.value = newValue;
          input.classList.add('field-changed');
          if (!changedFields.includes(fieldName)) {
            changedFields.push(fieldName);
          }
        }
      };

      fillEmptyField(titleInput, apiData.title, 'title');
      fillEmptyField(authorInput, apiData.author, 'author');
      fillEmptyField(publisherInput, apiData.publisher, 'publisher');
      fillEmptyField(publishedDateInput, apiData.publishedDate, 'published date');
      fillEmptyField(physicalFormatInput, apiData.physicalFormat, 'format');
      fillEmptyField(pageCountInput, apiData.pageCount, 'pages');

      if (apiData.covers && Object.keys(apiData.covers).length > 0) {
        renderCoverPicker(apiData.covers, coverUrlInput.value);
        if (!coverUrlInput.value.trim()) {
          if (apiData.covers.googleBooks) {
            selectCover('googleBooks');
            changedFields.push('cover');
          } else if (apiData.covers.openLibrary) {
            selectCover('openLibrary');
            changedFields.push('cover');
          }
        }
      } else if (apiData.coverImageUrl && !coverUrlInput.value.trim()) {
        coverUrlInput.value = apiData.coverImageUrl;
        changedFields.push('cover');
      }

      if (changedFields.length > 0) {
        setTimeout(() => {
          document.querySelectorAll('.field-changed').forEach(el => {
            el.classList.remove('field-changed');
          });
        }, 3000);
      }

      if (changedFields.length > 0) {
        updateSaveButtonState();
        showToast(`Updated: ${changedFields.join(', ')}`, { type: 'success' });
      } else {
        showToast('No new data found', { type: 'info' });
      }
    } else {
      if (changedFields.length > 0) {
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
