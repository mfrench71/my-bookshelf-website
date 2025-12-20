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
import { renderStars, parseTimestamp, showToast, initIcons, clearBooksCache, updateRatingStars as updateStars } from './utils.js';

// Initialize icons once on load
initIcons();

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
const bookRating = document.getElementById('book-rating');
const bookDates = document.getElementById('book-dates');
const editForm = document.getElementById('edit-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const starBtns = document.querySelectorAll('.star-btn');

// Auth Check - header.js handles redirect, just load book
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadBook();
  }
});

// Load Book
async function loadBook() {
  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    const bookSnap = await getDoc(bookRef);

    if (!bookSnap.exists()) {
      showToast('Book not found', { type: 'error' });
      setTimeout(() => window.location.href = '/books/', 1500);
      return;
    }

    book = { id: bookSnap.id, ...bookSnap.data() };
    renderBook();
  } catch (error) {
    console.error('Error loading book:', error);
    showToast('Error loading book', { type: 'error' });
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

  // Rating
  bookRating.innerHTML = book.rating ? renderStars(book.rating) : '';

  // Dates
  const dateAdded = parseTimestamp(book.createdAt);
  const dateModified = parseTimestamp(book.updatedAt);
  const dateOptions = { year: 'numeric', month: 'short', day: 'numeric' };

  let datesHtml = '';
  if (dateAdded) {
    datesHtml += `Added ${dateAdded.toLocaleDateString(undefined, dateOptions)}`;
  }
  if (dateModified && dateModified.getTime() !== dateAdded?.getTime()) {
    datesHtml += ` · Modified ${dateModified.toLocaleDateString(undefined, dateOptions)}`;
  }
  bookDates.innerHTML = datesHtml;

  // Form
  titleInput.value = book.title || '';
  authorInput.value = book.author || '';
  coverUrlInput.value = book.coverImageUrl || '';
  notesInput.value = book.notes || '';
  currentRating = book.rating || 0;
  updateRatingStars();

  // Show content
  loading.classList.add('hidden');
  content.classList.remove('hidden');
  initIcons();
}

// Rating Stars
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentRating = parseInt(btn.dataset.rating);
    updateRatingStars();
  });
});

function updateRatingStars() {
  updateStars(starBtns, currentRating);
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
    rating: currentRating || null,
    notes: notesInput.value.trim(),
    updatedAt: serverTimestamp()
  };

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await updateDoc(bookRef, updates);

    // Clear cache so changes appear on the list page
    clearBooksCache(currentUser.uid);

    showToast('Changes saved!', { type: 'success' });

    // Update local data and re-render
    book = { ...book, ...updates };
    renderBook();
  } catch (error) {
    console.error('Error saving:', error);
    showToast('Error saving changes', { type: 'error' });
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

    // Clear cache so the deleted book disappears from the list
    clearBooksCache(currentUser.uid);

    showToast('Book deleted', { type: 'success' });
    setTimeout(() => window.location.href = '/books/', 1000);
  } catch (error) {
    console.error('Error deleting:', error);
    showToast('Error deleting book', { type: 'error' });
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Delete';
    deleteModal.classList.add('hidden');
  }
});
