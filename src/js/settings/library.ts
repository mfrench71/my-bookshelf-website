// Library Settings Page Logic
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged, User } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { bookRepository } from '../repositories/book-repository.js';
import {
  loadUserGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  mergeGenres,
  GENRE_COLORS,
  getUsedColors,
  clearGenresCache,
  recalculateGenreBookCounts,
} from '../genres.js';
import {
  loadUserSeries,
  createSeries,
  updateSeries,
  deleteSeries,
  mergeSeries,
  clearSeriesCache,
  findPotentialDuplicates,
  updateSeriesBookCounts,
} from '../series.js';
import { seriesRepository } from '../repositories/series-repository.js';
import {
  showToast,
  initIcons,
  getContrastColor,
  escapeHtml,
  clearBooksCache,
  CACHE_KEY,
  serializeTimestamp,
  isMobile,
  isValidHexColor,
} from '../utils.js';
import { validateForm, showFormErrors, clearFormErrors } from '../utils/validation.js';
import { GenreSchema, validateGenreUniqueness, validateColourUniqueness } from '../schemas/genre.js';
import { SeriesFormSchema } from '../schemas/series.js';
import { BottomSheet } from '../components/modal.js';
import { wishlistRepository } from '../repositories/wishlist-repository.js';
import { updateSettingsIndicators } from '../utils/settings-indicators.js';
import { getSyncSettings, saveSyncSettings } from '../utils/sync-settings.js';

/** Genre data structure */
interface GenreData {
  id: string;
  name: string;
  color: string;
  bookCount?: number;
  [key: string]: unknown;
}

/** Series data structure */
interface SeriesData {
  id: string;
  name: string;
  description?: string;
  totalBooks?: number;
  bookCount?: number;
  [key: string]: unknown;
}

/** Book data structure for backup/restore */
interface BookData {
  id?: string;
  title: string;
  author?: string;
  isbn?: string;
  genres?: string[];
  seriesId?: string;
  _normalizedTitle?: string;
  _normalizedAuthor?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

/** Wishlist item data structure */
interface WishlistItemData {
  id?: string;
  title?: string;
  author?: string;
  isbn?: string;
  coverImageUrl?: string;
  priority?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

/** Export data format */
interface ExportData {
  version: number;
  exportedAt: string;
  genres: Array<Omit<GenreData, 'id'> & { _exportId: string }>;
  series: Array<Omit<SeriesData, 'id'> & { _exportId: string }>;
  books: BookData[];
  wishlist: WishlistItemData[];
  bin: BookData[];
}

// Initialize icons once on load
initIcons();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIcons);
} else {
  setTimeout(initIcons, 0);
}

// State
let currentUser: User | null = null;
let genres: GenreData[] = [];
let series: SeriesData[] = [];
let books: BookData[] = [];
let wishlist: WishlistItemData[] = [];
let allBooksLoaded = false;
let editingGenreId: string | null = null;
let editingSeriesId: string | null = null;
let deletingGenreId: string | null = null;
let deletingSeriesId: string | null = null;
let mergingGenreId: string | null = null;
let mergingSeriesId: string | null = null;
let selectedColor: string = GENRE_COLORS[0];

// Original values for change tracking
let originalGenreValues = { name: '', color: '' };
let originalSeriesValues = { name: '', description: '', totalBooks: '' };

// DOM Elements - Genres
const genresLoading = document.getElementById('genres-loading');
const genresEmpty = document.getElementById('genres-empty');
const genreList = document.getElementById('genre-list');
const addGenreBtn = document.getElementById('add-genre-btn');
const genreModal = document.getElementById('genre-modal');
const genreModalTitle = document.getElementById('genre-modal-title');
const genreForm = document.getElementById('genre-form') as HTMLFormElement | null;
const genreNameInput = document.getElementById('genre-name') as HTMLInputElement | null;
const colorPickerSection = document.getElementById('color-picker-section');
const colorPicker = document.getElementById('color-picker');
const cancelGenreBtn = document.getElementById('cancel-genre');
const saveGenreBtn = document.getElementById('save-genre') as HTMLButtonElement | null;
const deleteGenreModal = document.getElementById('delete-genre-modal');
const deleteGenreMessage = document.getElementById('delete-genre-message');
const cancelDeleteGenreBtn = document.getElementById('cancel-delete-genre');
const confirmDeleteGenreBtn = document.getElementById('confirm-delete-genre') as HTMLButtonElement | null;
const mergeGenreModal = document.getElementById('merge-genre-modal');
const mergeGenreSourceName = document.getElementById('merge-genre-source-name');
const mergeGenreTargetSelect = document.getElementById('merge-genre-target-select') as HTMLSelectElement | null;
const cancelMergeGenreBtn = document.getElementById('cancel-merge-genre');
const confirmMergeGenreBtn = document.getElementById('confirm-merge-genre') as HTMLButtonElement | null;

// DOM Elements - Picker Display
const genreSuggestionsFirstToggle = document.getElementById(
  'genre-suggestions-first-toggle'
) as HTMLInputElement | null;
const seriesSuggestionsFirstToggle = document.getElementById(
  'series-suggestions-first-toggle'
) as HTMLInputElement | null;

// DOM Elements - Series
const seriesLoading = document.getElementById('series-loading');
const seriesEmpty = document.getElementById('series-empty');
const seriesList = document.getElementById('series-list');
const addSeriesBtn = document.getElementById('add-series-btn');
const seriesModal = document.getElementById('series-modal');
const seriesModalTitle = document.getElementById('series-modal-title');
const seriesForm = document.getElementById('series-form') as HTMLFormElement | null;
const seriesNameInput = document.getElementById('series-name') as HTMLInputElement | null;
const seriesDescriptionInput = document.getElementById('series-description') as HTMLTextAreaElement | null;
const seriesTotalBooksInput = document.getElementById('series-total-books') as HTMLInputElement | null;
const cancelSeriesBtn = document.getElementById('cancel-series');
const saveSeriesBtn = document.getElementById('save-series') as HTMLButtonElement | null;
const deleteSeriesModal = document.getElementById('delete-series-modal');
const deleteSeriesMessage = document.getElementById('delete-series-message');
const cancelDeleteSeriesBtn = document.getElementById('cancel-delete-series');
const confirmDeleteSeriesBtn = document.getElementById('confirm-delete-series') as HTMLButtonElement | null;
const mergeSeriesModal = document.getElementById('merge-series-modal');
const mergeSourceName = document.getElementById('merge-source-name');
const mergeTargetSelect = document.getElementById('merge-target-select') as HTMLSelectElement | null;
const cancelMergeSeriesBtn = document.getElementById('cancel-merge-series');
const confirmMergeSeriesBtn = document.getElementById('confirm-merge-series') as HTMLButtonElement | null;
const seriesDuplicates = document.getElementById('series-duplicates');
const duplicateList = document.getElementById('duplicate-list');

// DOM Elements - Backup & Restore
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement | null;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement | null;
const importFileInput = document.getElementById('import-file') as HTMLInputElement | null;
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
  genreList.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const editBtn = target.closest('.edit-btn') as HTMLElement | null;
    if (editBtn) {
      openEditGenreModal(editBtn.dataset.id!);
      return;
    }
    const mergeBtn = target.closest('.merge-genre-btn') as HTMLElement | null;
    if (mergeBtn) {
      openMergeGenreModal(mergeBtn.dataset.id!, mergeBtn.dataset.name!);
      return;
    }
    const deleteBtn = target.closest('.delete-btn') as HTMLElement | null;
    if (deleteBtn) {
      openDeleteGenreModal(deleteBtn.dataset.id!, deleteBtn.dataset.name!, parseInt(deleteBtn.dataset.count!));
    }
  });
}

// Event delegation for series list
if (seriesList) {
  seriesList.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const editBtn = target.closest('.edit-series-btn') as HTMLElement | null;
    if (editBtn) {
      openEditSeriesModal(editBtn.dataset.id!);
      return;
    }
    const deleteBtn = target.closest('.delete-series-btn') as HTMLElement | null;
    if (deleteBtn) {
      openDeleteSeriesModal(deleteBtn.dataset.id!, deleteBtn.dataset.name!, parseInt(deleteBtn.dataset.count!));
      return;
    }
    const mergeBtn = target.closest('.merge-series-btn') as HTMLElement | null;
    if (mergeBtn) {
      openMergeSeriesModal(mergeBtn.dataset.id!, mergeBtn.dataset.name!);
    }
  });
}

// Auth Check
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    currentUser = user;
    loadPickerDisplaySettings();
    await Promise.all([loadGenres(), loadSeries()]);
    updateSettingsIndicators(user.uid);
  }
});

// ==================== Picker Display ====================

/**
 * Load picker display settings from localStorage
 */
function loadPickerDisplaySettings(): void {
  const settings = getSyncSettings();
  if (genreSuggestionsFirstToggle) {
    genreSuggestionsFirstToggle.checked = settings.genreSuggestionsFirst;
  }
  if (seriesSuggestionsFirstToggle) {
    seriesSuggestionsFirstToggle.checked = settings.seriesSuggestionsFirst;
  }
}

// Genre suggestions toggle event listener
genreSuggestionsFirstToggle?.addEventListener('change', () => {
  const enabled = genreSuggestionsFirstToggle.checked;
  saveSyncSettings({ genreSuggestionsFirst: enabled });
  showToast(enabled ? 'Genre suggestions shown first' : 'Your genres shown first', { type: 'info' });
});

// Series suggestions toggle event listener
seriesSuggestionsFirstToggle?.addEventListener('change', () => {
  const enabled = seriesSuggestionsFirstToggle.checked;
  saveSyncSettings({ seriesSuggestionsFirst: enabled });
  showToast(enabled ? 'Series suggestions shown first' : 'Your series shown first', { type: 'info' });
});

// ==================== Genres ====================

async function loadGenres(): Promise<void> {
  if (!currentUser) return;

  try {
    genres = await loadUserGenres(currentUser.uid, true);
    renderGenres();
  } catch (error) {
    console.error('Error loading genres:', error);
    showToast('Error loading genres', { type: 'error' });
  }
}

function renderGenres(): void {
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
            ${genres
              .map(genre => {
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
              })
              .join('')}
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
function renderColorPicker(): void {
  if (!colorPicker) return;

  const usedColors = getUsedColors(genres, editingGenreId);

  // Only render available colours (hide used instead of disabling)
  const availableColors = GENRE_COLORS.filter((c: string) => !usedColors.has(c.toLowerCase()));

  colorPicker.innerHTML = availableColors
    .map((color: string) => {
      const isSelected = color.toLowerCase() === selectedColor?.toLowerCase();
      const textColor = getContrastColor(color);

      return `
      <button type="button" class="color-btn w-8 h-8 rounded-full border-2 ${isSelected ? 'border-gray-900 ring-2 ring-offset-2 ring-gray-400' : 'border-transparent'} hover:scale-110 transition-transform"
        style="background-color: ${color}" data-color="${color}" aria-label="Select ${color} colour${isSelected ? ' (selected)' : ''}" aria-pressed="${isSelected}">
        ${isSelected ? `<i data-lucide="check" class="w-4 h-4 mx-auto" style="color: ${textColor}" aria-hidden="true"></i>` : ''}
      </button>
    `;
    })
    .join('');

  colorPicker.querySelectorAll<HTMLButtonElement>('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedColor = btn.dataset.color!;
      renderColorPicker();
      updateGenreSaveButtonState();
    });
  });

  initIcons();
}

/**
 * Check if genre form has unsaved changes
 */
function isGenreFormDirty(): boolean {
  if (!genreNameInput) return false;

  // For add mode, form is dirty if name has content
  if (!editingGenreId) {
    return genreNameInput.value.trim().length > 0;
  }
  // For edit mode, compare against original values
  if (genreNameInput.value.trim() !== originalGenreValues.name) return true;
  if (selectedColor !== originalGenreValues.color) return true;
  return false;
}

/**
 * Update genre save button state based on form changes
 */
function updateGenreSaveButtonState(): void {
  if (!saveGenreBtn) return;

  const isDirty = isGenreFormDirty();
  saveGenreBtn.disabled = !isDirty;
  saveGenreBtn.classList.toggle('opacity-50', !isDirty);
  saveGenreBtn.classList.toggle('cursor-not-allowed', !isDirty);
}

function openAddGenreModal(): void {
  if (!genreModalTitle || !genreNameInput || !saveGenreBtn || !genreForm) return;

  editingGenreId = null;
  genreModalTitle.textContent = 'Add Genre';
  genreNameInput.value = '';
  saveGenreBtn.textContent = 'Add';
  clearFormErrors(genreForm);
  // Hide colour picker for add (colour is auto-assigned randomly)
  colorPickerSection?.classList.add('hidden');
  // Initialize button state (disabled until name entered)
  updateGenreSaveButtonState();
  genreSheet?.open();
  if (!isMobile()) genreNameInput.focus();
}

function openEditGenreModal(genreId: string): void {
  const genre = genres.find(g => g.id === genreId);
  if (!genre || !genreModalTitle || !genreNameInput || !saveGenreBtn || !genreForm) return;

  editingGenreId = genreId;
  genreModalTitle.textContent = 'Edit Genre';
  genreNameInput.value = genre.name;
  selectedColor = genre.color;
  saveGenreBtn.textContent = 'Save';
  clearFormErrors(genreForm);
  // Store original values for change tracking
  originalGenreValues = { name: genre.name, color: genre.color };
  // Show colour picker for edit (user can change colour)
  colorPickerSection?.classList.remove('hidden');
  renderColorPicker();
  // Initialize button state (disabled until changes made)
  updateGenreSaveButtonState();
  genreSheet?.open();
  // Scroll colour picker to top after modal opens (double RAF for layout stability)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      colorPicker?.scrollTo(0, 0);
    });
  });
  if (!isMobile()) genreNameInput.focus();
}

function closeGenreModal(): void {
  genreSheet?.close();
  editingGenreId = null;
}

function openDeleteGenreModal(genreId: string, name: string, bookCount: number): void {
  if (!deleteGenreMessage) return;

  deletingGenreId = genreId;
  deleteGenreMessage.textContent =
    bookCount > 0
      ? `This will remove "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
      : `Are you sure you want to delete "${name}"?`;
  deleteGenreSheet?.open();
}

function closeDeleteGenreModal(): void {
  deleteGenreSheet?.close();
  deletingGenreId = null;
}

function openMergeGenreModal(genreId: string, name: string): void {
  if (!mergeGenreSourceName || !mergeGenreTargetSelect || !confirmMergeGenreBtn) return;

  mergingGenreId = genreId;
  mergeGenreSourceName.textContent = name;

  mergeGenreTargetSelect.innerHTML =
    '<option value="">Select a genre...</option>' +
    genres
      .filter(g => g.id !== genreId)
      .map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`)
      .join('');

  confirmMergeGenreBtn.disabled = true;
  mergeGenreSheet?.open();
}

function closeMergeGenreModal(): void {
  mergeGenreSheet?.close();
  mergingGenreId = null;
}

// Genre Event Listeners
addGenreBtn?.addEventListener('click', openAddGenreModal);
cancelGenreBtn?.addEventListener('click', closeGenreModal);
cancelDeleteGenreBtn?.addEventListener('click', closeDeleteGenreModal);
cancelMergeGenreBtn?.addEventListener('click', closeMergeGenreModal);

// Update save button state when genre name changes
genreNameInput?.addEventListener('input', updateGenreSaveButtonState);

mergeGenreTargetSelect?.addEventListener('change', () => {
  if (confirmMergeGenreBtn && mergeGenreTargetSelect) {
    confirmMergeGenreBtn.disabled = !mergeGenreTargetSelect.value;
  }
});

genreForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  if (!genreForm || !genreNameInput || !saveGenreBtn || !currentUser) return;

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
  if (!deletingGenreId || !confirmDeleteGenreBtn || !currentUser) return;

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
  if (!mergingGenreId || !mergeGenreTargetSelect?.value || !confirmMergeGenreBtn || !currentUser) return;

  confirmMergeGenreBtn.disabled = true;
  confirmMergeGenreBtn.textContent = 'Merging...';

  try {
    const result = await mergeGenres(currentUser.uid, mergingGenreId, mergeGenreTargetSelect.value);

    const message =
      result.booksUpdated > 0
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

async function loadSeries(): Promise<void> {
  if (!currentUser) return;

  try {
    series = await loadUserSeries(currentUser.uid, true);
    renderSeries();
  } catch (error) {
    console.error('Error loading series:', error);
    showToast('Error loading series', { type: 'error' });
  }
}

function renderSeries(): void {
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
            ${series
              .map(s => {
                const completionText = s.totalBooks ? `${s.bookCount || 0}/${s.totalBooks}` : `${s.bookCount || 0}`;

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
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  renderDuplicateWarnings();
  initIcons();
}

function renderDuplicateWarnings(): void {
  if (!seriesDuplicates || !duplicateList) return;

  const duplicates = findPotentialDuplicates(series);

  if (duplicates.length === 0) {
    seriesDuplicates.classList.add('hidden');
    return;
  }

  duplicateList.innerHTML = duplicates
    .map((group: SeriesData[]) => {
      const names = group.map(s => `"${escapeHtml(s.name)}"`).join(', ');
      return `<p class="text-sm text-amber-800">${names}</p>`;
    })
    .join('');

  seriesDuplicates.classList.remove('hidden');
  initIcons();
}

/**
 * Check if series form has unsaved changes
 */
function isSeriesFormDirty(): boolean {
  if (!seriesNameInput || !seriesDescriptionInput || !seriesTotalBooksInput) return false;

  // For add mode, form is dirty if name has content
  if (!editingSeriesId) {
    return seriesNameInput.value.trim().length > 0;
  }
  // For edit mode, compare against original values
  if (seriesNameInput.value.trim() !== originalSeriesValues.name) return true;
  if ((seriesDescriptionInput.value || '') !== originalSeriesValues.description) return true;
  if ((seriesTotalBooksInput.value || '') !== originalSeriesValues.totalBooks) return true;
  return false;
}

/**
 * Update series save button state based on form changes
 */
function updateSeriesSaveButtonState(): void {
  if (!saveSeriesBtn) return;

  const isDirty = isSeriesFormDirty();
  saveSeriesBtn.disabled = !isDirty;
  saveSeriesBtn.classList.toggle('opacity-50', !isDirty);
  saveSeriesBtn.classList.toggle('cursor-not-allowed', !isDirty);
}

function openAddSeriesModal(): void {
  if (
    !seriesModalTitle ||
    !seriesNameInput ||
    !seriesDescriptionInput ||
    !seriesTotalBooksInput ||
    !saveSeriesBtn ||
    !seriesForm
  ) {
    return;
  }

  editingSeriesId = null;
  seriesModalTitle.textContent = 'Add Series';
  seriesNameInput.value = '';
  seriesDescriptionInput.value = '';
  seriesTotalBooksInput.value = '';
  saveSeriesBtn.textContent = 'Add';
  clearFormErrors(seriesForm);
  // Initialize button state (disabled until name entered)
  updateSeriesSaveButtonState();
  seriesSheet?.open();
  if (!isMobile()) seriesNameInput.focus();
}

function openEditSeriesModal(seriesId: string): void {
  const s = series.find(x => x.id === seriesId);
  if (
    !s ||
    !seriesModalTitle ||
    !seriesNameInput ||
    !seriesDescriptionInput ||
    !seriesTotalBooksInput ||
    !saveSeriesBtn ||
    !seriesForm
  ) {
    return;
  }

  editingSeriesId = seriesId;
  seriesModalTitle.textContent = 'Edit Series';
  seriesNameInput.value = s.name;
  seriesDescriptionInput.value = s.description || '';
  seriesTotalBooksInput.value = s.totalBooks ? String(s.totalBooks) : '';
  saveSeriesBtn.textContent = 'Save';
  clearFormErrors(seriesForm);
  // Store original values for change tracking
  originalSeriesValues = {
    name: s.name,
    description: s.description || '',
    totalBooks: s.totalBooks ? String(s.totalBooks) : '',
  };
  // Initialize button state (disabled until changes made)
  updateSeriesSaveButtonState();
  seriesSheet?.open();
  if (!isMobile()) seriesNameInput.focus();
}

function closeSeriesModal(): void {
  seriesSheet?.close();
  editingSeriesId = null;
}

function openDeleteSeriesModal(seriesId: string, name: string, bookCount: number): void {
  if (!deleteSeriesMessage) return;

  deletingSeriesId = seriesId;
  deleteSeriesMessage.textContent =
    bookCount > 0
      ? `This will unlink "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
      : `Are you sure you want to delete "${name}"?`;
  deleteSeriesSheet?.open();
}

function closeDeleteSeriesModal(): void {
  deleteSeriesSheet?.close();
  deletingSeriesId = null;
}

function openMergeSeriesModal(seriesId: string, name: string): void {
  if (!mergeSourceName || !mergeTargetSelect || !confirmMergeSeriesBtn) return;

  mergingSeriesId = seriesId;
  mergeSourceName.textContent = name;

  mergeTargetSelect.innerHTML =
    '<option value="">Select a series...</option>' +
    series
      .filter(s => s.id !== seriesId)
      .map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
      .join('');

  confirmMergeSeriesBtn.disabled = true;
  mergeSeriesSheet?.open();
}

function closeMergeSeriesModal(): void {
  mergeSeriesSheet?.close();
  mergingSeriesId = null;
}

// Series Event Listeners
addSeriesBtn?.addEventListener('click', openAddSeriesModal);
cancelSeriesBtn?.addEventListener('click', closeSeriesModal);
cancelDeleteSeriesBtn?.addEventListener('click', closeDeleteSeriesModal);
cancelMergeSeriesBtn?.addEventListener('click', closeMergeSeriesModal);

// Update save button state when series fields change
seriesNameInput?.addEventListener('input', updateSeriesSaveButtonState);
seriesDescriptionInput?.addEventListener('input', updateSeriesSaveButtonState);
seriesTotalBooksInput?.addEventListener('input', updateSeriesSaveButtonState);

mergeTargetSelect?.addEventListener('change', () => {
  if (confirmMergeSeriesBtn && mergeTargetSelect) {
    confirmMergeSeriesBtn.disabled = !mergeTargetSelect.value;
  }
});

seriesForm?.addEventListener('submit', async (e: Event) => {
  e.preventDefault();
  if (
    !seriesForm ||
    !seriesNameInput ||
    !seriesDescriptionInput ||
    !seriesTotalBooksInput ||
    !saveSeriesBtn ||
    !currentUser
  ) {
    return;
  }

  clearFormErrors(seriesForm);
  const formData = {
    name: seriesNameInput.value,
    description: seriesDescriptionInput.value || null,
    totalBooks: seriesTotalBooksInput.value,
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
        totalBooks: result.data.totalBooks,
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
  if (!deletingSeriesId || !confirmDeleteSeriesBtn || !currentUser) return;

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
  if (!mergingSeriesId || !mergeTargetSelect?.value || !confirmMergeSeriesBtn || !currentUser) return;

  confirmMergeSeriesBtn.disabled = true;
  confirmMergeSeriesBtn.textContent = 'Merging...';

  try {
    const result = await mergeSeries(currentUser.uid, mergingSeriesId, mergeTargetSelect.value);

    const message =
      result.booksUpdated > 0
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

async function loadAllBooks(): Promise<void> {
  if (allBooksLoaded || !currentUser) return;

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
  } catch (_e) {
    console.warn('Cache read error');
  }

  try {
    const fetchedBooks = await bookRepository.getWithOptions(currentUser.uid, {
      orderByField: 'createdAt',
      orderDirection: 'desc',
    });
    books = fetchedBooks.map(book => {
      const data = book as BookData;
      return {
        ...data,
        createdAt: serializeTimestamp(data.createdAt as Parameters<typeof serializeTimestamp>[0]),
        updatedAt: serializeTimestamp(data.updatedAt as Parameters<typeof serializeTimestamp>[0]),
      } as BookData;
    });
    allBooksLoaded = true;
  } catch (error) {
    console.error('Error loading books:', error);
    throw error;
  }
}

async function exportBackup(): Promise<void> {
  if (!exportBtn || !currentUser) return;

  exportBtn.disabled = true;
  exportBtn.innerHTML =
    '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Loading...';

  try {
    await loadAllBooks();

    // Load all series (including soft-deleted)
    let allSeries: SeriesData[] = [];
    try {
      allSeries = await seriesRepository.getAllSorted(currentUser.uid);
    } catch (_e) {
      console.warn('Failed to load series for export');
    }

    // Load wishlist for export
    try {
      wishlist = (await wishlistRepository.getAll(currentUser.uid)) as WishlistItemData[];
    } catch (_e) {
      console.warn('Failed to load wishlist for export');
      wishlist = [];
    }

    // Load all books including binned (soft-deleted)
    let allBooks: BookData[] = [];
    try {
      const fetchedBooks = await bookRepository.getWithOptions(currentUser.uid, {
        orderByField: 'createdAt',
        orderDirection: 'desc',
      });
      allBooks = fetchedBooks.map(book => {
        const data = book as BookData;
        return {
          ...data,
          createdAt: serializeTimestamp(data.createdAt as Parameters<typeof serializeTimestamp>[0]),
          updatedAt: serializeTimestamp(data.updatedAt as Parameters<typeof serializeTimestamp>[0]),
        } as BookData;
      });
    } catch (_e) {
      console.warn('Failed to load all books for export');
      allBooks = books;
    }

    // Separate active books from binned books
    const activeBooks = allBooks.filter(book => !(book as Record<string, unknown>).deletedAt);
    const binnedBooks = allBooks.filter(book => (book as Record<string, unknown>).deletedAt);

    if (
      activeBooks.length === 0 &&
      genres.length === 0 &&
      wishlist.length === 0 &&
      allSeries.length === 0 &&
      binnedBooks.length === 0
    ) {
      showToast('No data to export', { type: 'error' });
      return;
    }

    const exportData: ExportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      genres: genres.map(({ id, ...genre }) => ({ ...genre, _exportId: id })),
      series: allSeries.map(({ id, ...s }) => ({ ...s, _exportId: id })),
      books: activeBooks.map(({ id: _id, _normalizedTitle, _normalizedAuthor, ...book }) => book),
      wishlist: wishlist.map(({ id: _id, ...item }) => item),
      bin: binnedBooks.map(({ id: _id, _normalizedTitle, _normalizedAuthor, ...book }) => book),
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mybookshelf-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    const parts = [`${activeBooks.length} books`, `${genres.length} genres`];
    if (allSeries.length > 0) parts.push(`${allSeries.length} series`);
    if (wishlist.length > 0) parts.push(`${wishlist.length} wishlist items`);
    if (binnedBooks.length > 0) parts.push(`${binnedBooks.length} binned`);
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

async function importBackup(file: File): Promise<void> {
  if (!importBtn || !currentUser) return;

  importBtn.disabled = true;
  importProgress?.classList.remove('hidden');
  importSummary?.classList.add('hidden');
  if (importStatus) importStatus.textContent = 'Reading file...';

  try {
    const text = await file.text();
    let data: ExportData;

    try {
      data = JSON.parse(text);
    } catch (_e) {
      throw new Error('Invalid JSON file');
    }

    // Support both v1 and v2 formats
    if (!data.version || (data.version !== 1 && data.version !== 2)) {
      throw new Error('Unrecognized backup format');
    }

    // Migrate v1 to v2 format (add empty series/bin)
    if (data.version === 1) {
      data.series = [];
      data.bin = [];
    }

    const importGenres = data.genres || [];
    const importSeries = data.series || [];
    const importBooks = data.books || [];
    const importWishlist = data.wishlist || [];
    const importBin = data.bin || [];

    if (
      importBooks.length === 0 &&
      importGenres.length === 0 &&
      importWishlist.length === 0 &&
      importSeries.length === 0 &&
      importBin.length === 0
    ) {
      throw new Error('Backup file is empty');
    }

    if (importStatus) importStatus.textContent = 'Checking for duplicates...';
    await loadAllBooks();
    const existingGenres = await loadUserGenres(currentUser.uid);

    // Load existing wishlist for cross-checks
    let existingWishlist: WishlistItemData[] = [];
    try {
      existingWishlist = (await wishlistRepository.getAll(currentUser.uid)) as WishlistItemData[];
    } catch (_e) {
      console.warn('Failed to load existing wishlist');
    }

    const genreIdMap = new Map<string, string>();
    let genresImported = 0;
    let genresSkipped = 0;

    if (importGenres.length > 0) {
      if (importStatus) importStatus.textContent = 'Importing genres...';

      for (const genre of importGenres) {
        const genreName = genre.name as string;
        const genreColor = genre.color as string;
        const existingGenre = existingGenres.find((g: GenreData) => g.name.toLowerCase() === genreName.toLowerCase());

        if (existingGenre) {
          genreIdMap.set(genre._exportId as string, existingGenre.id);
          genresSkipped++;
        } else {
          const newGenre = await createGenre(currentUser.uid, genreName, genreColor);
          genreIdMap.set(genre._exportId as string, newGenre.id);
          genresImported++;
        }
      }
    }

    // Import series
    const seriesIdMap = new Map<string, string>();
    let seriesImported = 0;
    let seriesSkipped = 0;

    if (importSeries.length > 0) {
      if (importStatus) importStatus.textContent = 'Importing series...';
      const existingSeries = await seriesRepository.getAllSorted(currentUser.uid);

      for (const s of importSeries) {
        const seriesName = s.name as string;
        const existingSeriesItem = existingSeries.find(
          (es: SeriesData) => es.name.toLowerCase() === seriesName.toLowerCase()
        );

        if (existingSeriesItem) {
          seriesIdMap.set(s._exportId as string, existingSeriesItem.id);
          seriesSkipped++;
        } else {
          const newSeries = await createSeries(
            currentUser.uid,
            seriesName,
            (s.description as string) || null,
            (s.totalBooks as number) || null
          );
          seriesIdMap.set(s._exportId as string, newSeries.id);
          seriesImported++;
        }
      }
    }

    let booksImported = 0;
    let booksSkipped = 0;
    const importedBookKeys = new Set<string>(); // Track imported books for wishlist cross-check

    if (importBooks.length > 0) {
      if (importStatus) importStatus.textContent = 'Importing books...';

      const booksRef = collection(db, 'users', currentUser.uid, 'books');
      const booksToImport: BookData[] = [];

      for (const book of importBooks) {
        const isDuplicate = books.some(existing => {
          if (book.isbn && existing.isbn && book.isbn === existing.isbn) return true;
          if (
            book.title &&
            existing.title &&
            book.title.toLowerCase() === existing.title.toLowerCase() &&
            (book.author || '').toLowerCase() === (existing.author || '').toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (isDuplicate) {
          booksSkipped++;
          continue;
        }

        let remappedGenres: string[] = [];
        if (book.genres && Array.isArray(book.genres)) {
          remappedGenres = book.genres.map(oldId => genreIdMap.get(oldId)).filter((id): id is string => !!id);
        }

        // Remap seriesId if present
        let remappedSeriesId: string | null = null;
        if (book.seriesId && typeof book.seriesId === 'string') {
          remappedSeriesId = seriesIdMap.get(book.seriesId) || null;
        }

        const bookData = { ...book };
        delete bookData.createdAt;
        delete bookData.updatedAt;

        booksToImport.push({
          ...bookData,
          genres: remappedGenres,
          seriesId: remappedSeriesId,
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
            updatedAt: serverTimestamp(),
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
    const ownedBooksLookup = new Set<string>();
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
      const wishlistToImport: WishlistItemData[] = [];

      for (const item of importWishlist) {
        // Check if already in wishlist
        const isDuplicate = existingWishlist.some(existing => {
          if (item.isbn && existing.isbn && item.isbn === existing.isbn) return true;
          if (
            item.title &&
            existing.title &&
            item.title.toLowerCase() === existing.title.toLowerCase() &&
            (item.author || '').toLowerCase() === (existing.author || '').toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (isDuplicate) {
          wishlistSkipped++;
          continue;
        }

        // Cross-check: skip if already in library (owned)
        const isOwned =
          (item.isbn && ownedBooksLookup.has(`isbn:${item.isbn}`)) ||
          (item.title &&
            ownedBooksLookup.has(`title:${item.title.toLowerCase()}|${(item.author || '').toLowerCase()}`));

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
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        wishlistImported += batchItems.length;
        if (importStatus) {
          importStatus.textContent = `Importing wishlist... ${wishlistImported}/${wishlistToImport.length}`;
        }
      }
    }

    // Cross-check: Remove existing wishlist items that match imported books
    let wishlistAutoRemoved = 0;
    if (importedBookKeys.size > 0 && existingWishlist.length > 0) {
      if (importStatus) importStatus.textContent = 'Cleaning up wishlist...';

      for (const wishlistItem of existingWishlist) {
        const matchesImportedBook =
          (wishlistItem.isbn && importedBookKeys.has(`isbn:${wishlistItem.isbn}`)) ||
          (wishlistItem.title &&
            importedBookKeys.has(
              `title:${wishlistItem.title.toLowerCase()}|${(wishlistItem.author || '').toLowerCase()}`
            ));

        if (matchesImportedBook && wishlistItem.id) {
          try {
            await wishlistRepository.remove(currentUser.uid, wishlistItem.id);
            wishlistAutoRemoved++;
          } catch (_e) {
            console.warn('Failed to auto-remove wishlist item');
          }
        }
      }
    }

    // Import bin items (soft-deleted books)
    let binImported = 0;
    let binSkipped = 0;

    if (importBin.length > 0) {
      if (importStatus) importStatus.textContent = 'Importing bin items...';

      const booksRef = collection(db, 'users', currentUser.uid, 'books');
      const binToImport: BookData[] = [];

      // Get all existing books including binned for duplicate check
      const allExistingBooks = await bookRepository.getWithOptions(currentUser.uid, {
        orderByField: 'createdAt',
        orderDirection: 'desc',
      });

      for (const binBook of importBin) {
        // Check for duplicates against ALL existing books (active + binned)
        const isDuplicate = allExistingBooks.some(existing => {
          if (binBook.isbn && existing.isbn && binBook.isbn === existing.isbn) return true;
          if (
            binBook.title &&
            existing.title &&
            binBook.title.toLowerCase() === existing.title.toLowerCase() &&
            (binBook.author || '').toLowerCase() === (existing.author || '').toLowerCase()
          ) {
            return true;
          }
          return false;
        });

        if (isDuplicate) {
          binSkipped++;
          continue;
        }

        // Remap genres and seriesId
        let remappedGenres: string[] = [];
        if (binBook.genres && Array.isArray(binBook.genres)) {
          remappedGenres = (binBook.genres as string[])
            .map(oldId => genreIdMap.get(oldId))
            .filter((id): id is string => !!id);
        }

        let remappedSeriesId: string | null = null;
        if (binBook.seriesId && typeof binBook.seriesId === 'string') {
          remappedSeriesId = seriesIdMap.get(binBook.seriesId) || null;
        }

        const bookData = { ...binBook };
        delete bookData.createdAt;
        delete bookData.updatedAt;

        binToImport.push({
          ...bookData,
          genres: remappedGenres,
          seriesId: remappedSeriesId,
          deletedAt: (binBook as Record<string, unknown>).deletedAt || Date.now(), // Preserve deletedAt or set to now
        });
      }

      // Batch write bin items
      const BATCH_SIZE = 500;
      for (let i = 0; i < binToImport.length; i += BATCH_SIZE) {
        const batchBooks = binToImport.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);

        for (const bookData of batchBooks) {
          const docRef = doc(booksRef);
          batch.set(docRef, {
            ...bookData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        binImported += batchBooks.length;
        if (importStatus) importStatus.textContent = `Importing bin items... ${binImported}/${binToImport.length}`;
      }
    }

    clearBooksCache(currentUser.uid);
    clearGenresCache();
    clearSeriesCache();
    wishlistRepository.clearCache();

    if (genresImported > 0 || booksImported > 0) {
      if (importStatus) importStatus.textContent = 'Updating counts...';
      await recalculateGenreBookCounts(currentUser.uid);
    }

    // Update series book counts if series were imported
    if (seriesImported > 0 || booksImported > 0) {
      await updateSeriesBookCounts(currentUser.uid);
    }

    // Hide progress spinner
    importProgress?.classList.add('hidden');

    // Build on-page summary
    const summaryLines: string[] = [];

    // Imported counts
    if (booksImported > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4 text-green-600"></i>${booksImported} book${booksImported !== 1 ? 's' : ''} added to library</div>`
      );
    }
    if (genresImported > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2"><i data-lucide="tag" class="w-4 h-4 text-green-600"></i>${genresImported} genre${genresImported !== 1 ? 's' : ''} created</div>`
      );
    }
    if (seriesImported > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2"><i data-lucide="library" class="w-4 h-4 text-green-600"></i>${seriesImported} series created</div>`
      );
    }
    if (wishlistImported > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2"><i data-lucide="heart" class="w-4 h-4 text-green-600"></i>${wishlistImported} wishlist item${wishlistImported !== 1 ? 's' : ''} added</div>`
      );
    }
    if (binImported > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2"><i data-lucide="trash-2" class="w-4 h-4 text-green-600"></i>${binImported} bin item${binImported !== 1 ? 's' : ''} restored</div>`
      );
    }

    // Skipped counts
    if (booksSkipped > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${booksSkipped} duplicate book${booksSkipped !== 1 ? 's' : ''} skipped</div>`
      );
    }
    if (genresSkipped > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${genresSkipped} existing genre${genresSkipped !== 1 ? 's' : ''} skipped</div>`
      );
    }
    if (seriesSkipped > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${seriesSkipped} existing series skipped</div>`
      );
    }
    if (wishlistSkipped > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${wishlistSkipped} duplicate wishlist item${wishlistSkipped !== 1 ? 's' : ''} skipped</div>`
      );
    }
    if (wishlistSkippedOwned > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2 text-gray-500"><i data-lucide="check-circle" class="w-4 h-4"></i>${wishlistSkippedOwned} wishlist item${wishlistSkippedOwned !== 1 ? 's' : ''} skipped (already owned)</div>`
      );
    }
    if (binSkipped > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2 text-gray-500"><i data-lucide="minus-circle" class="w-4 h-4"></i>${binSkipped} duplicate bin item${binSkipped !== 1 ? 's' : ''} skipped</div>`
      );
    }

    // Auto-removed from wishlist
    if (wishlistAutoRemoved > 0) {
      summaryLines.push(
        `<div class="flex items-center gap-2 text-blue-600"><i data-lucide="sparkles" class="w-4 h-4"></i>${wishlistAutoRemoved} wishlist item${wishlistAutoRemoved !== 1 ? 's' : ''} auto-removed (now owned)</div>`
      );
    }

    // Nothing imported
    if (
      booksImported === 0 &&
      genresImported === 0 &&
      seriesImported === 0 &&
      wishlistImported === 0 &&
      binImported === 0
    ) {
      summaryLines.push(`<div class="text-gray-500">No new items to import (all duplicates or already owned)</div>`);
    }

    // Show summary
    if (importSummaryContent) {
      importSummaryContent.innerHTML = summaryLines.join('');
    }
    importSummary?.classList.remove('hidden');
    initIcons();

    // Brief toast
    const totalImported = booksImported + genresImported + seriesImported + wishlistImported + binImported;
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
importFileInput?.addEventListener('change', (e: Event) => {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) importBackup(file);
});
