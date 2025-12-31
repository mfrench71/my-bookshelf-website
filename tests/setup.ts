/**
 * Test Setup File (TypeScript)
 * Provides typed mocks for browser APIs and Firebase
 */

import { vi, type Mock } from 'vitest';
import type {
  Book,
  Genre,
  Series,
  WishlistItem,
  GoogleBooksResponse,
  GoogleBooksItem,
  FirestoreTimestamp,
} from '../src/js/types/index.js';

// ============================================================================
// Global Type Declarations
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var lucide: { createIcons: Mock };
  // eslint-disable-next-line no-var
  var fetch: Mock;
}

// ============================================================================
// Mock Lucide Icons
// ============================================================================

global.lucide = {
  createIcons: vi.fn(),
};

// ============================================================================
// Mock HTMLCanvasElement.toDataURL for WebP support detection
// ============================================================================

const originalCreateElement = document.createElement.bind(document);
document.createElement = function <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: ElementCreationOptions
): HTMLElementTagNameMap[K] {
  const element = originalCreateElement(tagName, options);
  if (tagName === 'canvas') {
    (element as HTMLCanvasElement).toDataURL = vi.fn((type?: string) => {
      if (type === 'image/webp') {
        return 'data:image/webp;base64,test';
      }
      return 'data:image/png;base64,test';
    });
  }
  return element;
};

// ============================================================================
// Mock Navigator APIs
// ============================================================================

global.navigator.vibrate = vi.fn();

// ============================================================================
// Mock localStorage
// ============================================================================

interface MockLocalStorage extends Storage {
  _reset: () => void;
}

const localStorageMock = ((): MockLocalStorage => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    _reset: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// ============================================================================
// Mock fetch
// ============================================================================

global.fetch = vi.fn();

// ============================================================================
// Mock Firebase Auth
// ============================================================================

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js', () => ({
  onAuthStateChanged: vi.fn(
    (_auth: unknown, callback: (user: { uid: string; email: string } | null) => void) => {
      callback({ uid: 'test-user-123', email: 'test@example.com' });
      return vi.fn();
    }
  ),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
}));

// ============================================================================
// Mock Firebase Firestore (CDN URL)
// ============================================================================

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(
    (_query: unknown, callback: (snapshot: { docs: unknown[] }) => void) => {
      callback({ docs: [] });
      return vi.fn();
    }
  ),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-book-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  getDoc: vi.fn(() =>
    Promise.resolve({ exists: () => true, data: () => ({}) })
  ),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  getDocsFromServer: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
}));

// ============================================================================
// Mock Firebase Firestore (Package Import for TypeScript)
// ============================================================================

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
  onSnapshot: vi.fn(
    (_query: unknown, callback: (snapshot: { docs: unknown[] }) => void) => {
      callback({ docs: [] });
      return vi.fn();
    }
  ),
  addDoc: vi.fn(() => Promise.resolve({ id: 'new-book-id' })),
  updateDoc: vi.fn(() => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(),
  getDoc: vi.fn(() =>
    Promise.resolve({ exists: () => true, data: () => ({}) })
  ),
  getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  getDocsFromServer: vi.fn(() => Promise.resolve({ docs: [], empty: true })),
  serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
}));

vi.mock('./firebase-config.js', () => ({
  auth: {},
  db: {},
}));

// ============================================================================
// Test Helper Functions (Typed)
// ============================================================================

/**
 * Reset all mocks between tests
 */
export function resetMocks(): void {
  vi.clearAllMocks();
  global.fetch.mockReset();
}

/**
 * Create mock Firestore timestamp
 */
export function createMockTimestamp(date?: Date): FirestoreTimestamp {
  const d = date || new Date();
  return { seconds: d.getTime() / 1000, nanoseconds: 0 } as FirestoreTimestamp;
}

/**
 * Create a mock book with Firestore timestamp format
 * @param overrides - Partial book data to override defaults (allows legacy fields for migration tests)
 */
export function createMockBook(overrides: Partial<Book> & Record<string, unknown> = {}): Book & Record<string, unknown> {
  const now = createMockTimestamp();
  return {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    coverImageUrl: 'https://example.com/cover.jpg',
    rating: 4,
    notes: 'Great book!',
    isbn: '1234567890',
    genres: [],
    reads: [],
    images: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a serialised book (milliseconds format for cache/localStorage)
 * @param overrides - Partial book data to override defaults
 */
export function createSerialisedBook(
  overrides: Partial<Omit<Book, 'createdAt' | 'updatedAt'>> & {
    createdAt?: number;
    updatedAt?: number;
  } = {}
): Omit<Book, 'createdAt' | 'updatedAt'> & { createdAt: number; updatedAt: number } {
  const now = Date.now();
  return {
    id: 'book-1',
    title: 'Test Book',
    author: 'Test Author',
    coverImageUrl: 'https://example.com/cover.jpg',
    rating: 4,
    notes: 'Great book!',
    isbn: '1234567890',
    genres: [],
    reads: [],
    images: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create multiple mock books
 * @param count - Number of books to create
 */
export function createMockBooks(count = 5): Book[] {
  return Array.from({ length: count }, (_, i) =>
    createMockBook({
      id: `book-${i + 1}`,
      title: `Book ${i + 1}`,
      author: `Author ${i + 1}`,
      rating: (i % 5) + 1,
      createdAt: createMockTimestamp(new Date(Date.now() - i * 86400000)),
    })
  );
}

/**
 * Create multiple serialised books
 * @param count - Number of books to create
 */
export function createSerialisedBooks(
  count = 5
): Array<Omit<Book, 'createdAt' | 'updatedAt'> & { createdAt: number; updatedAt: number }> {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) =>
    createSerialisedBook({
      id: `book-${i + 1}`,
      title: `Book ${i + 1}`,
      author: `Author ${i + 1}`,
      rating: (i % 5) + 1,
      createdAt: now - i * 86400000,
    })
  );
}

/**
 * Create a mock genre
 * @param overrides - Partial genre data to override defaults
 */
export function createMockGenre(overrides: Partial<Genre> = {}): Genre {
  const now = createMockTimestamp();
  return {
    id: 'genre-1',
    name: 'Fiction',
    color: '#3b82f6',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create multiple mock genres
 * @param count - Number of genres to create
 */
export function createMockGenres(count = 3): Genre[] {
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const names = ['Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 'Mystery'];
  return Array.from({ length: count }, (_, i) =>
    createMockGenre({
      id: `genre-${i + 1}`,
      name: names[i % names.length],
      color: colors[i % colors.length],
    })
  );
}

/**
 * Create a mock series
 * @param overrides - Partial series data to override defaults
 */
export function createMockSeries(overrides: Partial<Series> = {}): Series {
  const now = createMockTimestamp();
  return {
    id: 'series-1',
    name: 'Test Series',
    expectedBooks: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Create a mock wishlist item
 * @param overrides - Partial wishlist item data to override defaults
 */
export function createMockWishlistItem(overrides: Partial<WishlistItem> = {}): WishlistItem {
  const now = createMockTimestamp();
  return {
    id: 'wishlist-1',
    title: 'Wishlist Book',
    author: 'Wishlist Author',
    addedFrom: 'manual',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Mock Google Books API response
 * @param books - Array of partial book data to include in response
 */
export function mockGoogleBooksResponse(
  books: Array<{ title: string; author: string; coverImageUrl?: string; publisher?: string; publishedDate?: string; isbn?: string }> = []
): GoogleBooksResponse {
  const items: GoogleBooksItem[] = books.map((book, i) => ({
    id: `google-${i}`,
    volumeInfo: {
      title: book.title,
      authors: [book.author],
      imageLinks: book.coverImageUrl ? { thumbnail: book.coverImageUrl } : undefined,
      publisher: book.publisher || 'Test Publisher',
      publishedDate: book.publishedDate || '2023',
      industryIdentifiers: book.isbn
        ? [{ type: 'ISBN_13', identifier: book.isbn }]
        : undefined,
    },
  }));

  return {
    items: items.length > 0 ? items : undefined,
    totalItems: items.length,
  };
}

/**
 * Mock Open Library API response
 * @param isbn - ISBN to use as key
 * @param book - Book data to include in response
 */
export function mockOpenLibraryResponse(
  isbn: string,
  book: { title: string; author: string; coverImageUrl?: string; publisher?: string; publishedDate?: string; physicalFormat?: string } | null = null
): Record<string, unknown> {
  if (!book) return {};

  return {
    [`ISBN:${isbn}`]: {
      title: book.title,
      authors: [{ name: book.author }],
      cover: book.coverImageUrl ? { medium: book.coverImageUrl } : undefined,
      publishers: [{ name: book.publisher || 'Test Publisher' }],
      publish_date: book.publishedDate || '2023',
      physical_format: book.physicalFormat || 'Hardcover',
    },
  };
}

// ============================================================================
// DOM Setup Helpers
// ============================================================================

/**
 * Setup DOM with common test elements
 */
export function setupDOM(): void {
  document.body.innerHTML = `
    <div id="toast" class="hidden"></div>
    <div id="loading-state"></div>
    <div id="empty-state" class="hidden"></div>
    <div id="no-results-state" class="hidden">
      <h3 id="no-results-title">No books match your filters</h3>
      <button id="clear-filters-link">clear all filters</button>
    </div>
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
    <select id="status-filter">
      <option value="">All Status</option>
      <option value="want-to-read">Want to Read</option>
      <option value="reading">Reading</option>
      <option value="finished">Finished</option>
    </select>
    <button id="reset-filters" class="hidden"></button>
  `;
}

/**
 * Cleanup DOM after tests
 */
export function cleanupDOM(): void {
  document.body.innerHTML = '';
}

// ============================================================================
// Type Exports for Tests
// ============================================================================

export type { Book, Genre, Series, WishlistItem, GoogleBooksResponse };

// ============================================================================
// Backward Compatibility Aliases (American spellings)
// ============================================================================

export const createSerializedBook = createSerialisedBook;
export const createSerializedBooks = createSerialisedBooks;
