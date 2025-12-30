// Maintenance Settings Page Logic
import { auth, db, storage } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, listAll, deleteObject, getMetadata } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import { clearGenresCache, recalculateGenreBookCounts } from '../genres.js';
import { showToast, initIcons, clearBooksCache, escapeHtml } from '../utils.js';
import { analyzeLibraryHealth, getCompletenessRating } from '../utils/library-health.js';
import { updateSettingsIndicators } from '../utils/settings-indicators.js';

// Initialize icons on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initIcons);

// State
let currentUser = null;
let books = [];
let allBooksLoaded = false;
let healthReport = null;

// DOM Elements - Genre Counts
const recountGenresBtn = document.getElementById('recount-genres-btn');
const recountResults = document.getElementById('recount-results');
const recountResultsText = document.getElementById('recount-results-text');

// DOM Elements - Library Health
const healthLoading = document.getElementById('health-loading');
const healthSummary = document.getElementById('health-summary');
const healthScore = document.getElementById('health-score');
const healthProgressBar = document.getElementById('health-progress-bar');
const healthRating = document.getElementById('health-rating');
const healthTotalBooks = document.getElementById('health-total-books');
const healthIssuesCount = document.getElementById('health-issues-count');
const healthIssues = document.getElementById('health-issues');
const healthComplete = document.getElementById('health-complete');
const healthRefreshBtn = document.getElementById('health-refresh-btn');
const healthActions = document.getElementById('health-actions');

// Auth Check
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    await updateLibraryHealth();
    updateSettingsIndicators(user.uid);
  }
});

// ==================== Load Books ====================

async function loadAllBooks() {
  if (allBooksLoaded) return;

  // Fetch fresh data for health analysis
  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const q = query(booksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(book => !book.deletedAt); // Exclude soft-deleted books
    allBooksLoaded = true;
  } catch (error) {
    console.error('Error loading books:', error);
    throw error;
  }
}

// ==================== Genre Counts ====================

async function runRecountGenres() {
  recountGenresBtn.disabled = true;
  recountGenresBtn.innerHTML =
    '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Counting...';
  recountResults?.classList.add('hidden');

  try {
    const results = await recalculateGenreBookCounts(currentUser.uid);

    recountResults?.classList.remove('hidden');

    if (results.genresUpdated === 0) {
      if (recountResultsText) recountResultsText.textContent = 'All genre counts are correct.';
      showToast('Counts verified!', { type: 'success' });
      setTimeout(() => recountResults?.classList.add('hidden'), 5000);
    } else {
      if (recountResultsText) {
        recountResultsText.textContent = `Updated ${results.genresUpdated} genre${results.genresUpdated !== 1 ? 's' : ''} after scanning ${results.totalBooks} books.`;
      }
      showToast('Counts updated!', { type: 'success' });

      clearGenresCache();
    }
  } catch (error) {
    console.error('Error recounting genres:', error);
    recountResults?.classList.remove('hidden');
    if (recountResultsText) recountResultsText.textContent = 'An error occurred while recounting. Please try again.';
    showToast('Recount failed', { type: 'error' });
  } finally {
    recountGenresBtn.disabled = false;
    recountGenresBtn.innerHTML = '<i data-lucide="calculator" class="w-4 h-4"></i><span>Recalculate Counts</span>';
    initIcons();
  }
}

recountGenresBtn?.addEventListener('click', runRecountGenres);

// ==================== Library Health ====================

/**
 * Issue type configuration for rendering badges
 */
const ISSUE_CONFIG = {
  missingCover: { icon: 'image', label: 'Cover' },
  missingGenres: { icon: 'tags', label: 'Genres' },
  missingPageCount: { icon: 'hash', label: 'Pages' },
  missingFormat: { icon: 'book-open', label: 'Format' },
  missingPublisher: { icon: 'building', label: 'Publisher' },
  missingPublishedDate: { icon: 'calendar', label: 'Date' },
  missingIsbn: { icon: 'barcode', label: 'ISBN' },
};

/**
 * Update the Library Health dashboard
 */
async function updateLibraryHealth() {
  if (!healthLoading || !healthSummary) return;

  try {
    await loadAllBooks();

    // Filter out binned books
    const activeBooks = books.filter(b => !b.deletedAt);
    healthReport = analyzeLibraryHealth(activeBooks);

    // Update progress bar
    const score = healthReport.completenessScore;
    const rating = getCompletenessRating(score);

    if (healthScore) healthScore.textContent = `${score}%`;
    if (healthProgressBar) {
      healthProgressBar.style.width = `${score}%`;
      // Set colour based on rating
      healthProgressBar.classList.remove('bg-green-500', 'bg-amber-500', 'bg-red-500');
      if (rating.colour === 'green') healthProgressBar.classList.add('bg-green-500');
      else if (rating.colour === 'amber') healthProgressBar.classList.add('bg-amber-500');
      else healthProgressBar.classList.add('bg-red-500');
    }
    if (healthRating) healthRating.textContent = rating.label;

    // Calculate unique books with issues
    const booksWithIssuesSet = new Set();
    for (const issueType of Object.keys(ISSUE_CONFIG)) {
      const issueBooks = healthReport.issues[issueType] || [];
      for (const book of issueBooks) {
        booksWithIssuesSet.add(book.id);
      }
    }
    const uniqueBooksWithIssues = booksWithIssuesSet.size;

    // Update stats
    if (healthTotalBooks) healthTotalBooks.textContent = healthReport.totalBooks;
    if (healthIssuesCount) healthIssuesCount.textContent = uniqueBooksWithIssues;

    // Render issue rows
    renderIssueRows();

    // Show/hide complete state
    if (uniqueBooksWithIssues === 0) {
      healthComplete?.classList.remove('hidden');
      healthIssues?.classList.add('hidden');
      healthActions?.classList.add('hidden');
    } else {
      healthComplete?.classList.add('hidden');
      healthIssues?.classList.remove('hidden');
      healthActions?.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Error analysing library health:', error);
    showToast('Failed to analyse library', { type: 'error' });
  }

  healthLoading?.classList.add('hidden');
  healthSummary?.classList.remove('hidden');
}

/**
 * Render books with issues (grouped by book, sorted by most issues first)
 */
function renderIssueRows() {
  if (!healthIssues || !healthReport) return;

  // Get all books with any issue
  const booksWithIssues = new Map();

  for (const [issueType, config] of Object.entries(ISSUE_CONFIG)) {
    const issueBooks = healthReport.issues[issueType] || [];
    for (const book of issueBooks) {
      if (!booksWithIssues.has(book.id)) {
        booksWithIssues.set(book.id, { book, missing: [] });
      }
      booksWithIssues.get(book.id).missing.push({
        label: config.label,
        icon: config.icon,
      });
    }
  }

  if (booksWithIssues.size === 0) {
    healthIssues.innerHTML = '<p class="text-gray-500 text-sm">No issues found.</p>';
    return;
  }

  // Sort by most issues first
  const sorted = [...booksWithIssues.values()].sort((a, b) => b.missing.length - a.missing.length);

  healthIssues.innerHTML = `
    <div class="space-y-2 max-h-96 overflow-y-auto">
      ${sorted
        .map(({ book, missing }) => {
          const cover = book.coverImageUrl || '';
          const title = escapeHtml(book.title || 'Untitled');
          const author = escapeHtml(book.author || 'Unknown');

          // Compact badges for missing fields
          const badges = missing
            .map(
              m =>
                `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
            <i data-lucide="${m.icon}" class="w-3 h-3" aria-hidden="true"></i>${m.label}
          </span>`
            )
            .join('');

          return `
          <div class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
            <div class="w-8 h-12 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
              ${
                cover
                  ? `<img src="${escapeHtml(cover)}" alt="" class="w-full h-full object-cover" loading="lazy">`
                  : `<div class="w-full h-full flex items-center justify-center text-gray-400">
                <i data-lucide="book" class="w-4 h-4" aria-hidden="true"></i>
              </div>`
              }
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">${title}</div>
              <div class="text-xs text-gray-500">by ${author}</div>
              <div class="flex flex-wrap gap-1 mt-1">${badges}</div>
            </div>
            <a href="/books/edit/?id=${book.id}" class="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Edit book"><i data-lucide="pencil" class="w-4 h-4" aria-hidden="true"></i></a>
          </div>
        `;
        })
        .join('')}
    </div>
  `;

  initIcons();
}

// Event listeners for Library Health
healthRefreshBtn?.addEventListener('click', async () => {
  healthLoading?.classList.remove('hidden');
  healthSummary?.classList.add('hidden');
  allBooksLoaded = false;
  clearBooksCache(currentUser.uid);
  await updateLibraryHealth();
});

// ==================== Orphaned Images ====================

// DOM Elements - Orphaned Images
const scanOrphansBtn = document.getElementById('scan-orphans-btn');
const deleteOrphansBtn = document.getElementById('delete-orphans-btn');
const orphanResults = document.getElementById('orphan-results');
const orphanLoading = document.getElementById('orphan-loading');
const orphanFound = document.getElementById('orphan-found');
const orphanNone = document.getElementById('orphan-none');
const orphanDeleted = document.getElementById('orphan-deleted');
const orphanCount = document.getElementById('orphan-count');
const orphanSize = document.getElementById('orphan-size');
const orphanDeletedCount = document.getElementById('orphan-deleted-count');

// Store orphaned images for deletion
let orphanedImages = [];

/**
 * Format bytes to human-readable size
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Recursively list all files in a storage folder
 * @param {StorageReference} folderRef
 * @returns {Promise<Array>} Array of {ref, metadata}
 */
async function listAllFilesRecursively(folderRef) {
  const files = [];

  try {
    const result = await listAll(folderRef);

    // Get metadata for all files in this folder
    for (const itemRef of result.items) {
      try {
        const metadata = await getMetadata(itemRef);
        files.push({ ref: itemRef, metadata });
      } catch (err) {
        console.warn('Could not get metadata for:', itemRef.fullPath, err);
      }
    }

    // Recursively list files in subfolders
    for (const prefixRef of result.prefixes) {
      const subFiles = await listAllFilesRecursively(prefixRef);
      files.push(...subFiles);
    }
  } catch (error) {
    // Folder might not exist, which is fine
    console.log('Could not list folder:', folderRef.fullPath, error.code);
  }

  return files;
}

/**
 * Scan for orphaned images in Firebase Storage
 */
async function scanForOrphanedImages() {
  if (!currentUser) return;

  // Reset UI
  orphanResults?.classList.remove('hidden');
  orphanLoading?.classList.remove('hidden');
  orphanFound?.classList.add('hidden');
  orphanNone?.classList.add('hidden');
  orphanDeleted?.classList.add('hidden');
  scanOrphansBtn.disabled = true;
  scanOrphansBtn.innerHTML =
    '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Scanning...';

  try {
    // Force reload books to get fresh data (don't use cache)
    allBooksLoaded = false;
    await loadAllBooks();

    // Collect all image storage paths from books
    const referencedPaths = new Set();
    for (const book of books) {
      if (book.images && Array.isArray(book.images)) {
        for (const img of book.images) {
          if (img.storagePath) {
            referencedPaths.add(img.storagePath);
          }
        }
      }
    }

    // List all files in user's storage folder
    const userStorageRef = ref(storage, `users/${currentUser.uid}`);
    const allFiles = await listAllFilesRecursively(userStorageRef);

    // Find orphaned files (in storage but not referenced by any book)
    orphanedImages = allFiles.filter(file => !referencedPaths.has(file.ref.fullPath));

    // Calculate total size
    const totalSize = orphanedImages.reduce((sum, file) => sum + (file.metadata.size || 0), 0);

    // Update UI
    orphanLoading?.classList.add('hidden');

    if (orphanedImages.length > 0) {
      orphanFound?.classList.remove('hidden');
      if (orphanCount) orphanCount.textContent = orphanedImages.length;
      if (orphanSize) orphanSize.textContent = formatBytes(totalSize);
      initIcons();
    } else {
      orphanNone?.classList.remove('hidden');
      showToast('No orphaned images found', { type: 'success' });
      setTimeout(() => orphanResults?.classList.add('hidden'), 5000);
    }
  } catch (error) {
    console.error('Error scanning for orphaned images:', error);
    orphanLoading?.classList.add('hidden');
    showToast('Failed to scan for orphaned images', { type: 'error' });
  } finally {
    scanOrphansBtn.disabled = false;
    scanOrphansBtn.innerHTML = '<i data-lucide="search" class="w-4 h-4"></i><span>Scan for Orphaned Images</span>';
    initIcons();
  }
}

/**
 * Delete all orphaned images
 */
async function deleteOrphanedImages() {
  if (!orphanedImages.length) return;

  deleteOrphansBtn.disabled = true;
  deleteOrphansBtn.innerHTML =
    '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Deleting...';

  let deletedCount = 0;

  try {
    for (const file of orphanedImages) {
      try {
        await deleteObject(file.ref);
        deletedCount++;
      } catch (err) {
        console.error('Failed to delete:', file.ref.fullPath, err);
      }
    }

    // Update UI
    orphanFound?.classList.add('hidden');
    orphanDeleted?.classList.remove('hidden');
    if (orphanDeletedCount) orphanDeletedCount.textContent = deletedCount;
    initIcons();

    showToast(`Deleted ${deletedCount} orphaned image${deletedCount !== 1 ? 's' : ''}`, { type: 'success' });

    // Clear the list
    orphanedImages = [];
  } catch (error) {
    console.error('Error deleting orphaned images:', error);
    showToast('Failed to delete some images', { type: 'error' });
  } finally {
    deleteOrphansBtn.disabled = false;
    deleteOrphansBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i><span>Delete Orphaned Images</span>';
    initIcons();
  }
}

// Event listeners for Orphaned Images
scanOrphansBtn?.addEventListener('click', scanForOrphanedImages);
deleteOrphansBtn?.addEventListener('click', deleteOrphanedImages);
