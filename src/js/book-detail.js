// Book Detail Page Logic
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Initialize icons
lucide.createIcons();

// State
let currentUser = null;
let bookId = null;
let book = null;
let currentRating = 0;

// Get book ID from URL
const urlParams = new URLSearchParams(window.location.search);
bookId = urlParams.get('id');

if (!bookId) {
  window.location.href = '/books/';
}

// DOM Elements
const loading = document.getElementById('loading');
const content = document.getElementById('content');
const coverContainer = document.getElementById('cover-container');
const bookTitle = document.getElementById('book-title');
const bookAuthor = document.getElementById('book-author');
const bookStatus = document.getElementById('book-status');
const bookRating = document.getElementById('book-rating');
const editForm = document.getElementById('edit-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const statusSelect = document.getElementById('status');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const starBtns = document.querySelectorAll('.star-btn');
const toast = document.getElementById('toast');

// Auth Check
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadBook();
  } else {
    window.location.href = '/';
  }
});

// Load Book
async function loadBook() {
  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    const bookSnap = await getDoc(bookRef);

    if (!bookSnap.exists()) {
      showToast('Book not found');
      setTimeout(() => window.location.href = '/books.html', 1500);
      return;
    }

    book = { id: bookSnap.id, ...bookSnap.data() };
    renderBook();
  } catch (error) {
    console.error('Error loading book:', error);
    showToast('Error loading book');
  }
}

function renderBook() {
  // Cover
  if (book.coverImageUrl) {
    coverContainer.innerHTML = `<img src="${book.coverImageUrl}" alt="" class="w-40 h-60 object-cover rounded-xl shadow-lg mx-auto">`;
  } else {
    coverContainer.innerHTML = `
      <div class="w-40 h-60 bg-primary rounded-xl shadow-lg mx-auto flex items-center justify-center">
        <i data-lucide="book" class="w-16 h-16 text-white"></i>
      </div>
    `;
  }

  // Info
  bookTitle.textContent = book.title;
  bookAuthor.textContent = book.author || 'Unknown author';

  // Status
  const statusLabels = {
    wantToRead: 'Want to Read',
    reading: 'Reading',
    finished: 'Finished'
  };
  bookStatus.textContent = statusLabels[book.status] || 'Unknown';
  bookStatus.className = `status-badge ${book.status}`;

  // Rating
  if (book.rating) {
    bookRating.innerHTML = renderStars(book.rating);
  } else {
    bookRating.innerHTML = '';
  }

  // Form
  titleInput.value = book.title || '';
  authorInput.value = book.author || '';
  coverUrlInput.value = book.coverImageUrl || '';
  statusSelect.value = book.status || 'wantToRead';
  notesInput.value = book.notes || '';
  currentRating = book.rating || 0;
  updateRatingStars();

  // Show content
  loading.classList.add('hidden');
  content.classList.remove('hidden');
  lucide.createIcons();
}

function renderStars(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    i < rating
      ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
      : '<svg class="empty" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
  ).join('');
}

// Rating Stars
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentRating = parseInt(btn.dataset.rating);
    updateRatingStars();
  });
});

function updateRatingStars() {
  starBtns.forEach(btn => {
    const rating = parseInt(btn.dataset.rating);
    if (rating <= currentRating) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  lucide.createIcons();
}

// Save Changes
editForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  const updates = {
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    coverImageUrl: coverUrlInput.value.trim(),
    status: statusSelect.value,
    rating: currentRating || null,
    notes: notesInput.value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await updateDoc(bookRef, updates);
    showToast('Changes saved!');

    // Update local data and re-render
    book = { ...book, ...updates };
    renderBook();
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error saving changes');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Changes';
  }
});

// Delete
deleteBtn.addEventListener('click', () => {
  deleteModal.classList.remove('hidden');
});

cancelDeleteBtn.addEventListener('click', () => {
  deleteModal.classList.add('hidden');
});

deleteModal.addEventListener('click', (e) => {
  if (e.target === deleteModal) {
    deleteModal.classList.add('hidden');
  }
});

confirmDeleteBtn.addEventListener('click', async () => {
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Deleting...';

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await deleteDoc(bookRef);
    showToast('Book deleted');
    setTimeout(() => window.location.href = '/books.html', 1000);
  } catch (error) {
    console.error('Error deleting:', error);
    showToast('Error deleting book');
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Delete';
    deleteModal.classList.add('hidden');
  }
});

// Toast
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), duration);
}
