// Add Book Page Logic
import { auth } from '/js/firebase-config.js';
import { onAuthStateChanged, User } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { bookRepository } from '../repositories/book-repository.js';
import {
  escapeHtml,
  escapeAttr,
  debounce,
  showToast,
  initIcons,
  clearBooksCache,
  isOnline,
  lockBodyScroll,
  unlockBodyScroll,
  lookupISBN,
  searchBooks as searchBooksAPI,
  isValidImageUrl,
  interceptNavigation,
} from '../utils.js';
import { parseHierarchicalGenres } from '../utils/genre-parser.js';
import { GenrePicker } from '../components/genre-picker.js';
import { RatingInput } from '../components/rating-input.js';
import { CoverPicker } from '../components/cover-picker.js';
import { SeriesPicker } from '../components/series-picker.js';
import { AuthorPicker } from '../components/author-picker.js';
import { ImageGallery } from '../components/image-gallery.js';
import { updateGenreBookCounts, clearGenresCache } from '../genres.js';
import { updateSeriesBookCounts, clearSeriesCache } from '../series.js';
import { ConfirmSheet } from '../components/modal.js';
import { BookFormSchema } from '../schemas/book.js';
import { validateForm, showFieldError, clearFormErrors, scrollToFirstError } from '../utils/validation.js';
import { wishlistRepository } from '../repositories/wishlist-repository.js';
import { isISBN, cleanISBN, checkForDuplicate } from '../utils/duplicate-checker.js';

// Declare Quagga as a global (loaded from vendor script)
declare const Quagga: {
  init: (config: unknown, callback: (err: unknown) => void) => void;
  start: () => void;
  stop: () => void;
  onDetected: (callback: (result: QuaggaResult) => void) => void;
  offDetected: () => void;
};

/** Quagga detection result */
interface QuaggaResult {
  codeResult?: {
    code?: string;
    decodedCodes?: Array<{ error?: number }>;
  };
}

/** Book cover URLs */
interface BookCovers {
  googleBooks?: string;
  openLibrary?: string;
}

/** Book data from API lookup */
interface BookLookupData {
  title?: string;
  author?: string;
  covers?: BookCovers;
  publisher?: string;
  publishedDate?: string;
  physicalFormat?: string;
  pageCount?: number | string;
  seriesName?: string;
  seriesPosition?: number;
  genres?: string[];
  source?: string;
}

/** Search result book */
interface SearchResultBook {
  title: string;
  author: string;
  cover?: string;
  publisher?: string;
  publishedDate?: string;
  isbn?: string;
  pageCount?: number;
  categories?: string[];
}

/** Wishlist item */
interface WishlistItem {
  id?: string;
  title: string;
  author?: string;
  isbn?: string;
}

/** Wishlist lookup type */
type WishlistLookup = Map<string, WishlistItem>;

/** Search state */
interface SearchState {
  query: string;
  startIndex: number;
  useOpenLibrary: boolean;
  hasMore: boolean;
  loading: boolean;
  totalItems: number;
}

// Initialize icons once on load
initIcons();

// State
let currentUser: User | null = null;
let ratingInput: RatingInput | null = null;
let coverPicker: CoverPicker | null = null;
let seriesPicker: SeriesPicker | null = null;
let authorPicker: AuthorPicker | null = null;
let imageGallery: ImageGallery | null = null;
let scannerRunning = false;
let beforeUnloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
let genrePicker: GenrePicker | null = null;
let apiGenreSuggestions: string[] = [];
let duplicateCheckBypassed = false;
let wishlistLookup: WishlistLookup | null = null;
let currentISBN = ''; // Track ISBN from lookup (since there's no input field now)

// DOM Elements - Search Section
const searchSection = document.getElementById('search-section');
const bookSearchInput = document.getElementById('book-search') as HTMLInputElement | null;
const searchBtn = document.getElementById('book-search-btn');
const clearSearchBtn = document.getElementById('clear-search');
const searchStatus = document.getElementById('search-status');
const searchResultsDiv = document.getElementById('book-search-results');
const resultsCount = document.getElementById('results-count');
const resultsList = document.getElementById('results-list');
const addManuallyBtn = document.getElementById('add-manually-btn');

// DOM Elements - Form Section
const formSection = document.getElementById('form-section');
const dataSourceEl = document.getElementById('data-source');
const dataSourceText = document.getElementById('data-source-text');
const startOverBtn = document.getElementById('start-over-btn');
const bookForm = document.getElementById('book-form') as HTMLFormElement | null;
const titleInput = document.getElementById('title') as HTMLInputElement | null;
const authorPickerContainer = document.getElementById('author-picker-container');
const coverUrlInput = document.getElementById('cover-url') as HTMLInputElement | null;
const coverPickerContainer = document.getElementById('cover-picker-container');
const coverPickerHint = document.getElementById('cover-picker-hint');
const imageGalleryContainer = document.getElementById('image-gallery-container');
const notesInput = document.getElementById('notes') as HTMLTextAreaElement | null;
const publisherInput = document.getElementById('publisher') as HTMLInputElement | null;
const publishedDateInput = document.getElementById('published-date') as HTMLInputElement | null;
const physicalFormatInput = document.getElementById('physical-format') as HTMLInputElement | null;
const pageCountInput = document.getElementById('page-count') as HTMLInputElement | null;
const submitBtn = document.getElementById('submit-btn') as HTMLButtonElement | null;
const ratingInputContainer = document.getElementById('rating-input');
const genrePickerContainer = document.getElementById('genre-picker-container');
const seriesPickerContainer = document.getElementById('series-picker-container');

// Scanner DOM Elements
const scanBtn = document.getElementById('scan-btn');
const scannerModal = document.getElementById('scanner-modal') as HTMLElement & {
  _escapeHandler?: (e: KeyboardEvent) => void;
};
const closeScannerBtn = document.getElementById('close-scanner');
const scannerContainer = document.getElementById('scanner-container');
const scannerLoading = document.getElementById('scanner-loading');
const scannerViewfinder = document.getElementById('scanner-viewfinder');

/**
 * Check if the form has actual content that would be lost
 * For add page, form is only dirty if there's meaningful content
 */
function hasFormContent(): boolean {
  // Check text inputs
  if (titleInput?.value.trim()) return true;
  if (authorPicker?.getValue().trim()) return true;
  if (coverUrlInput?.value.trim()) return true;
  if (publisherInput?.value.trim()) return true;
  if (publishedDateInput?.value.trim()) return true;
  if (physicalFormatInput?.value.trim()) return true;
  if (pageCountInput?.value.trim()) return true;
  if (notesInput?.value.trim()) return true;

  // Check rating
  if (ratingInput?.getValue() > 0) return true;

  // Check pickers
  if (genrePicker?.getSelected().length > 0) return true;
  if (seriesPicker?.getSelected().seriesId) return true;

  // Check images
  if (imageGallery?.getImages().length > 0) return true;

  return false;
}

/**
 * Show the search section and hide form with animation
 */
function showSearchSection(): void {
  if (!formSection || !searchSection || !bookSearchInput) return;

  // Animate form out
  formSection.classList.add('section-exit');

  setTimeout(() => {
    formSection.classList.add('hidden');
    formSection.classList.remove('section-exit');

    // Animate search in
    searchSection.classList.remove('hidden');
    searchSection.classList.add('section-enter');
    bookSearchInput.focus();

    // Clean up animation class
    setTimeout(() => {
      searchSection.classList.remove('section-enter');
    }, 200);
  }, 150);
}

/**
 * Show the form section and hide search with animation
 * @param source - Data source: 'manual' | 'google' | 'openlibrary' | 'scan'
 */
function showFormSection(source = 'manual'): void {
  if (!searchSection || !formSection || !titleInput) return;

  // Animate search out
  searchSection.classList.add('section-exit');

  setTimeout(() => {
    searchSection.classList.add('hidden');
    searchSection.classList.remove('section-exit');

    // Update data source display
    if (source === 'manual') {
      dataSourceEl?.classList.add('hidden');
      // Reset dirty flag for manual entry - user hasn't made changes yet
    } else {
      dataSourceEl?.classList.remove('hidden');
      const sourceLabels: Record<string, string> = {
        google: 'Found via Google Books',
        openlibrary: 'Found via Open Library',
        scan: 'Found via barcode scan',
      };
      if (dataSourceText) {
        dataSourceText.textContent = sourceLabels[source] || 'Book data loaded';
      }
    }

    // Animate form in
    formSection.classList.remove('hidden');
    formSection.classList.add('section-enter');
    initIcons();
    titleInput.focus();

    // Clean up animation class
    setTimeout(() => {
      formSection.classList.remove('section-enter');
    }, 200);
  }, 150);
}

/**
 * Perform the actual form reset (called after confirmation or if no changes)
 */
function doStartOver(): void {
  // Reset form
  bookForm?.reset();
  currentISBN = '';
  duplicateCheckBypassed = false;
  apiGenreSuggestions = [];

  // Explicitly clear fields that form.reset() may not handle
  if (authorPicker) authorPicker.setValue('');
  if (coverUrlInput) coverUrlInput.value = '';

  // Reset pickers
  if (ratingInput) ratingInput.setValue(0);
  if (coverPicker) coverPicker.setCovers(null);
  if (genrePicker) {
    genrePicker.setSelected([]);
    genrePicker.setSuggestions([]);
  }
  if (seriesPicker) seriesPicker.clear();
  if (imageGallery) imageGallery.cleanupUnsavedUploads();

  // Reset formDirty AFTER pickers (their onChange callbacks set it to true)

  // Reset submit button state
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    submitBtn.textContent = 'Add Book';
    submitBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
    submitBtn.classList.add('bg-primary', 'hover:bg-primary-dark');
  }

  // Clear search
  if (bookSearchInput) bookSearchInput.value = '';
  searchResultsDiv?.classList.add('hidden');
  if (resultsList) resultsList.innerHTML = '';
  clearSearchBtn?.classList.add('hidden');
  searchStatus?.classList.add('hidden');

  showSearchSection();
}

/**
 * Reset form and return to search (with confirmation if dirty)
 */
function startOver(): void {
  // Confirm if form has data
  if (hasFormContent()) {
    const confirmSheet = new ConfirmSheet({
      title: 'Discard Changes?',
      message: 'You have unsaved book data. Are you sure you want to go back?',
      confirmText: 'Discard',
      cancelText: 'Keep Editing',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: () => {
        doStartOver();
      },
    });
    confirmSheet.show();
    return;
  }

  doStartOver();
}

// Auth Check - header.js handles redirect, just capture user
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    currentUser = user;
    initRatingInput();
    initCoverPicker();
    initImageGallery();
    initGenrePicker();
    initSeriesPicker();
    initAuthorPicker();
    // Load wishlist for pre-checking search results
    try {
      const wishlistItems = await wishlistRepository.getAll(user.uid);
      wishlistLookup = wishlistRepository.createLookup(wishlistItems);
    } catch (_e) {
      console.warn('Wishlist load failed');
      wishlistLookup = new Map();
    }
  }
});

/**
 * Initialize Rating Input
 */
function initRatingInput(): void {
  if (ratingInput || !ratingInputContainer) return;

  ratingInput = new RatingInput({
    container: ratingInputContainer,
    value: 0,
    onChange: () => {},
  });
}

/**
 * Initialize Genre Picker
 */
async function initGenrePicker(): Promise<void> {
  if (genrePicker || !genrePickerContainer || !currentUser) return;

  genrePicker = new GenrePicker({
    container: genrePickerContainer,
    userId: currentUser.uid,
    onChange: () => {},
  });

  await genrePicker.init();
}

/**
 * Update genre suggestions from API responses
 */
function updateGenreSuggestions(genres: string[]): void {
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

/**
 * Initialize Series Picker
 */
async function initSeriesPicker(): Promise<void> {
  if (seriesPicker || !seriesPickerContainer || !currentUser) return;

  seriesPicker = new SeriesPicker({
    container: seriesPickerContainer,
    userId: currentUser.uid,
    onChange: () => {},
  });

  await seriesPicker.init();
}

/**
 * Initialize Author Picker
 */
async function initAuthorPicker(): Promise<void> {
  if (authorPicker || !authorPickerContainer || !currentUser) return;

  authorPicker = new AuthorPicker({
    container: authorPickerContainer,
    userId: currentUser.uid,
    onChange: () => {
      updateSubmitButtonState();
    },
  });

  await authorPicker.init();
}

/**
 * Initialize Cover Picker
 */
function initCoverPicker(): void {
  if (coverPicker || !coverPickerContainer) return;

  coverPicker = new CoverPicker({
    container: coverPickerContainer,
    onSelect: (url: string) => {
      if (coverUrlInput) coverUrlInput.value = url;
      // Show hint if multiple covers available
      const covers = coverPicker!.getCovers();
      const hasMultiple = covers?.googleBooks && covers?.openLibrary;
      coverPickerHint?.classList.toggle('hidden', !hasMultiple);
    },
  });
}

/**
 * Initialize Image Gallery
 */
function initImageGallery(): void {
  if (imageGallery || !imageGalleryContainer || !currentUser) return;

  imageGallery = new ImageGallery({
    container: imageGalleryContainer,
    userId: currentUser.uid,
    bookId: null, // Will be set after book is created
    maxImages: 10,
    onPrimaryChange: (url: string | null, userInitiated: boolean) => {
      // Update cover picker with primary image (or clear if null)
      if (coverPicker) {
        coverPicker.setUserUpload(url, userInitiated);
        if (url && coverUrlInput) {
          coverUrlInput.value = url;
        }
      }
    },
    onChange: () => {},
  });
}

/**
 * Set covers in the picker
 */
function setCoverPickerCovers(covers: BookCovers | null): void {
  if (coverPicker) {
    coverPicker.setCovers(covers);
    if (coverUrlInput) coverUrlInput.value = coverPicker.getSelectedUrl() || '';
    // Show hint if multiple covers available
    const hasMultiple = covers && covers.googleBooks && covers.openLibrary;
    coverPickerHint?.classList.toggle('hidden', !hasMultiple);
  }
}

/**
 * Set series suggestion from API lookup
 */
function setSeriesSuggestion(seriesName?: string, seriesPosition?: number): void {
  if (seriesPicker) {
    if (seriesName) {
      seriesPicker.setSuggestion(seriesName, seriesPosition);
    } else {
      seriesPicker.clear();
    }
  }
}

/**
 * Show search status message
 */
function showSearchStatus(message: string, type = 'info'): void {
  if (!searchStatus) return;
  searchStatus.textContent = message;
  searchStatus.classList.remove('hidden', 'text-gray-500', 'text-green-600', 'text-red-600');
  searchStatus.classList.add(
    type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-gray-500'
  );
}

/**
 * Hide search status
 */
function hideSearchStatus(): void {
  searchStatus?.classList.add('hidden');
}

/**
 * Handle unified search - detects ISBN vs title/author
 */
async function handleSearch(): Promise<void> {
  const input = bookSearchInput?.value.trim();
  if (!input) {
    searchResultsDiv?.classList.add('hidden');
    hideSearchStatus();
    return;
  }

  // Hide the ISBN hint when search starts
  hideSearchStatus();

  if (isISBN(input)) {
    // ISBN detected - do direct lookup
    await handleISBNLookup(input);
  } else if (input.length >= 2) {
    // Text search
    await searchBooks(input);
  }
}

/**
 * Handle ISBN lookup (from search input or barcode scan)
 */
async function handleISBNLookup(isbn: string, fromScan = false): Promise<void> {
  const cleanedISBN = cleanISBN(isbn);
  showSearchStatus('Looking up ISBN...', 'info');

  try {
    const bookData = await fetchBookByISBN(cleanedISBN);
    if (bookData) {
      currentISBN = cleanedISBN;

      // Populate form
      if (titleInput) titleInput.value = bookData.title || '';
      if (authorPicker) authorPicker.setValue(bookData.author || '');
      setCoverPickerCovers(bookData.covers || null);
      if (publisherInput) publisherInput.value = bookData.publisher || '';
      if (publishedDateInput) publishedDateInput.value = bookData.publishedDate || '';
      if (physicalFormatInput) physicalFormatInput.value = bookData.physicalFormat || '';
      if (pageCountInput) pageCountInput.value = String(bookData.pageCount || '');
      setSeriesSuggestion(bookData.seriesName, bookData.seriesPosition);

      updateSubmitButtonState();

      // Show form with data source
      const source = fromScan ? 'scan' : bookData.source || 'google';
      showFormSection(source);
      showToast('Book found!', { type: 'success' });
    } else {
      showSearchStatus('Book not found. Try searching by title or add manually.', 'error');
    }
  } catch (error) {
    console.error('ISBN lookup error:', error);
    showSearchStatus('Error looking up ISBN. Please try again.', 'error');
  }
}

/**
 * Fetch book by ISBN
 */
async function fetchBookByISBN(isbn: string): Promise<BookLookupData | null> {
  const result = await lookupISBN(isbn);
  if (result && result.genres) {
    updateGenreSuggestions(result.genres);
  }
  return result;
}

// Book Search State
let searchState: SearchState = {
  query: '',
  startIndex: 0,
  useOpenLibrary: false,
  hasMore: true,
  loading: false,
  totalItems: 0,
};
const SEARCH_PAGE_SIZE = 10;

// Intersection Observer for lazy loading search results
let searchScrollObserver: IntersectionObserver | null = null;

/**
 * Set up IntersectionObserver for search scroll
 */
function setupSearchScrollObserver(): void {
  if (searchScrollObserver) searchScrollObserver.disconnect();

  searchScrollObserver = new IntersectionObserver(
    async entries => {
      if (entries[0].isIntersecting && !searchState.loading && searchState.hasMore) {
        try {
          await loadMoreSearchResults();
        } catch (_e) {
          console.error('Error loading more results');
        }
      }
    },
    { root: resultsList, rootMargin: '50px' }
  );
}

setupSearchScrollObserver();

/**
 * Search books by title/author - tries Google Books, falls back to Open Library
 */
async function searchBooks(query: string): Promise<void> {
  if (!query || query.length < 2) {
    searchResultsDiv?.classList.add('hidden');
    if (resultsList) resultsList.innerHTML = '';
    return;
  }

  hideSearchStatus();

  // Reset search state for new query
  searchState = {
    query,
    startIndex: 0,
    useOpenLibrary: false,
    hasMore: true,
    loading: true,
    totalItems: 0,
  };

  // Clear accumulated genre suggestions from previous searches
  apiGenreSuggestions = [];

  // Show skeleton loaders
  if (resultsList) {
    resultsList.innerHTML = Array(3)
      .fill(
        `
    <div class="flex gap-3 p-3 border-b border-gray-100">
      <div class="skeleton w-12 h-18 rounded flex-shrink-0"></div>
      <div class="flex-1 space-y-2">
        <div class="skeleton h-4 w-3/4 rounded"></div>
        <div class="skeleton h-3 w-1/2 rounded"></div>
        <div class="skeleton h-2 w-2/3 rounded"></div>
      </div>
    </div>
  `
      )
      .join('');
  }
  searchResultsDiv?.classList.remove('hidden');

  const result = await fetchSearchResults();

  if (!result.books.length) {
    if (resultsCount) resultsCount.textContent = 'No results';
    if (resultsList) {
      resultsList.innerHTML = `
      <div class="py-8 text-center">
        <i data-lucide="search-x" class="w-12 h-12 text-gray-300 mx-auto"></i>
        <p class="text-gray-500 mt-3">No books found</p>
        <p class="text-gray-400 text-sm mt-1">Try a different search term</p>
      </div>
    `;
    }
    initIcons();
    return;
  }

  if (resultsCount) {
    resultsCount.textContent = `${result.books.length} result${result.books.length !== 1 ? 's' : ''}`;
  }
  renderSearchResults(result.books, false);
  searchState.startIndex = SEARCH_PAGE_SIZE;
  searchState.hasMore = result.hasMore;
  searchState.loading = false;
}

/**
 * Fetch search results from API
 */
async function fetchSearchResults(): Promise<{ books: SearchResultBook[]; hasMore: boolean }> {
  const { query, startIndex, useOpenLibrary } = searchState;

  const result = await searchBooksAPI(query, {
    startIndex,
    maxResults: SEARCH_PAGE_SIZE,
    useOpenLibrary,
  });

  // Update search state with API results
  searchState.totalItems = result.totalItems;
  searchState.useOpenLibrary = result.useOpenLibrary;

  return { books: result.books, hasMore: result.hasMore };
}

/**
 * Load more search results for infinite scroll
 */
async function loadMoreSearchResults(): Promise<void> {
  if (searchState.loading || !searchState.hasMore) return;

  searchState.loading = true;

  // Add loading indicator
  const sentinel = resultsList?.querySelector('#search-sentinel');
  if (sentinel) {
    sentinel.innerHTML =
      '<div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>';
  }

  const result = await fetchSearchResults();

  if (result.books.length > 0) {
    renderSearchResults(result.books, true);
    searchState.startIndex += result.books.length;
    if (resultsCount) resultsCount.textContent = `${searchState.startIndex} results`;
  }

  searchState.hasMore = result.hasMore;
  searchState.loading = false;
}

/**
 * Render search results to DOM
 */
function renderSearchResults(books: SearchResultBook[], append = false): void {
  if (!resultsList) return;

  const html = books
    .map(book => {
      const hasCover = book.cover && isValidImageUrl(book.cover);
      const isWishlisted = book.isbn && wishlistLookup?.has(book.isbn);
      return `
    <div class="search-result flex gap-3 p-3 hover:bg-gray-50 cursor-pointer"
         data-title="${escapeAttr(book.title)}"
         data-author="${escapeAttr(book.author)}"
         data-cover="${hasCover ? escapeAttr(book.cover!) : ''}"
         data-publisher="${escapeAttr(book.publisher || '')}"
         data-published="${escapeAttr(book.publishedDate || '')}"
         data-isbn="${escapeAttr(book.isbn || '')}"
         data-pagecount="${book.pageCount || ''}"
         data-categories="${escapeAttr(JSON.stringify(book.categories || []))}">
      ${
        hasCover
          ? `<img src="${escapeAttr(book.cover!)}" alt="" class="w-12 h-18 object-cover rounded flex-shrink-0" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''
      }
      <div class="w-12 h-18 bg-gray-200 rounded flex-shrink-0 items-center justify-center${hasCover ? ' hidden' : ' flex'}"><i data-lucide="book" class="w-6 h-6 text-gray-400"></i></div>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-gray-900 truncate">${escapeHtml(book.title)}</p>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(book.author)}</p>
        <p class="text-xs text-gray-400 truncate">
          ${[book.publisher, book.publishedDate, book.pageCount ? `${book.pageCount} pages` : ''].filter(Boolean).join(' · ')}
        </p>
      </div>
      <button type="button" class="wishlist-btn flex-shrink-0 p-2 ${isWishlisted ? 'text-pink-500' : 'text-gray-400 hover:text-pink-500 hover:bg-pink-50'} rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="${isWishlisted ? 'Already in wishlist' : 'Add to wishlist'}" aria-label="${isWishlisted ? 'Already in wishlist' : 'Add to wishlist'}"
        ${isWishlisted ? 'disabled' : ''}>
        <i data-lucide="heart" class="w-5 h-5${isWishlisted ? ' fill-current' : ''}"></i>
      </button>
    </div>
  `;
    })
    .join('');

  // Remove old sentinel if appending
  if (append) {
    const oldSentinel = resultsList.querySelector('#search-sentinel');
    if (oldSentinel) oldSentinel.remove();
  }

  if (append) {
    resultsList.insertAdjacentHTML('beforeend', html);
  } else {
    resultsList.innerHTML = html;

    // Set up click delegation once
    resultsList.onclick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Handle wishlist button click
      const wishlistBtn = target.closest('.wishlist-btn') as HTMLButtonElement | null;
      if (wishlistBtn) {
        e.stopPropagation();
        const result = wishlistBtn.closest('.search-result') as HTMLElement | null;
        if (result) handleAddToWishlist(result, wishlistBtn);
        return;
      }

      // Handle card click to select book
      const result = target.closest('.search-result') as HTMLElement | null;
      if (result) selectSearchResult(result);
    };
  }

  // Add sentinel for infinite scroll if there are more results
  if (searchState.hasMore && searchScrollObserver) {
    resultsList.insertAdjacentHTML(
      'beforeend',
      `
      <div id="search-sentinel" class="py-3 text-center text-xs text-gray-400">
        Scroll for more...
      </div>
    `
    );
    const sentinel = resultsList.querySelector('#search-sentinel');
    if (sentinel) searchScrollObserver.observe(sentinel);
  }

  initIcons();
}

/**
 * Select a search result and populate the form
 */
async function selectSearchResult(el: HTMLElement): Promise<void> {
  const { title, author, cover, publisher, published, isbn, pagecount, categories } = el.dataset;

  // Show loading state on the clicked result
  el.classList.add('opacity-50', 'pointer-events-none');
  el.innerHTML +=
    '<div class="absolute inset-0 flex items-center justify-center bg-white/50"><div class="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full"></div></div>';
  el.classList.add('relative');

  currentISBN = isbn || '';
  if (titleInput) titleInput.value = title || '';
  if (authorPicker) authorPicker.setValue(author || '');

  // Extract and suggest genres from categories (parse through normalizer)
  if (categories) {
    try {
      const categoryList = JSON.parse(categories);
      if (categoryList.length > 0) {
        const parsedGenres = parseHierarchicalGenres(categoryList);
        updateGenreSuggestions(parsedGenres);
      }
    } catch (_e) {
      // Ignore parse errors
    }
  }

  // Set initial values from search result
  if (publisherInput) publisherInput.value = publisher || '';
  if (publishedDateInput) publishedDateInput.value = published || '';
  if (physicalFormatInput) physicalFormatInput.value = '';
  if (pageCountInput) pageCountInput.value = pagecount || '';

  // If we have an ISBN, use lookupISBN to get complete data from both APIs
  // This ensures we get covers from both Google Books and Open Library
  let covers: BookCovers = {};
  let source = 'google';

  if (isbn) {
    try {
      const bookData = await lookupISBN(isbn);
      if (bookData) {
        // Supplement missing fields
        if (publisherInput && !publisherInput.value && bookData.publisher) {
          publisherInput.value = bookData.publisher;
        }
        if (publishedDateInput && !publishedDateInput.value && bookData.publishedDate) {
          publishedDateInput.value = bookData.publishedDate;
        }
        if (physicalFormatInput && !physicalFormatInput.value && bookData.physicalFormat) {
          physicalFormatInput.value = bookData.physicalFormat;
        }
        if (pageCountInput && !pageCountInput.value && bookData.pageCount != null) {
          pageCountInput.value = String(bookData.pageCount);
        }

        // Get covers from both APIs
        if (bookData.covers) {
          covers = bookData.covers;
        }

        // Get genre suggestions
        if (bookData.genres?.length > 0) {
          updateGenreSuggestions(bookData.genres);
        }

        // Get series info
        if (bookData.seriesName) {
          setSeriesSuggestion(bookData.seriesName, bookData.seriesPosition);
        }

        source = bookData.source || 'google';
      }
    } catch (_e) {
      console.error('ISBN lookup error');
      // Fall back to search result cover only
      if (cover) {
        covers.googleBooks = cover;
      }
    }
  } else {
    // No ISBN - use search result cover only
    if (cover) {
      covers.googleBooks = cover;
    }
  }

  // Set covers in picker
  setCoverPickerCovers(Object.keys(covers).length > 0 ? covers : null);

  updateSubmitButtonState();

  // Show form
  showFormSection(source);
  showToast('Book selected!', { type: 'success' });
}

/**
 * Handle adding a book to the wishlist from search results
 */
async function handleAddToWishlist(resultEl: HTMLElement, btn: HTMLButtonElement): Promise<void> {
  if (!currentUser) {
    showToast('Please sign in first', { type: 'error' });
    return;
  }

  // Check for offline before attempting Firebase operation
  if (!isOnline()) {
    showToast('You are offline. Please check your connection.', { type: 'error' });
    return;
  }

  const { title, author, cover, publisher, published, isbn, pagecount } = resultEl.dataset;

  // Disable button and show loading state
  btn.disabled = true;
  btn.classList.add('opacity-50');

  try {
    // Check for duplicates first
    const existing = await wishlistRepository.checkDuplicate(currentUser.uid, isbn || null, title || '', author || '');
    if (existing) {
      showToast(`"${existing.title}" is already in your wishlist`, { type: 'error' });
      return;
    }

    // Add to wishlist
    await wishlistRepository.add(currentUser.uid, {
      title: title || '',
      author: author || '',
      isbn: isbn || null,
      coverImageUrl: cover || null,
      covers: cover ? { googleBooks: cover } : null,
      publisher: publisher || null,
      publishedDate: published || null,
      pageCount: pagecount ? parseInt(pagecount, 10) : null,
      addedFrom: 'search',
    });

    // Update local lookup so subsequent searches show this item as wishlisted
    if (isbn && wishlistLookup) {
      wishlistLookup.set(isbn, { title: title || '', author: author || '', isbn });
    }

    // Update button to show success (filled heart)
    btn.innerHTML = '<i data-lucide="heart" class="w-5 h-5 fill-current"></i>';
    btn.classList.remove('text-gray-400', 'hover:text-pink-500', 'hover:bg-pink-50');
    btn.classList.add('text-pink-500');
    btn.disabled = true;
    btn.title = 'Already in wishlist';
    btn.setAttribute('aria-label', 'Already in wishlist');
    initIcons();

    showToast(`"${title}" added to wishlist`, { type: 'success' });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    showToast('Failed to add to wishlist', { type: 'error' });
  } finally {
    // Only re-enable if not successfully added to wishlist (pink = success state)
    if (!btn.classList.contains('text-pink-500')) {
      btn.disabled = false;
      btn.classList.remove('opacity-50');
    }
  }
}

// Search button click
searchBtn?.addEventListener('click', handleSearch);

// Enter key in search input
bookSearchInput?.addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSearch();
  }
});

// Debounced search on input (only for text, not ISBN)
const debouncedSearch = debounce(async (query: string) => {
  // Don't auto-search ISBNs - wait for explicit Go/Enter
  if (isISBN(query)) {
    searchResultsDiv?.classList.add('hidden');
    showSearchStatus('ISBN detected — press Go to look up', 'info');
    return;
  }

  try {
    await searchBooks(query);
  } catch (error) {
    console.error('Search error:', error);
    if (resultsList) {
      resultsList.innerHTML = '<p class="p-3 text-sm text-red-500">Search failed. Please try again.</p>';
    }
  }
}, 300);

bookSearchInput?.addEventListener('input', () => {
  const query = bookSearchInput.value.trim();
  debouncedSearch(query);
  // Show/hide clear button
  clearSearchBtn?.classList.toggle('hidden', !query);
});

// Clear search button
clearSearchBtn?.addEventListener('click', () => {
  if (bookSearchInput) bookSearchInput.value = '';
  searchResultsDiv?.classList.add('hidden');
  if (resultsList) resultsList.innerHTML = '';
  clearSearchBtn?.classList.add('hidden');
  hideSearchStatus();
  // Reset search state
  searchState = {
    query: '',
    startIndex: 0,
    useOpenLibrary: false,
    hasMore: true,
    loading: false,
    totalItems: 0,
  };
  bookSearchInput?.focus();
});

// Add manually button
addManuallyBtn?.addEventListener('click', () => {
  showFormSection('manual');
});

// Start over button
startOverBtn?.addEventListener('click', startOver);

// Barcode Scanner using Quagga2 - optimized for iOS
scanBtn?.addEventListener('click', openScanner);
closeScannerBtn?.addEventListener('click', closeScanner);

/**
 * Open barcode scanner
 */
async function openScanner(): Promise<void> {
  if (!scannerModal || !scannerContainer) return;

  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    showToast('Camera requires HTTPS. Use the deployed site.', { type: 'error' });
    return;
  }

  scannerModal.classList.remove('hidden');
  lockBodyScroll();
  initIcons();

  // Close on escape key
  const escapeHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') closeScanner();
  };
  document.addEventListener('keydown', escapeHandler);
  scannerModal._escapeHandler = escapeHandler;

  try {
    // Add 10s timeout for camera access to prevent indefinite waiting
    const cameraPromise = navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    const timeoutPromise = new Promise<MediaStream>((_, reject) =>
      setTimeout(() => reject(new Error('Camera access timed out')), 10000)
    );
    const stream = await Promise.race([cameraPromise, timeoutPromise]);
    stream.getTracks().forEach(track => track.stop());
    await startQuagga();
  } catch (err) {
    console.error('Scanner error:', err);
    closeScanner();

    const errorMessages: Record<string, string> = {
      NotAllowedError: 'Camera permission denied. Allow camera access.',
      NotFoundError: 'No camera found.',
      NotReadableError: 'Camera in use by another app.',
    };
    const error = err as Error & { name?: string };
    showToast(errorMessages[error.name || ''] || 'Scanner error. Please try again.', { type: 'error' });
  }
}

/**
 * Play a short beep for scan feedback (iOS doesn't support vibration)
 */
function playBeep(): void {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 1000; // 1kHz tone
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3; // Not too loud

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.1); // 100ms beep
  } catch (_e) {
    // Ignore audio errors
  }
}

/**
 * Start Quagga barcode scanner
 */
function startQuagga(): Promise<void> {
  return new Promise((resolve, reject) => {
    Quagga.init(
      {
        inputStream: {
          name: 'Live',
          type: 'LiveStream',
          target: scannerContainer,
          constraints: { facingMode: 'environment' },
        },
        locator: { patchSize: 'medium', halfSample: true },
        numOfWorkers: 0,
        frequency: 10,
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader'],
        },
        locate: true,
      },
      function (err: unknown) {
        if (err) {
          reject(err);
          return;
        }
        Quagga.start();
        scannerRunning = true;
        // Hide loading, show viewfinder
        scannerLoading?.classList.add('hidden');
        scannerViewfinder?.classList.remove('hidden');
        resolve();
      }
    );

    Quagga.onDetected(function (result: QuaggaResult) {
      if (!result?.codeResult?.code) return;

      const errors = (result.codeResult.decodedCodes || [])
        .filter((x): x is { error: number } => x.error !== undefined)
        .map(x => x.error);
      const avgError = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : 1;

      // Reject scans with high error rate (lower is better, 0.1 is acceptable threshold)
      if (avgError >= 0.1) {
        return;
      }

      const code = result.codeResult.code;
      if (!/^\d{10,13}$/.test(code)) {
        return;
      }

      // Feedback: vibrate on Android, beep on iOS
      if (navigator.vibrate) {
        navigator.vibrate(100);
      } else {
        playBeep();
      }

      closeScanner();
      showToast('Scanned: ' + code, { type: 'success' });
      handleISBNLookup(code, true);
    });
  });
}

/**
 * Close barcode scanner
 */
function closeScanner(): void {
  if (!scannerModal || !scannerContainer) return;

  // Remove escape key handler
  if (scannerModal._escapeHandler) {
    document.removeEventListener('keydown', scannerModal._escapeHandler);
    delete scannerModal._escapeHandler;
  }

  scannerModal.classList.add('hidden');
  unlockBodyScroll();

  if (scannerRunning) {
    try {
      Quagga.stop();
      Quagga.offDetected();
    } catch (_e) {
      // Ignore stop errors
    }
    scannerRunning = false;
  }

  // Force stop any remaining video streams (Quagga may not release properly)
  const video = scannerContainer.querySelector('video') as HTMLVideoElement | null;
  if (video && video.srcObject) {
    (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }

  scannerContainer.innerHTML = '';

  // Reset loading/viewfinder states for next open
  scannerLoading?.classList.remove('hidden');
  scannerViewfinder?.classList.add('hidden');
}

/**
 * Check if book form has minimum required data (title and author)
 */
function isFormValid(): boolean {
  if (!titleInput?.value?.trim()) return false;
  if (!authorPicker?.getValue()?.trim()) return false;
  return true;
}

/**
 * Update submit button state based on form validity
 */
function updateSubmitButtonState(): void {
  const isValid = isFormValid();
  if (submitBtn) {
    submitBtn.disabled = !isValid;
    submitBtn.classList.toggle('opacity-50', !isValid);
    submitBtn.classList.toggle('cursor-not-allowed', !isValid);
  }
}

// Update submit button state when title changes
titleInput?.addEventListener('input', () => {
  updateSubmitButtonState();
});

// Initialize submit button state (disabled until title entered)
updateSubmitButtonState();

// Form Submit
bookForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();

  // Clear previous validation errors
  clearFormErrors(bookForm);

  // Check for offline before attempting Firebase operation
  if (!isOnline()) {
    showToast('You are offline. Please check your connection.', { type: 'error' });
    return;
  }

  if (!currentUser) {
    showToast('Please sign in first', { type: 'error' });
    return;
  }

  const title = titleInput?.value.trim() || '';
  const author = authorPicker ? authorPicker.getValue().trim() : '';
  const isbn = currentISBN;

  // Validate form data
  const formData = {
    title,
    author,
    isbn,
    coverImageUrl: coverUrlInput?.value.trim() || '',
    publisher: publisherInput?.value.trim() || '',
    publishedDate: publishedDateInput?.value.trim() || '',
    physicalFormat: physicalFormatInput?.value.trim() || '',
    pageCount: pageCountInput?.value || '',
    rating: ratingInput ? ratingInput.getValue() : null,
    notes: notesInput?.value.trim() || '',
  };

  const validation = validateForm(BookFormSchema, formData);
  if (!validation.success) {
    // Show field-level errors
    if (validation.errors.title && titleInput) showFieldError(titleInput, validation.errors.title);
    if (validation.errors.author && authorPickerContainer) {
      const authorInput = authorPickerContainer.querySelector('.author-picker-input') as HTMLInputElement | null;
      if (authorInput) showFieldError(authorInput, validation.errors.author);
    }
    if (validation.errors.coverImageUrl && coverUrlInput) {
      showFieldError(coverUrlInput, validation.errors.coverImageUrl);
    }
    if (validation.errors.pageCount && pageCountInput) showFieldError(pageCountInput, validation.errors.pageCount);
    if (validation.errors.notes && notesInput) showFieldError(notesInput, validation.errors.notes);
    // Scroll to first error field
    scrollToFirstError(bookForm);
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking...';
  }

  try {
    // Check for duplicates (unless already bypassed)
    if (!duplicateCheckBypassed) {
      try {
        const { isDuplicate, matchType, existingBook } = await checkForDuplicate(currentUser.uid, isbn, title, author);

        if (isDuplicate && submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Add Anyway';
          // Visual distinction: amber/warning styling for override action
          submitBtn.classList.remove('bg-primary', 'hover:bg-primary-dark');
          submitBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
          duplicateCheckBypassed = true;

          const matchDesc =
            matchType === 'isbn'
              ? `A book with ISBN "${isbn}" already exists`
              : `"${existingBook?.title}" by ${existingBook?.author} already exists`;

          showToast(`${matchDesc}. Click "Add Anyway" to add duplicate.`, { type: 'error', duration: 5000 });
          return;
        }
      } catch (error) {
        console.error('Error checking for duplicates:', error);
        // Continue with add if duplicate check fails
      }
    }

    if (submitBtn) submitBtn.textContent = 'Adding...';

    // Get selected genres from picker
    const selectedGenres = genrePicker ? genrePicker.getSelected() : [];

    // Get selected series from picker
    const selectedSeries = seriesPicker ? seriesPicker.getSelected() : { seriesId: null, position: null };

    const bookData = {
      title,
      author,
      coverImageUrl: coverUrlInput?.value.trim() || '',
      covers: coverPicker && coverPicker.hasCovers() ? coverPicker.getCovers() : null,
      rating: ratingInput ? ratingInput.getValue() : null,
      notes: notesInput?.value.trim() || '',
      isbn,
      genres: selectedGenres,
      publisher: publisherInput?.value.trim() || '',
      publishedDate: publishedDateInput?.value.trim() || '',
      physicalFormat: physicalFormatInput?.value.trim() || '',
      pageCount: pageCountInput?.value ? parseInt(pageCountInput.value, 10) : null,
      seriesId: selectedSeries.seriesId,
      seriesPosition: selectedSeries.position,
      images: imageGallery ? imageGallery.getImages() : [],
      reads: [], // Reading status inferred from reads array
    };

    await bookRepository.create(currentUser.uid, bookData);

    // Update genre book counts
    if (selectedGenres.length > 0) {
      await updateGenreBookCounts(currentUser.uid, selectedGenres, []);
    }

    // Update series book count
    if (selectedSeries.seriesId) {
      await updateSeriesBookCounts(currentUser.uid, selectedSeries.seriesId, null);
    }

    duplicateCheckBypassed = false;

    // Mark uploaded images as saved (prevents cleanup on navigation)
    imageGallery?.markAsSaved();

    // Clear caches so the new book appears on the list page
    clearBooksCache(currentUser.uid);
    clearGenresCache();
    if (selectedSeries.seriesId) {
      clearSeriesCache();
    }

    showToast('Book added!', { type: 'success' });
    setTimeout(() => {
      window.location.href = '/books/';
    }, 1000);
  } catch (error) {
    console.error('Error adding book:', error);
    showToast('Error adding book', { type: 'error' });
  } finally {
    // Always re-enable button (redirect handles success case)
    if (submitBtn) {
      submitBtn.disabled = false;
      if (duplicateCheckBypassed) {
        submitBtn.textContent = 'Add Anyway';
        submitBtn.classList.remove('bg-primary', 'hover:bg-primary-dark');
        submitBtn.classList.add('bg-amber-500', 'hover:bg-amber-600');
      } else {
        submitBtn.textContent = 'Add Book';
        submitBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        submitBtn.classList.add('bg-primary', 'hover:bg-primary-dark');
      }
    }
  }
});

// Track unsaved changes and reset duplicate bypass when form changes
document.querySelectorAll('#book-form input, #book-form textarea, #book-form select').forEach(el =>
  el.addEventListener('input', () => {
    const element = el as HTMLInputElement;
    // Reset duplicate bypass if user changes title or author
    if (['title', 'author'].includes(element.id)) {
      if (duplicateCheckBypassed && submitBtn) {
        duplicateCheckBypassed = false;
        submitBtn.textContent = 'Add Book';
        // Restore default button styling
        submitBtn.classList.remove('bg-amber-500', 'hover:bg-amber-600');
        submitBtn.classList.add('bg-primary', 'hover:bg-primary-dark');
      }
    }
  })
);

// Warn before leaving with unsaved changes
if (beforeUnloadHandler) {
  window.removeEventListener('beforeunload', beforeUnloadHandler);
}
beforeUnloadHandler = (e: BeforeUnloadEvent) => {
  if (hasFormContent()) {
    e.preventDefault();
    e.returnValue = '';
  }
};
window.addEventListener('beforeunload', beforeUnloadHandler);

// Cleanup on page hide (best-effort)
window.addEventListener('pagehide', () => {
  if (imageGallery && hasFormContent()) {
    imageGallery.cleanupUnsavedUploads();
  }
});

// Intercept in-app navigation (header/breadcrumb links) when form is dirty
// Shows custom ConfirmSheet instead of allowing immediate navigation
interceptNavigation({
  isDirty: () => hasFormContent(),
  showConfirmation: () =>
    ConfirmSheet.show({
      title: 'Discard Changes?',
      message: 'You have unsaved book data. Are you sure you want to leave?',
      confirmText: 'Discard',
      cancelText: 'Keep Editing',
      confirmClass: 'bg-red-600 hover:bg-red-700',
    }),
  onBeforeNavigate: () => {
    // Clear dirty flag to prevent beforeunload from also triggering
    if (imageGallery?.hasUnsavedUploads()) {
      imageGallery.cleanupUnsavedUploads();
    }
  },
});
