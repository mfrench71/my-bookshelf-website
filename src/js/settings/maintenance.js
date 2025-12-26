// Maintenance Settings Page Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  clearGenresCache,
  migrateGenreData,
  recalculateGenreBookCounts
} from '../genres.js';
import { showToast, initIcons, clearBooksCache, CACHE_KEY, serializeTimestamp, escapeHtml, lookupISBN } from '../utils.js';

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

// DOM Elements - Cover Fetch
const coverStatsLoading = document.getElementById('cover-stats-loading');
const coverStats = document.getElementById('cover-stats');
const coverIsbnCount = document.getElementById('cover-isbn-count');
const coverMultiCount = document.getElementById('cover-multi-count');
const coverProgress = document.getElementById('cover-progress');
const coverStatus = document.getElementById('cover-status');
const coverProgressBar = document.getElementById('cover-progress-bar');
const coverResults = document.getElementById('cover-results');
const coverResultsText = document.getElementById('cover-results-text');
const fetchCoversBtn = document.getElementById('fetch-covers-btn');

// Auth Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await updateCoverStats();
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

// ==================== Cover Fetch ====================

async function updateCoverStats() {
  if (!coverIsbnCount || !coverMultiCount) return;

  try {
    await loadAllBooks();

    const booksWithIsbn = books.filter(b => b.isbn);
    const booksWithMultipleCovers = books.filter(b => {
      if (!b.covers) return false;
      const coverCount = Object.values(b.covers).filter(url => url).length;
      return coverCount > 1;
    });

    coverIsbnCount.textContent = booksWithIsbn.length;
    coverMultiCount.textContent = booksWithMultipleCovers.length;
  } catch (error) {
    console.error('Error updating cover stats:', error);
    coverIsbnCount.textContent = '-';
    coverMultiCount.textContent = '-';
  }

  coverStatsLoading?.classList.add('hidden');
  coverStats?.classList.remove('hidden');
}

async function runFetchCovers() {
  fetchCoversBtn.disabled = true;
  fetchCoversBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Fetching...';
  coverProgress?.classList.remove('hidden');
  coverResults?.classList.add('hidden');
  if (coverProgressBar) coverProgressBar.style.width = '0%';

  try {
    await loadAllBooks();

    const booksWithIsbn = books.filter(b => b.isbn);

    if (booksWithIsbn.length === 0) {
      coverProgress?.classList.add('hidden');
      coverResults?.classList.remove('hidden');
      if (coverResultsText) coverResultsText.textContent = 'No books with ISBNs found.';
      showToast('No books with ISBNs to process', { type: 'info' });
      return;
    }

    let processed = 0;
    let updated = 0;
    let newCoversFound = 0;
    const updatedBooks = [];

    const booksRef = collection(db, 'users', currentUser.uid, 'books');

    for (const book of booksWithIsbn) {
      processed++;
      const percent = Math.round((processed / booksWithIsbn.length) * 100);
      if (coverProgressBar) coverProgressBar.style.width = `${percent}%`;
      if (coverStatus) coverStatus.textContent = `Processing ${processed} of ${booksWithIsbn.length}...`;

      try {
        const result = await lookupISBN(book.isbn, { skipCache: true });

        if (result && result.covers) {
          const existingCovers = book.covers || {};
          const newCovers = result.covers;

          const hasNewGoogle = newCovers.googleBooks && !existingCovers.googleBooks;
          const hasNewOpenLibrary = newCovers.openLibrary && !existingCovers.openLibrary;

          if (hasNewGoogle || hasNewOpenLibrary) {
            newCoversFound++;
          }

          const mergedCovers = {
            ...existingCovers,
            ...newCovers
          };

          const coversChanged =
            (mergedCovers.googleBooks !== existingCovers.googleBooks) ||
            (mergedCovers.openLibrary !== existingCovers.openLibrary);

          if (coversChanged) {
            const newCoverImageUrl = mergedCovers.googleBooks || mergedCovers.openLibrary || book.coverImageUrl;
            await setDoc(doc(booksRef, book.id), {
              covers: mergedCovers,
              coverImageUrl: newCoverImageUrl,
              updatedAt: serverTimestamp()
            }, { merge: true });
            updated++;

            const sources = [];
            if (hasNewGoogle) sources.push('Google Books');
            if (hasNewOpenLibrary) sources.push('Open Library');
            updatedBooks.push({
              title: book.title,
              sources: sources.length > 0 ? sources : ['updated']
            });
          }
        }
      } catch (error) {
        console.warn(`Error fetching covers for book ${book.id}:`, error);
      }

      if (processed < booksWithIsbn.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    coverProgress?.classList.add('hidden');
    coverResults?.classList.remove('hidden');

    if (updated === 0) {
      if (coverResultsText) coverResultsText.innerHTML = `Scanned ${processed} books. No new covers found.`;
      showToast('No new covers found', { type: 'info' });
    } else {
      let html = `<p class="mb-2">Scanned ${processed} books. Updated ${updated} with new cover options.</p>`;
      html += `<ul class="text-sm text-gray-600 space-y-1 max-h-32 overflow-y-auto">`;
      for (const book of updatedBooks) {
        const sourcesText = book.sources.join(', ');
        html += `<li class="flex items-start gap-2">
          <i data-lucide="check" class="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5"></i>
          <span><strong>${escapeHtml(book.title)}</strong> <span class="text-gray-400">(${sourcesText})</span></span>
        </li>`;
      }
      html += `</ul>`;
      if (coverResultsText) coverResultsText.innerHTML = html;
      initIcons();
      showToast(`Found ${newCoversFound} new covers!`, { type: 'success' });
    }

    clearBooksCache(currentUser.uid);
    allBooksLoaded = false;
    await updateCoverStats();

  } catch (error) {
    console.error('Error fetching covers:', error);
    coverProgress?.classList.add('hidden');
    coverResults?.classList.remove('hidden');
    if (coverResultsText) coverResultsText.textContent = `Error: ${error.message}`;
    showToast('Cover fetch failed', { type: 'error' });
  } finally {
    fetchCoversBtn.disabled = false;
    fetchCoversBtn.innerHTML = '<i data-lucide="image" class="w-4 h-4"></i><span>Fetch Covers</span>';
    initIcons();
  }
}

fetchCoversBtn?.addEventListener('click', runFetchCovers);
