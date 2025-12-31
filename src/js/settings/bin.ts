// Settings Bin Page - Manage deleted books
import { auth, db } from '/js/firebase-config.js';
import { onAuthStateChanged, User } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { showToast, initIcons, escapeHtml, isValidImageUrl, serializeTimestamp } from '../utils.js';
import { BottomSheet } from '../components/modal.js';
import {
  filterBinnedBooks,
  getDaysRemaining,
  restoreBook,
  permanentlyDeleteBook,
  emptyBin,
  purgeExpiredBooks,
} from '../bin.js';
import { updateSettingsIndicators, clearIndicatorsCache } from '../utils/settings-indicators.js';

/** Book data with bin fields */
interface BinnedBookData {
  id: string;
  title: string;
  author?: string;
  coverImageUrl?: string;
  deletedAt?: number | null;
  genres?: string[];
  seriesId?: string | null;
  images?: Array<{ storagePath: string }>;
  createdAt?: unknown;
  updatedAt?: unknown;
}

// Initialize icons
initIcons();

// State
let currentUser: User | null = null;
let binnedBooks: BinnedBookData[] = [];
let selectedBook: BinnedBookData | null = null;
let hasTriggeredInitialFade = false;

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const bookList = document.getElementById('book-list');
const binCount = document.getElementById('bin-count');
const emptyBinBtn = document.getElementById('empty-bin-btn');

// Modals
const restoreModal = document.getElementById('restore-modal');
const deleteModal = document.getElementById('delete-modal');
const emptyBinModal = document.getElementById('empty-bin-modal');

// Bottom Sheet Instances
const restoreSheet = restoreModal ? new BottomSheet({ container: restoreModal }) : null;
const deleteSheet = deleteModal ? new BottomSheet({ container: deleteModal }) : null;
const emptyBinSheet = emptyBinModal ? new BottomSheet({ container: emptyBinModal }) : null;

// Auth Check
onAuthStateChanged(auth, async (user: User | null) => {
  if (user) {
    currentUser = user;
    await loadBinnedBooks();
    updateSettingsIndicators(user.uid);
  }
});

// Load binned books
async function loadBinnedBooks(): Promise<void> {
  if (!currentUser) return;

  try {
    // Fetch all books
    const booksRef = collection(db, 'users', currentUser.uid, 'books');
    const snapshot = await getDocs(booksRef);
    const allBooks: BinnedBookData[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: serializeTimestamp(doc.data().createdAt),
      updatedAt: serializeTimestamp(doc.data().updatedAt),
    })) as BinnedBookData[];

    // Filter to binned books only
    binnedBooks = filterBinnedBooks(allBooks);

    // Auto-purge expired books
    const purgedCount = await purgeExpiredBooks(currentUser.uid, binnedBooks);
    if (purgedCount > 0) {
      showToast(`${purgedCount} expired book${purgedCount > 1 ? 's' : ''} permanently deleted`, { type: 'info' });
      // Re-filter after purge
      binnedBooks = binnedBooks.filter(b => getDaysRemaining(b.deletedAt) > 0);
    }

    // Sort by deletedAt (most recent first)
    binnedBooks.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

    renderBinnedBooks();
  } catch (error) {
    console.error('Error loading binned books:', error);
    showToast('Error loading bin', { type: 'error' });
    loadingState?.classList.add('hidden');
  }
}

// Render binned books
function renderBinnedBooks(): void {
  loadingState?.classList.add('hidden');

  if (binnedBooks.length === 0) {
    emptyState?.classList.remove('hidden');
    bookList?.classList.add('hidden');
    emptyBinBtn?.classList.add('hidden');
    binCount?.classList.add('hidden');
    initIcons();
    return;
  }

  emptyState?.classList.add('hidden');
  bookList?.classList.remove('hidden');
  emptyBinBtn?.classList.remove('hidden');

  // Update count
  if (binCount) {
    binCount.textContent = `${binnedBooks.length} book${binnedBooks.length > 1 ? 's' : ''}`;
    binCount.classList.remove('hidden');
  }

  // Render book cards
  if (bookList) {
    bookList.innerHTML = binnedBooks.map(book => renderBinBookCard(book)).join('');

    // Trigger fade-in animation on first content render
    if (!hasTriggeredInitialFade) {
      bookList.classList.add('content-fade-in');
      hasTriggeredInitialFade = true;
    }

    initIcons();

    // Attach event listeners to buttons
    bookList.querySelectorAll<HTMLButtonElement>('[data-action="restore"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        selectedBook = binnedBooks.find(b => b.id === btn.dataset.bookId) || null;
        restoreSheet?.open();
      });
    });

    bookList.querySelectorAll<HTMLButtonElement>('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        selectedBook = binnedBooks.find(b => b.id === btn.dataset.bookId) || null;
        deleteSheet?.open();
      });
    });
  }
}

// Render a single binned book card
function renderBinBookCard(book: BinnedBookData): string {
  const daysRemaining = getDaysRemaining(book.deletedAt);
  const isUrgent = daysRemaining <= 7;

  const cover =
    book.coverImageUrl && isValidImageUrl(book.coverImageUrl)
      ? `<div class="w-16 h-24 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
        <img src="${escapeHtml(book.coverImageUrl)}" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-300\\'><i data-lucide=\\'book\\' class=\\'w-6 h-6\\'></i></div>'">
      </div>`
      : `<div class="w-16 h-24 flex-shrink-0 bg-gray-100 rounded flex items-center justify-center text-gray-300">
        <i data-lucide="book" class="w-6 h-6" aria-hidden="true"></i>
      </div>`;

  const badgeColor = isUrgent ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600';

  return `
    <div class="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
      ${cover}
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate">${escapeHtml(book.title)}</h3>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(book.author || 'Unknown author')}</p>
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${badgeColor} mt-2">
          <i data-lucide="clock" class="w-3 h-3" aria-hidden="true"></i>
          <span>${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left</span>
        </span>
      </div>
      <div class="flex gap-1 items-center">
        <button data-action="restore" data-book-id="${book.id}"
                class="p-2 hover:bg-green-50 rounded text-gray-400 hover:text-green-600 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                aria-label="Restore ${escapeHtml(book.title)}">
          <i data-lucide="rotate-ccw" class="w-4 h-4" aria-hidden="true"></i>
        </button>
        <button data-action="delete" data-book-id="${book.id}"
                class="p-2 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
                aria-label="Permanently delete ${escapeHtml(book.title)}">
          <i data-lucide="trash-2" class="w-4 h-4" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `;
}

// Restore modal handlers
document.getElementById('cancel-restore')?.addEventListener('click', () => {
  restoreSheet?.close();
  selectedBook = null;
});

document.getElementById('confirm-restore')?.addEventListener('click', async () => {
  if (!selectedBook || !currentUser) return;

  const confirmBtn = document.getElementById('confirm-restore') as HTMLButtonElement | null;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Restoring...';
  }

  try {
    const result = await restoreBook(currentUser.uid, selectedBook.id, selectedBook);

    // Remove from local list
    binnedBooks = binnedBooks.filter(b => b.id !== selectedBook?.id);

    restoreSheet?.close();

    // Show appropriate message
    if (result.warnings && result.warnings.length > 0) {
      showToast(`Book restored. ${result.warnings.join('. ')}`, { type: 'info' });
    } else if (result.seriesRestored) {
      showToast('Book and series restored to library', { type: 'success' });
    } else {
      showToast('Book restored to library', { type: 'success' });
    }

    selectedBook = null;
    clearIndicatorsCache();
    updateSettingsIndicators(currentUser.uid);
    renderBinnedBooks();
  } catch (error) {
    console.error('Error restoring book:', error);
    showToast('Error restoring book', { type: 'error' });
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Restore';
    }
  }
});

// Delete modal handlers
document.getElementById('cancel-delete')?.addEventListener('click', () => {
  deleteSheet?.close();
  selectedBook = null;
});

document.getElementById('confirm-delete')?.addEventListener('click', async () => {
  if (!selectedBook || !currentUser) return;

  const confirmBtn = document.getElementById('confirm-delete') as HTMLButtonElement | null;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Deleting...';
  }

  try {
    await permanentlyDeleteBook(currentUser.uid, selectedBook.id, selectedBook);

    // Remove from local list
    binnedBooks = binnedBooks.filter(b => b.id !== selectedBook?.id);

    deleteSheet?.close();
    showToast('Book permanently deleted', { type: 'success' });

    selectedBook = null;
    clearIndicatorsCache();
    updateSettingsIndicators(currentUser.uid);
    renderBinnedBooks();
  } catch (error) {
    console.error('Error deleting book:', error);
    showToast('Error deleting book', { type: 'error' });
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Delete Forever';
    }
  }
});

// Empty bin handlers
emptyBinBtn?.addEventListener('click', () => {
  const text = document.getElementById('empty-bin-text');
  if (text) {
    text.textContent = `All ${binnedBooks.length} book${binnedBooks.length > 1 ? 's' : ''} will be permanently deleted. This cannot be undone.`;
  }
  emptyBinSheet?.open();
});

document.getElementById('cancel-empty-bin')?.addEventListener('click', () => {
  emptyBinSheet?.close();
});

document.getElementById('confirm-empty-bin')?.addEventListener('click', async () => {
  if (!currentUser) return;

  const confirmBtn = document.getElementById('confirm-empty-bin') as HTMLButtonElement | null;
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Emptying...';
  }

  try {
    const count = await emptyBin(currentUser.uid, binnedBooks);

    binnedBooks = [];
    emptyBinSheet?.close();
    showToast(`${count} book${count > 1 ? 's' : ''} permanently deleted`, { type: 'success' });

    clearIndicatorsCache();
    updateSettingsIndicators(currentUser.uid);
    renderBinnedBooks();
  } catch (error) {
    console.error('Error emptying bin:', error);
    showToast('Error emptying bin', { type: 'error' });
  } finally {
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Empty Bin';
    }
  }
});
