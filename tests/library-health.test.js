import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hasFieldValue,
  getMissingFields,
  calculateBookCompleteness,
  calculateLibraryCompleteness,
  analyzeLibraryHealth,
  getCompletenessRating,
  getBooksWithIssue,
  getFixableBooksWithIssue,
  HEALTH_FIELDS
} from '../src/js/utils/library-health.js';

// Mock Firebase
vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  doc: vi.fn(),
  updateDoc: vi.fn(),
  serverTimestamp: vi.fn(() => 'mock-timestamp')
}));

vi.mock('/js/firebase-config.js', () => ({
  db: {}
}));

vi.mock('../src/js/utils/api.js', () => ({
  lookupISBN: vi.fn()
}));

describe('Library Health Utils', () => {
  describe('HEALTH_FIELDS', () => {
    it('has expected fields with weights', () => {
      expect(HEALTH_FIELDS.coverImageUrl.weight).toBe(2);
      expect(HEALTH_FIELDS.genres.weight).toBe(2);
      expect(HEALTH_FIELDS.pageCount.weight).toBe(1);
      expect(HEALTH_FIELDS.physicalFormat.weight).toBe(1);
      expect(HEALTH_FIELDS.publisher.weight).toBe(1);
      expect(HEALTH_FIELDS.publishedDate.weight).toBe(1);
      expect(HEALTH_FIELDS.isbn.weight).toBe(0); // Not in score
    });

    it('has apiFixable flags', () => {
      expect(HEALTH_FIELDS.coverImageUrl.apiFixable).toBe(true);
      expect(HEALTH_FIELDS.isbn.apiFixable).toBe(false);
    });
  });

  describe('hasFieldValue', () => {
    it('returns true for non-empty string fields', () => {
      expect(hasFieldValue({ coverImageUrl: 'http://example.com/cover.jpg' }, 'coverImageUrl')).toBe(true);
      expect(hasFieldValue({ publisher: 'Penguin' }, 'publisher')).toBe(true);
    });

    it('returns false for empty/missing string fields', () => {
      expect(hasFieldValue({ coverImageUrl: '' }, 'coverImageUrl')).toBe(false);
      expect(hasFieldValue({ coverImageUrl: null }, 'coverImageUrl')).toBe(false);
      expect(hasFieldValue({}, 'coverImageUrl')).toBe(false);
    });

    it('returns true for non-empty genres array', () => {
      expect(hasFieldValue({ genres: ['Fiction', 'Mystery'] }, 'genres')).toBe(true);
      expect(hasFieldValue({ genres: ['Single'] }, 'genres')).toBe(true);
    });

    it('returns false for empty/missing genres array', () => {
      expect(hasFieldValue({ genres: [] }, 'genres')).toBe(false);
      expect(hasFieldValue({ genres: null }, 'genres')).toBe(false);
      expect(hasFieldValue({}, 'genres')).toBe(false);
    });

    it('returns true for truthy numeric fields', () => {
      expect(hasFieldValue({ pageCount: 300 }, 'pageCount')).toBe(true);
    });

    it('returns false for zero page count', () => {
      expect(hasFieldValue({ pageCount: 0 }, 'pageCount')).toBe(false);
    });
  });

  describe('getMissingFields', () => {
    it('returns all fields for empty book', () => {
      const missing = getMissingFields({});
      expect(missing).toContain('coverImageUrl');
      expect(missing).toContain('genres');
      expect(missing).toContain('pageCount');
      expect(missing).toContain('physicalFormat');
      expect(missing).toContain('publisher');
      expect(missing).toContain('publishedDate');
      expect(missing).toContain('isbn');
    });

    it('returns empty array for complete book', () => {
      const completeBook = {
        coverImageUrl: 'http://example.com/cover.jpg',
        genres: ['Fiction'],
        pageCount: 300,
        physicalFormat: 'Paperback',
        publisher: 'Penguin',
        publishedDate: '2023',
        isbn: '9781234567890'
      };
      expect(getMissingFields(completeBook)).toEqual([]);
    });

    it('returns only missing fields for partial book', () => {
      const partialBook = {
        coverImageUrl: 'http://example.com/cover.jpg',
        genres: ['Fiction'],
        isbn: '9781234567890'
      };
      const missing = getMissingFields(partialBook);
      expect(missing).not.toContain('coverImageUrl');
      expect(missing).not.toContain('genres');
      expect(missing).not.toContain('isbn');
      expect(missing).toContain('pageCount');
      expect(missing).toContain('physicalFormat');
      expect(missing).toContain('publisher');
      expect(missing).toContain('publishedDate');
    });
  });

  describe('calculateBookCompleteness', () => {
    it('returns 100% for complete book', () => {
      const completeBook = {
        coverImageUrl: 'http://example.com/cover.jpg',
        genres: ['Fiction'],
        pageCount: 300,
        physicalFormat: 'Paperback',
        publisher: 'Penguin',
        publishedDate: '2023'
      };
      expect(calculateBookCompleteness(completeBook)).toBe(100);
    });

    it('returns 0% for empty book', () => {
      expect(calculateBookCompleteness({})).toBe(0);
    });

    it('weights cover and genres higher', () => {
      // Total weight: 2+2+1+1+1+1 = 8
      // Book with only cover (weight 2): 2/8 = 25%
      const onlyCover = { coverImageUrl: 'http://example.com/cover.jpg' };
      expect(calculateBookCompleteness(onlyCover)).toBe(25);

      // Book with only pageCount (weight 1): 1/8 = 12.5% -> 13%
      const onlyPageCount = { pageCount: 300 };
      expect(calculateBookCompleteness(onlyPageCount)).toBe(13);
    });

    it('calculates correct percentage for mixed fields', () => {
      // cover (2) + genres (2) + pageCount (1) = 5/8 = 62.5% -> 63%
      const partialBook = {
        coverImageUrl: 'http://example.com/cover.jpg',
        genres: ['Fiction'],
        pageCount: 300
      };
      expect(calculateBookCompleteness(partialBook)).toBe(63);
    });

    it('does not count ISBN in completeness score', () => {
      // ISBN has weight 0, so it should not affect score
      const bookWithIsbn = { isbn: '9781234567890' };
      expect(calculateBookCompleteness(bookWithIsbn)).toBe(0);
    });
  });

  describe('calculateLibraryCompleteness', () => {
    it('returns 100% for empty library', () => {
      expect(calculateLibraryCompleteness([])).toBe(100);
      expect(calculateLibraryCompleteness(null)).toBe(100);
    });

    it('returns 100% for all complete books', () => {
      const books = [
        {
          coverImageUrl: 'http://example.com/1.jpg',
          genres: ['Fiction'],
          pageCount: 300,
          physicalFormat: 'Paperback',
          publisher: 'Penguin',
          publishedDate: '2023'
        },
        {
          coverImageUrl: 'http://example.com/2.jpg',
          genres: ['Non-Fiction'],
          pageCount: 200,
          physicalFormat: 'Hardcover',
          publisher: 'Random House',
          publishedDate: '2022'
        }
      ];
      expect(calculateLibraryCompleteness(books)).toBe(100);
    });

    it('returns 0% for all empty books', () => {
      const books = [{}, {}, {}];
      expect(calculateLibraryCompleteness(books)).toBe(0);
    });

    it('averages book completeness scores', () => {
      // Book 1: 100%, Book 2: 0% -> Average 50%
      const books = [
        {
          coverImageUrl: 'http://example.com/1.jpg',
          genres: ['Fiction'],
          pageCount: 300,
          physicalFormat: 'Paperback',
          publisher: 'Penguin',
          publishedDate: '2023'
        },
        {}
      ];
      expect(calculateLibraryCompleteness(books)).toBe(50);
    });
  });

  describe('analyzeLibraryHealth', () => {
    const createBook = (overrides = {}) => ({
      id: 'book-' + Math.random().toString(36).substr(2, 9),
      title: 'Test Book',
      author: 'Test Author',
      ...overrides
    });

    it('returns correct structure', () => {
      const result = analyzeLibraryHealth([]);
      expect(result).toHaveProperty('totalBooks');
      expect(result).toHaveProperty('completenessScore');
      expect(result).toHaveProperty('totalIssues');
      expect(result).toHaveProperty('fixableBooks');
      expect(result).toHaveProperty('issues');
      expect(result.issues).toHaveProperty('missingCover');
      expect(result.issues).toHaveProperty('missingGenres');
      expect(result.issues).toHaveProperty('missingPageCount');
      expect(result.issues).toHaveProperty('missingFormat');
      expect(result.issues).toHaveProperty('missingPublisher');
      expect(result.issues).toHaveProperty('missingPublishedDate');
      expect(result.issues).toHaveProperty('missingIsbn');
    });

    it('excludes binned books from analysis', () => {
      const books = [
        createBook({ deletedAt: Date.now() }),
        createBook({ coverImageUrl: 'http://example.com/cover.jpg' })
      ];
      const result = analyzeLibraryHealth(books);
      expect(result.totalBooks).toBe(1);
    });

    it('correctly categorises missing fields', () => {
      const books = [
        createBook({ isbn: '1234' }), // Missing all except isbn
        createBook({ coverImageUrl: 'http://example.com/cover.jpg', genres: ['Fiction'] }), // Missing most
        createBook({
          coverImageUrl: 'http://example.com/cover.jpg',
          genres: ['Fiction'],
          pageCount: 300,
          physicalFormat: 'Paperback',
          publisher: 'Penguin',
          publishedDate: '2023',
          isbn: '5678'
        }) // Complete
      ];

      const result = analyzeLibraryHealth(books);
      expect(result.totalBooks).toBe(3);
      expect(result.issues.missingCover.length).toBe(1); // First book only
      expect(result.issues.missingGenres.length).toBe(1); // First book only
      expect(result.issues.missingIsbn.length).toBe(1); // Second book only
    });

    it('counts fixable books (with ISBN and missing fields)', () => {
      const books = [
        createBook({ isbn: '1234' }), // Fixable - has ISBN, missing fields
        createBook({ isbn: '5678', coverImageUrl: 'http://example.com/cover.jpg' }), // Fixable - has ISBN, missing some
        createBook({}), // Not fixable - no ISBN
        createBook({
          coverImageUrl: 'http://example.com/cover.jpg',
          genres: ['Fiction'],
          pageCount: 300,
          physicalFormat: 'Paperback',
          publisher: 'Penguin',
          publishedDate: '2023',
          isbn: '9999'
        }) // Not fixable - complete
      ];

      const result = analyzeLibraryHealth(books);
      expect(result.fixableBooks).toBe(2);
    });

    it('calculates total issues excluding ISBN', () => {
      const book = createBook({}); // Missing everything
      const result = analyzeLibraryHealth([book]);
      // Missing: cover, genres, pageCount, format, publisher, publishedDate (6 total)
      // ISBN is NOT counted in totalIssues
      expect(result.totalIssues).toBe(6);
    });
  });

  describe('getCompletenessRating', () => {
    it('returns Excellent for 90%+', () => {
      expect(getCompletenessRating(100)).toEqual({ label: 'Excellent', colour: 'green' });
      expect(getCompletenessRating(95)).toEqual({ label: 'Excellent', colour: 'green' });
      expect(getCompletenessRating(90)).toEqual({ label: 'Excellent', colour: 'green' });
    });

    it('returns Good for 70-89%', () => {
      expect(getCompletenessRating(89)).toEqual({ label: 'Good', colour: 'green' });
      expect(getCompletenessRating(75)).toEqual({ label: 'Good', colour: 'green' });
      expect(getCompletenessRating(70)).toEqual({ label: 'Good', colour: 'green' });
    });

    it('returns Fair for 50-69%', () => {
      expect(getCompletenessRating(69)).toEqual({ label: 'Fair', colour: 'amber' });
      expect(getCompletenessRating(55)).toEqual({ label: 'Fair', colour: 'amber' });
      expect(getCompletenessRating(50)).toEqual({ label: 'Fair', colour: 'amber' });
    });

    it('returns Needs Attention for <50%', () => {
      expect(getCompletenessRating(49)).toEqual({ label: 'Needs Attention', colour: 'red' });
      expect(getCompletenessRating(25)).toEqual({ label: 'Needs Attention', colour: 'red' });
      expect(getCompletenessRating(0)).toEqual({ label: 'Needs Attention', colour: 'red' });
    });
  });

  describe('getBooksWithIssue', () => {
    it('returns books with specified issue', () => {
      const healthReport = {
        issues: {
          missingCover: [{ id: '1', title: 'Book 1' }],
          missingGenres: [{ id: '2', title: 'Book 2' }, { id: '3', title: 'Book 3' }],
          missingIsbn: []
        }
      };

      expect(getBooksWithIssue(healthReport, 'missingCover')).toHaveLength(1);
      expect(getBooksWithIssue(healthReport, 'missingGenres')).toHaveLength(2);
      expect(getBooksWithIssue(healthReport, 'missingIsbn')).toHaveLength(0);
    });

    it('returns empty array for unknown issue type', () => {
      const healthReport = { issues: {} };
      expect(getBooksWithIssue(healthReport, 'unknownIssue')).toEqual([]);
    });
  });

  describe('getFixableBooksWithIssue', () => {
    it('returns only books with ISBN', () => {
      const healthReport = {
        issues: {
          missingCover: [
            { id: '1', title: 'Book 1', isbn: '1234567890' },
            { id: '2', title: 'Book 2' }, // No ISBN
            { id: '3', title: 'Book 3', isbn: '0987654321' }
          ]
        }
      };

      const fixable = getFixableBooksWithIssue(healthReport, 'missingCover');
      expect(fixable).toHaveLength(2);
      expect(fixable.every(b => b.isbn)).toBe(true);
    });
  });
});

describe('Library Health Fix Functions', () => {
  // Import the functions that need async testing with mocks
  let fixBookFromAPI;
  let fixBooksFromAPI;
  let lookupISBNMock;
  let updateDocMock;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mock references
    const apiModule = await import('../src/js/utils/api.js');
    lookupISBNMock = apiModule.lookupISBN;

    const firestoreModule = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    updateDocMock = firestoreModule.updateDoc;

    // Import functions fresh for each test
    const healthModule = await import('../src/js/utils/library-health.js');
    fixBookFromAPI = healthModule.fixBookFromAPI;
    fixBooksFromAPI = healthModule.fixBooksFromAPI;
  });

  describe('fixBookFromAPI', () => {
    it('returns error for book without ISBN', async () => {
      const result = await fixBookFromAPI('user123', { id: 'book1', title: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No ISBN - cannot lookup');
      expect(result.fieldsFixed).toEqual([]);
    });

    it('returns error when API returns no data', async () => {
      lookupISBNMock.mockResolvedValue(null);

      const result = await fixBookFromAPI('user123', { id: 'book1', isbn: '1234567890' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No data available from APIs');
    });

    it('fills only empty fields', async () => {
      lookupISBNMock.mockResolvedValue({
        coverImageUrl: 'http://new-cover.jpg',
        genres: ['Mystery'],
        pageCount: 350,
        physicalFormat: 'Paperback',
        publisher: 'New Publisher',
        publishedDate: '2024'
      });
      updateDocMock.mockResolvedValue();

      const book = {
        id: 'book1',
        isbn: '1234567890',
        coverImageUrl: 'http://existing-cover.jpg', // Already has cover
        genres: ['Fiction'] // Already has genres
      };

      const result = await fixBookFromAPI('user123', book);
      expect(result.success).toBe(true);
      expect(result.fieldsFixed).not.toContain('coverImageUrl');
      expect(result.fieldsFixed).not.toContain('genres');
      expect(result.fieldsFixed).toContain('pageCount');
      expect(result.fieldsFixed).toContain('physicalFormat');
      expect(result.fieldsFixed).toContain('publisher');
      expect(result.fieldsFixed).toContain('publishedDate');
    });

    it('returns success false when no new data available', async () => {
      lookupISBNMock.mockResolvedValue({
        coverImageUrl: '', // Empty
        genres: [],
        pageCount: null,
        physicalFormat: '',
        publisher: '',
        publishedDate: ''
      });

      const result = await fixBookFromAPI('user123', { id: 'book1', isbn: '1234567890' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No new data available');
    });
  });

  describe('fixBooksFromAPI', () => {
    it('processes multiple books with progress callback', async () => {
      lookupISBNMock
        .mockResolvedValueOnce({ pageCount: 300 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ coverImageUrl: 'http://cover.jpg' });
      updateDocMock.mockResolvedValue();

      const books = [
        { id: '1', isbn: '111', title: 'Book 1' },
        { id: '2', isbn: '222', title: 'Book 2' },
        { id: '3', isbn: '333', title: 'Book 3' }
      ];

      const progressCalls = [];
      const onProgress = (current, total, book) => {
        progressCalls.push({ current, total, title: book.title });
      };

      const result = await fixBooksFromAPI('user123', books, onProgress, 0); // No delay for test

      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[0]).toEqual({ current: 1, total: 3, title: 'Book 1' });
      expect(progressCalls[2]).toEqual({ current: 3, total: 3, title: 'Book 3' });

      expect(result.fixed).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.fieldsFixedCount.pageCount).toBe(1);
      expect(result.fieldsFixedCount.coverImageUrl).toBe(1);
    });

    it('categorises books without ISBN as skipped', async () => {
      const books = [
        { id: '1', title: 'No ISBN Book' },
        { id: '2', isbn: '222', title: 'Has ISBN' }
      ];

      lookupISBNMock.mockResolvedValue({ pageCount: 300 });
      updateDocMock.mockResolvedValue();

      const result = await fixBooksFromAPI('user123', books, null, 0);

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toBe('No ISBN');
      expect(result.fixed).toHaveLength(1);
    });
  });
});
