// Book Edit Page Logic
import { auth } from '/js/firebase-config.js';
import { onAuthStateChanged, User } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { bookRepository } from '../repositories/book-repository.js';
import {
  parseTimestamp,
  formatDate,
  showToast,
  initIcons,
  clearBooksCache,
  normalizeTitle,
  normalizeAuthor,
  normalizePublisher,
  normalizePublishedDate,
  lookupISBN,
  fetchWithTimeout,
  migrateBookReads,
  getBookStatus,
  interceptNavigation,
} from '../utils.js';
import { GenrePicker } from '../components/genre-picker.js';
import { RatingInput } from '../components/rating-input.js';
import { SeriesPicker } from '../components/series-picker.js';
import { AuthorPicker } from '../components/author-picker.js';
import { CoverPicker } from '../components/cover-picker.js';
import { ImageGallery, type GalleryImage } from '../components/image-gallery.js';
import { updateGenreBookCounts, clearGenresCache } from '../genres.js';
import { updateSeriesBookCounts, clearSeriesCache } from '../series.js';
import { BookFormSchema, BookFormData } from '../schemas/book.js';
import { validateForm, showFieldError, clearFormErrors, scrollToFirstError } from '../utils/validation.js';
import { renderBreadcrumbs, Breadcrumbs } from '../components/breadcrumb.js';
import { ConfirmSheet } from '../components/modal.js';
import type { BookCovers, BookRead, PhysicalFormat } from '../types/index.js';

/** Read entry for tracking reading history - compatible with BookRead */
interface ReadEntry {
  startedAt?: string | number | Date | null;
  finishedAt?: string | number | Date | null;
}

/** Book image from gallery - compatible with GalleryImage */
interface BookImage {
  id?: string;
  url: string;
  storagePath?: string;
  isPrimary?: boolean;
  uploadedAt?: number;
  sizeBytes?: number;
  width?: number;
  height?: number;
  caption?: string;
}

/** Book data structure */
interface BookData {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  coverImageUrl?: string;
  covers?: BookCovers;
  publisher?: string;
  publishedDate?: string;
  physicalFormat?: string;
  pageCount?: number | string;
  notes?: string;
  rating?: number;
  genres?: string[];
  seriesId?: string | null;
  seriesPosition?: number | null;
  images?: BookImage[];
  reads?: ReadEntry[];
  startedAt?: unknown;
  finishedAt?: unknown;
  deletedAt?: number | null;
  [key: string]: unknown;
}

/** Original form values for dirty checking */
interface OriginalValues {
  title: string;
  author: string;
  coverImageUrl: string;
  publisher: string;
  publishedDate: string;
  physicalFormat: string;
  pageCount: string | number;
  notes: string;
  rating: number;
  genres: string[];
  reads: string;
}

/** API lookup result */
interface APILookupResult {
  title?: string;
  author?: string;
  coverImageUrl?: string;
  covers?: BookCovers;
  publisher?: string;
  publishedDate?: string;
  physicalFormat?: string;
  pageCount?: number | string;
  seriesName?: string;
  seriesPosition?: number;
  genres?: string[];
}

// Initialize icons once on load
initIcons();

// State
let currentUser: User | null = null;
let bookId: string | null = null;
let book: BookData | null = null;
let ratingInput: RatingInput | null = null;
let genrePicker: GenrePicker | null = null;
let seriesPicker: SeriesPicker | null = null;
let authorPicker: AuthorPicker | null = null;
let coverPicker: CoverPicker | null = null;
let imageGallery: ImageGallery | null = null;
let originalGenres: string[] = [];
let originalSeriesId: string | null = null;
let originalImages: BookImage[] = [];
let originalValues: OriginalValues = {
  title: '',
  author: '',
  coverImageUrl: '',
  publisher: '',
  publishedDate: '',
  physicalFormat: '',
  pageCount: '',
  notes: '',
  rating: 0,
  genres: [],
  reads: '[]',
};
let formDirty = false;
let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
let currentReads: ReadEntry[] = [];

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
const cancelBtn = document.getElementById('cancel-btn') as HTMLButtonElement | null;
const editForm = document.getElementById('edit-form') as HTMLFormElement | null;
const titleInput = document.getElementById('title') as HTMLInputElement | null;
const authorPickerContainer = document.getElementById('author-picker-container');
const coverUrlInput = document.getElementById('cover-url') as HTMLInputElement | null;
const coverPickerContainer = document.getElementById('cover-picker-container');
const coverPickerHint = document.getElementById('cover-picker-hint');
const publisherInput = document.getElementById('publisher') as HTMLInputElement | null;
const publishedDateInput = document.getElementById('published-date') as HTMLInputElement | null;
const physicalFormatInput = document.getElementById('physical-format') as HTMLInputElement | null;
const pageCountInput = document.getElementById('page-count') as HTMLInputElement | null;
const notesInput = document.getElementById('notes') as HTMLTextAreaElement | null;
const saveBtn = document.getElementById('save-btn') as HTMLButtonElement | null;
const refreshDataBtn = document.getElementById('refresh-data-btn') as HTMLButtonElement | null;
const ratingInputContainer = document.getElementById('rating-input');
const genrePickerContainer = document.getElementById('genre-picker-container');
const seriesPickerContainer = document.getElementById('series-picker-container');
const imageGalleryContainer = document.getElementById('image-gallery-container');

// Reading Dates Elements
const startedDateInput = document.getElementById('started-date') as HTMLInputElement | null;
const finishedDateInput = document.getElementById('finished-date') as HTMLInputElement | null;
const readingDateError = document.getElementById('reading-date-error');
const rereadBtn = document.getElementById('reread-btn') as HTMLButtonElement | null;
const readingStatusBadge = document.getElementById('reading-status-badge');
const readHistorySection = document.getElementById('read-history-section');
const toggleHistoryBtn = document.getElementById('toggle-history') as HTMLButtonElement | null;
const historyChevron = document.getElementById('history-chevron') as HTMLElement | null;
const historyCount = document.getElementById('history-count');
const readHistoryList = document.getElementById('read-history-list');

/**
 * Navigate to the view page for this book
 */
function goToViewPage(): void {
  window.location.href = `/books/view/?id=${bookId}`;
}

// Cancel button - cleanup unsaved uploads before navigating
cancelBtn?.addEventListener('click', async () => {
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

/**
 * Initialize the cover picker component
 */
function initCoverPicker(): void {
  if (coverPicker || !coverPickerContainer || !coverUrlInput) return;

  coverPicker = new CoverPicker({
    container: coverPickerContainer,
    onSelect: (url: string) => {
      coverUrlInput.value = url;
      updateCoverPickerHint();
      updateSaveButtonState();
    },
  });
}

/**
 * Set covers in the cover picker
 * @param covers - Cover URLs from different sources
 * @param currentUrl - Currently selected cover URL
 */
function setCoverPickerCovers(covers: BookCovers, currentUrl: string | null = null): void {
  if (!coverPicker) initCoverPicker();
  if (!coverPicker || !coverUrlInput) return;

  const url = currentUrl !== null ? currentUrl : coverUrlInput.value;
  coverPicker.setCovers(covers, url);
  updateCoverPickerHint();
}

/**
 * Update the cover picker hint visibility
 */
function updateCoverPickerHint(): void {
  if (!coverPickerHint || !coverPicker) return;
  const covers = coverPicker.getCovers();
  const hasMultiple = covers.googleBooks && covers.openLibrary;
  coverPickerHint.classList.toggle('hidden', !hasMultiple);
}

/**
 * Set series suggestion from API lookup
 * @param seriesName - Series name from API
 * @param seriesPosition - Position in series
 */
function setSeriesSuggestion(seriesName: string | undefined, seriesPosition: number | undefined): void {
  if (seriesPicker) {
    if (seriesName) {
      seriesPicker.setSuggestion(seriesName, seriesPosition);
    } else {
      seriesPicker.clear();
    }
  }
}

/**
 * Initialize the series picker component
 */
async function initSeriesPicker(): Promise<void> {
  if (seriesPicker || !seriesPickerContainer || !currentUser) return;

  seriesPicker = new SeriesPicker({
    container: seriesPickerContainer,
    userId: currentUser.uid,
    currentBookId: bookId, // Exclude current book from position conflict check
    onChange: () => {
      updateSaveButtonState();
    },
  });

  await seriesPicker.init();

  // Set initial series if book has one
  if (book && book.seriesId) {
    seriesPicker.setSelected(book.seriesId, book.seriesPosition);
    originalSeriesId = book.seriesId;
  }
}

/**
 * Initialize the author picker component
 */
async function initAuthorPicker(): Promise<void> {
  if (authorPicker || !authorPickerContainer || !currentUser) return;

  authorPicker = new AuthorPicker({
    container: authorPickerContainer,
    userId: currentUser.uid,
    onChange: () => {
      updateSaveButtonState();
    },
  });

  await authorPicker.init();

  // Set initial author if book has one
  if (book && book.author) {
    authorPicker.setValue(book.author);
  }
}

/**
 * Initialize the image gallery component
 */
function initImageGallery(): void {
  if (imageGallery || !imageGalleryContainer || !currentUser || !bookId) return;

  imageGallery = new ImageGallery({
    container: imageGalleryContainer,
    userId: currentUser.uid,
    bookId: bookId,
    maxImages: 10,
    onPrimaryChange: (url: string | null, userInitiated: boolean) => {
      // Update cover picker with primary image (or clear if null)
      if (coverPicker && coverUrlInput) {
        coverPicker.setUserUpload(url, userInitiated);
        if (url) {
          coverUrlInput.value = url;
        }
        updateSaveButtonState();
      }
    },
    onChange: () => {
      updateSaveButtonState();
    },
  });

  // Load existing images if book has any
  if (book && book.images && book.images.length > 0) {
    imageGallery.setImages(book.images as GalleryImage[]);
    originalImages = [...book.images];
  }
}

// Auth Check
onAuthStateChanged(auth, (user: User | null) => {
  if (user) {
    currentUser = user;
    loadBook();
  }
});

/**
 * Initialize the genre picker component
 */
async function initGenrePicker(): Promise<void> {
  if (genrePicker || !genrePickerContainer || !currentUser) return;

  genrePicker = new GenrePicker({
    container: genrePickerContainer,
    userId: currentUser.uid,
    onChange: () => {
      updateSaveButtonState();
    },
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

/**
 * Fetch genre suggestions from APIs
 * @param isbn - Book ISBN
 */
async function fetchGenreSuggestions(isbn: string): Promise<void> {
  try {
    // Use lookupISBN which checks both Google Books and Open Library,
    // parses hierarchical genres, and normalizes variations
    const result = await lookupISBN(isbn);
    if (result?.genres?.length > 0 && genrePicker) {
      genrePicker.setSuggestions(result.genres);
    }
  } catch (e: unknown) {
    const error = e as { message?: string };
    console.warn('Genre suggestions unavailable:', error.message);
  }
}

/**
 * Load book data from repository
 */
async function loadBook(): Promise<void> {
  if (!currentUser || !bookId) return;

  try {
    book = (await bookRepository.getById(currentUser.uid, bookId)) as unknown as BookData | null;

    if (!book) {
      showToast('Book not found', { type: 'error' });
      setTimeout(() => (window.location.href = '/books/'), 1500);
      return;
    }

    renderForm();
  } catch (error) {
    console.error('Error loading book:', error);
    showToast('Error loading book', { type: 'error' });
  }
}

/**
 * Render the edit form with book data
 */
function renderForm(): void {
  if (
    !book ||
    !breadcrumb ||
    !pageTitle ||
    !titleInput ||
    !coverUrlInput ||
    !publisherInput ||
    !publishedDateInput ||
    !physicalFormatInput ||
    !pageCountInput ||
    !notesInput ||
    !loading ||
    !content
  ) {
    return;
  }

  // Render breadcrumbs
  renderBreadcrumbs(breadcrumb, Breadcrumbs.bookEdit(book.title, bookId!));

  // Page title
  pageTitle.textContent = `Edit: ${book.title}`;

  // Form fields
  titleInput.value = book.title || '';
  // Author is set via initAuthorPicker
  coverUrlInput.value = book.coverImageUrl || '';
  publisherInput.value = book.publisher || '';
  publishedDateInput.value = book.publishedDate || '';
  physicalFormatInput.value = book.physicalFormat || '';
  pageCountInput.value = String(book.pageCount || '');
  notesInput.value = book.notes || '';
  initRatingInput(book.rating || 0);

  // Reading dates
  const migratedBook = migrateBookReads(book as Parameters<typeof migrateBookReads>[0]);
  currentReads = migratedBook.reads ? [...migratedBook.reads.map(r => ({ ...r }) as ReadEntry)] : [];
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
    reads: JSON.stringify(currentReads),
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

/**
 * Fetch book covers from APIs
 * @param isbn - Book ISBN
 */
async function fetchBookCovers(isbn: string): Promise<void> {
  try {
    const result = await lookupISBN(isbn);
    if (result && result.covers && book) {
      setCoverPickerCovers(result.covers, book.coverImageUrl);
    }
  } catch (e) {
    console.warn('Error fetching covers:', e);
  }
}

/**
 * Initialize the rating input component
 * @param initialValue - Initial rating value
 */
function initRatingInput(initialValue = 0): void {
  if (ratingInput) {
    ratingInput.setValue(initialValue);
    return;
  }

  if (!ratingInputContainer) return;

  ratingInput = new RatingInput({
    container: ratingInputContainer,
    value: initialValue,
    onChange: () => {
      updateSaveButtonState();
    },
  });
}

/**
 * Format a timestamp for date input
 * @param timestamp - Timestamp to format
 * @returns ISO date string or empty string
 */
function formatDateForInput(timestamp: unknown): string {
  const date = parseTimestamp(timestamp as Parameters<typeof parseTimestamp>[0]);
  if (!date) return '';
  return date.toISOString().split('T')[0];
}

/**
 * Update the reading dates UI based on current reads
 */
function updateReadingDatesUI(): void {
  if (
    !startedDateInput ||
    !finishedDateInput ||
    !readingStatusBadge ||
    !rereadBtn ||
    !readHistorySection ||
    !historyCount
  ) {
    return;
  }

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
    historyCount.textContent = String(previousReads.length);
    renderReadHistory(previousReads);
  } else {
    readHistorySection.classList.add('hidden');
  }

  initIcons();
}

/**
 * Render the read history list
 * @param previousReads - Array of previous read entries
 */
function renderReadHistory(previousReads: ReadEntry[]): void {
  if (!readHistoryList) return;

  const html = previousReads
    .slice()
    .reverse()
    .map(read => {
      const started = formatDate(read.startedAt) || 'Unknown';
      const finished = formatDate(read.finishedAt) || 'In progress';
      return `<div class="text-gray-500">${started} - ${finished}</div>`;
    })
    .join('');
  readHistoryList.innerHTML = html;
}

startedDateInput?.addEventListener('change', () => {
  if (!startedDateInput || !finishedDateInput || !readingDateError) return;

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

finishedDateInput?.addEventListener('change', () => {
  if (!startedDateInput || !finishedDateInput || !readingDateError) return;

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

rereadBtn?.addEventListener('click', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  currentReads.push({ startedAt: today.getTime(), finishedAt: null });

  updateReadingDatesUI();
  updateSaveButtonState();
  showToast('Started new read!', { type: 'success' });
});

toggleHistoryBtn?.addEventListener('click', () => {
  if (!readHistoryList || !historyChevron) return;

  const isHidden = readHistoryList.classList.contains('hidden');
  readHistoryList.classList.toggle('hidden');
  historyChevron.style.transform = isHidden ? 'rotate(90deg)' : '';
});

/**
 * Check if the form has unsaved changes
 * @returns True if form is dirty
 */
function checkFormDirty(): boolean {
  if (
    !titleInput ||
    !coverUrlInput ||
    !publisherInput ||
    !publishedDateInput ||
    !physicalFormatInput ||
    !pageCountInput ||
    !notesInput
  ) {
    return false;
  }

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
  if (!currentGenres.every((g: string) => originalValues.genres.includes(g))) return true;

  // Check series
  const currentSeries = seriesPicker
    ? seriesPicker.getSelected()
    : { seriesId: originalSeriesId, position: book?.seriesPosition ?? null };
  if (currentSeries.seriesId !== originalSeriesId) return true;
  if (currentSeries.seriesId && book && currentSeries.position !== book.seriesPosition) return true;

  // Check images
  const currentImages = imageGallery ? imageGallery.getImages() : originalImages;
  if (currentImages.length !== originalImages.length) return true;
  if (JSON.stringify(currentImages.map((i: BookImage) => i.id)) !== JSON.stringify(originalImages.map(i => i.id))) {
    return true;
  }

  return false;
}

/**
 * Update save button enabled state based on form dirty status
 */
function updateSaveButtonState(): void {
  if (!saveBtn) return;

  formDirty = checkFormDirty();
  saveBtn.disabled = !formDirty;
  saveBtn.classList.toggle('opacity-50', !formDirty);
  saveBtn.classList.toggle('cursor-not-allowed', !formDirty);
}

// Save Changes
editForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();

  if (
    !editForm ||
    !titleInput ||
    !coverUrlInput ||
    !publisherInput ||
    !publishedDateInput ||
    !physicalFormatInput ||
    !pageCountInput ||
    !notesInput ||
    !saveBtn ||
    !currentUser ||
    !bookId ||
    !authorPickerContainer
  ) {
    return;
  }

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
    notes: notesInput.value.trim(),
  };

  const validation = validateForm<BookFormData>(BookFormSchema, formData);
  if (!validation.success) {
    if (validation.errors.title) showFieldError(titleInput, validation.errors.title);
    if (validation.errors.author) {
      const authorInput = authorPickerContainer.querySelector('.author-picker-input') as HTMLInputElement | null;
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
    covers: Object.keys(availableCovers).length > 0 ? (availableCovers as BookCovers) : null,
    publisher: validation.data.publisher || '',
    publishedDate: validation.data.publishedDate || '',
    physicalFormat: (validation.data.physicalFormat || '') as PhysicalFormat,
    pageCount: validation.data.pageCount || null,
    seriesId: selectedSeries.seriesId,
    seriesPosition: selectedSeries.position,
    rating: validation.data.rating || null,
    notes: validation.data.notes || '',
    genres: selectedGenres,
    images: imageGallery ? imageGallery.getImages() : [],
    reads: currentReads as BookRead[],
  };

  try {
    await bookRepository.update(currentUser.uid, bookId, updates);

    const addedGenres = selectedGenres.filter((g: string) => !originalGenres.includes(g));
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
  el?.addEventListener('input', () => {
    updateSaveButtonState();
  });
});

// Warn before leaving with unsaved changes
if (beforeUnloadHandler) {
  window.removeEventListener('beforeunload', beforeUnloadHandler);
}
beforeUnloadHandler = (e: BeforeUnloadEvent) => {
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
    imageGallery.cleanupUnsavedUploads().catch((err: unknown) => {
      console.error('Failed to cleanup unsaved uploads:', err);
    });
  }
});

// Intercept in-app navigation (header/breadcrumb links) when form is dirty
// Shows custom ConfirmSheet instead of allowing immediate navigation
interceptNavigation({
  isDirty: () => formDirty,
  showConfirmation: () =>
    ConfirmSheet.show({
      title: 'Discard Changes?',
      message: 'You have unsaved changes. Are you sure you want to leave?',
      confirmText: 'Discard',
      cancelText: 'Keep Editing',
      confirmClass: 'bg-red-600 hover:bg-red-700',
    }),
  onBeforeNavigate: () => {
    // Clear dirty flag to prevent beforeunload from also triggering
    formDirty = false;
    if (imageGallery?.hasUnsavedUploads()) {
      imageGallery.cleanupUnsavedUploads();
    }
  },
});

/**
 * Fetch book data from Google Books or Open Library APIs
 * @param isbn - Book ISBN
 * @param title - Book title
 * @param author - Book author
 * @returns API lookup result or null
 */
async function fetchBookDataFromAPI(
  isbn: string | undefined,
  title: string | undefined,
  author: string | undefined
): Promise<APILookupResult | null> {
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
          pageCount: volumeInfo.pageCount || null,
        };
      }
    } catch (e) {
      console.error('Google Books search error:', e);
    }
  }

  return null;
}

refreshDataBtn?.addEventListener('click', async () => {
  if (
    !refreshDataBtn ||
    !titleInput ||
    !publisherInput ||
    !publishedDateInput ||
    !physicalFormatInput ||
    !pageCountInput ||
    !coverUrlInput ||
    !book
  ) {
    return;
  }

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
    const changedFields: string[] = [];

    const normalizeField = (
      input: HTMLInputElement,
      normalizeFn: (value: string) => string,
      fieldName: string
    ): void => {
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
    if (authorPicker && authorPickerContainer) {
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
      const fillEmptyField = (
        input: HTMLInputElement,
        newValue: string | number | undefined | null,
        fieldName: string
      ): void => {
        if (newValue != null && newValue !== '' && !input.value.trim()) {
          input.value = String(newValue);
          input.classList.add('field-changed');
          if (!changedFields.includes(fieldName)) {
            changedFields.push(fieldName);
          }
        }
      };

      fillEmptyField(titleInput, apiData.title, 'title');
      // Author uses AuthorPicker instead of standard input
      if (authorPicker && authorPickerContainer && apiData.author && !authorPicker.getValue().trim()) {
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
        if (!coverUrlInput.value.trim() && coverPicker) {
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
