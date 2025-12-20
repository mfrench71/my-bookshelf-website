// Settings Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  collection,
  query,
  orderBy,
  getDocs
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  loadUserGenres,
  createGenre,
  updateGenre,
  deleteGenre,
  GENRE_COLORS,
  getUsedColors,
  getAvailableColors,
  clearGenresCache
} from './genres.js';
import { showToast, initIcons, getContrastColor, escapeHtml, clearBooksCache, CACHE_KEY, serializeTimestamp } from './utils.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let genres = [];
let editingGenreId = null;
let selectedColor = GENRE_COLORS[0];
let books = [];
let allBooksLoaded = false;

// DOM Elements - Navigation
const navBtns = document.querySelectorAll('.settings-nav-btn');
const sections = document.querySelectorAll('.settings-section');

// DOM Elements - Genres
const genresLoading = document.getElementById('genres-loading');
const genresEmpty = document.getElementById('genres-empty');
const genreList = document.getElementById('genre-list');
const addGenreBtn = document.getElementById('add-genre-btn');
const genreModal = document.getElementById('genre-modal');
const modalTitle = document.getElementById('modal-title');
const genreForm = document.getElementById('genre-form');
const genreNameInput = document.getElementById('genre-name');
const colorPicker = document.getElementById('color-picker');
const cancelGenreBtn = document.getElementById('cancel-genre');
const saveGenreBtn = document.getElementById('save-genre');
const deleteModal = document.getElementById('delete-modal');
const deleteMessage = document.getElementById('delete-message');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

// DOM Elements - Export
const exportBtn = document.getElementById('export-btn');

// Auth Check
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadGenres();
  }
});

// ==================== Section Navigation ====================

navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const sectionId = btn.dataset.section;
    switchSection(sectionId);
  });
});

function switchSection(sectionId) {
  // Update nav buttons
  navBtns.forEach(btn => {
    const isActive = btn.dataset.section === sectionId;
    btn.classList.toggle('active', isActive);
    btn.classList.toggle('bg-primary', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('text-gray-700', !isActive);
    btn.classList.toggle('hover:bg-gray-100', !isActive);
  });

  // Show/hide sections
  sections.forEach(section => {
    const isActive = section.id === `${sectionId}-section`;
    section.classList.toggle('hidden', !isActive);
  });

  initIcons();
}

// Initialize active state
switchSection('genres');

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
  genresLoading.classList.add('hidden');

  if (genres.length === 0) {
    genresEmpty.classList.remove('hidden');
    genreList.innerHTML = '';
    initIcons();
    return;
  }

  genresEmpty.classList.add('hidden');

  genreList.innerHTML = genres.map(genre => {
    const textColor = getContrastColor(genre.color);
    return `
      <div class="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
        <span class="genre-badge" style="background-color: ${genre.color}; color: ${textColor}">${escapeHtml(genre.name)}</span>
        <span class="text-sm text-gray-500 flex-1">${genre.bookCount || 0} book${(genre.bookCount || 0) !== 1 ? 's' : ''}</span>
        <button class="edit-btn p-2 hover:bg-gray-100 rounded-lg text-gray-500" data-id="${genre.id}" title="Edit">
          <i data-lucide="edit-2" class="w-4 h-4"></i>
        </button>
        <button class="delete-btn p-2 hover:bg-red-50 rounded-lg text-red-500" data-id="${genre.id}" data-name="${escapeHtml(genre.name)}" data-count="${genre.bookCount || 0}" title="Delete">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join('');

  // Attach event listeners
  genreList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });

  genreList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id, btn.dataset.name, parseInt(btn.dataset.count)));
  });

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

function openAddModal() {
  editingGenreId = null;
  modalTitle.textContent = 'Add Genre';
  genreNameInput.value = '';
  const availableColors = getAvailableColors(genres);
  selectedColor = availableColors[0] || GENRE_COLORS[0];
  saveGenreBtn.textContent = 'Add';
  renderColorPicker();
  genreModal.classList.remove('hidden');
  genreNameInput.focus();
}

function openEditModal(genreId) {
  const genre = genres.find(g => g.id === genreId);
  if (!genre) return;

  editingGenreId = genreId;
  modalTitle.textContent = 'Edit Genre';
  genreNameInput.value = genre.name;
  selectedColor = genre.color;
  saveGenreBtn.textContent = 'Save';
  renderColorPicker();
  genreModal.classList.remove('hidden');
  genreNameInput.focus();
}

function closeModal() {
  genreModal.classList.add('hidden');
  editingGenreId = null;
}

let deletingGenreId = null;

function openDeleteModal(genreId, name, bookCount) {
  deletingGenreId = genreId;
  deleteMessage.textContent = bookCount > 0
    ? `This will remove "${name}" from ${bookCount} book${bookCount !== 1 ? 's' : ''}.`
    : `Are you sure you want to delete "${name}"?`;
  deleteModal.classList.remove('hidden');
}

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  deletingGenreId = null;
}

// Genre Event Listeners
addGenreBtn.addEventListener('click', openAddModal);
cancelGenreBtn.addEventListener('click', closeModal);
genreModal.addEventListener('click', (e) => {
  if (e.target === genreModal) closeModal();
});
cancelDeleteBtn.addEventListener('click', closeDeleteModal);
deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

genreForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = genreNameInput.value.trim();
  if (!name) {
    showToast('Please enter a genre name', { type: 'error' });
    return;
  }

  saveGenreBtn.disabled = true;
  saveGenreBtn.textContent = 'Saving...';

  try {
    if (editingGenreId) {
      await updateGenre(currentUser.uid, editingGenreId, { name, color: selectedColor });
      showToast('Genre updated!', { type: 'success' });
    } else {
      await createGenre(currentUser.uid, name, selectedColor);
      showToast('Genre created!', { type: 'success' });
    }

    closeModal();
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

confirmDeleteBtn.addEventListener('click', async () => {
  if (!deletingGenreId) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Deleting...';

  try {
    const booksUpdated = await deleteGenre(currentUser.uid, deletingGenreId);

    if (booksUpdated > 0) {
      clearBooksCache(currentUser.uid);
    }

    showToast('Genre deleted', { type: 'success' });
    closeDeleteModal();
    clearGenresCache();
    await loadGenres();
  } catch (error) {
    console.error('Error deleting genre:', error);
    showToast('Error deleting genre', { type: 'error' });
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Delete';
  }
});

// ==================== Export ====================

async function loadAllBooks() {
  if (allBooksLoaded) return;

  // Try cache first
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
    // Ignore cache errors
  }

  // Fetch from Firebase
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

async function exportBooks() {
  exportBtn.disabled = true;
  exportBtn.innerHTML = '<span class="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>Loading...';

  try {
    await loadAllBooks();

    if (books.length === 0) {
      showToast('No books to export', { type: 'error' });
      return;
    }

    const data = books.map(({ id, _normalizedTitle, _normalizedAuthor, ...book }) => book);
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `mybookshelf-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    showToast('Books exported!', { type: 'success' });
  } catch (error) {
    console.error('Error exporting books:', error);
    showToast('Error exporting books', { type: 'error' });
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i><span>Download Backup</span>';
    initIcons();
  }
}

exportBtn.addEventListener('click', exportBooks);
