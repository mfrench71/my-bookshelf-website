// Maintenance Settings Page Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  clearGenresCache,
  migrateGenreData,
  recalculateGenreBookCounts
} from '../genres.js';
import { showToast, initIcons, clearBooksCache, escapeHtml } from '../utils.js';
import {
  analyzeLibraryHealth,
  getCompletenessRating
} from '../utils/library-health.js';

// Initialize icons on DOMContentLoaded
document.addEventListener('DOMContentLoaded', initIcons);

// State
let currentUser = null;
let books = [];
let allBooksLoaded = false;
let healthReport = null;

// DOM Elements - Cleanup
const cleanupGenresBtn = document.getElementById('cleanup-genres-btn');
const cleanupProgress = document.getElementById('cleanup-progress');
const cleanupStatus = document.getElementById('cleanup-status');
const cleanupProgressBar = document.getElementById('cleanup-progress-bar');
const cleanupResults = document.getElementById('cleanup-results');
const cleanupResultsText = document.getElementById('cleanup-results-text');
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
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await updateLibraryHealth();
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
    books = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allBooksLoaded = true;
  } catch (error) {
    console.error('Error loading books:', error);
    throw error;
  }
}

// ==================== Data Cleanup ====================

async function runGenreCleanup() {
  cleanupGenresBtn.disabled = true;
  cleanupGenresBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Processing...';
  cleanupProgress?.classList.remove('hidden');
  cleanupResults?.classList.add('hidden');
  if (cleanupProgressBar) cleanupProgressBar.style.width = '0%';

  try {
    const results = await migrateGenreData(currentUser.uid, (processed, total) => {
      const percent = Math.round((processed / total) * 100);
      if (cleanupProgressBar) cleanupProgressBar.style.width = `${percent}%`;
      if (cleanupStatus) cleanupStatus.textContent = `Processing book ${processed} of ${total}...`;
    });

    cleanupProgress?.classList.add('hidden');
    cleanupResults?.classList.remove('hidden');

    if (results.booksUpdated === 0 && results.genresCreated === 0) {
      if (cleanupResultsText) cleanupResultsText.textContent = 'No issues found. All genre references are valid.';
      showToast('Data is clean!', { type: 'success' });
      setTimeout(() => cleanupResults?.classList.add('hidden'), 5000);
    } else {
      const parts = [];
      if (results.booksUpdated > 0) {
        parts.push(`${results.booksUpdated} book${results.booksUpdated !== 1 ? 's' : ''} updated`);
      }
      if (results.genresCreated > 0) {
        parts.push(`${results.genresCreated} genre${results.genresCreated !== 1 ? 's' : ''} created`);
      }
      if (cleanupResultsText) cleanupResultsText.textContent = parts.join(', ') + '.';

      if (results.errors.length > 0 && cleanupResultsText) {
        cleanupResultsText.textContent += ` ${results.errors.length} error${results.errors.length !== 1 ? 's' : ''} occurred.`;
        console.error('Cleanup errors:', results.errors);
      }

      showToast('Cleanup complete!', { type: 'success' });

      clearBooksCache(currentUser.uid);
      clearGenresCache();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
    cleanupProgress?.classList.add('hidden');
    cleanupResults?.classList.remove('hidden');
    if (cleanupResultsText) cleanupResultsText.textContent = 'An error occurred during cleanup. Please try again.';
    showToast('Cleanup failed', { type: 'error' });
  } finally {
    cleanupGenresBtn.disabled = false;
    cleanupGenresBtn.innerHTML = '<i data-lucide="sparkles" class="w-4 h-4"></i><span>Run Cleanup</span>';
    initIcons();
  }
}

async function runRecountGenres() {
  recountGenresBtn.disabled = true;
  recountGenresBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Counting...';
  recountResults?.classList.add('hidden');

  try {
    const results = await recalculateGenreBookCounts(currentUser.uid);

    recountResults?.classList.remove('hidden');

    if (results.genresUpdated === 0) {
      if (recountResultsText) recountResultsText.textContent = 'All genre counts are correct.';
      showToast('Counts verified!', { type: 'success' });
      setTimeout(() => recountResults?.classList.add('hidden'), 5000);
    } else {
      if (recountResultsText) recountResultsText.textContent = `Updated ${results.genresUpdated} genre${results.genresUpdated !== 1 ? 's' : ''} after scanning ${results.totalBooks} books.`;
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

cleanupGenresBtn?.addEventListener('click', runGenreCleanup);
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
  missingIsbn: { icon: 'barcode', label: 'ISBN' }
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

    // Update stats
    if (healthTotalBooks) healthTotalBooks.textContent = healthReport.totalBooks;
    if (healthIssuesCount) healthIssuesCount.textContent = healthReport.totalIssues;

    // Render issue rows
    renderIssueRows();

    // Show/hide complete state
    if (healthReport.totalIssues === 0) {
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
        icon: config.icon
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
      ${sorted.map(({ book, missing }) => {
        const cover = book.coverImageUrl || '';
        const title = escapeHtml(book.title || 'Untitled');
        const author = escapeHtml(book.author || 'Unknown');

        // Compact badges for missing fields
        const badges = missing.map(m =>
          `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
            <i data-lucide="${m.icon}" class="w-3 h-3" aria-hidden="true"></i>${m.label}
          </span>`
        ).join('');

        return `
          <div class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200">
            <div class="w-8 h-12 flex-shrink-0 bg-gray-200 rounded overflow-hidden">
              ${cover ? `<img src="${escapeHtml(cover)}" alt="" class="w-full h-full object-cover">` :
              `<div class="w-full h-full flex items-center justify-center text-gray-400">
                <i data-lucide="book" class="w-4 h-4" aria-hidden="true"></i>
              </div>`}
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-900 truncate">${title}</div>
              <div class="text-xs text-gray-500">by ${author}</div>
              <div class="flex flex-wrap gap-1 mt-1">${badges}</div>
            </div>
            <a href="/books/edit/?id=${book.id}" class="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Edit book"><i data-lucide="pencil" class="w-4 h-4" aria-hidden="true"></i></a>
          </div>
        `;
      }).join('')}
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
