// Book View Page Logic (Read-only display)
import { auth } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { bookRepository } from '../repositories/book-repository.js';
import {
  parseTimestamp,
  formatDate,
  showToast,
  initIcons,
  renderStars,
  getContrastColor,
  migrateBookReads,
  getBookStatus,
  escapeHtml,
  isValidHexColor,
} from '../utils.js';
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
const content = document.getElementById('book-content');
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
const bookAuthorName = document.getElementById('book-author-name');
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

// Images gallery elements
const imagesSection = document.getElementById('images-section');
const imagesGallery = document.getElementById('images-gallery');

// Lightbox elements
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxLoading = document.getElementById('lightbox-loading');
const lightboxCounter = document.getElementById('lightbox-counter');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxAnnouncer = document.getElementById('lightbox-announcer');
const lightboxSwipeHint = document.getElementById('lightbox-swipe-hint');

// Lightbox state
let lightboxImages = [];
let lightboxIndex = 0;
let lightboxFocusableElements = [];
let lightboxPreviousFocus = null;
let swipeHintShown = false;

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
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    // Load genres and series for badge display
    const [genres, series] = await Promise.all([loadUserGenres(user.uid), loadUserSeries(user.uid)]);
    genreLookup = createGenreLookup(genres);
    seriesLookup = createSeriesLookup(series);
    loadBook();
  }
});

// Load Book
async function loadBook() {
  try {
    book = await bookRepository.getById(currentUser.uid, bookId);

    if (!book) {
      showToast('Book not found', { type: 'error' });
      setTimeout(() => (window.location.href = '/books/'), 1500);
      return;
    }

    // Redirect to bin if book is in bin
    if (book.deletedAt) {
      showToast('This book is in the bin', { type: 'info' });
      setTimeout(() => (window.location.href = '/settings/bin/'), 1500);
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
  bookAuthorName.textContent = authorName;
  if (book.author) {
    bookAuthorEl.href = `/books/?author=${encodeURIComponent(book.author)}`;
    bookAuthorEl.classList.remove('pointer-events-none');
  } else {
    bookAuthorEl.removeAttribute('href');
    bookAuthorEl.classList.add('pointer-events-none');
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
      readingStatus.className =
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800';
    } else if (status === 'finished') {
      readingStatus.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4"></i> Finished';
      readingStatus.className =
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800';
    }
    statusSection.classList.remove('hidden');
  }

  // Genres (clickable links to filter book list)
  if (book.genres && book.genres.length > 0 && genreLookup) {
    const html = book.genres
      .map(gId => genreLookup.get(gId))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(g => {
        const safeColor = isValidHexColor(g.color) ? g.color : '#6b7280';
        const textColor = getContrastColor(safeColor);
        const href = `/books/?genres=${encodeURIComponent(g.id)}`;
        return `<a href="${href}" class="genre-badge genre-badge-link" style="background-color: ${safeColor}; color: ${textColor}">${escapeHtml(g.name)}</a>`;
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
    bookAdded.textContent = dateAdded.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    addedRow.classList.remove('hidden');
  }
  const dateModified = parseTimestamp(book.updatedAt);
  if (dateModified && dateAdded && dateModified.getTime() !== dateAdded.getTime()) {
    bookModified.textContent = dateModified.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    modifiedRow.classList.remove('hidden');
  }

  // Reading History
  const reads = migratedBook.reads || [];
  if (reads.length > 0) {
    const historyHtml = reads
      .slice()
      .reverse()
      .map(read => {
        const started = formatDate(read.startedAt) || 'Unknown';
        const finished = read.finishedAt ? formatDate(read.finishedAt) : 'In progress';
        return `
        <div class="flex items-center gap-2 text-sm">
          <i data-lucide="calendar" class="w-4 h-4 text-gray-400"></i>
          <span>${started} - ${finished}</span>
        </div>
      `;
      })
      .join('');
    readingHistory.innerHTML = historyHtml;
    readingHistorySection.classList.remove('hidden');
  }

  // Notes
  if (book.notes && book.notes.trim()) {
    bookNotes.textContent = book.notes;
    notesSection.classList.remove('hidden');
  }

  // Images gallery
  renderGallery();

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

  // Load books in the same series using repository
  try {
    const allSeriesBooks = await bookRepository.getBySeriesId(currentUser.uid, book.seriesId);

    // Filter out binned (soft-deleted) books
    const seriesBooksData = allSeriesBooks.filter(b => !b.deletedAt);

    // Sort by position (nulls at end)
    seriesBooksData.sort((a, b) => {
      if (a.seriesPosition === null && b.seriesPosition === null) return 0;
      if (a.seriesPosition === null) return 1;
      if (b.seriesPosition === null) return -1;
      return a.seriesPosition - b.seriesPosition;
    });

    // Render book list
    if (seriesBooksData.length > 1) {
      const booksHtml = seriesBooksData
        .map(b => {
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
        })
        .join('');

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
      // Hide "View all" link when there's only one book
      seriesViewAll.classList.add('hidden');
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

    setTimeout(() => (window.location.href = '/books/'), 1000);
  } catch (error) {
    console.error('Error moving to bin:', error);
    showToast('Error moving book to bin', { type: 'error' });
    deleteSheet?.close();
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Move to Bin';
  }
});

// ===== Image Gallery & Lightbox =====

/**
 * Render the images gallery section
 */
function renderGallery() {
  if (!book.images || book.images.length === 0) return;

  // Store images for lightbox
  lightboxImages = book.images;

  // Render gallery thumbnails
  const html = book.images
    .map(
      (img, index) => `
    <button type="button"
            class="gallery-thumb aspect-square bg-gray-100 rounded-lg overflow-hidden relative cursor-pointer hover:opacity-90 transition-opacity"
            data-index="${index}"
            aria-label="View image ${index + 1}">
      <!-- Loading skeleton -->
      <div class="thumb-loading absolute inset-0 flex items-center justify-center bg-gray-100">
        <div class="w-5 h-5 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
      </div>
      <img src="${escapeHtml(img.url)}"
           alt="Book photo ${index + 1}"
           class="w-full h-full object-cover hidden"
           onload="this.classList.remove('hidden'); this.previousElementSibling.classList.add('hidden');"
           onerror="this.style.display='none'; this.previousElementSibling.innerHTML='<i data-lucide=\\'image-off\\' class=\\'w-6 h-6 text-gray-400\\'></i>'; lucide.createIcons();">
      ${
        img.isPrimary
          ? `
        <div class="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-white text-xs rounded font-medium">
          Cover
        </div>
      `
          : ''
      }
    </button>
  `
    )
    .join('');

  imagesGallery.innerHTML = html;
  imagesSection.classList.remove('hidden');

  // Attach click handlers
  imagesGallery.querySelectorAll('.gallery-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const index = parseInt(thumb.dataset.index, 10);
      openLightbox(index);
    });
  });

  initIcons();
}

/**
 * Open lightbox at specified index with animations
 * @param {number} index
 */
function openLightbox(index) {
  if (!lightboxImages.length) return;

  // Store previous focus for restoration
  lightboxPreviousFocus = document.activeElement;

  lightboxIndex = index;

  // Show lightbox with backdrop fade animation
  lightbox.classList.remove('hidden');
  lightbox.classList.remove('lightbox-close');
  lightbox.classList.add('lightbox-open');

  // Add image enter animation
  lightboxImage.classList.add('lightbox-image-enter');

  // Show swipe hint on mobile (first time only)
  if (!swipeHintShown && lightboxSwipeHint && window.innerWidth < 768) {
    lightboxSwipeHint.classList.remove('hidden');
    swipeHintShown = true;
    // Hide hint after 3 seconds
    setTimeout(() => {
      lightboxSwipeHint.classList.add('hidden');
    }, 3000);
  }

  updateLightboxImage(true);
  document.body.style.overflow = 'hidden';

  // Set up focus trap
  setupFocusTrap();

  // Focus close button
  setTimeout(() => lightboxClose?.focus(), 100);

  initIcons();
}

/**
 * Close the lightbox with animations
 */
function closeLightbox() {
  // Add exit animations
  lightbox.classList.remove('lightbox-open');
  lightbox.classList.add('lightbox-close');
  lightboxImage.classList.add('lightbox-image-exit');

  // Wait for animation to complete before hiding
  setTimeout(() => {
    lightbox.classList.add('hidden');
    lightbox.classList.remove('lightbox-close');
    lightboxImage.classList.remove('lightbox-image-enter', 'lightbox-image-exit');
    document.body.style.overflow = '';

    // Reset content position (from swipe)
    if (lightboxContent) {
      lightboxContent.style.transform = '';
      lightboxContent.style.opacity = '';
    }

    // Restore focus
    if (lightboxPreviousFocus) {
      lightboxPreviousFocus.focus();
      lightboxPreviousFocus = null;
    }
  }, 150);
}

/**
 * Navigate to previous image with crossfade
 */
function prevImage() {
  if (lightboxImages.length <= 1) return;
  lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
  updateLightboxImage(false, 'prev');
}

/**
 * Navigate to next image with crossfade
 */
function nextImage() {
  if (lightboxImages.length <= 1) return;
  lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
  updateLightboxImage(false, 'next');
}

/**
 * Update the lightbox to show current image
 * @param {boolean} isOpening - Whether this is the initial open
 * @param {string} direction - Navigation direction ('prev' or 'next')
 */
function updateLightboxImage(isOpening = false, direction = null) {
  const img = lightboxImages[lightboxIndex];
  if (!img) return;

  // Show loading, hide image
  lightboxLoading.classList.remove('hidden');
  lightboxImage.classList.add('hidden');

  // Update counter
  lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxImages.length}`;

  // Announce to screen readers
  announceToScreenReader(`Image ${lightboxIndex + 1} of ${lightboxImages.length}`);

  // Show/hide nav buttons
  const showNav = lightboxImages.length > 1;
  lightboxPrev.classList.toggle('hidden', !showNav);
  lightboxNext.classList.toggle('hidden', !showNav);

  // Load image
  lightboxImage.onload = () => {
    lightboxLoading.classList.add('hidden');
    lightboxImage.classList.remove('hidden');

    // Apply crossfade animation for navigation (not initial open)
    if (!isOpening && direction) {
      lightboxImage.classList.remove('lightbox-crossfade');
      // Force reflow to restart animation
      void lightboxImage.offsetWidth;
      lightboxImage.classList.add('lightbox-crossfade');
    }
  };
  lightboxImage.onerror = () => {
    lightboxLoading.classList.add('hidden');
    lightboxImage.classList.remove('hidden');
    lightboxImage.alt = 'Failed to load image';
    announceToScreenReader('Failed to load image');
  };
  lightboxImage.src = img.url;
  lightboxImage.alt = `Book image ${lightboxIndex + 1}`;
}

/**
 * Announce message to screen readers
 * @param {string} message
 */
function announceToScreenReader(message) {
  if (!lightboxAnnouncer) return;
  lightboxAnnouncer.textContent = '';
  // Use setTimeout to ensure the change is announced
  setTimeout(() => {
    lightboxAnnouncer.textContent = message;
  }, 50);
}

/**
 * Set up focus trap within lightbox
 */
function setupFocusTrap() {
  if (!lightbox) return;

  // Get all focusable elements within lightbox
  lightboxFocusableElements = lightbox.querySelectorAll(
    'button:not([disabled]):not(.hidden), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
}

/**
 * Handle focus trap keyboard navigation
 * @param {KeyboardEvent} e
 */
function handleFocusTrap(e) {
  if (e.key !== 'Tab' || lightbox.classList.contains('hidden')) return;

  const focusable = Array.from(lightboxFocusableElements).filter(el => !el.classList.contains('hidden'));
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// Lightbox event listeners
if (lightboxClose) {
  lightboxClose.addEventListener('click', closeLightbox);
}
if (lightboxPrev) {
  lightboxPrev.addEventListener('click', prevImage);
}
if (lightboxNext) {
  lightboxNext.addEventListener('click', nextImage);
}

// Close on backdrop click
if (lightbox) {
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox || e.target.id === 'lightbox-content') {
      closeLightbox();
    }
  });
}

// Keyboard navigation with focus trap
document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('hidden')) return;

  switch (e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      prevImage();
      break;
    case 'ArrowRight':
      nextImage();
      break;
    case 'Tab':
      handleFocusTrap(e);
      break;
  }
});

// Touch swipe support for mobile (horizontal and vertical)
let touchStartX = 0;
let touchStartY = 0;
let touchCurrentY = 0;
let isDragging = false;

if (lightbox) {
  lightbox.addEventListener(
    'touchstart',
    e => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
      touchCurrentY = touchStartY;
      isDragging = false;
    },
    { passive: true }
  );

  lightbox.addEventListener(
    'touchmove',
    e => {
      const currentX = e.changedTouches[0].screenX;
      touchCurrentY = e.changedTouches[0].screenY;
      const diffY = touchCurrentY - touchStartY;
      const diffX = currentX - touchStartX;

      // Only handle vertical swipe (swipe down to close)
      // Require more vertical than horizontal movement
      if (Math.abs(diffY) > Math.abs(diffX) && diffY > 20) {
        isDragging = true;
        lightbox.classList.add('lightbox-dragging');

        // Move content with finger
        if (lightboxContent) {
          const translateY = Math.max(0, diffY * 0.5); // Dampen the movement
          const opacity = Math.max(0.3, 1 - diffY / 300);
          lightboxContent.style.transform = `translateY(${translateY}px)`;
          lightboxContent.style.opacity = opacity;
        }

        // Hide swipe hint when dragging
        if (lightboxSwipeHint) {
          lightboxSwipeHint.classList.add('hidden');
        }
      }
    },
    { passive: true }
  );

  lightbox.addEventListener(
    'touchend',
    e => {
      const endX = e.changedTouches[0].screenX;
      const endY = e.changedTouches[0].screenY;
      const diffX = endX - touchStartX;
      const diffY = endY - touchStartY;

      lightbox.classList.remove('lightbox-dragging');

      // Check for swipe down to close
      if (isDragging && diffY > 100) {
        closeLightbox();
        return;
      }

      // Reset position if not closing
      if (isDragging && lightboxContent) {
        lightboxContent.style.transform = '';
        lightboxContent.style.opacity = '';
      }

      // Handle horizontal swipe for navigation
      if (!isDragging && Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 0) {
          prevImage(); // Swipe right = previous
        } else {
          nextImage(); // Swipe left = next
        }
      }

      isDragging = false;
    },
    { passive: true }
  );
}
