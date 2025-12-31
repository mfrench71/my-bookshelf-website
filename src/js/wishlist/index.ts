// Wishlist Page
import { auth } from '/js/firebase-config.js';
import { onAuthStateChanged, User } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { wishlistRepository, type WishlistItem } from '../repositories/wishlist-repository.js';
import { clearBooksCache } from '../utils/cache.js';
import { showToast, initIcons, escapeHtml, isValidImageUrl } from '../utils.js';
import { BottomSheet } from '../components/modal.js';
import { validateForm, showFormErrors, clearFormErrors } from '../utils/validation.js';
import { z } from '/js/vendor/zod.js';

// Simple schema for edit form (priority + notes only)
const WishlistEditSchema = z.object({
  priority: z.enum(['high', 'medium', 'low', '']).transform((s: string) => s || null),
  notes: z
    .string()
    .max(2000, 'Notes must be 2000 characters or less')
    .transform((s: string) => s?.trim() || null),
});

/** Priority color mapping */
type Priority = 'high' | 'medium' | 'low';

/** Original edit form values for change tracking */
interface OriginalEditValues {
  priority: string;
  notes: string;
}

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const wishlistItemsContainer = document.getElementById('wishlist-items');
const itemCount = document.getElementById('item-count');
const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;

// Edit modal elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form') as HTMLFormElement | null;
const editPrioritySelect = document.getElementById('edit-priority') as HTMLSelectElement | null;
const editNotesTextarea = document.getElementById('edit-notes') as HTMLTextAreaElement | null;
const cancelEditBtn = document.getElementById('cancel-edit') as HTMLButtonElement | null;
const saveEditBtn = document.getElementById('save-edit') as HTMLButtonElement | null;

// Move modal elements
const moveModal = document.getElementById('move-modal');
const moveText = document.getElementById('move-text');
const cancelMoveBtn = document.getElementById('cancel-move') as HTMLButtonElement | null;
const confirmMoveBtn = document.getElementById('confirm-move') as HTMLButtonElement | null;

// Delete modal elements
const deleteModal = document.getElementById('delete-modal');
const deleteText = document.getElementById('delete-text');
const cancelDeleteBtn = document.getElementById('cancel-delete') as HTMLButtonElement | null;
const confirmDeleteBtn = document.getElementById('confirm-delete') as HTMLButtonElement | null;

// State
let currentUser: User | null = null;
let wishlistItems: WishlistItem[] = [];
let selectedItem: WishlistItem | null = null;
let currentSort = 'createdAt-desc';
let hasTriggeredInitialFade = false;

// Original values for change tracking
let originalEditValues: OriginalEditValues = { priority: '', notes: '' };

// Bottom sheets
let editSheet: BottomSheet | null = null;
let moveSheet: BottomSheet | null = null;
let deleteSheet: BottomSheet | null = null;

// Priority colours
const PRIORITY_COLORS: Record<Priority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/**
 * Render a wishlist item card
 * @param item - Wishlist item to render
 * @returns HTML string for the card
 */
function renderWishlistCard(item: WishlistItem): string {
  const cover =
    item.coverImageUrl && isValidImageUrl(item.coverImageUrl)
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
 * @param author - Author name
 * @returns Lowercase surname
 */
function getAuthorSurname(author: string | undefined): string {
  if (!author) return '';
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Sort wishlist items
 * @param items - Items to sort
 * @param sortKey - Sort key
 * @returns Sorted items
 */
function sortItems(items: WishlistItem[], sortKey: string): WishlistItem[] {
  const sorted = [...items];

  switch (sortKey) {
    case 'createdAt-desc':
      sorted.sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
      });
      break;
    case 'createdAt-asc':
      sorted.sort((a, b) => {
        const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
        return aTime - bTime;
      });
      break;
    case 'priority-high': {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, null: 3 };
      sorted.sort((a, b) => {
        const aOrder = priorityOrder[a.priority || 'null'] ?? 3;
        const bOrder = priorityOrder[b.priority || 'null'] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
        // Secondary sort by date
        const aTime = (a.createdAt as { seconds?: number })?.seconds || 0;
        const bTime = (b.createdAt as { seconds?: number })?.seconds || 0;
        return bTime - aTime;
      });
      break;
    }
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
function renderWishlistItems(): void {
  if (!loadingState || !emptyState || !wishlistItemsContainer || !itemCount) return;

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

  // Trigger fade-in animation on first content render
  if (!hasTriggeredInitialFade) {
    wishlistItemsContainer.classList.add('content-fade-in');
    hasTriggeredInitialFade = true;
  }

  initIcons();

  // Attach event listeners using event delegation
  wishlistItemsContainer.querySelectorAll('[data-action="move"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = (btn as HTMLButtonElement).dataset.itemId;
      selectedItem = wishlistItems.find(i => i.id === itemId) || null;
      if (selectedItem && moveText) {
        moveText.textContent = `"${selectedItem.title}" will be added to your library.`;
        moveSheet?.open();
      }
    });
  });

  wishlistItemsContainer.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = (btn as HTMLButtonElement).dataset.itemId;
      selectedItem = wishlistItems.find(i => i.id === itemId) || null;
      if (selectedItem && editForm && editPrioritySelect && editNotesTextarea) {
        clearFormErrors(editForm);
        editPrioritySelect.value = selectedItem.priority || '';
        editNotesTextarea.value = selectedItem.notes || '';
        // Store original values for change tracking
        originalEditValues = {
          priority: selectedItem.priority || '',
          notes: selectedItem.notes || '',
        };
        // Initialize button state (disabled until changes made)
        updateEditSaveButtonState();
        editSheet?.open();
      }
    });
  });

  wishlistItemsContainer.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = (btn as HTMLButtonElement).dataset.itemId;
      selectedItem = wishlistItems.find(i => i.id === itemId) || null;
      if (selectedItem && deleteText) {
        deleteText.textContent = `"${selectedItem.title}" will be removed from your wishlist.`;
        deleteSheet?.open();
      }
    });
  });
}

/**
 * Check if wishlist edit form has unsaved changes
 * @returns True if form has changes
 */
function isEditFormDirty(): boolean {
  if (!editPrioritySelect || !editNotesTextarea) return false;

  if ((editPrioritySelect.value || '') !== originalEditValues.priority) return true;
  if ((editNotesTextarea.value || '') !== originalEditValues.notes) return true;
  return false;
}

/**
 * Update wishlist edit save button state based on form changes
 */
function updateEditSaveButtonState(): void {
  if (!saveEditBtn) return;

  const isDirty = isEditFormDirty();
  saveEditBtn.disabled = !isDirty;
  saveEditBtn.classList.toggle('opacity-50', !isDirty);
  saveEditBtn.classList.toggle('cursor-not-allowed', !isDirty);
}

/**
 * Load wishlist data
 */
async function loadWishlist(): Promise<void> {
  if (!currentUser) return;

  try {
    wishlistItems = await wishlistRepository.getAll(currentUser.uid);
    renderWishlistItems();
  } catch (error) {
    console.error('Error loading wishlist:', error);
    loadingState?.classList.add('hidden');
    showToast('Failed to load wishlist. Please try again.', { type: 'error' });
  }
}

/**
 * Handle move to library
 */
async function handleMoveToLibrary(): Promise<void> {
  if (!selectedItem || !currentUser || !confirmMoveBtn) return;

  confirmMoveBtn.disabled = true;
  confirmMoveBtn.textContent = 'Adding...';

  try {
    await wishlistRepository.moveToLibrary(currentUser.uid, selectedItem.id);
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
 * @param e - Form submit event
 */
async function handleEditSave(e: Event): Promise<void> {
  e.preventDefault();
  if (!selectedItem || !currentUser || !editForm || !editPrioritySelect || !editNotesTextarea || !saveEditBtn) return;

  clearFormErrors(editForm);

  const formData = {
    priority: editPrioritySelect.value,
    notes: editNotesTextarea.value,
  };

  const validation = validateForm(WishlistEditSchema, formData);
  if (!validation.success) {
    showFormErrors(editForm, validation.errors);
    return;
  }

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = 'Saving...';

  try {
    await wishlistRepository.updateItem(currentUser.uid, selectedItem.id, {
      priority: validation.data.priority as 'high' | 'medium' | 'low' | null,
      notes: validation.data.notes,
    });
    editSheet?.close();
    showToast('Wishlist item updated', { type: 'success' });
    await loadWishlist();
  } catch (error) {
    console.error('Error updating item:', error);
    showToast('Failed to update item. Please try again.', { type: 'error' });
  } finally {
    saveEditBtn.disabled = false;
    saveEditBtn.textContent = 'Save';
    selectedItem = null;
  }
}

/**
 * Handle delete
 */
async function handleDelete(): Promise<void> {
  if (!selectedItem || !currentUser || !confirmDeleteBtn) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Removing...';

  try {
    await wishlistRepository.remove(currentUser.uid, selectedItem.id);
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

// Update save button state when edit form fields change
editPrioritySelect?.addEventListener('change', updateEditSaveButtonState);
editNotesTextarea?.addEventListener('input', updateEditSaveButtonState);

cancelMoveBtn?.addEventListener('click', () => moveSheet?.close());
confirmMoveBtn?.addEventListener('click', handleMoveToLibrary);
cancelDeleteBtn?.addEventListener('click', () => deleteSheet?.close());
confirmDeleteBtn?.addEventListener('click', handleDelete);

// Auth state listener
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    currentUser = user;
    await loadWishlist();
  } else {
    window.location.href = '/login/';
  }
});
