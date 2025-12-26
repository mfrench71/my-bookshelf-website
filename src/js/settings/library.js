// Library Settings Page Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  loadUserGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  GENRE_COLORS,
  getUsedColors,
  getAvailableColors,
  clearGenresCache,
  recalculateGenreBookCounts
} from '../genres.js';
import {
  loadUserSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  mergeSeries,
  clearSeriesCache,
  findPotentialDuplicates
} from '../series.js';
import { showToast, initIcons, getContrastColor, escapeHtml, clearBooksCache, CACHE_KEY, serializeTimestamp, lockBodyScroll, unlockBodyScroll, isMobile } from '../utils.js';
import { validateForm, showFormErrors, clearFormErrors } from '../utils/validation.js';
import { GenreSchema, validateGenreUniqueness, validateColourUniqueness } from '../schemas/genre.js';
import { SeriesFormSchema } from '../schemas/series.js';

// Initialize icons once on load
initIcons();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  setTimeout(initIcons, 0);
}

// State
let currentUser = null;
let genres = [];
let series = [];
let books = [];
let allBooksLoaded = false;
let editingGenreId = null;
let editingSeriesId = null;
let deletingGenreId = null;
let deletingSeriesId = null;
let mergingSeriesId = null;
let selectedColor = GENRE_COLORS[0];

// DOM Elements - Genres
const genresLoading = document.getElementById('genres-loading');
const genresEmpty = document.getElementById('genres-empty');
const genreList = document.getElementById('genre-list');
const addGenreBtn = document.getElementById('add-genre-btn');
const genreModal = document.getElementById('genre-modal');
const genreModalTitle = document.getElementById('genre-modal-title');
const genreForm = document.getElementById('genre-form');
const genreNameInput = document.getElementById('genre-name');
const colorPicker = document.getElementById('color-picker');
const cancelGenreBtn = document.getElementById('cancel-genre');
const saveGenreBtn = document.getElementById('save-genre');
const deleteGenreModal = document.getElementById('delete-genre-modal');
const deleteGenreMessage = document.getElementById('delete-genre-message');
const cancelDeleteGenreBtn = document.getElementById('cancel-delete-genre');
const confirmDeleteGenreBtn = document.getElementById('confirm-delete-genre');

// DOM Elements - Series
const seriesLoading = document.getElementById('series-loading');
const seriesEmpty = document.getElementById('series-empty');
const seriesList = document.getElementById('series-list');
const addSeriesBtn = document.getElementById('add-series-btn');
const seriesModal = document.getElementById('series-modal');
const seriesModalTitle = document.getElementById('series-modal-title');
const seriesForm = document.getElementById('series-form');
const seriesNameInput = document.getElementById('series-name');
const seriesDescriptionInput = document.getElementById('series-description');
const seriesTotalBooksInput = document.getElementById('series-total-books');
const cancelSeriesBtn = document.getElementById('cancel-series');
const saveSeriesBtn = document.getElementById('save-series');
const deleteSeriesModal = document.getElementById('delete-series-modal');
const deleteSeriesMessage = document.getElementById('delete-series-message');
const cancelDeleteSeriesBtn = document.getElementById('cancel-delete-series');
const confirmDeleteSeriesBtn = document.getElementById('confirm-delete-series');
const mergeSeriesModal = document.getElementById('merge-series-modal');
const mergeSourceName = document.getElementById('merge-source-name');
const mergeTargetSelect = document.getElementById('merge-target-select');
const cancelMergeSeriesBtn = document.getElementById('cancel-merge-series');
const confirmMergeSeriesBtn = document.getElementById('confirm-merge-series');
const seriesDuplicates = document.getElementById('series-duplicates');
const duplicateList = document.getElementById('duplicate-list');

// DOM Elements - Backup & Restore
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file');
const importProgress = document.getElementById('import-progress');
const importStatus = document.getElementById('import-status');

// Auth Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await Promise.all([loadGenres(), loadSeries()]);
  }
});

// ==================== Genres ====================

async function loadGenres() {
  try {
    genres = await loadUserGenres(currentUser.uid, true);
    renderGenres();
  } catch (error) {
    console.error('Error loading genres:', error);
    showToast('Error loading genres', { type: 'error' });
  }
}

function renderGenres() {
  genresLoading?.classList.add('hidden');

  if (genres.length === 0) {
    genresEmpty?.classList.remove('hidden');
    if (genreList) genreList.innerHTML = '';
    initIcons();
    return;
  }

  genresEmpty?.classList.add('hidden');

  if (genreList) {
    genreList.innerHTML = `
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table class="w-full">
          <tbody class="divide-y divide-gray-100">
            ${genres.map(genre => {
              return `
                <tr class="hover:bg-gray-50">
                  <td class="py-1.5 px-3">
                    <div class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${genre.color}" title="${escapeHtml(genre.name)}"></span>
                      <span class="text-sm text-gray-900">${escapeHtml(genre.name)}</span>
                    </div>
                  </td>
                  <td class="py-1.5 px-3 text-xs text-gray-500 whitespace-nowrap text-right">${genre.bookCount || 0}</td>
                  <td class="py-0 px-0 text-right whitespace-nowrap">
                    <button class="edit-btn p-2 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" data-id="${genre.id}" aria-label="Edit ${escapeHtml(genre.name)}">
                      <i data-lucide="edit-2" class="w-4 h-4" aria-hidden="true"></i>
                    </button>
                    <button class="delete-btn p-2 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" data-id="${genre.id}" data-name="${escapeHtml(genre.name)}" data-count="${genre.bookCount || 0}" aria-label="Delete ${escapeHtml(genre.name)}">
                      <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    genreList.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditGenreModal(btn.dataset.id));
    });

    genreList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => openDeleteGenreModal(btn.dataset.id, btn.dataset.name, parseInt(btn.dataset.count)));
    });
  }

  initIcons();
}

function renderColorPicker() {
  const usedColors = getUsedColors(genres, editingGenreId);

  colorPicker.innerHTML = GENRE_COLORS.map(color => {
    const isSelected = color.toLowerCase() === selectedColor?.toLowerCase();
    const isUsed = usedColors.has(color.toLowerCase());
    const textColor = getContrastColor(color);

    if (isUsed) {
      return `
        <button type="button" class="color-btn w-8 h-8 rounded-full border-2 border-transparent opacity-30 cursor-not-allowed relative"
          style="background-color: ${color}" disabled title="Already in use">
          <i data-lucide="x" class="w-4 h-4 mx-auto" style="color: ${textColor}"></i>
        </button>
      `;
    }

    return `
      <button type="button" class="color-btn w-8 h-8 rounded-full border-2 ${isSelected ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-transparent'} hover:scale-110 transition-transform"
        style="background-color: ${color}" data-color="${color}">
        ${isSelected ? `<i data-lucide="check" class="w-4 h-4 mx-auto" style="color: ${textColor}"></i>` : ''}
      </button>
    `;
  }).join('');

  colorPicker.querySelectorAll('.color-btn:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color;
      renderColorPicker();
    });
  });

  initIcons();
}

function openAddGenreModal() {
  editingGenreId = null;
  genreModalTitle.textContent = 'Add Genre';
  genreNameInput.value = '';
  const availableColors = getAvailableColors(genres);
  selectedColor = availableColors[0] || GENRE_COLORS[0];
  saveGenreBtn.textContent = 'Add';
  clearFormErrors(genreForm);
  renderColorPicker();
  genreModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) genreNameInput.focus();
}

function openEditGenreModal(genreId) {
  const genre = genres.find(g => g.id === genreId);
  if (!genre) return;

  editingGenreId = genreId;
  genreModalTitle.textContent = 'Edit Genre';
  genreNameInput.value = genre.name;
  selectedColor = genre.color;
  saveGenreBtn.textContent = 'Save';
  clearFormErrors(genreForm);
  renderColorPicker();
  genreModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) genreNameInput.focus();
}

function closeGenreModal() {
  genreModal?.classList.add('hidden');
  unlockBodyScroll();
  editingGenreId = null;
}

function openDeleteGenreModal(genreId, name, bookCount) {
  deletingGenreId = genreId;
  deleteGenreMessage.textContent = bookCount > 0
    ? `This will remove "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
    : `Are you sure you want to delete "${name}"?`;
  deleteGenreModal?.classList.remove('hidden');
  lockBodyScroll();
}

function closeDeleteGenreModal() {
  deleteGenreModal?.classList.add('hidden');
  unlockBodyScroll();
  deletingGenreId = null;
}

// Genre Event Listeners
addGenreBtn?.addEventListener('click', openAddGenreModal);
cancelGenreBtn?.addEventListener('click', closeGenreModal);
genreModal?.addEventListener('click', (e) => {
  if (e.target === genreModal) closeGenreModal();
});
cancelDeleteGenreBtn?.addEventListener('click', closeDeleteGenreModal);
deleteGenreModal?.addEventListener('click', (e) => {
  if (e.target === deleteGenreModal) closeDeleteGenreModal();
});

genreForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  clearFormErrors(genreForm);
  const formData = {
    name: genreNameInput.value,
    color: selectedColor
  };

  const result = validateForm(GenreSchema, formData);
  if (!result.success) {
    showFormErrors(genreForm, result.errors);
    return;
  }

  const nameError = validateGenreUniqueness(result.data.name, genres, editingGenreId);
  if (nameError) {
    showFormErrors(genreForm, { name: nameError });
    return;
  }

  const colourError = validateColourUniqueness(result.data.color, genres, editingGenreId);
  if (colourError) {
    showFormErrors(genreForm, { color: colourError });
    return;
  }

  saveGenreBtn.disabled = true;
  saveGenreBtn.textContent = 'Saving...';

  try {
    if (editingGenreId) {
      await updateGenre(currentUser.uid, editingGenreId, { name: result.data.name, color: result.data.color });
      showToast('Genre updated!', { type: 'success' });
    } else {
      await createGenre(currentUser.uid, result.data.name, result.data.color);
      showToast('Genre created!', { type: 'success' });
    }

    closeGenreModal();
    clearGenresCache();
    await loadGenres();
  } catch (error) {
    console.error('Error saving genre:', error);
    showToast(error.message || 'Error saving genre', { type: 'error' });
  } finally {
    saveGenreBtn.disabled = false;
    saveGenreBtn.textContent = editingGenreId ? 'Save' : 'Add';
  }
});

confirmDeleteGenreBtn?.addEventListener('click', async () => {
  if (!deletingGenreId) return;

  confirmDeleteGenreBtn.disabled = true;
  confirmDeleteGenreBtn.textContent = 'Deleting...';

  try {
    const booksUpdated = await deleteGenre(currentUser.uid, deletingGenreId);

    if (booksUpdated > 0) {
      clearBooksCache(currentUser.uid);
    }

    showToast('Genre deleted', { type: 'success' });
    closeDeleteGenreModal();
    clearGenresCache();
    await loadGenres();
  } catch (error) {
    console.error('Error deleting genre:', error);
    showToast('Error deleting genre', { type: 'error' });
  } finally {
    confirmDeleteGenreBtn.disabled = false;
    confirmDeleteGenreBtn.textContent = 'Delete';
  }
});

// ==================== Series ====================

async function loadSeries() {
  if (!currentUser) return;

  try {
    series = await loadUserSeries(currentUser.uid, true);
    renderSeries();
  } catch (error) {
    console.error('Error loading series:', error);
    showToast('Error loading series', { type: 'error' });
  }
}

function renderSeries() {
  seriesLoading?.classList.add('hidden');

  if (series.length === 0) {
    seriesEmpty?.classList.remove('hidden');
    if (seriesList) seriesList.innerHTML = '';
    seriesDuplicates?.classList.add('hidden');
    initIcons();
    return;
  }

  seriesEmpty?.classList.add('hidden');

  if (seriesList) {
    seriesList.innerHTML = `
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table class="w-full">
          <tbody class="divide-y divide-gray-100">
            ${series.map(s => {
              const completionText = s.totalBooks
                ? `${s.bookCount || 0}/${s.totalBooks}`
                : `${s.bookCount || 0}`;

              return `
                <tr class="hover:bg-gray-50">
                  <td class="py-1.5 px-3">
                    <span class="text-sm text-gray-900">${escapeHtml(s.name)}</span>
                  </td>
                  <td class="py-1.5 px-3 text-xs text-gray-500 whitespace-nowrap text-right">${completionText}</td>
                  <td class="py-0 px-0 text-right whitespace-nowrap">
                    <button class="edit-series-btn p-2 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" data-id="${s.id}" aria-label="Edit ${escapeHtml(s.name)}">
                      <i data-lucide="edit-2" class="w-4 h-4" aria-hidden="true"></i>
                    </button>
                    <button class="merge-series-btn p-2 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-500 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" data-id="${s.id}" data-name="${escapeHtml(s.name)}" aria-label="Merge ${escapeHtml(s.name)}">
                      <i data-lucide="git-merge" class="w-4 h-4" aria-hidden="true"></i>
                    </button>
                    <button class="delete-series-btn p-2 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" data-id="${s.id}" data-name="${escapeHtml(s.name)}" data-count="${s.bookCount || 0}" aria-label="Delete ${escapeHtml(s.name)}">
                      <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    seriesList.querySelectorAll('.edit-series-btn').forEach(btn => {
      btn.addEventListener('click', () => openEditSeriesModal(btn.dataset.id));
    });

    seriesList.querySelectorAll('.merge-series-btn').forEach(btn => {
      btn.addEventListener('click', () => openMergeSeriesModal(btn.dataset.id, btn.dataset.name));
    });

    seriesList.querySelectorAll('.delete-series-btn').forEach(btn => {
      btn.addEventListener('click', () => openDeleteSeriesModal(btn.dataset.id, btn.dataset.name, parseInt(btn.dataset.count)));
    });
  }

  renderDuplicateWarnings();
  initIcons();
}

function renderDuplicateWarnings() {
  if (!seriesDuplicates || !duplicateList) return;

  const duplicates = findPotentialDuplicates(series);

  if (duplicates.length === 0) {
    seriesDuplicates.classList.add('hidden');
    return;
  }

  duplicateList.innerHTML = duplicates.map(group => {
    const names = group.map(s => `"${escapeHtml(s.name)}"`).join(', ');
    return `<p class="text-sm text-amber-800">${names}</p>`;
  }).join('');

  seriesDuplicates.classList.remove('hidden');
  initIcons();
}

function openAddSeriesModal() {
  editingSeriesId = null;
  seriesModalTitle.textContent = 'Add Series';
  seriesNameInput.value = '';
  seriesDescriptionInput.value = '';
  seriesTotalBooksInput.value = '';
  saveSeriesBtn.textContent = 'Add';
  clearFormErrors(seriesForm);
  seriesModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) seriesNameInput.focus();
}

function openEditSeriesModal(seriesId) {
  const s = series.find(x => x.id === seriesId);
  if (!s) return;

  editingSeriesId = seriesId;
  seriesModalTitle.textContent = 'Edit Series';
  seriesNameInput.value = s.name;
  seriesDescriptionInput.value = s.description || '';
  seriesTotalBooksInput.value = s.totalBooks || '';
  saveSeriesBtn.textContent = 'Save';
  clearFormErrors(seriesForm);
  seriesModal.classList.remove('hidden');
  lockBodyScroll();
  if (!isMobile()) seriesNameInput.focus();
}

function closeSeriesModal() {
  seriesModal?.classList.add('hidden');
  unlockBodyScroll();
  editingSeriesId = null;
}

function openDeleteSeriesModal(seriesId, name, bookCount) {
  deletingSeriesId = seriesId;
  deleteSeriesMessage.textContent = bookCount > 0
    ? `This will unlink "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
    : `Are you sure you want to delete "${name}"?`;
  deleteSeriesModal?.classList.remove('hidden');
  lockBodyScroll();
}

function closeDeleteSeriesModal() {
  deleteSeriesModal?.classList.add('hidden');
  unlockBodyScroll();
  deletingSeriesId = null;
}

function openMergeSeriesModal(seriesId, name) {
  mergingSeriesId = seriesId;
  mergeSourceName.textContent = name;

  mergeTargetSelect.innerHTML = '<option value="">Select a series...</option>' +
    series
      .filter(s => s.id !== seriesId)
      .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
      .join('');

  confirmMergeSeriesBtn.disabled = true;
  mergeSeriesModal?.classList.remove('hidden');
  lockBodyScroll();
}

function closeMergeSeriesModal() {
  mergeSeriesModal?.classList.add('hidden');
  unlockBodyScroll();
  mergingSeriesId = null;
}

// Series Event Listeners
addSeriesBtn?.addEventListener('click', openAddSeriesModal);
cancelSeriesBtn?.addEventListener('click', closeSeriesModal);
seriesModal?.addEventListener('click', (e) => {
  if (e.target === seriesModal) closeSeriesModal();
});
cancelDeleteSeriesBtn?.addEventListener('click', closeDeleteSeriesModal);
deleteSeriesModal?.addEventListener('click', (e) => {
  if (e.target === deleteSeriesModal) closeDeleteSeriesModal();
});
cancelMergeSeriesBtn?.addEventListener('click', closeMergeSeriesModal);
mergeSeriesModal?.addEventListener('click', (e) => {
  if (e.target === mergeSeriesModal) closeMergeSeriesModal();
});

mergeTargetSelect?.addEventListener('change', () => {
  confirmMergeSeriesBtn.disabled = !mergeTargetSelect.value;
});

seriesForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  clearFormErrors(seriesForm);
  const formData = {
    name: seriesNameInput.value,
    description: seriesDescriptionInput.value || null,
    totalBooks: seriesTotalBooksInput.value
  };

  const result = validateForm(SeriesFormSchema, formData);
  if (!result.success) {
    showFormErrors(seriesForm, result.errors);
    return;
  }

  saveSeriesBtn.disabled = true;
  saveSeriesBtn.textContent = 'Saving...';

  try {
    if (editingSeriesId) {
      await updateSeries(currentUser.uid, editingSeriesId, {
        name: result.data.name,
        description: result.data.description,
        totalBooks: result.data.totalBooks
      });
      showToast('Series updated!', { type: 'success' });
    } else {
      await createSeries(currentUser.uid, result.data.name, result.data.description, result.data.totalBooks);
      showToast('Series created!', { type: 'success' });
    }

    closeSeriesModal();
    clearSeriesCache();
    await loadSeries();
  } catch (error) {
    console.error('Error saving series:', error);
    showToast(error.message || 'Error saving series', { type: 'error' });
  } finally {
    saveSeriesBtn.disabled = false;
    saveSeriesBtn.textContent = editingSeriesId ? 'Save' : 'Add';
  }
});

confirmDeleteSeriesBtn?.addEventListener('click', async () => {
  if (!deletingSeriesId) return;

  confirmDeleteSeriesBtn.disabled = true;
  confirmDeleteSeriesBtn.textContent = 'Deleting...';

  try {
    const booksUpdated = await deleteSeries(currentUser.uid, deletingSeriesId);

    if (booksUpdated > 0) {
      clearBooksCache(currentUser.uid);
    }

    showToast('Series deleted', { type: 'success' });
    closeDeleteSeriesModal();
    clearSeriesCache();
    await loadSeries();
  } catch (error) {
    console.error('Error deleting series:', error);
    showToast('Error deleting series', { type: 'error' });
  } finally {
    confirmDeleteSeriesBtn.disabled = false;
    confirmDeleteSeriesBtn.textContent = 'Delete';
  }
});

confirmMergeSeriesBtn?.addEventListener('click', async () => {
  if (!mergingSeriesId || !mergeTargetSelect.value) return;

  confirmMergeSeriesBtn.disabled = true;
  confirmMergeSeriesBtn.textContent = 'Merging...';

  try {
    const result = await mergeSeries(currentUser.uid, mergingSeriesId, mergeTargetSelect.value);

    const message = result.booksUpdated > 0
      ? `Merged! ${result.booksUpdated} book${result.booksUpdated !== 1 ? 's' : ''} moved.`
      : 'Series merged!';

    showToast(message, { type: 'success' });
    closeMergeSeriesModal();
    clearSeriesCache();
    clearBooksCache(currentUser.uid);
    await loadSeries();
  } catch (error) {
    console.error('Error merging series:', error);
    showToast(error.message || 'Error merging series', { type: 'error' });
  } finally {
    confirmMergeSeriesBtn.disabled = false;
    confirmMergeSeriesBtn.textContent = 'Merge';
  }
});

// ==================== Backup & Restore ====================

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

async function exportBackup() {
  exportBtn.disabled = true;
  exportBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Loading...';

  try {
    await loadAllBooks();

    if (books.length === 0 && genres.length === 0) {
      showToast('No data to export', { type: 'error' });
      return;
    }

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      genres: genres.map(({ id, ...genre }) => ({ ...genre, _exportId: id })),
      books: books.map(({ id, _normalizedTitle, _normalizedAuthor, ...book }) => book)
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mybookshelf-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast(`Exported ${books.length} books and ${genres.length} genres`);
  } catch (error) {
    console.error('Error exporting backup:', error);
    showToast('Error exporting backup', { type: 'error' });
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i><span>Download Backup</span>';
    initIcons();
  }
}

async function importBackup(file) {
  importBtn.disabled = true;
  importProgress?.classList.remove('hidden');
  if (importStatus) importStatus.textContent = 'Reading file...';

  try {
    const text = await file.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON file');
    }

    if (!data.version || data.version !== 1) {
      throw new Error('Unrecognized backup format');
    }

    const importGenres = data.genres || [];
    const importBooks = data.books || [];

    if (importBooks.length === 0 && importGenres.length === 0) {
      throw new Error('Backup file is empty');
    }

    if (importStatus) importStatus.textContent = 'Checking for duplicates...';
    await loadAllBooks();
    const existingGenres = await loadUserGenres(currentUser.uid);

    const genreIdMap = new Map();
    let genresImported = 0;
    let genresSkipped = 0;

    if (importGenres.length > 0) {
      if (importStatus) importStatus.textContent = 'Importing genres...';

      for (const genre of importGenres) {
        const existingGenre = existingGenres.find(g => g.name.toLowerCase() === genre.name.toLowerCase());

        if (existingGenre) {
          genreIdMap.set(genre._exportId, existingGenre.id);
          genresSkipped++;
        } else {
          const newGenre = await createGenre(currentUser.uid, genre.name, genre.color);
          genreIdMap.set(genre._exportId, newGenre.id);
          genresImported++;
        }
      }
    }

    let booksImported = 0;
    let booksSkipped = 0;

    if (importBooks.length > 0) {
      if (importStatus) importStatus.textContent = 'Importing books...';

      const booksRef = collection(db, 'users', currentUser.uid, 'books');
      const booksToImport = [];

      for (const book of importBooks) {
        const isDuplicate = books.some(existing => {
          if (book.isbn && existing.isbn && book.isbn === existing.isbn) return true;
          if (book.title && existing.title &&
              book.title.toLowerCase() === existing.title.toLowerCase() &&
              (book.author || '').toLowerCase() === (existing.author || '').toLowerCase()) return true;
          return false;
        });

        if (isDuplicate) {
          booksSkipped++;
          continue;
        }

        let remappedGenres = [];
        if (book.genres && Array.isArray(book.genres)) {
          remappedGenres = book.genres
            .map(oldId => genreIdMap.get(oldId))
            .filter(id => id);
        }

        const bookData = { ...book };
        delete bookData.createdAt;
        delete bookData.updatedAt;

        booksToImport.push({
          ...bookData,
          genres: remappedGenres
        });
      }

      const BATCH_SIZE = 500;
      for (let i = 0; i < booksToImport.length; i += BATCH_SIZE) {
        const batchBooks = booksToImport.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const bookData of batchBooks) {
          const docRef = doc(booksRef);
          batch.set(docRef, {
            ...bookData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
        booksImported += batchBooks.length;
        if (importStatus) importStatus.textContent = `Importing books... ${booksImported}/${booksToImport.length}`;
      }
    }

    clearBooksCache(currentUser.uid);
    clearGenresCache();

    if (genresImported > 0 || booksImported > 0) {
      if (importStatus) importStatus.textContent = 'Updating genre counts...';
      await recalculateGenreBookCounts(currentUser.uid);
    }

    const results = [];
    if (booksImported > 0) results.push(`${booksImported} books`);
    if (genresImported > 0) results.push(`${genresImported} genres`);

    const skipped = [];
    if (booksSkipped > 0) skipped.push(`${booksSkipped} duplicate books`);
    if (genresSkipped > 0) skipped.push(`${genresSkipped} existing genres`);

    let message = `Imported ${results.join(' and ') || 'nothing'}`;
    if (skipped.length > 0) message += `. Skipped ${skipped.join(', ')}`;

    showToast(message);

    setTimeout(() => window.location.reload(), 1500);

  } catch (error) {
    console.error('Error importing backup:', error);
    showToast(error.message || 'Error importing backup', { type: 'error' });
    importProgress?.classList.add('hidden');
  } finally {
    importBtn.disabled = false;
    if (importFileInput) importFileInput.value = '';
  }
}

exportBtn?.addEventListener('click', exportBackup);
importBtn?.addEventListener('click', () => importFileInput?.click());
importFileInput?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importBackup(file);
});
