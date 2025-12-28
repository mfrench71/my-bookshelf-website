// Book View Page Logic (Read-only display)
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { parseTimestamp, formatDate, showToast, initIcons, renderStars, getContrastColor, migrateBookReads, getBookStatus, escapeHtml, isValidHexColor } from '../utils.js';
import { loadUserGenres, createGenreLookup } from '../genres.js';
import { loadUserSeries, createSeriesLookup, softDeleteSeries } from '../series.js';
import { formatSeriesDisplay } from '../utils/series-parser.js';
import { renderBreadcrumbs, Breadcrumbs } from '../components/breadcrumb.js';
import { BottomSheet } from '../components/modal.js';
import { softDeleteBook } from '../bin.js';

// Initialize icons
initIcons();

// State
let currentUser = null;
let bookId = null;
let book = null;
let genreLookup = null;
let seriesLookup = null;

// Get book ID from URL
const urlParams = new URLSearchParams(window.location.search);
bookId = urlParams.get('id');

if (!bookId) {
  window.location.href = '/books/';
}

// DOM Elements
const loading = document.getElementById('loading');
const content = document.getElementById('main-content');
const breadcrumb = document.getElementById('breadcrumb');
const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-btn');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const deleteSeriesOption = document.getElementById('delete-series-option');
const deleteSeriesCheckbox = document.getElementById('delete-series-checkbox');
const deleteSeriesName = document.getElementById('delete-series-name');

// Bottom Sheet Instance
const deleteSheet = deleteModal ? new BottomSheet({ container: deleteModal }) : null;

// Cover elements
const coverPlaceholder = document.getElementById('cover-placeholder');
const coverImage = document.getElementById('cover-image');
const coverLoading = document.getElementById('cover-loading');

// Detail elements
const bookTitleEl = document.getElementById('book-title');
const bookAuthorEl = document.getElementById('book-author');
const ratingSection = document.getElementById('rating-section');
const ratingStars = document.getElementById('rating-stars');
const statusSection = document.getElementById('status-section');
const readingStatus = document.getElementById('reading-status');
const genresSection = document.getElementById('genres-section');
const genreBadges = document.getElementById('genre-badges');
const seriesSection = document.getElementById('series-section');
const seriesTitle = document.getElementById('series-title');
const seriesBooks = document.getElementById('series-books');
const seriesViewAll = document.getElementById('series-view-all');
const notesSection = document.getElementById('notes-section');
const bookNotes = document.getElementById('book-notes');
const readingHistorySection = document.getElementById('reading-history-section');
const readingHistory = document.getElementById('reading-history');

// Metadata elements
const isbnRow = document.getElementById('isbn-row');
const bookIsbn = document.getElementById('book-isbn');
const pagesRow = document.getElementById('pages-row');
const bookPages = document.getElementById('book-pages');
const formatRow = document.getElementById('format-row');
const bookFormat = document.getElementById('book-format');
const publisherRow = document.getElementById('publisher-row');
const bookPublisher = document.getElementById('book-publisher');
const publishedRow = document.getElementById('published-row');
const bookPublished = document.getElementById('book-published');
const addedRow = document.getElementById('added-row');
const bookAdded = document.getElementById('book-added');
const modifiedRow = document.getElementById('modified-row');
const bookModified = document.getElementById('book-modified');

// Auth Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    // Load genres and series for badge display
    const [genres, series] = await Promise.all([
      loadUserGenres(user.uid),
      loadUserSeries(user.uid)
    ]);
    genreLookup = createGenreLookup(genres);
    seriesLookup = createSeriesLookup(series);
    loadBook();
  }
});

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

    // Redirect to bin if book is in bin
    if (book.deletedAt) {
      showToast('This book is in the bin', { type: 'info' });
      setTimeout(() => window.location.href = '/settings/bin/', 1500);
      return;
    }

    renderBook();
  } catch (error) {
    console.error('Error loading book:', error);
    showToast('Error loading book', { type: 'error' });
  }
}

function renderBook() {
  // Render breadcrumbs
  renderBreadcrumbs(breadcrumb, Breadcrumbs.bookView(book.title, bookId));

  // Set edit button URL
  editBtn.href = `/books/edit/?id=${bookId}`;

  // Cover - use the stored cover URL directly
  if (book.coverImageUrl) {
    // Show loading spinner while image loads
    coverLoading.classList.remove('hidden');
    coverPlaceholder.classList.add('hidden');

    coverImage.onload = () => {
      // Image loaded successfully - hide spinner, show image
      coverLoading.classList.add('hidden');
      coverImage.classList.remove('hidden');
    };

    coverImage.onerror = () => {
      // Failed to load - show placeholder
      coverLoading.classList.add('hidden');
      coverImage.classList.add('hidden');
      coverPlaceholder.classList.remove('hidden');
    };

    coverImage.src = book.coverImageUrl;
  }

  // Title & Author
  bookTitleEl.textContent = book.title;
  const authorName = book.author || 'Unknown author';
  bookAuthorEl.textContent = authorName;
  if (book.author) {
    bookAuthorEl.href = `/books/?author=${encodeURIComponent(book.author)}`;
  } else {
    bookAuthorEl.removeAttribute('href');
    bookAuthorEl.style.cursor = 'default';
  }

  // Rating
  if (book.rating) {
    ratingStars.innerHTML = renderStars(book.rating);
    ratingSection.classList.remove('hidden');
  }

  // Reading Status
  const migratedBook = migrateBookReads(book);
  const status = getBookStatus(migratedBook);
  if (status) {
    if (status === 'reading') {
      readingStatus.innerHTML = '<i data-lucide="book-open" class="w-4 h-4"></i> Reading';
      readingStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800';
    } else if (status === 'finished') {
      readingStatus.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Finished';
      readingStatus.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800';
    }
    statusSection.classList.remove('hidden');
  }

  // Genres
  if (book.genres && book.genres.length > 0 && genreLookup) {
    const html = book.genres
      .map(gId => genreLookup.get(gId))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(g => {
        const safeColor = isValidHexColor(g.color) ? g.color : '#6b7280';
        const textColor = getContrastColor(safeColor);
        return `<span class="genre-badge" style="background-color: ${safeColor}; color: ${textColor}">${escapeHtml(g.name)}</span>`;
      })
      .join('');
    genreBadges.innerHTML = html;
    genresSection.classList.remove('hidden');
  }

  // Series
  if (book.seriesId && seriesLookup) {
    renderSeriesSection();
  }

  // Metadata
  if (book.isbn) {
    bookIsbn.textContent = book.isbn;
    isbnRow.classList.remove('hidden');
  }
  if (book.pageCount) {
    bookPages.textContent = book.pageCount;
    pagesRow.classList.remove('hidden');
  }
  if (book.physicalFormat) {
    bookFormat.textContent = book.physicalFormat;
    formatRow.classList.remove('hidden');
  }
  if (book.publisher) {
    bookPublisher.textContent = book.publisher;
    publisherRow.classList.remove('hidden');
  }
  if (book.publishedDate) {
    bookPublished.textContent = book.publishedDate;
    publishedRow.classList.remove('hidden');
  }
  const dateAdded = parseTimestamp(book.createdAt);
  if (dateAdded) {
    bookAdded.textContent = dateAdded.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    addedRow.classList.remove('hidden');
  }
  const dateModified = parseTimestamp(book.updatedAt);
  if (dateModified && dateAdded && dateModified.getTime() !== dateAdded.getTime()) {
    bookModified.textContent = dateModified.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    modifiedRow.classList.remove('hidden');
  }

  // Reading History
  const reads = migratedBook.reads || [];
  if (reads.length > 0) {
    const historyHtml = reads.slice().reverse().map(read => {
      const started = formatDate(read.startedAt) || 'Unknown';
      const finished = read.finishedAt ? formatDate(read.finishedAt) : 'In progress';
      return `
        <div class="flex items-center gap-2 text-sm">
          <i data-lucide="calendar" class="w-4 h-4 text-gray-400"></i>
          <span>${started} - ${finished}</span>
        </div>
      `;
    }).join('');
    readingHistory.innerHTML = historyHtml;
    readingHistorySection.classList.remove('hidden');
  }

  // Notes
  if (book.notes && book.notes.trim()) {
    bookNotes.textContent = book.notes;
    notesSection.classList.remove('hidden');
  }

  // Show content
  loading.classList.add('hidden');
  content.classList.remove('hidden');
  initIcons();
}

// Render series section with other books in the same series
async function renderSeriesSection() {
  const seriesObj = seriesLookup?.get(book.seriesId);
  if (!seriesObj) return;

  const seriesName = seriesObj.name;

  // Update title with series name
  seriesTitle.textContent = seriesName;

  // Load books in the same series using Firestore query
  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const seriesQuery = query(booksRef, where('seriesId', '==', book.seriesId));
    const snapshot = await getDocs(seriesQuery);

    const seriesBooksData = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Sort by position (nulls at end)
    seriesBooksData.sort((a, b) => {
      if (a.seriesPosition === null && b.seriesPosition === null) return 0;
      if (a.seriesPosition === null) return 1;
      if (b.seriesPosition === null) return -1;
      return a.seriesPosition - b.seriesPosition;
    });

    // Render book list
    if (seriesBooksData.length > 1) {
      const booksHtml = seriesBooksData.map(b => {
        const isCurrent = b.id === bookId;
        const positionStr = b.seriesPosition ? `#${b.seriesPosition}` : '';
        const displayText = positionStr ? `${positionStr} ${b.title}` : b.title;

        if (isCurrent) {
          return `
            <div class="flex items-center gap-2 text-sm py-1 text-primary font-medium">
              <i data-lucide="book-open" class="w-4 h-4"></i>
              <span>${displayText}</span>
              <span class="text-xs text-gray-400">(viewing)</span>
            </div>
          `;
        }
        return `
          <a href="/books/view/?id=${b.id}" class="flex items-center gap-2 text-sm py-1 text-gray-700 hover:text-primary">
            <i data-lucide="book" class="w-4 h-4 text-gray-400"></i>
            <span>${displayText}</span>
          </a>
        `;
      }).join('');

      seriesBooks.innerHTML = booksHtml;

      // Show "View all" link (use series ID for filtering)
      seriesViewAll.href = `/books/?series=${encodeURIComponent(book.seriesId)}`;
      seriesViewAll.classList.remove('hidden');
    } else {
      // Only current book in series - just show series name
      seriesBooks.innerHTML = `
        <p class="text-sm text-gray-500">
          ${formatSeriesDisplay(seriesName, book.seriesPosition)}
        </p>
      `;
    }

    seriesSection.classList.remove('hidden');
    initIcons();
  } catch (error) {
    console.error('Error loading series books:', error);
    // Still show series info even if query fails
    seriesBooks.innerHTML = `
      <p class="text-sm text-gray-500">
        ${formatSeriesDisplay(seriesName, book.seriesPosition)}
      </p>
    `;
    seriesSection.classList.remove('hidden');
  }
}

// Delete handlers
deleteBtn.addEventListener('click', () => {
  // Check if this is the last book in a series
  if (book.seriesId && seriesLookup) {
    const seriesObj = seriesLookup.get(book.seriesId);
    if (seriesObj && seriesObj.bookCount === 1) {
      // This is the last book in the series - show option to delete series
      deleteSeriesName.textContent = `"${seriesObj.name}" will become empty`;
      deleteSeriesOption.classList.remove('hidden');
      deleteSeriesCheckbox.checked = false;
    } else {
      deleteSeriesOption.classList.add('hidden');
    }
  } else {
    deleteSeriesOption.classList.add('hidden');
  }
  deleteSheet?.open();
});

cancelDeleteBtn.addEventListener('click', () => {
  deleteSheet?.close();
});

confirmDeleteBtn.addEventListener('click', async () => {
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Moving...';

  // Check if user wants to delete the empty series too
  const shouldDeleteSeries = deleteSeriesCheckbox.checked && book.seriesId;
  const seriesIdToDelete = shouldDeleteSeries ? book.seriesId : null;

  try {
    await softDeleteBook(currentUser.uid, bookId, book);

    // Soft-delete the series if requested (can be restored with book)
    if (seriesIdToDelete) {
      try {
        await softDeleteSeries(currentUser.uid, seriesIdToDelete);
        showToast('Book and series moved to bin', { type: 'success' });
      } catch (seriesError) {
        console.error('Error deleting series:', seriesError);
        showToast('Book moved to bin (series deletion failed)', { type: 'info' });
      }
    } else {
      showToast('Book moved to bin', { type: 'success' });
    }

    setTimeout(() => window.location.href = '/books/', 1000);
  } catch (error) {
    console.error('Error moving to bin:', error);
    showToast('Error moving book to bin', { type: 'error' });
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Move to Bin';
    deleteSheet?.close();
  }
});
