/**
 * Test Setup File
 * Provides mocks for browser APIs and Firebase
 */

import { vi } from 'vitest';

// Mock lucide icons
global.lucide = {
  createIcons: vi.fn()
};

// Mock navigator.vibrate
global.navigator.vibrate = vi.fn();

// Mock fetch for API tests
global.fetch = vi.fn();

// Mock Firebase modules
vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js', () => ({
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Simulate logged-in user by default
    callback({ uid: 'test-user-123', email: 'test@example.com' });
    return vi.fn(); // unsubscribe function
  }),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn()
}));

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((query, callback) => {
    callback({ docs: [] });
    return vi.fn(); // unsubscribe function
  }),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-book-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ exists: () => true, data: () => ({}) })),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 }))
}));

vi.mock('./firebase-config.js', () => ({
  auth: {},
  db: {}
}));

// Helper to reset all mocks between tests
export function resetMocks() {
  vi.clearAllMocks();
  global.fetch.mockReset();
}

// Helper to create mock book data
export function createMockBook(overrides = {}) {
  return {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    coverImageUrl: 'https://example.com/cover.jpg',
    rating: 4,
    notes: 'Great book!',
    isbn: '1234567890',
    createdAt: { seconds: Date.now() / 1000 },
    updatedAt: { seconds: Date.now() / 1000 },
    ...overrides
  };
}

// Helper to create multiple mock books
export function createMockBooks(count = 5) {
  return Array.from({ length: count }, (_, i) => createMockBook({
    id: `book-${i + 1}`,
    title: `Book ${i + 1}`,
    author: `Author ${i + 1}`,
    rating: (i % 5) + 1,
    createdAt: { seconds: (Date.now() / 1000) - (i * 86400) } // Each book 1 day older
  }));
}

// Helper to mock Google Books API response
export function mockGoogleBooksResponse(books = []) {
  const items = books.map(book => ({
    volumeInfo: {
      title: book.title,
      authors: [book.author],
      imageLinks: { thumbnail: book.coverImageUrl },
      publisher: book.publisher || 'Test Publisher',
      publishedDate: book.publishedDate || '2023',
      industryIdentifiers: [{ identifier: book.isbn || '1234567890' }]
    }
  }));

  return {
    items: items.length > 0 ? items : undefined,
    totalItems: items.length
  };
}

// Helper to mock Open Library API response
export function mockOpenLibraryResponse(isbn, book = null) {
  if (!book) return {};

  return {
    [`ISBN:${isbn}`]: {
      title: book.title,
      authors: [{ name: book.author }],
      cover: { medium: book.coverImageUrl },
      publishers: [{ name: book.publisher || 'Test Publisher' }],
      publish_date: book.publishedDate || '2023',
      physical_format: book.physicalFormat || 'Hardcover'
    }
  };
}

// Setup DOM with common elements
export function setupDOM() {
  document.body.innerHTML = `
    <div id="toast" class="hidden"></div>
    <div id="loading-state"></div>
    <div id="empty-state" class="hidden"></div>
    <div id="book-list"></div>
    <select id="sort-select">
      <option value="createdAt-desc">Date Added (Newest)</option>
      <option value="createdAt-asc">Date Added (Oldest)</option>
      <option value="title-asc">Title (A-Z)</option>
      <option value="title-desc">Title (Z-A)</option>
      <option value="author-asc">Author (A-Z)</option>
      <option value="author-desc">Author (Z-A)</option>
      <option value="rating-desc">Rating (High-Low)</option>
      <option value="rating-asc">Rating (Low-High)</option>
    </select>
    <select id="rating-filter">
      <option value="0">All Ratings</option>
      <option value="5">5 Stars</option>
      <option value="4">4+ Stars</option>
      <option value="3">3+ Stars</option>
    </select>
    <button id="reset-filters" class="hidden"></button>
  `;
}

// Cleanup after each test
export function cleanupDOM() {
  document.body.innerHTML = '';
}
