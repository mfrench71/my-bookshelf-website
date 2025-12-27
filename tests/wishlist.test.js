import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadWishlistItems,
  getWishlistCount,
  checkWishlistDuplicate,
  addWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  moveToLibrary,
  clearWishlistCache,
  createWishlistLookup
} from '../src/js/wishlist.js';

// Mock Firebase
vi.mock('../src/js/firebase-config.js', () => ({
  db: {}
}));

// Mock utils
const mockLookupISBN = vi.fn();
vi.mock('../src/js/utils.js', () => ({
  normalizeText: (text) => text?.toLowerCase().replace(/[^a-z0-9]/g, '') || '',
  lookupISBN: (...args) => mockLookupISBN(...args)
}));

// Mock Firestore functions
const mockGetDocs = vi.fn();
const mockGetDoc = vi.fn();
const mockAddDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(() => ({})),
  doc: vi.fn(() => ({})),
  getDocs: (...args) => mockGetDocs(...args),
  getDoc: (...args) => mockGetDoc(...args),
  addDoc: (...args) => mockAddDoc(...args),
  updateDoc: (...args) => mockUpdateDoc(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  query: vi.fn((...args) => args),
  where: vi.fn(),
  orderBy: vi.fn(),
  serverTimestamp: vi.fn(() => 'timestamp')
}));

describe('clearWishlistCache', () => {
  it('should clear cache without error', () => {
    expect(() => clearWishlistCache()).not.toThrow();
  });
});

describe('loadWishlistItems', () => {
  beforeEach(() => {
    clearWishlistCache();
    mockGetDocs.mockReset();
  });

  it('should fetch wishlist items from Firestore', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'w1', data: () => ({ title: 'Book 1', author: 'Author 1', priority: 'high' }) },
        { id: 'w2', data: () => ({ title: 'Book 2', author: 'Author 2', priority: null }) }
      ]
    });

    const items = await loadWishlistItems('user123');

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: 'w1', title: 'Book 1', author: 'Author 1', priority: 'high' });
    expect(items[1]).toEqual({ id: 'w2', title: 'Book 2', author: 'Author 2', priority: null });
  });

  it('should return cached items on subsequent calls', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'w1', data: () => ({ title: 'Book 1', author: 'Author 1' }) }
      ]
    });

    await loadWishlistItems('user123');
    await loadWishlistItems('user123');

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
  });

  it('should fetch fresh data when forceRefresh is true', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: 'w1', data: () => ({ title: 'Book 1', author: 'Author 1' }) }
      ]
    });

    await loadWishlistItems('user123');
    await loadWishlistItems('user123', true);

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });

  it('should fetch fresh data for different users', async () => {
    mockGetDocs.mockResolvedValue({
      docs: []
    });

    await loadWishlistItems('user123');
    await loadWishlistItems('user456');

    expect(mockGetDocs).toHaveBeenCalledTimes(2);
  });
});

describe('getWishlistCount', () => {
  beforeEach(() => {
    clearWishlistCache();
    mockGetDocs.mockReset();
  });

  it('should return the number of wishlist items', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'w1', data: () => ({ title: 'Book 1', author: 'Author 1' }) },
        { id: 'w2', data: () => ({ title: 'Book 2', author: 'Author 2' }) },
        { id: 'w3', data: () => ({ title: 'Book 3', author: 'Author 3' }) }
      ]
    });

    const count = await getWishlistCount('user123');

    expect(count).toBe(3);
  });

  it('should return 0 for empty wishlist', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: []
    });

    const count = await getWishlistCount('user123');

    expect(count).toBe(0);
  });

  it('should return 0 on error', async () => {
    mockGetDocs.mockRejectedValueOnce(new Error('Firestore error'));

    const count = await getWishlistCount('user123');

    expect(count).toBe(0);
  });
});

describe('checkWishlistDuplicate', () => {
  beforeEach(() => {
    clearWishlistCache();
    mockGetDocs.mockReset();
  });

  it('should find duplicate by ISBN', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'w1', data: () => ({ title: 'Book 1', author: 'Author 1', isbn: '1234567890' }) }
      ]
    });

    const duplicate = await checkWishlistDuplicate('user123', '1234567890', 'Different Title', 'Different Author');

    expect(duplicate).not.toBeNull();
    expect(duplicate.isbn).toBe('1234567890');
  });

  it('should find duplicate by title and author', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'w1', data: () => ({ title: 'The Great Book', author: 'John Smith', isbn: null }) }
      ]
    });

    const duplicate = await checkWishlistDuplicate('user123', null, 'The Great Book', 'John Smith');

    expect(duplicate).not.toBeNull();
    expect(duplicate.title).toBe('The Great Book');
  });

  it('should return null when no duplicate found', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'w1', data: () => ({ title: 'Book 1', author: 'Author 1', isbn: '1234567890' }) }
      ]
    });

    const duplicate = await checkWishlistDuplicate('user123', '0987654321', 'New Book', 'New Author');

    expect(duplicate).toBeNull();
  });
});

describe('addWishlistItem', () => {
  beforeEach(() => {
    clearWishlistCache();
    mockGetDocs.mockReset();
    mockAddDoc.mockReset();
  });

  it('should add a new wishlist item', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'new-id' });

    const result = await addWishlistItem('user123', {
      title: 'New Book',
      author: 'New Author',
      isbn: '1234567890',
      priority: 'high'
    });

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('new-id');
    expect(result.title).toBe('New Book');
    expect(result.priority).toBe('high');
  });

  it('should throw error for duplicate item', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'w1', data: () => ({ title: 'Existing Book', author: 'Author', isbn: '1234567890' }) }
      ]
    });

    await expect(addWishlistItem('user123', {
      title: 'Different Title',
      author: 'Different Author',
      isbn: '1234567890'
    })).rejects.toThrow('already in your wishlist');
  });

  it('should set default values for optional fields', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    mockAddDoc.mockResolvedValueOnce({ id: 'new-id' });

    const result = await addWishlistItem('user123', {
      title: 'Book',
      author: 'Author'
    });

    expect(result.isbn).toBeNull();
    expect(result.priority).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.addedFrom).toBe('manual');
  });
});

describe('updateWishlistItem', () => {
  beforeEach(() => {
    mockUpdateDoc.mockReset();
  });

  it('should update allowed fields', async () => {
    mockUpdateDoc.mockResolvedValueOnce();

    const result = await updateWishlistItem('user123', 'item-id', {
      priority: 'low',
      notes: 'Updated notes'
    });

    expect(mockUpdateDoc).toHaveBeenCalledTimes(1);
    expect(result.priority).toBe('low');
    expect(result.notes).toBe('Updated notes');
  });

  it('should not update disallowed fields', async () => {
    mockUpdateDoc.mockResolvedValueOnce();

    const result = await updateWishlistItem('user123', 'item-id', {
      title: 'New Title', // Not allowed
      priority: 'high'
    });

    expect(result.title).toBeUndefined();
    expect(result.priority).toBe('high');
  });
});

describe('deleteWishlistItem', () => {
  beforeEach(() => {
    clearWishlistCache();
    mockDeleteDoc.mockReset();
  });

  it('should delete a wishlist item', async () => {
    mockDeleteDoc.mockResolvedValueOnce();

    await deleteWishlistItem('user123', 'item-id');

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });
});

describe('moveToLibrary', () => {
  beforeEach(() => {
    clearWishlistCache();
    mockGetDoc.mockReset();
    mockAddDoc.mockReset();
    mockDeleteDoc.mockReset();
    mockLookupISBN.mockReset();
  });

  it('should create book and delete wishlist item', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        title: 'My Book',
        author: 'Author Name',
        isbn: '1234567890',
        coverImageUrl: 'http://example.com/cover.jpg',
        publisher: 'Publisher',
        publishedDate: '2023',
        pageCount: 300,
        notes: 'Great book'
      })
    });
    mockLookupISBN.mockResolvedValueOnce(null); // No enrichment
    mockAddDoc.mockResolvedValueOnce({ id: 'book-id' });
    mockDeleteDoc.mockResolvedValueOnce();

    const result = await moveToLibrary('user123', 'wishlist-item-id');

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('book-id');
    expect(result.title).toBe('My Book');
    expect(result.author).toBe('Author Name');
    expect(result.genres).toEqual([]);
    expect(result.reads).toEqual([]);
  });

  it('should enrich data from ISBN lookup when available', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        title: 'My Book',
        author: 'Author Name',
        isbn: '1234567890',
        coverImageUrl: 'http://old-cover.jpg',
        publisher: '',
        publishedDate: '',
        pageCount: null,
        notes: ''
      })
    });
    mockLookupISBN.mockResolvedValueOnce({
      coverImageUrl: 'http://better-cover.jpg',
      covers: { googleBooks: 'http://gb-cover.jpg', openLibrary: 'http://ol-cover.jpg' },
      publisher: 'Enriched Publisher',
      publishedDate: '2024',
      physicalFormat: 'Hardcover',
      pageCount: 350
    });
    mockAddDoc.mockResolvedValueOnce({ id: 'book-id' });
    mockDeleteDoc.mockResolvedValueOnce();

    const result = await moveToLibrary('user123', 'wishlist-item-id');

    expect(mockLookupISBN).toHaveBeenCalledWith('1234567890');
    expect(result.coverImageUrl).toBe('http://better-cover.jpg');
    expect(result.publisher).toBe('Enriched Publisher');
    expect(result.publishedDate).toBe('2024');
    expect(result.physicalFormat).toBe('Hardcover');
    expect(result.pageCount).toBe(350);
  });

  it('should continue with wishlist data if ISBN lookup fails', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        title: 'My Book',
        author: 'Author Name',
        isbn: '1234567890',
        coverImageUrl: 'http://original-cover.jpg',
        publisher: 'Original Publisher',
        publishedDate: '2020',
        pageCount: 200,
        notes: ''
      })
    });
    mockLookupISBN.mockRejectedValueOnce(new Error('API error'));
    mockAddDoc.mockResolvedValueOnce({ id: 'book-id' });
    mockDeleteDoc.mockResolvedValueOnce();

    const result = await moveToLibrary('user123', 'wishlist-item-id');

    expect(result.coverImageUrl).toBe('http://original-cover.jpg');
    expect(result.publisher).toBe('Original Publisher');
  });

  it('should throw error if wishlist item not found', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false
    });

    await expect(moveToLibrary('user123', 'non-existent-id'))
      .rejects.toThrow('Wishlist item not found');
  });
});

describe('createWishlistLookup', () => {
  it('should create a lookup map by ISBN', () => {
    const items = [
      { id: 'w1', title: 'Book 1', isbn: '1111111111' },
      { id: 'w2', title: 'Book 2', isbn: '2222222222' },
      { id: 'w3', title: 'Book 3', isbn: null }
    ];

    const lookup = createWishlistLookup(items);

    expect(lookup.size).toBe(2);
    expect(lookup.get('1111111111').title).toBe('Book 1');
    expect(lookup.get('2222222222').title).toBe('Book 2');
    expect(lookup.has(null)).toBe(false);
  });

  it('should return empty map for empty array', () => {
    const lookup = createWishlistLookup([]);

    expect(lookup.size).toBe(0);
  });
});
