// Book Edit Page Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { parseTimestamp, formatDate, showToast, initIcons, clearBooksCache, normalizeTitle, normalizeAuthor, normalizePublisher, normalizePublishedDate, lookupISBN, fetchWithTimeout, migrateBookReads, getBookStatus, interceptNavigation } from '../utils.js';
import { formatSeriesDisplay, parseSeriesFromAPI } from '../utils/series-parser.js';
import { GenrePicker } from '../components/genre-picker.js';
import { RatingInput } from '../components/rating-input.js';
import { SeriesPicker } from '../components/series-picker.js';
import { AuthorPicker } from '../components/author-picker.js';
import { CoverPicker } from '../components/cover-picker.js';
import { ImageGallery } from '../components/image-gallery.js';
import { updateGenreBookCounts, clearGenresCache } from '../genres.js';
import { updateSeriesBookCounts, clearSeriesCache } from '../series.js';
import { BookFormSchema } from '../schemas/book.js';
import { validateForm, showFieldError, clearFormErrors, scrollToFirstError } from '../utils/validation.js';
import { renderBreadcrumbs, Breadcrumbs } from '../components/breadcrumb.js';
import { ConfirmSheet } from '../components/modal.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let bookId = null;
let book = null;
let ratingInput = null;
let genrePicker = null;
let seriesPicker = null;
let authorPicker = null;
let coverPicker = null;
let imageGallery = null;
let originalGenres = [];
let originalSeriesId = null;
let originalImages = [];
let originalValues = {};
let formDirty = false;
let beforeUnloadHandler = null;
let currentReads = [];

// Get book ID from URL
const urlParams = new URLSearchParams(window.location.search);
bookId = urlParams.get('id');

if (!bookId) {
  window.location.href = '/books/';
}

// DOM Elements
const loading = document.getElementById('loading');
const content = document.getElementById('book-content');
const pageTitle = document.getElementById('page-title');
const breadcrumb = document.getElementById('breadcrumb');
const cancelBtn = document.getElementById('cancel-btn');
const editForm = document.getElementById('edit-form');
const titleInput = document.getElementById('title');
const authorPickerContainer = document.getElementById('author-picker-container');
const coverUrlInput = document.getElementById('cover-url');
const coverPickerContainer = document.getElementById('cover-picker-container');
const coverPickerHint = document.getElementById('cover-picker-hint');
const publisherInput = document.getElementById('publisher');
const publishedDateInput = document.getElementById('published-date');
const physicalFormatInput = document.getElementById('physical-format');
const pageCountInput = document.getElementById('page-count');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('save-btn');
const refreshDataBtn = document.getElementById('refresh-data-btn');
const ratingInputContainer = document.getElementById('rating-input');
const genrePickerContainer = document.getElementById('genre-picker-container');
const seriesPickerContainer = document.getElementById('series-picker-container');
const imageGalleryContainer = document.getElementById('image-gallery-container');

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

// Navigation - Cancel button goes back to view page
function goToViewPage() {
  window.location.href = `/books/view/?id=${bookId}`;
}

// Cancel button - cleanup unsaved uploads before navigating
cancelBtn.addEventListener('click', async () => {
  // Cleanup any newly uploaded images that weren't saved
  if (imageGallery?.hasUnsavedUploads()) {
    try {
      await imageGallery.cleanupUnsavedUploads();
    } catch (error) {
      console.error('Failed to cleanup unsaved uploads:', error);
    }
  }
  goToViewPage();
});

// Cover Picker Functions
function initCoverPicker() {
  if (coverPicker) return; // Already initialized

  coverPicker = new CoverPicker({
    container: coverPickerContainer,
    onSelect: (url) => {
      coverUrlInput.value = url;
      updateCoverPickerHint();
      updateSaveButtonState();
    }
  });
}

function setCoverPickerCovers(covers, currentUrl = null) {
  if (!coverPicker) initCoverPicker();

  const url = currentUrl !== null ? currentUrl : coverUrlInput.value;
  coverPicker.setCovers(covers, url);
  updateCoverPickerHint();
}

function updateCoverPickerHint() {
  if (!coverPickerHint || !coverPicker) return;
  const covers = coverPicker.getCovers();
  const hasMultiple = covers.googleBooks && covers.openLibrary;
  coverPickerHint.classList.toggle('hidden', !hasMultiple);
}

// Set series suggestion from API lookup
function setSeriesSuggestion(seriesName, seriesPosition) {
  if (seriesPicker) {
    if (seriesName) {
      seriesPicker.setSuggestion(seriesName, seriesPosition);
    } else {
      seriesPicker.clear();
    }
  }
}

// Initialize Series Picker
async function initSeriesPicker() {
  if (seriesPicker || !seriesPickerContainer) return;

  seriesPicker = new SeriesPicker({
    container: seriesPickerContainer,
    userId: currentUser.uid,
    currentBookId: bookId, // Exclude current book from position conflict check
    onChange: () => {
      updateSaveButtonState();
    }
  });

  await seriesPicker.init();

  // Set initial series if book has one
  if (book && book.seriesId) {
    seriesPicker.setSelected(book.seriesId, book.seriesPosition);
    originalSeriesId = book.seriesId;
  }
}

// Initialize Author Picker
async function initAuthorPicker() {
  if (authorPicker || !authorPickerContainer) return;

  authorPicker = new AuthorPicker({
    container: authorPickerContainer,
    userId: currentUser.uid,
    onChange: () => {
      updateSaveButtonState();
    }
  });

  await authorPicker.init();

  // Set initial author if book has one
  if (book && book.author) {
    authorPicker.setValue(book.author);
  }
}

// Initialize Image Gallery
function initImageGallery() {
  if (imageGallery || !imageGalleryContainer) return;

  imageGallery = new ImageGallery({
    container: imageGalleryContainer,
    userId: currentUser.uid,
    bookId: bookId,
    maxImages: 10,
    onPrimaryChange: (url, userInitiated) => {
      // Update cover picker with primary image (or clear if null)
      if (coverPicker) {
        coverPicker.setUserUpload(url, userInitiated);
        if (url) {
          coverUrlInput.value = url;
        }
        updateSaveButtonState();
      }
    },
    onChange: () => {
      updateSaveButtonState();
    }
  });

  // Load existing images if book has any
  if (book && book.images && book.images.length > 0) {
    imageGallery.setImages(book.images);
    originalImages = [...book.images];
  }
}

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
    // Use lookupISBN which checks both Google Books and Open Library,
    // parses hierarchical genres, and normalizes variations
    const result = await lookupISBN(isbn);
    if (result?.genres?.length > 0 && genrePicker) {
      genrePicker.setSuggestions(result.genres);
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
  // Render breadcrumbs
  renderBreadcrumbs(breadcrumb, Breadcrumbs.bookEdit(book.title, bookId));

  // Page title
  pageTitle.textContent = `Edit: ${book.title}`;

  // Form fields
  titleInput.value = book.title || '';
  // Author is set via initAuthorPicker
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
  initSeriesPicker();
  initAuthorPicker();
  initImageGallery();

  // Cover picker
  initCoverPicker();
  if (book.covers && Object.keys(book.covers).length > 0) {
    setCoverPickerCovers(book.covers, book.coverImageUrl);
  } else if (book.isbn) {
    fetchBookCovers(book.isbn);
  }
}

async function fetchBookCovers(isbn) {
  try {
    const result = await lookupISBN(isbn);
    if (result && result.covers) {
      setCoverPickerCovers(result.covers, book.coverImageUrl);
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
    startedDateInput.classList.add('border-red-500', 'focus:ring-red-500');
    finishedDateInput.classList.add('border-red-500', 'focus:ring-red-500');
    return;
  }
  readingDateError.classList.add('hidden');
  startedDateInput.classList.remove('border-red-500', 'focus:ring-red-500');
  finishedDateInput.classList.remove('border-red-500', 'focus:ring-red-500');

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
    finishedDateInput.classList.add('border-red-500', 'focus:ring-red-500');
    return;
  }

  if (finishedValue && startedDateInput.value && finishedValue < startedDateInput.value) {
    readingDateError.textContent = 'Finished date cannot be before started date';
    readingDateError.classList.remove('hidden');
    startedDateInput.classList.add('border-red-500', 'focus:ring-red-500');
    finishedDateInput.classList.add('border-red-500', 'focus:ring-red-500');
    return;
  }
  readingDateError.classList.add('hidden');
  startedDateInput.classList.remove('border-red-500', 'focus:ring-red-500');
  finishedDateInput.classList.remove('border-red-500', 'focus:ring-red-500');

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
  if (authorPicker && authorPicker.getValue().trim() !== originalValues.author) return true;
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

  // Check series
  const currentSeries = seriesPicker ? seriesPicker.getSelected() : { seriesId: originalSeriesId };
  if (currentSeries.seriesId !== originalSeriesId) return true;
  if (currentSeries.seriesId && currentSeries.position !== book.seriesPosition) return true;

  // Check images
  const currentImages = imageGallery ? imageGallery.getImages() : originalImages;
  if (currentImages.length !== originalImages.length) return true;
  if (JSON.stringify(currentImages.map(i => i.id)) !== JSON.stringify(originalImages.map(i => i.id))) return true;

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
  const selectedSeries = seriesPicker ? seriesPicker.getSelected() : { seriesId: null, position: null };

  const formData = {
    title: titleInput.value.trim(),
    author: authorPicker ? authorPicker.getValue().trim() : '',
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
    if (validation.errors.author) {
      const authorInput = authorPickerContainer.querySelector('.author-picker-input');
      if (authorInput) showFieldError(authorInput, validation.errors.author);
    }
    if (validation.errors.coverImageUrl) showFieldError(coverUrlInput, validation.errors.coverImageUrl);
    if (validation.errors.pageCount) showFieldError(pageCountInput, validation.errors.pageCount);
    if (validation.errors.notes) showFieldError(notesInput, validation.errors.notes);
    // Scroll to first error field
    scrollToFirstError(editForm);
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const availableCovers = coverPicker ? coverPicker.getCovers() : {};
  const updates = {
    title: validation.data.title,
    author: validation.data.author,
    coverImageUrl: validation.data.coverImageUrl || '',
    covers: Object.keys(availableCovers).length > 0 ? availableCovers : null,
    publisher: validation.data.publisher || '',
    publishedDate: validation.data.publishedDate || '',
    physicalFormat: validation.data.physicalFormat || '',
    pageCount: validation.data.pageCount || null,
    seriesId: selectedSeries.seriesId,
    seriesPosition: selectedSeries.position,
    rating: validation.data.rating || null,
    notes: validation.data.notes || '',
    genres: selectedGenres,
    images: imageGallery ? imageGallery.getImages() : [],
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

    // Update series book counts if series changed
    const seriesChanged = selectedSeries.seriesId !== originalSeriesId;
    if (seriesChanged) {
      // Update counts: add to new series, remove from old series
      await updateSeriesBookCounts(currentUser.uid, selectedSeries.seriesId, originalSeriesId);
    }

    clearBooksCache(currentUser.uid);
    clearGenresCache();
    if (seriesChanged) {
      clearSeriesCache();
    }

    // Reset dirty flag before redirect to prevent "leave site?" prompt
    formDirty = false;

    // Mark uploaded images as saved (prevents cleanup on navigation)
    imageGallery?.markAsSaved();

    showToast('Changes saved!', { type: 'success' });

    // Redirect to view page after save
    setTimeout(() => goToViewPage(), 1000);
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error saving changes', { type: 'error' });
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
});

// Track input changes (authorPicker handles its own onChange)
[titleInput, publisherInput, publishedDateInput, physicalFormatInput, pageCountInput, notesInput].forEach(el => {
  el.addEventListener('input', () => {
    updateSaveButtonState();
  });
});

// Warn before leaving with unsaved changes
if (beforeUnloadHandler) {
  window.removeEventListener('beforeunload', beforeUnloadHandler);
}
beforeUnloadHandler = (e) => {
  if (formDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
};
window.addEventListener('beforeunload', beforeUnloadHandler);

// Cleanup unsaved image uploads when leaving page (best effort)
// Note: This may not complete if page unloads quickly - Cloud Function handles orphans
window.addEventListener('pagehide', () => {
  if (imageGallery?.hasUnsavedUploads()) {
    // Fire and forget - can't await during page unload
    imageGallery.cleanupUnsavedUploads().catch(err => {
      console.error('Failed to cleanup unsaved uploads:', err);
    });
  }
});

// Intercept in-app navigation (header/breadcrumb links) when form is dirty
// Shows custom ConfirmSheet instead of allowing immediate navigation
interceptNavigation({
  isDirty: () => formDirty,
  showConfirmation: () => ConfirmSheet.show({
    title: 'Discard Changes?',
    message: 'You have unsaved changes. Are you sure you want to leave?',
    confirmText: 'Discard',
    cancelText: 'Keep Editing',
    confirmClass: 'bg-red-600 hover:bg-red-700'
  }),
  onBeforeNavigate: () => {
    // Clear dirty flag to prevent beforeunload from also triggering
    formDirty = false;
    if (imageGallery?.hasUnsavedUploads()) {
      imageGallery.cleanupUnsavedUploads();
    }
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
          physicalFormat: '',
          pageCount: volumeInfo.pageCount || null
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
    // Handle author normalization via AuthorPicker
    if (authorPicker) {
      const currentAuthor = authorPicker.getValue();
      const normalizedAuthor = normalizeAuthor(currentAuthor);
      if (currentAuthor && normalizedAuthor !== currentAuthor) {
        authorPicker.setValue(normalizedAuthor);
        const authorInput = authorPickerContainer.querySelector('.author-picker-input');
        if (authorInput) authorInput.classList.add('field-changed');
        changedFields.push('author');
      }
    }
    normalizeField(publisherInput, normalizePublisher, 'publisher');
    normalizeField(publishedDateInput, normalizePublishedDate, 'published date');

    const apiData = await fetchBookDataFromAPI(book.isbn, book.title, book.author);

    if (apiData) {
      const fillEmptyField = (input, newValue, fieldName) => {
        if (newValue != null && newValue !== '' && !input.value.trim()) {
          input.value = newValue;
          input.classList.add('field-changed');
          if (!changedFields.includes(fieldName)) {
            changedFields.push(fieldName);
          }
        }
      };

      fillEmptyField(titleInput, apiData.title, 'title');
      // Author uses AuthorPicker instead of standard input
      if (authorPicker && apiData.author && !authorPicker.getValue().trim()) {
        authorPicker.setValue(apiData.author);
        const authorInput = authorPickerContainer.querySelector('.author-picker-input');
        if (authorInput) authorInput.classList.add('field-changed');
        if (!changedFields.includes('author')) changedFields.push('author');
      }
      fillEmptyField(publisherInput, apiData.publisher, 'publisher');
      fillEmptyField(publishedDateInput, apiData.publishedDate, 'published date');
      fillEmptyField(physicalFormatInput, apiData.physicalFormat, 'format');
      fillEmptyField(pageCountInput, apiData.pageCount, 'pages');

      if (apiData.covers && Object.keys(apiData.covers).length > 0) {
        setCoverPickerCovers(apiData.covers, coverUrlInput.value);
        if (!coverUrlInput.value.trim()) {
          // Auto-select first available cover
          const selectedUrl = coverPicker.getSelectedUrl();
          if (selectedUrl) {
            coverUrlInput.value = selectedUrl;
            changedFields.push('cover');
          }
        }
      } else if (apiData.coverImageUrl && !coverUrlInput.value.trim()) {
        coverUrlInput.value = apiData.coverImageUrl;
        changedFields.push('cover');
      }

      // Series from API - suggest if no series currently selected
      const currentSeriesSelection = seriesPicker ? seriesPicker.getSelected() : { seriesId: null };
      if (apiData.seriesName && !currentSeriesSelection.seriesId) {
        setSeriesSuggestion(apiData.seriesName, apiData.seriesPosition);
        changedFields.push('series');
      }

      if (changedFields.length > 0) {
        updateSaveButtonState();
        showToast(`Updated: ${changedFields.join(', ')}`, { type: 'success' });
      } else {
        showToast('No new data found', { type: 'info' });
      }
    } else {
      if (changedFields.length > 0) {
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
