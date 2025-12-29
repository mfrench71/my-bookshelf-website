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
  mergeGenres,
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
import { showToast, initIcons, getContrastColor, escapeHtml, clearBooksCache, CACHE_KEY, serializeTimestamp, isMobile, isValidHexColor } from '../utils.js';
import { validateForm, showFormErrors, clearFormErrors } from '../utils/validation.js';
import { GenreSchema, validateGenreUniqueness, validateColourUniqueness } from '../schemas/genre.js';
import { SeriesFormSchema } from '../schemas/series.js';
import { BottomSheet } from '../components/modal.js';
import { loadWishlistItems, clearWishlistCache, deleteWishlistItem } from '../wishlist.js';
import { updateSettingsIndicators } from '../utils/settings-indicators.js';

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
let wishlist = [];
let allBooksLoaded = false;
let editingGenreId = null;
let editingSeriesId = null;
let deletingGenreId = null;
let deletingSeriesId = null;
let mergingGenreId = null;
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
const colorPickerSection = document.getElementById('color-picker-section');
const colorPicker = document.getElementById('color-picker');
const cancelGenreBtn = document.getElementById('cancel-genre');
const saveGenreBtn = document.getElementById('save-genre');
const deleteGenreModal = document.getElementById('delete-genre-modal');
const deleteGenreMessage = document.getElementById('delete-genre-message');
const cancelDeleteGenreBtn = document.getElementById('cancel-delete-genre');
const confirmDeleteGenreBtn = document.getElementById('confirm-delete-genre');
const mergeGenreModal = document.getElementById('merge-genre-modal');
const mergeGenreSourceName = document.getElementById('merge-genre-source-name');
const mergeGenreTargetSelect = document.getElementById('merge-genre-target-select');
const cancelMergeGenreBtn = document.getElementById('cancel-merge-genre');
const confirmMergeGenreBtn = document.getElementById('confirm-merge-genre');

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
const importSummary = document.getElementById('import-summary');
const importSummaryContent = document.getElementById('import-summary-content');

// Bottom Sheet Instances
const genreSheet = genreModal ? new BottomSheet({ container: genreModal }) : null;
const deleteGenreSheet = deleteGenreModal ? new BottomSheet({ container: deleteGenreModal }) : null;
const mergeGenreSheet = mergeGenreModal ? new BottomSheet({ container: mergeGenreModal }) : null;
const seriesSheet = seriesModal ? new BottomSheet({ container: seriesModal }) : null;
const deleteSeriesSheet = deleteSeriesModal ? new BottomSheet({ container: deleteSeriesModal }) : null;
const mergeSeriesSheet = mergeSeriesModal ? new BottomSheet({ container: mergeSeriesModal }) : null;

// Event delegation for genre list (prevents memory leaks from re-adding listeners on each render)
if (genreList) {
  genreList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-btn');
    if (editBtn) {
      openEditGenreModal(editBtn.dataset.id);
      return;
    }
    const mergeBtn = e.target.closest('.merge-genre-btn');
    if (mergeBtn) {
      openMergeGenreModal(mergeBtn.dataset.id, mergeBtn.dataset.name);
      return;
    }
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
      openDeleteGenreModal(deleteBtn.dataset.id, deleteBtn.dataset.name, parseInt(deleteBtn.dataset.count));
    }
  });
}

// Event delegation for series list
if (seriesList) {
  seriesList.addEventListener('click', (e) => {
    const editBtn = e.target.closest('.edit-series-btn');
    if (editBtn) {
      openEditSeriesModal(editBtn.dataset.id);
      return;
    }
    const deleteBtn = e.target.closest('.delete-series-btn');
    if (deleteBtn) {
      openDeleteSeriesModal(deleteBtn.dataset.id, deleteBtn.dataset.name, parseInt(deleteBtn.dataset.count));
      return;
    }
    const mergeBtn = e.target.closest('.merge-series-btn');
    if (mergeBtn) {
      openMergeSeriesModal(mergeBtn.dataset.id, mergeBtn.dataset.name);
    }
  });
}

// Auth Check
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await Promise.all([loadGenres(), loadSeries()]);
    updateSettingsIndicators(user.uid);
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
              const safeColor = isValidHexColor(genre.color) ? genre.color : '#6b7280';
              return `
                <tr class="hover:bg-gray-50">
                  <td class="py-1.5 px-3">
                    <div class="flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${safeColor}" title="${escapeHtml(genre.name)}"></span>
                      <span class="text-sm text-gray-900">${escapeHtml(genre.name)}</span>
                    </div>
                  </td>
                  <td class="py-1.5 px-3 text-xs text-gray-500 whitespace-nowrap text-right">${genre.bookCount || 0}</td>
                  <td class="py-0 px-0 text-right whitespace-nowrap">
                    <button class="edit-btn p-2 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" data-id="${genre.id}" aria-label="Edit ${escapeHtml(genre.name)}">
                      <i data-lucide="edit-2" class="w-4 h-4" aria-hidden="true"></i>
                    </button>
                    <button class="merge-genre-btn p-2 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-500 min-w-[44px] min-h-[44px] inline-flex items-center justify-center" data-id="${genre.id}" data-name="${escapeHtml(genre.name)}" aria-label="Merge ${escapeHtml(genre.name)}">
                      <i data-lucide="git-merge" class="w-4 h-4" aria-hidden="true"></i>
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

  }

  initIcons();
}

/**
 * Render the colour picker with only available colours (used colours are hidden)
 */
function renderColorPicker() {
  const usedColors = getUsedColors(genres, editingGenreId);

  // Only render available colours (hide used instead of disabling)
  const availableColors = GENRE_COLORS.filter(c => !usedColors.has(c.toLowerCase()));

  colorPicker.innerHTML = availableColors.map(color => {
    const isSelected = color.toLowerCase() === selectedColor?.toLowerCase();
    const textColor = getContrastColor(color);

    return `
      <button type="button" class="color-btn w-8 h-8 rounded-full border-2 ${isSelected ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-transparent'} hover:scale-110 transition-transform"
        style="background-color: ${color}" data-color="${color}" aria-label="Select ${color} colour${isSelected ? ' (selected)' : ''}" aria-pressed="${isSelected}">
        ${isSelected ? `<i data-lucide="check" class="w-4 h-4 mx-auto" style="color: ${textColor}" aria-hidden="true"></i>` : ''}
      </button>
    `;
  }).join('');

  colorPicker.querySelectorAll('.color-btn').forEach(btn => {
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
  saveGenreBtn.textContent = 'Add';
  clearFormErrors(genreForm);
  // Hide colour picker for add (colour is auto-assigned randomly)
  colorPickerSection?.classList.add('hidden');
  genreSheet?.open();
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
  // Show colour picker for edit (user can change colour)
  colorPickerSection?.classList.remove('hidden');
  renderColorPicker();
  // Scroll colour picker to top
  colorPicker?.scrollTo(0, 0);
  genreSheet?.open();
  if (!isMobile()) genreNameInput.focus();
}

function closeGenreModal() {
  genreSheet?.close();
  editingGenreId = null;
}

function openDeleteGenreModal(genreId, name, bookCount) {
  deletingGenreId = genreId;
  deleteGenreMessage.textContent = bookCount > 0
    ? `This will remove "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
    : `Are you sure you want to delete "${name}"?`;
  deleteGenreSheet?.open();
}

function closeDeleteGenreModal() {
  deleteGenreSheet?.close();
  deletingGenreId = null;
}

function openMergeGenreModal(genreId, name) {
  mergingGenreId = genreId;
  mergeGenreSourceName.textContent = name;

  mergeGenreTargetSelect.innerHTML = '<option value="">Select a genre...</option>' +
    genres
      .filter(g => g.id !== genreId)
      .map(g => {
        const safeColor = isValidHexColor(g.color) ? g.color : '#6b7280';
        return `<option value="${g.id}">${escapeHtml(g.name)}</option>`;
      })
      .join('');

  confirmMergeGenreBtn.disabled = true;
  mergeGenreSheet?.open();
}

function closeMergeGenreModal() {
  mergeGenreSheet?.close();
  mergingGenreId = null;
}

// Genre Event Listeners
addGenreBtn?.addEventListener('click', openAddGenreModal);
cancelGenreBtn?.addEventListener('click', closeGenreModal);
cancelDeleteGenreBtn?.addEventListener('click', closeDeleteGenreModal);
cancelMergeGenreBtn?.addEventListener('click', closeMergeGenreModal);

mergeGenreTargetSelect?.addEventListener('change', () => {
  confirmMergeGenreBtn.disabled = !mergeGenreTargetSelect.value;
});

genreForm?.addEventListener('submit', async (e) => {
  e.preventDefault();

  clearFormErrors(genreForm);

  // For add: only validate name (colour auto-assigned)
  // For edit: validate both name and colour
  const formData = editingGenreId
    ? { name: genreNameInput.value, color: selectedColor }
    : { name: genreNameInput.value };

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

  // Only validate colour uniqueness when editing
  if (editingGenreId && result.data.color) {
    const colourError = validateColourUniqueness(result.data.color, genres, editingGenreId);
    if (colourError) {
      showFormErrors(genreForm, { color: colourError });
      return;
    }
  }

  saveGenreBtn.disabled = true;
  saveGenreBtn.textContent = 'Saving...';

  try {
    if (editingGenreId) {
      await updateGenre(currentUser.uid, editingGenreId, { name: result.data.name, color: result.data.color });
      showToast('Genre updated!', { type: 'success' });
    } else {
      // Create without colour - will be auto-assigned randomly
      await createGenre(currentUser.uid, result.data.name);
      showToast('Genre created!', { type: 'success' });
    }

    closeGenreModal();
    clearGenresCache();
    await loadGenres();
  } catch (error) {
    console.error('Error saving genre:', error);
    showToast('Failed to save genre. Please try again.', { type: 'error' });
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

confirmMergeGenreBtn?.addEventListener('click', async () => {
  if (!mergingGenreId || !mergeGenreTargetSelect.value) return;

  confirmMergeGenreBtn.disabled = true;
  confirmMergeGenreBtn.textContent = 'Merging...';

  try {
    const result = await mergeGenres(currentUser.uid, mergingGenreId, mergeGenreTargetSelect.value);

    const message = result.booksUpdated > 0
      ? `Merged! ${result.booksUpdated} book${result.booksUpdated !== 1 ? 's' : ''} updated.`
      : 'Genre merged!';

    showToast(message, { type: 'success' });
    closeMergeGenreModal();
    clearGenresCache();
    clearBooksCache(currentUser.uid);
    await loadGenres();
  } catch (error) {
    console.error('Error merging genres:', error);
    showToast('Failed to merge genres. Please try again.', { type: 'error' });
  } finally {
    confirmMergeGenreBtn.disabled = false;
    confirmMergeGenreBtn.textContent = 'Merge';
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
  seriesSheet?.open();
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
  seriesSheet?.open();
  if (!isMobile()) seriesNameInput.focus();
}

function closeSeriesModal() {
  seriesSheet?.close();
  editingSeriesId = null;
}

function openDeleteSeriesModal(seriesId, name, bookCount) {
  deletingSeriesId = seriesId;
  deleteSeriesMessage.textContent = bookCount > 0
    ? `This will unlink "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
    : `Are you sure you want to delete "${name}"?`;
  deleteSeriesSheet?.open();
}

function closeDeleteSeriesModal() {
  deleteSeriesSheet?.close();
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
  mergeSeriesSheet?.open();
}

function closeMergeSeriesModal() {
  mergeSeriesSheet?.close();
  mergingSeriesId = null;
}

// Series Event Listeners
addSeriesBtn?.addEventListener('click', openAddSeriesModal);
cancelSeriesBtn?.addEventListener('click', closeSeriesModal);
cancelDeleteSeriesBtn?.addEventListener('click', closeDeleteSeriesModal);
cancelMergeSeriesBtn?.addEventListener('click', closeMergeSeriesModal);

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
    showToast('Failed to save series. Please try again.', { type: 'error' });
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
    showToast('Failed to merge series. Please try again.', { type: 'error' });
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
    // Load wishlist for export
    try {
      wishlist = await loadWishlistItems(currentUser.uid);
    } catch (e) {
      console.warn('Failed to load wishlist for export:', e.message);
      wishlist = [];
    }

    if (books.length === 0 && genres.length === 0 && wishlist.length === 0) {
      showToast('No data to export', { type: 'error' });
      return;
    }

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      genres: genres.map(({ id, ...genre }) => ({ ...genre, _exportId: id })),
      books: books.map(({ id, _normalizedTitle, _normalizedAuthor, ...book }) => book),
      wishlist: wishlist.map(({ id, ...item }) => item)
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mybookshelf-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    const parts = [`${books.length} books`, `${genres.length} genres`];
    if (wishlist.length > 0) parts.push(`${wishlist.length} wishlist items`);
    showToast(`Exported ${parts.join(', ')}`, { type: 'success' });
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
  importSummary?.classList.add('hidden');
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
    const importWishlist = data.wishlist || [];

    if (importBooks.length === 0 && importGenres.length === 0 && importWishlist.length === 0) {
      throw new Error('Backup file is empty');
    }

    if (importStatus) importStatus.textContent = 'Checking for duplicates...';
    await loadAllBooks();
    const existingGenres = await loadUserGenres(currentUser.uid);

    // Load existing wishlist for cross-checks
    let existingWishlist = [];
    try {
      existingWishlist = await loadWishlistItems(currentUser.uid);
    } catch (e) {
      console.warn('Failed to load existing wishlist:', e.message);
    }

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
    const importedBookKeys = new Set(); // Track imported books for wishlist cross-check

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

        // Track for wishlist cross-check
        if (book.isbn) {
          importedBookKeys.add(`isbn:${book.isbn}`);
        }
        if (book.title) {
          importedBookKeys.add(`title:${book.title.toLowerCase()}|${(book.author || '').toLowerCase()}`);
        }
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

    // Import wishlist items (with cross-check against library)
    let wishlistImported = 0;
    let wishlistSkipped = 0;
    let wishlistSkippedOwned = 0;

    // Build lookup of all owned books (existing + just imported)
    const ownedBooksLookup = new Set();
    for (const book of books) {
      if (book.isbn) ownedBooksLookup.add(`isbn:${book.isbn}`);
      if (book.title) ownedBooksLookup.add(`title:${book.title.toLowerCase()}|${(book.author || '').toLowerCase()}`);
    }
    for (const key of importedBookKeys) {
      ownedBooksLookup.add(key);
    }

    if (importWishlist.length > 0) {
      if (importStatus) importStatus.textContent = 'Importing wishlist...';

      const wishlistRef = collection(db, 'users', currentUser.uid, 'wishlist');
      const wishlistToImport = [];

      for (const item of importWishlist) {
        // Check if already in wishlist
        const isDuplicate = existingWishlist.some(existing => {
          if (item.isbn && existing.isbn && item.isbn === existing.isbn) return true;
          if (item.title && existing.title &&
              item.title.toLowerCase() === existing.title.toLowerCase() &&
              (item.author || '').toLowerCase() === (existing.author || '').toLowerCase()) return true;
          return false;
        });

        if (isDuplicate) {
          wishlistSkipped++;
          continue;
        }

        // Cross-check: skip if already in library (owned)
        const isOwned = (item.isbn && ownedBooksLookup.has(`isbn:${item.isbn}`)) ||
          (item.title && ownedBooksLookup.has(`title:${item.title.toLowerCase()}|${(item.author || '').toLowerCase()}`));

        if (isOwned) {
          wishlistSkippedOwned++;
          continue;
        }

        const itemData = { ...item };
        delete itemData.createdAt;
        delete itemData.updatedAt;
        wishlistToImport.push(itemData);
      }

      // Batch write wishlist items
      const BATCH_SIZE = 500;
      for (let i = 0; i < wishlistToImport.length; i += BATCH_SIZE) {
        const batchItems = wishlistToImport.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const itemData of batchItems) {
          const docRef = doc(wishlistRef);
          batch.set(docRef, {
            ...itemData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }

        await batch.commit();
        wishlistImported += batchItems.length;
        if (importStatus) importStatus.textContent = `Importing wishlist... ${wishlistImported}/${wishlistToImport.length}`;
      }
    }

    // Cross-check: Remove existing wishlist items that match imported books
    let wishlistAutoRemoved = 0;
    if (importedBookKeys.size > 0 && existingWishlist.length > 0) {
      if (importStatus) importStatus.textContent = 'Cleaning up wishlist...';

      for (const wishlistItem of existingWishlist) {
        const matchesImportedBook =
          (wishlistItem.isbn && importedBookKeys.has(`isbn:${wishlistItem.isbn}`)) ||
          (wishlistItem.title && importedBookKeys.has(`title:${wishlistItem.title.toLowerCase()}|${(wishlistItem.author || '').toLowerCase()}`));

        if (matchesImportedBook) {
          try {
            await deleteWishlistItem(currentUser.uid, wishlistItem.id);
            wishlistAutoRemoved++;
          } catch (e) {
            console.warn('Failed to auto-remove wishlist item:', e.message);
          }
        }
      }
    }

    clearBooksCache(currentUser.uid);
    clearGenresCache();
    clearWishlistCache();

    if (genresImported > 0 || booksImported > 0) {
      if (importStatus) importStatus.textContent = 'Updating genre counts...';
      await recalculateGenreBookCounts(currentUser.uid);
    }

    // Hide progress spinner
    importProgress?.classList.add('hidden');

    // Build on-page summary
    const summaryLines = [];

    // Imported counts
    if (booksImported > 0) {
      summaryLines.push(`<div class="flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-green-600"></i>${booksImported} book${booksImported !== 1 ? 's' : ''} added to library</div>`);
    }
    if (genresImported > 0) {
      summaryLines.push(`<div class="flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4 text-green-600"></i>${genresImported} genre${genresImported !== 1 ? 's' : ''} created</div>`);
    }
    if (wishlistImported > 0) {
      summaryLines.push(`<div class="flex items-center gap-2"><i data-lucide="heart" class="w-4 h-4 text-green-600"></i>${wishlistImported} wishlist item${wishlistImported !== 1 ? 's' : ''} added</div>`);
    }

    // Skipped counts
    if (booksSkipped > 0) {
      summaryLines.push(`<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${booksSkipped} duplicate book${booksSkipped !== 1 ? 's' : ''} skipped</div>`);
    }
    if (genresSkipped > 0) {
      summaryLines.push(`<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${genresSkipped} existing genre${genresSkipped !== 1 ? 's' : ''} skipped</div>`);
    }
    if (wishlistSkipped > 0) {
      summaryLines.push(`<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${wishlistSkipped} duplicate wishlist item${wishlistSkipped !== 1 ? 's' : ''} skipped</div>`);
    }
    if (wishlistSkippedOwned > 0) {
      summaryLines.push(`<div class="flex items-center gap-2 text-gray-500"><i data-lucide="check-circle" class="w-4 h-4"></i>${wishlistSkippedOwned} wishlist item${wishlistSkippedOwned !== 1 ? 's' : ''} skipped (already owned)</div>`);
    }

    // Auto-removed from wishlist
    if (wishlistAutoRemoved > 0) {
      summaryLines.push(`<div class="flex items-center gap-2 text-blue-600"><i data-lucide="sparkles" class="w-4 h-4"></i>${wishlistAutoRemoved} wishlist item${wishlistAutoRemoved !== 1 ? 's' : ''} auto-removed (now owned)</div>`);
    }

    // Nothing imported
    if (booksImported === 0 && genresImported === 0 && wishlistImported === 0) {
      summaryLines.push(`<div class="text-gray-500">No new items to import (all duplicates or already owned)</div>`);
    }

    // Show summary
    if (importSummaryContent) {
      importSummaryContent.innerHTML = summaryLines.join('');
    }
    importSummary?.classList.remove('hidden');
    initIcons();

    // Brief toast
    const totalImported = booksImported + genresImported + wishlistImported;
    if (totalImported > 0) {
      showToast('Import complete', { type: 'success' });
    } else {
      showToast('Nothing new to import', { type: 'info' });
    }

  } catch (error) {
    console.error('Error importing backup:', error);
    showToast('Failed to import backup. Please check the file format.', { type: 'error' });
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
