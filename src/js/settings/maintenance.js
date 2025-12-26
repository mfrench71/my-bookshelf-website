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
import { showToast, initIcons, clearBooksCache, CACHE_KEY, serializeTimestamp, escapeHtml } from '../utils.js';
import {
  analyzeLibraryHealth,
  getCompletenessRating,
  fixBooksFromAPI,
  HEALTH_FIELDS
} from '../utils/library-health.js';

// Initialize icons once on load
initIcons();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  setTimeout(initIcons, 0);
}

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
const healthFixableCount = document.getElementById('health-fixable-count');
const healthIssues = document.getElementById('health-issues');
const healthComplete = document.getElementById('health-complete');
const healthFixProgress = document.getElementById('health-fix-progress');
const healthFixStatus = document.getElementById('health-fix-status');
const healthFixProgressBar = document.getElementById('health-fix-progress-bar');
const healthFixResults = document.getElementById('health-fix-results');
const healthFixResultsText = document.getElementById('health-fix-results-text');
const healthFixAllBtn = document.getElementById('health-fix-all-btn');
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

  try {
    const cached = localStorage.getItem(`${CACHE_KEY}_${currentUser.uid}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      const cachedBooks = parsed.books || parsed || [];
      const hasMore = parsed.hasMore ?? true;

      if (cachedBooks.length > 0 && !hasMore) {
        books = cachedBooks;
        allBooksLoaded = true;
        return;
      }
    }
  } catch (e) {
    console.warn('Cache read error:', e.message);
  }

  try {
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const q = query(booksRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    books = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: serializeTimestamp(data.createdAt),
        updatedAt: serializeTimestamp(data.updatedAt)
      };
    });
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
    if (cleanupResultsText) cleanupResultsText.textContent = `Error: ${error.message}`;
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
    if (recountResultsText) recountResultsText.textContent = `Error: ${error.message}`;
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
 * Issue type configuration for rendering
 * apiFixable is derived from HEALTH_FIELDS at runtime
 */
const ISSUE_CONFIG = {
  missingCover: { icon: 'image', label: 'Missing cover image', field: 'coverImageUrl' },
  missingGenres: { icon: 'tags', label: 'Missing genres', field: 'genres' },
  missingPageCount: { icon: 'hash', label: 'Missing page count', field: 'pageCount' },
  missingFormat: { icon: 'book-open', label: 'Missing format', field: 'physicalFormat' },
  missingPublisher: { icon: 'building', label: 'Missing publisher', field: 'publisher' },
  missingPublishedDate: { icon: 'calendar', label: 'Missing published date', field: 'publishedDate' },
  missingIsbn: { icon: 'barcode', label: 'Missing ISBN', field: 'isbn' }
};

/**
 * Check if an issue type can be fixed via API
 */
function isApiFixable(issueType) {
  const field = ISSUE_CONFIG[issueType]?.field;
  return field && HEALTH_FIELDS[field]?.apiFixable;
}

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
    if (healthFixableCount) healthFixableCount.textContent = healthReport.fixableBooks;

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

    // Update Fix All button state
    if (healthFixAllBtn) {
      healthFixAllBtn.disabled = healthReport.fixableBooks === 0;
    }

  } catch (error) {
    console.error('Error analysing library health:', error);
    showToast('Failed to analyse library', { type: 'error' });
  }

  healthLoading?.classList.add('hidden');
  healthSummary?.classList.remove('hidden');
  initIcons();
}

/**
 * Render issue rows with expandable sections
 */
function renderIssueRows() {
  if (!healthIssues || !healthReport) return;

  let html = '';

  for (const [issueType, config] of Object.entries(ISSUE_CONFIG)) {
    const issueBooks = healthReport.issues[issueType] || [];
    if (issueBooks.length === 0) continue;

    const canFixViaApi = isApiFixable(issueType);
    const withIsbnCount = issueBooks.filter(b => b.isbn).length;
    const summaryText = canFixViaApi && withIsbnCount > 0 ? ` (${withIsbnCount} with ISBN)` : '';

    html += `
      <div class="issue-section border border-gray-200 rounded-lg overflow-hidden">
        <button class="issue-row w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                data-issue="${issueType}" aria-expanded="false">
          <div class="flex items-center gap-3">
            <i data-lucide="${config.icon}" class="w-4 h-4 text-amber-500 flex-shrink-0" aria-hidden="true"></i>
            <span class="text-sm text-gray-700">
              <span class="font-medium">${issueBooks.length}</span> ${config.label.toLowerCase()}${summaryText}
            </span>
          </div>
          <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 issue-chevron transition-transform" aria-hidden="true"></i>
        </button>
        <div class="issue-details hidden p-3 border-t border-gray-200 bg-white">
          <div class="space-y-2 max-h-48 overflow-y-auto">
            ${renderBookList(issueBooks, issueType, canFixViaApi)}
          </div>
          ${canFixViaApi ? (withIsbnCount > 0 ? `
            <button class="fix-issue-btn mt-3 flex items-center gap-2 px-3 py-1.5 text-sm bg-primary hover:bg-primary-dark text-white rounded transition-colors"
                    data-issue="${issueType}">
              <i data-lucide="wand-2" class="w-3 h-3" aria-hidden="true"></i>
              Try API for ${withIsbnCount} book${withIsbnCount !== 1 ? 's' : ''}
            </button>
          ` : `
            <p class="mt-3 text-sm text-gray-500 italic">No books have ISBN for API lookup</p>
          `) : `
            <p class="mt-3 text-sm text-gray-500 italic">This field must be entered manually</p>
          `}
        </div>
      </div>
    `;
  }

  healthIssues.innerHTML = html;
  initIcons();

  // Add click handlers for expandable rows
  healthIssues.querySelectorAll('.issue-row').forEach(row => {
    row.addEventListener('click', () => toggleIssueSection(row));
  });

  // Add click handlers for fix buttons
  healthIssues.querySelectorAll('.fix-issue-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      fixIssueType(btn.dataset.issue);
    });
  });
}

/**
 * Render list of books with an issue
 * @param {Array} books - Books to render
 * @param {string} issueType - The issue type
 * @param {boolean} canFixViaApi - Whether this issue can be fixed via API
 */
function renderBookList(books, issueType, canFixViaApi) {
  return books.map(book => {
    const hasIsbn = !!book.isbn;
    const cover = book.coverImageUrl || '';

    return `
      <div class="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
        <div class="w-8 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
          ${cover ? `<img src="${escapeHtml(cover)}" alt="" class="w-full h-full object-cover">` :
          `<div class="w-full h-full flex items-center justify-center text-gray-400">
            <i data-lucide="book" class="w-4 h-4" aria-hidden="true"></i>
          </div>`}
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-gray-900 truncate">${escapeHtml(book.title || 'Untitled')}</p>
          <p class="text-xs text-gray-500 truncate">${escapeHtml(book.author || 'Unknown author')}</p>
        </div>
        ${canFixViaApi ? (
          !hasIsbn ? `<span class="text-xs text-gray-400 flex-shrink-0">No ISBN</span>` : ''
        ) : `
          <a href="/books/edit/?id=${book.id}" class="text-xs text-primary hover:text-primary-dark flex-shrink-0">
            Edit
          </a>
        `}
      </div>
    `;
  }).join('');
}

/**
 * Toggle expandable issue section
 */
function toggleIssueSection(row) {
  const section = row.closest('.issue-section');
  const details = section.querySelector('.issue-details');
  const chevron = row.querySelector('.issue-chevron');
  const isExpanded = row.getAttribute('aria-expanded') === 'true';

  // Collapse all other sections
  healthIssues.querySelectorAll('.issue-row[aria-expanded="true"]').forEach(otherRow => {
    if (otherRow !== row) {
      otherRow.setAttribute('aria-expanded', 'false');
      otherRow.closest('.issue-section').querySelector('.issue-details')?.classList.add('hidden');
      otherRow.querySelector('.issue-chevron')?.classList.remove('rotate-180');
    }
  });

  // Toggle this section
  row.setAttribute('aria-expanded', !isExpanded);
  details?.classList.toggle('hidden', isExpanded);
  chevron?.classList.toggle('rotate-180', !isExpanded);
}

/**
 * Fix all books with a specific issue type
 */
async function fixIssueType(issueType) {
  const issueBooks = healthReport?.issues[issueType] || [];
  const fixableBooks = issueBooks.filter(b => b.isbn);

  if (fixableBooks.length === 0) {
    showToast('No books with ISBN to fix', { type: 'info' });
    return;
  }

  await runFixBooks(fixableBooks, ISSUE_CONFIG[issueType]?.label || issueType);
}

/**
 * Fix all fixable books
 */
async function runFixAll() {
  if (!healthReport || healthReport.fixableBooks === 0) {
    showToast('No books to fix', { type: 'info' });
    return;
  }

  // Get all unique fixable books (have ISBN and at least one missing field)
  const activeBooks = books.filter(b => !b.deletedAt);
  const allFixable = activeBooks.filter(b => {
    if (!b.isbn) return false;
    // Check if any API-fixable field is missing
    for (const [field, config] of Object.entries(HEALTH_FIELDS)) {
      if (config.apiFixable) {
        const hasValue = field === 'genres' ?
          (Array.isArray(b.genres) && b.genres.length > 0) :
          !!b[field];
        if (!hasValue) return true;
      }
    }
    return false;
  });

  await runFixBooks(allFixable, 'all missing fields');
}

/**
 * Run the fix process for a set of books
 */
async function runFixBooks(booksToFix, description) {
  if (!booksToFix.length) return;

  // Disable buttons
  if (healthFixAllBtn) {
    healthFixAllBtn.disabled = true;
    healthFixAllBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Fixing...';
  }
  healthRefreshBtn?.classList.add('hidden');
  healthFixProgress?.classList.remove('hidden');
  healthFixResults?.classList.add('hidden');

  try {
    const results = await fixBooksFromAPI(
      currentUser.uid,
      booksToFix,
      (current, total, book) => {
        const percent = Math.round((current / total) * 100);
        if (healthFixProgressBar) healthFixProgressBar.style.width = `${percent}%`;
        if (healthFixStatus) healthFixStatus.textContent = `Fixing ${current} of ${total}: ${book.title || 'Untitled'}`;
      },
      500 // 500ms delay between API calls
    );

    // Show results
    healthFixProgress?.classList.add('hidden');
    healthFixResults?.classList.remove('hidden');

    if (results.fixed.length === 0) {
      if (healthFixResultsText) {
        let html = `<p>Checked ${booksToFix.length} book${booksToFix.length !== 1 ? 's' : ''} - APIs had no new data.</p>`;
        html += `<p class="text-gray-500 text-sm mt-1">Note: Not all books have complete metadata in Google Books or Open Library.</p>`;
        if (results.skipped.length > 0) {
          html += `<p class="text-gray-500 mt-1">${results.skipped.length} book${results.skipped.length !== 1 ? 's' : ''} skipped (no ISBN).</p>`;
        }
        if (results.errors.length > 0) {
          html += `<p class="text-amber-600 mt-1">${results.errors.length} book${results.errors.length !== 1 ? 's' : ''} had API errors.</p>`;
        }
        healthFixResultsText.innerHTML = html;
      }
      showToast('APIs had no new data', { type: 'info' });
    } else {
      // Build results summary
      let html = `<p class="mb-2">Fixed ${results.fixed.length} book${results.fixed.length !== 1 ? 's' : ''}:</p>`;

      // Show field counts
      const fieldCounts = Object.entries(results.fieldsFixedCount);
      if (fieldCounts.length > 0) {
        html += `<ul class="text-sm text-gray-600 mb-2">`;
        for (const [field, count] of fieldCounts) {
          const label = HEALTH_FIELDS[field]?.label || field;
          html += `<li class="flex items-center gap-2">
            <i data-lucide="check" class="w-3 h-3 text-green-500" aria-hidden="true"></i>
            ${count} ${label.toLowerCase()}${count !== 1 ? 's' : ''}
          </li>`;
        }
        html += `</ul>`;
      }

      // Show fixed books
      html += `<div class="max-h-32 overflow-y-auto space-y-1">`;
      for (const { book, fieldsFixed } of results.fixed) {
        html += `<div class="flex items-center gap-2 text-sm">
          <i data-lucide="check-circle" class="w-4 h-4 text-green-500 flex-shrink-0" aria-hidden="true"></i>
          <span class="truncate">${escapeHtml(book.title || 'Untitled')}</span>
          <span class="text-gray-400 text-xs">(${fieldsFixed.length} field${fieldsFixed.length !== 1 ? 's' : ''})</span>
        </div>`;
      }
      html += `</div>`;

      if (results.errors.length > 0) {
        html += `<p class="text-amber-600 mt-2">${results.errors.length} book${results.errors.length !== 1 ? 's' : ''} had errors.</p>`;
      }

      if (healthFixResultsText) healthFixResultsText.innerHTML = html;
      initIcons();
      showToast(`Fixed ${results.fixed.length} book${results.fixed.length !== 1 ? 's' : ''}!`, { type: 'success' });
    }

    // Refresh data
    clearBooksCache(currentUser.uid);
    allBooksLoaded = false;
    await updateLibraryHealth();

  } catch (error) {
    console.error('Error fixing books:', error);
    healthFixProgress?.classList.add('hidden');
    healthFixResults?.classList.remove('hidden');
    if (healthFixResultsText) healthFixResultsText.innerHTML = `<p class="text-red-600">Error: ${error.message}</p>`;
    showToast('Fix failed', { type: 'error' });
  } finally {
    if (healthFixAllBtn) {
      healthFixAllBtn.disabled = healthReport?.fixableBooks === 0;
      healthFixAllBtn.innerHTML = '<i data-lucide="wand-2" class="w-4 h-4"></i><span>Try API for All</span>';
    }
    healthRefreshBtn?.classList.remove('hidden');
    initIcons();
  }
}

// Event listeners for Library Health
healthFixAllBtn?.addEventListener('click', runFixAll);
healthRefreshBtn?.addEventListener('click', async () => {
  healthLoading?.classList.remove('hidden');
  healthSummary?.classList.add('hidden');
  allBooksLoaded = false;
  clearBooksCache(currentUser.uid);
  await updateLibraryHealth();
});
