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
import { GenrePicker } from './genre-picker.js';
import { updateGenreBookCounts, clearGenresCache } from './genres.js';

// Initialize icons once on load
initIcons();

// State
let currentUser = null;
let bookId = null;
let book = null;
let currentRating = 0;
let genrePicker = null;
let originalGenres = [];
let originalValues = {};
let formDirty = false;

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
const bookDetails = document.getElementById('book-details');
const editForm = document.getElementById('edit-form');
const titleInput = document.getElementById('title');
const authorInput = document.getElementById('author');
const coverUrlInput = document.getElementById('cover-url');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const refreshDataBtn = document.getElementById('refresh-data-btn');
const deleteModal = document.getElementById('delete-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete');
const confirmDeleteBtn = document.getElementById('confirm-delete');
const starBtns = document.querySelectorAll('.star-btn');
const genrePickerContainer = document.getElementById('genre-picker-container');

// Auth Check - header.js handles redirect, just load book
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loadBook();
  }
});

// Initialize Genre Picker
async function initGenrePicker() {
  if (genrePicker) return;

  genrePicker = new GenrePicker({
    container: genrePickerContainer,
    userId: currentUser.uid,
    onChange: () => {
      formDirty = true;
    }
  });

  await genrePicker.init();

  // Set the book's existing genres
  if (book && book.genres) {
    originalGenres = [...book.genres];
    genrePicker.setSelected(book.genres);
  }

  // Fetch genre suggestions from API if book has ISBN
  if (book && book.isbn) {
    fetchGenreSuggestions(book.isbn);
  }
}

// Fetch genre suggestions from Google Books API
async function fetchGenreSuggestions(isbn) {
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await response.json();

    if (data.items?.length > 0) {
      const categories = data.items[0].volumeInfo.categories || [];
      if (categories.length > 0 && genrePicker) {
        console.log('API genre suggestions for edit:', categories);
        genrePicker.setSuggestions(categories);
      }
    }
  } catch (e) {
    console.error('Error fetching genre suggestions:', e);
  }
}

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
    datesHtml += `<div>Added ${dateAdded.toLocaleDateString(undefined, dateOptions)}</div>`;
  }
  if (dateModified && dateModified.getTime() !== dateAdded?.getTime()) {
    datesHtml += `<div>Modified ${dateModified.toLocaleDateString(undefined, dateOptions)}</div>`;
  }
  bookDates.innerHTML = datesHtml;

  // Book Details (publisher, published date, physical format)
  let detailsHtml = '';
  if (book.publisher) {
    detailsHtml += `<div><span class="text-gray-400">Publisher:</span> ${book.publisher}</div>`;
  }
  if (book.publishedDate) {
    detailsHtml += `<div><span class="text-gray-400">Published:</span> ${book.publishedDate}</div>`;
  }
  if (book.physicalFormat) {
    detailsHtml += `<div><span class="text-gray-400">Format:</span> ${book.physicalFormat}</div>`;
  }
  bookDetails.innerHTML = detailsHtml;

  // Form
  titleInput.value = book.title || '';
  authorInput.value = book.author || '';
  coverUrlInput.value = book.coverImageUrl || '';
  notesInput.value = book.notes || '';
  currentRating = book.rating || 0;
  updateRatingStars();

  // Store original values for dirty checking
  originalValues = {
    title: book.title || '',
    author: book.author || '',
    coverImageUrl: book.coverImageUrl || '',
    notes: book.notes || '',
    rating: book.rating || 0
  };
  formDirty = false;

  // Show content
  loading.classList.add('hidden');
  content.classList.remove('hidden');
  initIcons();

  // Initialize genre picker after content is shown
  initGenrePicker();
}

// Rating Stars
starBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    currentRating = parseInt(btn.dataset.rating);
    updateRatingStars();
    formDirty = true;
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

  // Get selected genres from picker
  const selectedGenres = genrePicker ? genrePicker.getSelected() : [];

  const updates = {
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    coverImageUrl: coverUrlInput.value.trim(),
    rating: currentRating || null,
    notes: notesInput.value.trim(),
    genres: selectedGenres,
    publisher: book.publisher || '',
    publishedDate: book.publishedDate || '',
    physicalFormat: book.physicalFormat || '',
    updatedAt: serverTimestamp()
  };

  try {
    const bookRef = doc(db, 'users', currentUser.uid, 'books', bookId);
    await updateDoc(bookRef, updates);

    // Update genre book counts for changed genres
    const addedGenres = selectedGenres.filter(g => !originalGenres.includes(g));
    const removedGenres = originalGenres.filter(g => !selectedGenres.includes(g));

    if (addedGenres.length > 0 || removedGenres.length > 0) {
      await updateGenreBookCounts(currentUser.uid, addedGenres, removedGenres);
      originalGenres = [...selectedGenres];
    }

    // Clear caches so changes appear on the list page
    clearBooksCache(currentUser.uid);
    clearGenresCache();

    showToast('Changes saved!', { type: 'success' });

    // Clear dirty state before re-render (renderBook will reset it)
    formDirty = false;

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

    // Decrement genre book counts for this book's genres
    const bookGenres = book.genres || [];
    if (bookGenres.length > 0) {
      await updateGenreBookCounts(currentUser.uid, [], bookGenres);
    }

    // Clear caches so the deleted book disappears from the list
    clearBooksCache(currentUser.uid);
    clearGenresCache();

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

// Track unsaved changes on form inputs
[titleInput, authorInput, coverUrlInput, notesInput].forEach(el => {
  el.addEventListener('input', () => {
    formDirty = true;
  });
});

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (formDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Refresh Data from APIs
async function fetchBookDataFromAPI(isbn, title, author) {
  // Try Google Books API first (by ISBN if available)
  if (isbn) {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      if (data.items?.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        return {
          title: volumeInfo.title || '',
          author: volumeInfo.authors?.join(', ') || '',
          coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
          publisher: volumeInfo.publisher || '',
          publishedDate: volumeInfo.publishedDate || '',
          physicalFormat: ''
        };
      }
    } catch (e) {
      console.error('Google Books API error:', e);
    }
  }

  // Try Google Books by title/author search
  if (title) {
    try {
      const searchQuery = author ? `intitle:${title}+inauthor:${author}` : `intitle:${title}`;
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.items?.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        return {
          title: volumeInfo.title || '',
          author: volumeInfo.authors?.join(', ') || '',
          coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
          publisher: volumeInfo.publisher || '',
          publishedDate: volumeInfo.publishedDate || '',
          physicalFormat: ''
        };
      }
    } catch (e) {
      console.error('Google Books search error:', e);
    }
  }

  // Try Open Library by ISBN
  if (isbn) {
    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const data = await response.json();
      const bookData = data[`ISBN:${isbn}`];
      if (bookData) {
        return {
          title: bookData.title || '',
          author: bookData.authors?.[0]?.name || '',
          coverImageUrl: bookData.cover?.medium || bookData.cover?.small || '',
          publisher: bookData.publishers?.[0]?.name || '',
          publishedDate: bookData.publish_date || '',
          physicalFormat: bookData.physical_format || ''
        };
      }
    } catch (e) {
      console.error('Open Library API error:', e);
    }
  }

  return null;
}

refreshDataBtn.addEventListener('click', async () => {
  refreshDataBtn.disabled = true;
  const originalHtml = refreshDataBtn.innerHTML;
  refreshDataBtn.innerHTML = `
    <div class="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></div>
    <span class="text-sm">Refreshing...</span>
  `;

  try {
    const apiData = await fetchBookDataFromAPI(book.isbn, book.title, book.author);

    if (apiData) {
      // Update form fields with API data
      if (apiData.title) {
        titleInput.value = apiData.title;
      }
      if (apiData.author) {
        authorInput.value = apiData.author;
      }
      if (apiData.coverImageUrl) {
        coverUrlInput.value = apiData.coverImageUrl;
      }

      // Update book object with new metadata for display
      book.publisher = apiData.publisher || book.publisher || '';
      book.publishedDate = apiData.publishedDate || book.publishedDate || '';
      book.physicalFormat = apiData.physicalFormat || book.physicalFormat || '';

      // Re-render book details section
      let detailsHtml = '';
      if (book.publisher) {
        detailsHtml += `<div><span class="text-gray-400">Publisher:</span> ${book.publisher}</div>`;
      }
      if (book.publishedDate) {
        detailsHtml += `<div><span class="text-gray-400">Published:</span> ${book.publishedDate}</div>`;
      }
      if (book.physicalFormat) {
        detailsHtml += `<div><span class="text-gray-400">Format:</span> ${book.physicalFormat}</div>`;
      }
      bookDetails.innerHTML = detailsHtml;

      formDirty = true;
      showToast('Book data refreshed from API', { type: 'success' });
    } else {
      showToast('No data found from APIs', { type: 'info' });
    }
  } catch (error) {
    console.error('Error refreshing book data:', error);
    showToast('Error fetching book data', { type: 'error' });
  } finally {
    refreshDataBtn.disabled = false;
    refreshDataBtn.innerHTML = originalHtml;
    initIcons();
  }
});
