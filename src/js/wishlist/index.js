// Wishlist Page
import { auth } from '/js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  loadWishlistItems,
  updateWishlistItem,
  deleteWishlistItem,
  moveToLibrary,
  clearWishlistCache
} from '../wishlist.js';
import { clearBooksCache } from '../utils/cache.js';
import { showToast, initIcons, escapeHtml, isValidImageUrl } from '../utils.js';
import { BottomSheet } from '../components/modal.js';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const wishlistItemsContainer = document.getElementById('wishlist-items');
const itemCount = document.getElementById('item-count');
const sortSelect = document.getElementById('sort-select');

// Edit modal elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const editPrioritySelect = document.getElementById('edit-priority');
const editNotesTextarea = document.getElementById('edit-notes');
const cancelEditBtn = document.getElementById('cancel-edit');

// Move modal elements
const moveModal = document.getElementById('move-modal');
const moveText = document.getElementById('move-text');
const cancelMoveBtn = document.getElementById('cancel-move');
const confirmMoveBtn = document.getElementById('confirm-move');

// Delete modal elements
const deleteModal = document.getElementById('delete-modal');
const deleteText = document.getElementById('delete-text');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');

// State
let currentUser = null;
let wishlistItems = [];
let selectedItem = null;
let currentSort = 'createdAt-desc';

// Bottom sheets
let editSheet = null;
let moveSheet = null;
let deleteSheet = null;

// Priority colours
const PRIORITY_COLORS = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700'
};

const PRIORITY_LABELS = {
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

/**
 * Render a wishlist item card
 */
function renderWishlistCard(item) {
  const cover = item.coverImageUrl && isValidImageUrl(item.coverImageUrl)
    ? `<div class="w-[48px] h-[72px] flex-shrink-0 bg-gray-100 rounded overflow-hidden">
        <img src="${escapeHtml(item.coverImageUrl)}" alt=""
          class="w-full h-full object-cover" loading="lazy"
          onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-300\\'><i data-lucide=\\'book\\' class=\\'w-5 h-5\\'></i></div>'">
      </div>`
    : `<div class="w-[48px] h-[72px] flex-shrink-0 bg-gray-100 rounded flex items-center justify-center text-gray-300">
        <i data-lucide="book" class="w-5 h-5"></i>
      </div>`;

  const priorityBadge = item.priority
    ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[item.priority]}">${PRIORITY_LABELS[item.priority]}</span>`
    : '';

  return `
    <div class="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3" data-item-id="${item.id}">
      ${cover}
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate text-sm">${escapeHtml(item.title)}</h3>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(item.author || 'Unknown')}</p>
        <div class="flex items-center gap-1.5 mt-1">
          ${priorityBadge}
          ${item.notes ? '<i data-lucide="message-square" class="w-3 h-3 text-gray-400" title="Has notes"></i>' : ''}
        </div>
      </div>
      <div class="flex gap-1 flex-shrink-0">
        <button data-action="move" data-item-id="${item.id}"
          class="p-2 hover:bg-green-50 rounded text-gray-400 hover:text-green-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
          title="I bought this" aria-label="Add to library">
          <i data-lucide="shopping-bag" class="w-4 h-4"></i>
        </button>
        <button data-action="edit" data-item-id="${item.id}"
          class="p-2 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
          title="Edit" aria-label="Edit item">
          <i data-lucide="edit-2" class="w-4 h-4"></i>
        </button>
        <button data-action="delete" data-item-id="${item.id}"
          class="p-2 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
          title="Remove" aria-label="Remove from wishlist">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  `;
}

/**
 * Get author surname for sorting (last word of author name)
 */
function getAuthorSurname(author) {
  if (!author) return '';
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Sort wishlist items
 */
function sortItems(items, sortKey) {
  const sorted = [...items];

  switch (sortKey) {
    case 'createdAt-desc':
      sorted.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      break;
    case 'createdAt-asc':
      sorted.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return aTime - bTime;
      });
      break;
    case 'priority-high':
      const priorityOrder = { high: 0, medium: 1, low: 2, null: 3 };
      sorted.sort((a, b) => {
        const aOrder = priorityOrder[a.priority] ?? 3;
        const bOrder = priorityOrder[b.priority] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Secondary sort by date
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return bTime - aTime;
      });
      break;
    case 'title-asc':
      sorted.sort((a, b) => (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase()));
      break;
    case 'author-asc':
      sorted.sort((a, b) => getAuthorSurname(a.author).localeCompare(getAuthorSurname(b.author)));
      break;
  }

  return sorted;
}

/**
 * Render all wishlist items
 */
function renderWishlistItems() {
  loadingState.classList.add('hidden');

  if (wishlistItems.length === 0) {
    emptyState.classList.remove('hidden');
    wishlistItemsContainer.classList.add('hidden');
    itemCount.classList.add('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  wishlistItemsContainer.classList.remove('hidden');
  itemCount.classList.remove('hidden');
  itemCount.textContent = `${wishlistItems.length} book${wishlistItems.length !== 1 ? 's' : ''}`;

  const sortedItems = sortItems(wishlistItems, currentSort);
  wishlistItemsContainer.innerHTML = sortedItems.map(item => renderWishlistCard(item)).join('');
  initIcons();

  // Attach event listeners using event delegation
  wishlistItemsContainer.querySelectorAll('[data-action="move"]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedItem = wishlistItems.find(i => i.id === btn.dataset.itemId);
      if (selectedItem) {
        moveText.textContent = `"${selectedItem.title}" will be added to your library.`;
        moveSheet?.open();
      }
    });
  });

  wishlistItemsContainer.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedItem = wishlistItems.find(i => i.id === btn.dataset.itemId);
      if (selectedItem) {
        editPrioritySelect.value = selectedItem.priority || '';
        editNotesTextarea.value = selectedItem.notes || '';
        editSheet?.open();
      }
    });
  });

  wishlistItemsContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedItem = wishlistItems.find(i => i.id === btn.dataset.itemId);
      if (selectedItem) {
        deleteText.textContent = `"${selectedItem.title}" will be removed from your wishlist.`;
        deleteSheet?.open();
      }
    });
  });
}

/**
 * Load wishlist data
 */
async function loadWishlist() {
  try {
    wishlistItems = await loadWishlistItems(currentUser.uid);
    renderWishlistItems();
  } catch (error) {
    console.error('Error loading wishlist:', error);
    loadingState.classList.add('hidden');
    showToast('Failed to load wishlist. Please try again.', { type: 'error' });
  }
}

/**
 * Handle move to library
 */
async function handleMoveToLibrary() {
  if (!selectedItem) return;

  confirmMoveBtn.disabled = true;
  confirmMoveBtn.textContent = 'Adding...';

  try {
    await moveToLibrary(currentUser.uid, selectedItem.id);
    clearBooksCache(currentUser.uid);
    moveSheet?.close();
    showToast(`"${selectedItem.title}" added to your library!`, { type: 'success' });
    await loadWishlist();
  } catch (error) {
    console.error('Error moving to library:', error);
    showToast('Failed to add to library. Please try again.', { type: 'error' });
  } finally {
    confirmMoveBtn.disabled = false;
    confirmMoveBtn.textContent = 'Add to Library';
    selectedItem = null;
  }
}

/**
 * Handle edit save
 */
async function handleEditSave(e) {
  e.preventDefault();
  if (!selectedItem) return;

  const saveBtn = document.getElementById('save-edit');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await updateWishlistItem(currentUser.uid, selectedItem.id, {
      priority: editPrioritySelect.value || null,
      notes: editNotesTextarea.value.trim() || null
    });
    editSheet?.close();
    showToast('Wishlist item updated', { type: 'success' });
    await loadWishlist();
  } catch (error) {
    console.error('Error updating item:', error);
    showToast('Failed to update item. Please try again.', { type: 'error' });
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    selectedItem = null;
  }
}

/**
 * Handle delete
 */
async function handleDelete() {
  if (!selectedItem) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Removing...';

  try {
    await deleteWishlistItem(currentUser.uid, selectedItem.id);
    deleteSheet?.close();
    showToast('Removed from wishlist', { type: 'success' });
    await loadWishlist();
  } catch (error) {
    console.error('Error deleting item:', error);
    showToast('Failed to remove item. Please try again.', { type: 'error' });
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Remove';
    selectedItem = null;
  }
}

// Initialise bottom sheets
if (editModal) {
  editSheet = new BottomSheet({ container: editModal });
}
if (moveModal) {
  moveSheet = new BottomSheet({ container: moveModal });
}
if (deleteModal) {
  deleteSheet = new BottomSheet({ container: deleteModal });
}

// Event listeners
sortSelect?.addEventListener('change', () => {
  currentSort = sortSelect.value;
  renderWishlistItems();
});

editForm?.addEventListener('submit', handleEditSave);
cancelEditBtn?.addEventListener('click', () => editSheet?.close());
cancelMoveBtn?.addEventListener('click', () => moveSheet?.close());
confirmMoveBtn?.addEventListener('click', handleMoveToLibrary);
cancelDeleteBtn?.addEventListener('click', () => deleteSheet?.close());
confirmDeleteBtn?.addEventListener('click', handleDelete);

// Auth state listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    await loadWishlist();
  } else {
    window.location.href = '/login/';
  }
});
