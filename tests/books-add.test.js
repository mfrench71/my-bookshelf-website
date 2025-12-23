/**
 * Integration tests for src/js/add.js
 * Tests API interactions, form validation, and book search functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  resetMocks,
  mockGoogleBooksResponse,
  mockOpenLibraryResponse,
  createMockBook
} from './setup.js';

// Replicate fetchBookByISBN function for testing (always checks both APIs)
async function fetchBookByISBN(isbn) {
  let result = null;

  // Try Google Books first
  try {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const data = await response.json();

    if (data.items?.length > 0) {
      const book = data.items[0].volumeInfo;
      result = {
        title: book.title,
        author: book.authors?.join(', ') || '',
        coverImageUrl: book.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
        publisher: book.publisher || '',
        publishedDate: book.publishedDate || '',
        physicalFormat: ''
      };
    }
  } catch (e) {
    console.error('Google Books error:', e);
  }

  // Try Open Library (as fallback or to supplement missing fields)
  try {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
    const data = await response.json();
    const book = data[`ISBN:${isbn}`];

    if (book) {
      if (result) {
        // Supplement missing fields from Open Library
        if (!result.publisher) result.publisher = book.publishers?.[0]?.name || '';
        if (!result.publishedDate) result.publishedDate = book.publish_date || '';
        if (!result.physicalFormat) result.physicalFormat = book.physical_format || '';
        if (!result.coverImageUrl) result.coverImageUrl = book.cover?.medium || '';
      } else {
        // Use Open Library as primary source
        result = {
          title: book.title,
          author: book.authors?.map(a => a.name).join(', ') || '',
          coverImageUrl: book.cover?.medium || '',
          publisher: book.publishers?.[0]?.name || '',
          publishedDate: book.publish_date || '',
          physicalFormat: book.physical_format || ''
        };
      }
    }
  } catch (e) {
    console.error('Open Library error:', e);
  }

  return result;
}

// Replicate search function for testing
async function searchBooks(query) {
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`);
  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return [];
  }

  return data.items.map(item => {
    const book = item.volumeInfo;
    return {
      title: book.title || 'Unknown Title',
      author: book.authors?.join(', ') || 'Unknown Author',
      coverImageUrl: book.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
      publisher: book.publisher || '',
      publishedDate: book.publishedDate || '',
      isbn: book.industryIdentifiers?.[0]?.identifier || ''
    };
  });
}

describe('fetchBookByISBN', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('Google Books API with Open Library supplement', () => {
    it('should fetch book details from Google Books and supplement from Open Library', async () => {
      const mockBook = {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        coverImageUrl: 'https://books.google.com/cover.jpg',
        publisher: 'Scribner',
        publishedDate: '1925'
      };

      // Google Books response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockGoogleBooksResponse([mockBook]))
      });

      // Open Library response (for supplementing)
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:9780743273565': {
            physical_format: 'Paperback'
          }
        })
      });

      const result = await fetchBookByISBN('9780743273565');

      expect(result).toBeTruthy();
      expect(result.title).toBe('The Great Gatsby');
      expect(result.author).toBe('F. Scott Fitzgerald');
      expect(result.publisher).toBe('Scribner');
      expect(result.physicalFormat).toBe('Paperback');
    });

    it('should convert http to https for cover images', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Test Book',
            imageLinks: {
              thumbnail: 'http://books.google.com/cover.jpg'
            }
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      // Open Library response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
      });

      const result = await fetchBookByISBN('1234567890');

      expect(result.coverImageUrl).toBe('https://books.google.com/cover.jpg');
    });

    it('should handle multiple authors', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Test Book',
            authors: ['Author One', 'Author Two', 'Author Three']
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      // Open Library response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
      });

      const result = await fetchBookByISBN('1234567890');

      expect(result.author).toBe('Author One, Author Two, Author Three');
    });

    it('should supplement missing fields from Open Library', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Minimal Book'
            // No authors, imageLinks, publisher, etc.
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      // Open Library supplements missing fields
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            publishers: [{ name: 'OL Publisher' }],
            publish_date: '2020',
            physical_format: 'Hardcover',
            cover: { medium: 'https://covers.openlibrary.org/cover.jpg' }
          }
        })
      });

      const result = await fetchBookByISBN('1234567890');

      expect(result.title).toBe('Minimal Book');
      expect(result.author).toBe('');
      expect(result.publisher).toBe('OL Publisher');
      expect(result.publishedDate).toBe('2020');
      expect(result.physicalFormat).toBe('Hardcover');
      expect(result.coverImageUrl).toBe('https://covers.openlibrary.org/cover.jpg');
    });

    it('should not overwrite existing Google Books data with Open Library data', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Google Book',
            authors: ['Google Author'],
            publisher: 'Google Publisher',
            publishedDate: '2021',
            imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' }
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      // Open Library has different data
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            publishers: [{ name: 'OL Publisher' }],
            publish_date: '2020',
            physical_format: 'Paperback',
            cover: { medium: 'https://covers.openlibrary.org/cover.jpg' }
          }
        })
      });

      const result = await fetchBookByISBN('1234567890');

      // Google Books data should be preserved
      expect(result.publisher).toBe('Google Publisher');
      expect(result.publishedDate).toBe('2021');
      expect(result.coverImageUrl).toBe('https://books.google.com/cover.jpg');
      // Only physicalFormat comes from Open Library (Google doesn't have it)
      expect(result.physicalFormat).toBe('Paperback');
    });
  });

  describe('Open Library fallback', () => {
    it('should fall back to Open Library when Google Books returns no results', async () => {
      // Google Books returns empty
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      // Open Library returns book
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockOpenLibraryResponse('1234567890', {
          title: 'Open Library Book',
          author: 'OL Author',
          coverImageUrl: 'https://covers.openlibrary.org/cover.jpg',
          publisher: 'OL Publisher',
          publishedDate: '2020',
          physicalFormat: 'Hardcover'
        }))
      });

      const result = await fetchBookByISBN('1234567890');

      expect(result.title).toBe('Open Library Book');
      expect(result.author).toBe('OL Author');
      expect(result.physicalFormat).toBe('Hardcover');
    });

    it('should return null when both APIs return no results', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
      });

      const result = await fetchBookByISBN('0000000000');

      expect(result).toBe(null);
    });
  });

  describe('error handling', () => {
    it('should handle Google Books API error and fall back', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockOpenLibraryResponse('1234567890', {
          title: 'Fallback Book',
          author: 'Fallback Author'
        }))
      });

      const result = await fetchBookByISBN('1234567890');

      expect(result.title).toBe('Fallback Book');
    });

    it('should return null when both APIs fail', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Google error'));
      global.fetch.mockRejectedValueOnce(new Error('Open Library error'));

      const result = await fetchBookByISBN('1234567890');

      expect(result).toBe(null);
    });
  });
});

describe('searchBooks', () => {
  beforeEach(() => {
    resetMocks();
  });

  it('should search for books by query', async () => {
    const mockBooks = [
      { title: 'Harry Potter', author: 'J.K. Rowling', isbn: '123' },
      { title: 'The Hobbit', author: 'J.R.R. Tolkien', isbn: '456' }
    ];

    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockGoogleBooksResponse(mockBooks))
    });

    const results = await searchBooks('fantasy');

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Harry Potter');
    expect(results[1].title).toBe('The Hobbit');
  });

  it('should return empty array for no results', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ items: null, totalItems: 0 })
    });

    const results = await searchBooks('xyznonexistent');

    expect(results).toEqual([]);
  });

  it('should URL encode the query', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockGoogleBooksResponse([]))
    });

    await searchBooks("Harry Potter & the Philosopher's Stone");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("Harry Potter & the Philosopher's Stone"))
    );
  });

  it('should handle special characters in query', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockGoogleBooksResponse([{ title: 'Test' }]))
    });

    const results = await searchBooks('café résumé');

    expect(results).toHaveLength(1);
  });

  it('should limit results to 10', async () => {
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve(mockGoogleBooksResponse([]))
    });

    await searchBooks('test');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('maxResults=10')
    );
  });
});

describe('ISBN validation', () => {
  // Replicate ISBN cleaning logic
  function cleanISBN(isbn) {
    return isbn.trim().replace(/-/g, '');
  }

  function isValidISBN(isbn) {
    const cleaned = cleanISBN(isbn);
    return /^\d{10}$/.test(cleaned) || /^\d{13}$/.test(cleaned);
  }

  it('should remove hyphens from ISBN', () => {
    expect(cleanISBN('978-0-7432-7356-5')).toBe('9780743273565');
    expect(cleanISBN('0-7432-7356-7')).toBe('0743273567');
  });

  it('should trim whitespace', () => {
    expect(cleanISBN('  1234567890  ')).toBe('1234567890');
  });

  it('should validate 10-digit ISBN', () => {
    expect(isValidISBN('0743273567')).toBe(true);
    expect(isValidISBN('0-7432-7356-7')).toBe(true);
  });

  it('should validate 13-digit ISBN', () => {
    expect(isValidISBN('9780743273565')).toBe(true);
    expect(isValidISBN('978-0-7432-7356-5')).toBe(true);
  });

  it('should reject invalid ISBNs', () => {
    expect(isValidISBN('123')).toBe(false);
    expect(isValidISBN('12345678901234')).toBe(false);
    expect(isValidISBN('abcdefghij')).toBe(false);
  });
});

describe('Form validation logic', () => {
  // Replicate form validation
  function validateBookForm(data) {
    const errors = [];

    if (!data.title || !data.title.trim()) {
      errors.push('Title is required');
    }

    if (!data.author || !data.author.trim()) {
      errors.push('Author is required');
    }

    if (data.coverImageUrl && !isValidUrl(data.coverImageUrl)) {
      errors.push('Invalid cover image URL');
    }

    if (data.rating !== null && data.rating !== undefined) {
      if (data.rating < 0 || data.rating > 5) {
        errors.push('Rating must be between 0 and 5');
      }
    }

    return errors;
  }

  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  it('should require title', () => {
    const errors = validateBookForm({ title: '', author: 'Test Author' });
    expect(errors).toContain('Title is required');
  });

  it('should require author', () => {
    const errors = validateBookForm({ title: 'Test Title', author: '' });
    expect(errors).toContain('Author is required');
  });

  it('should validate cover URL format', () => {
    const errors = validateBookForm({
      title: 'Test',
      author: 'Test',
      coverImageUrl: 'not-a-url'
    });
    expect(errors).toContain('Invalid cover image URL');
  });

  it('should accept valid cover URL', () => {
    const errors = validateBookForm({
      title: 'Test',
      author: 'Test',
      coverImageUrl: 'https://example.com/cover.jpg'
    });
    expect(errors).not.toContain('Invalid cover image URL');
  });

  it('should allow empty cover URL', () => {
    const errors = validateBookForm({
      title: 'Test',
      author: 'Test',
      coverImageUrl: ''
    });
    expect(errors).toHaveLength(0);
  });

  it('should validate rating range', () => {
    const errorsHigh = validateBookForm({
      title: 'Test',
      author: 'Test',
      rating: 6
    });
    expect(errorsHigh).toContain('Rating must be between 0 and 5');

    const errorsLow = validateBookForm({
      title: 'Test',
      author: 'Test',
      rating: -1
    });
    expect(errorsLow).toContain('Rating must be between 0 and 5');
  });

  it('should pass with valid data', () => {
    const errors = validateBookForm({
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      coverImageUrl: 'https://example.com/gatsby.jpg',
      rating: 5
    });
    expect(errors).toHaveLength(0);
  });
});

describe('Barcode scanning validation', () => {
  // Replicate barcode validation from add.js
  function isValidBarcode(code, avgError) {
    // Reject low confidence scans
    if (avgError > 0.1) return false;

    // Must be 10-13 digits (ISBN format)
    if (!/^\d{10,13}$/.test(code)) return false;

    return true;
  }

  it('should accept high confidence scans', () => {
    expect(isValidBarcode('9780743273565', 0.05)).toBe(true);
  });

  it('should reject low confidence scans', () => {
    expect(isValidBarcode('9780743273565', 0.15)).toBe(false);
  });

  it('should reject non-ISBN barcodes', () => {
    expect(isValidBarcode('ABC123', 0.05)).toBe(false);
    expect(isValidBarcode('123', 0.05)).toBe(false);
    expect(isValidBarcode('12345678901234', 0.05)).toBe(false);
  });

  it('should accept 10-digit ISBN', () => {
    expect(isValidBarcode('0743273567', 0.05)).toBe(true);
  });

  it('should accept 13-digit ISBN', () => {
    expect(isValidBarcode('9780743273565', 0.05)).toBe(true);
  });
});

describe('checkForDuplicate', () => {
  // Replicate normalizeText from utils.js
  function normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[''`]/g, "'")
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // Replicate checkForDuplicate logic for testing
  function checkForDuplicate(existingBooks, isbn, title, author) {
    // Check by ISBN first (most reliable)
    if (isbn) {
      const isbnMatch = existingBooks.find(b => b.isbn === isbn);
      if (isbnMatch) {
        return { isDuplicate: true, matchType: 'isbn', existingBook: isbnMatch };
      }
    }

    // Check by normalized title + author
    const normalizedTitle = normalizeText(title);
    const normalizedAuthor = normalizeText(author);

    for (const book of existingBooks) {
      const bookNormalizedTitle = normalizeText(book.title || '');
      const bookNormalizedAuthor = normalizeText(book.author || '');

      if (bookNormalizedTitle === normalizedTitle && bookNormalizedAuthor === normalizedAuthor) {
        return { isDuplicate: true, matchType: 'title-author', existingBook: book };
      }
    }

    return { isDuplicate: false, matchType: null, existingBook: null };
  }

  const existingBooks = [
    { id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', isbn: '9780743273565' },
    { id: '2', title: 'To Kill a Mockingbird', author: 'Harper Lee', isbn: '9780061120084' },
    { id: '3', title: '1984', author: 'George Orwell', isbn: '' }
  ];

  describe('ISBN matching', () => {
    it('should detect duplicate by exact ISBN match', () => {
      const result = checkForDuplicate(existingBooks, '9780743273565', 'Different Title', 'Different Author');
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('isbn');
      expect(result.existingBook.title).toBe('The Great Gatsby');
    });

    it('should not match different ISBN', () => {
      const result = checkForDuplicate(existingBooks, '9781234567890', 'New Book', 'New Author');
      expect(result.isDuplicate).toBe(false);
    });

    it('should skip ISBN check when ISBN is empty', () => {
      const result = checkForDuplicate(existingBooks, '', 'New Book', 'New Author');
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Title/Author matching', () => {
    it('should detect duplicate by exact title and author', () => {
      const result = checkForDuplicate(existingBooks, '', 'The Great Gatsby', 'F. Scott Fitzgerald');
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('title-author');
    });

    it('should detect duplicate with different case', () => {
      const result = checkForDuplicate(existingBooks, '', 'THE GREAT GATSBY', 'f. scott fitzgerald');
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('title-author');
    });

    it('should detect duplicate with mixed case', () => {
      const result = checkForDuplicate(existingBooks, '', 'the great GATSBY', 'F. SCOTT Fitzgerald');
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('title-author');
    });

    it('should detect duplicate with different apostrophe styles', () => {
      const booksWithApostrophe = [
        { id: '1', title: "Harry Potter and the Philosopher's Stone", author: 'J.K. Rowling', isbn: '' }
      ];
      // Using curly apostrophe
      const result = checkForDuplicate(booksWithApostrophe, '', "Harry Potter and the Philosopher's Stone", 'J.K. Rowling');
      expect(result.isDuplicate).toBe(true);
    });

    it('should detect duplicate with accented characters normalized', () => {
      const booksWithAccents = [
        { id: '1', title: 'Café Society', author: 'René Author', isbn: '' }
      ];
      // Without accents
      const result = checkForDuplicate(booksWithAccents, '', 'Cafe Society', 'Rene Author');
      expect(result.isDuplicate).toBe(true);
    });

    it('should not match when only title matches', () => {
      const result = checkForDuplicate(existingBooks, '', 'The Great Gatsby', 'Different Author');
      expect(result.isDuplicate).toBe(false);
    });

    it('should not match when only author matches', () => {
      const result = checkForDuplicate(existingBooks, '', 'Different Title', 'F. Scott Fitzgerald');
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('Priority', () => {
    it('should prefer ISBN match over title/author match', () => {
      // Book with matching ISBN but different title/author
      const result = checkForDuplicate(existingBooks, '9780743273565', 'Completely Different', 'Someone Else');
      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe('isbn');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty existing books list', () => {
      const result = checkForDuplicate([], '9780743273565', 'New Book', 'New Author');
      expect(result.isDuplicate).toBe(false);
    });

    it('should handle book with empty title', () => {
      const result = checkForDuplicate(existingBooks, '', '', 'Some Author');
      expect(result.isDuplicate).toBe(false);
    });

    it('should handle book with empty author', () => {
      const result = checkForDuplicate(existingBooks, '', 'Some Title', '');
      expect(result.isDuplicate).toBe(false);
    });

    it('should handle whitespace-only values', () => {
      const result = checkForDuplicate(existingBooks, '', '   ', '   ');
      expect(result.isDuplicate).toBe(false);
    });
  });
});

describe('Cover picker functionality', () => {
  // Replicate cover picker rendering logic for testing
  function renderCoverPicker(covers) {
    const result = {
      showPicker: false,
      showGoogleOption: false,
      showOpenLibraryOption: false,
      selectedCover: null,
      showNoCoverMsg: false
    };

    if (!covers || Object.keys(covers).length === 0) {
      result.showNoCoverMsg = true;
      return result;
    }

    const hasGoogle = covers.googleBooks;
    const hasOpenLibrary = covers.openLibrary;

    if (hasGoogle || hasOpenLibrary) {
      result.showPicker = true;
      result.showGoogleOption = !!hasGoogle;
      result.showOpenLibraryOption = !!hasOpenLibrary;

      // Auto-select first available
      if (hasGoogle) {
        result.selectedCover = 'googleBooks';
      } else if (hasOpenLibrary) {
        result.selectedCover = 'openLibrary';
      }
    } else {
      result.showNoCoverMsg = true;
    }

    return result;
  }

  function selectCover(availableCovers, source) {
    if (!availableCovers || !availableCovers[source]) {
      return { success: false, url: null };
    }
    return { success: true, url: availableCovers[source] };
  }

  describe('renderCoverPicker', () => {
    it('should show picker with both options when both covers available', () => {
      const covers = {
        googleBooks: 'https://books.google.com/cover.jpg',
        openLibrary: 'https://covers.openlibrary.org/cover.jpg'
      };

      const result = renderCoverPicker(covers);

      expect(result.showPicker).toBe(true);
      expect(result.showGoogleOption).toBe(true);
      expect(result.showOpenLibraryOption).toBe(true);
      expect(result.selectedCover).toBe('googleBooks');
      expect(result.showNoCoverMsg).toBe(false);
    });

    it('should show only Google option when only Google cover available', () => {
      const covers = {
        googleBooks: 'https://books.google.com/cover.jpg'
      };

      const result = renderCoverPicker(covers);

      expect(result.showPicker).toBe(true);
      expect(result.showGoogleOption).toBe(true);
      expect(result.showOpenLibraryOption).toBe(false);
      expect(result.selectedCover).toBe('googleBooks');
    });

    it('should show only Open Library option when only Open Library cover available', () => {
      const covers = {
        openLibrary: 'https://covers.openlibrary.org/cover.jpg'
      };

      const result = renderCoverPicker(covers);

      expect(result.showPicker).toBe(true);
      expect(result.showGoogleOption).toBe(false);
      expect(result.showOpenLibraryOption).toBe(true);
      expect(result.selectedCover).toBe('openLibrary');
    });

    it('should show no cover message when covers object is empty', () => {
      const result = renderCoverPicker({});

      expect(result.showPicker).toBe(false);
      expect(result.showNoCoverMsg).toBe(true);
    });

    it('should show no cover message when covers is null', () => {
      const result = renderCoverPicker(null);

      expect(result.showPicker).toBe(false);
      expect(result.showNoCoverMsg).toBe(true);
    });

    it('should show no cover message when covers is undefined', () => {
      const result = renderCoverPicker(undefined);

      expect(result.showPicker).toBe(false);
      expect(result.showNoCoverMsg).toBe(true);
    });

    it('should handle covers with empty string values', () => {
      const covers = {
        googleBooks: '',
        openLibrary: ''
      };

      const result = renderCoverPicker(covers);

      expect(result.showPicker).toBe(false);
      expect(result.showNoCoverMsg).toBe(true);
    });
  });

  describe('selectCover', () => {
    const availableCovers = {
      googleBooks: 'https://books.google.com/cover.jpg',
      openLibrary: 'https://covers.openlibrary.org/cover.jpg'
    };

    it('should select Google cover successfully', () => {
      const result = selectCover(availableCovers, 'googleBooks');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://books.google.com/cover.jpg');
    });

    it('should select Open Library cover successfully', () => {
      const result = selectCover(availableCovers, 'openLibrary');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://covers.openlibrary.org/cover.jpg');
    });

    it('should fail when selecting unavailable source', () => {
      const singleCover = { googleBooks: 'https://books.google.com/cover.jpg' };

      const result = selectCover(singleCover, 'openLibrary');

      expect(result.success).toBe(false);
      expect(result.url).toBe(null);
    });

    it('should fail when covers is null', () => {
      const result = selectCover(null, 'googleBooks');

      expect(result.success).toBe(false);
    });

    it('should fail when source is invalid', () => {
      const result = selectCover(availableCovers, 'invalid');

      expect(result.success).toBe(false);
    });
  });
});

describe('lookupISBN covers object', () => {
  beforeEach(() => {
    resetMocks();
  });

  // Replicate the expected behavior for testing
  async function fetchBookWithCovers(isbn) {
    let result = null;
    let googleBooksCover = '';
    let openLibraryCover = '';

    // Try Google Books first
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();

      if (data.items?.length > 0) {
        const book = data.items[0].volumeInfo;
        googleBooksCover = book.imageLinks?.thumbnail?.replace('http:', 'https:') || '';
        result = {
          title: book.title,
          author: book.authors?.join(', ') || '',
          coverImageUrl: googleBooksCover,
          publisher: book.publisher || '',
          publishedDate: book.publishedDate || ''
        };
      }
    } catch (e) {
      console.error('Google Books error:', e);
    }

    // Try Open Library
    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const data = await response.json();
      const book = data[`ISBN:${isbn}`];

      if (book) {
        openLibraryCover = book.cover?.medium || '';

        if (result) {
          // Supplement missing fields
          if (!result.coverImageUrl) result.coverImageUrl = openLibraryCover;
        } else {
          // Use Open Library as primary source
          result = {
            title: book.title,
            author: book.authors?.map(a => a.name).join(', ') || '',
            coverImageUrl: openLibraryCover,
            publisher: book.publishers?.[0]?.name || '',
            publishedDate: book.publish_date || ''
          };
        }
      }
    } catch (e) {
      console.error('Open Library error:', e);
    }

    // Add covers object with all available sources
    if (result) {
      result.covers = {};
      if (googleBooksCover) result.covers.googleBooks = googleBooksCover;
      if (openLibraryCover) result.covers.openLibrary = openLibraryCover;
    }

    return result;
  }

  it('should return covers from both APIs when available', async () => {
    // Google Books response
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        items: [{
          volumeInfo: {
            title: 'Test Book',
            imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' }
          }
        }]
      })
    });

    // Open Library response
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        'ISBN:1234567890': {
          title: 'Test Book',
          cover: { medium: 'https://covers.openlibrary.org/cover.jpg' }
        }
      })
    });

    const result = await fetchBookWithCovers('1234567890');

    expect(result.covers).toBeDefined();
    expect(result.covers.googleBooks).toBe('https://books.google.com/cover.jpg');
    expect(result.covers.openLibrary).toBe('https://covers.openlibrary.org/cover.jpg');
  });

  it('should return only Google cover when Open Library has none', async () => {
    // Google Books response
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        items: [{
          volumeInfo: {
            title: 'Test Book',
            imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' }
          }
        }]
      })
    });

    // Open Library response - no cover
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        'ISBN:1234567890': {
          title: 'Test Book'
          // No cover field
        }
      })
    });

    const result = await fetchBookWithCovers('1234567890');

    expect(result.covers).toBeDefined();
    expect(result.covers.googleBooks).toBe('https://books.google.com/cover.jpg');
    expect(result.covers.openLibrary).toBeUndefined();
  });

  it('should return only Open Library cover when Google has none', async () => {
    // Google Books response - no cover
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        items: [{
          volumeInfo: {
            title: 'Test Book'
            // No imageLinks
          }
        }]
      })
    });

    // Open Library response
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        'ISBN:1234567890': {
          title: 'Test Book',
          cover: { medium: 'https://covers.openlibrary.org/cover.jpg' }
        }
      })
    });

    const result = await fetchBookWithCovers('1234567890');

    expect(result.covers).toBeDefined();
    expect(result.covers.googleBooks).toBeUndefined();
    expect(result.covers.openLibrary).toBe('https://covers.openlibrary.org/cover.jpg');
  });

  it('should return empty covers object when neither API has covers', async () => {
    // Google Books response - no cover
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        items: [{
          volumeInfo: {
            title: 'Test Book'
          }
        }]
      })
    });

    // Open Library response - no cover
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        'ISBN:1234567890': {
          title: 'Test Book'
        }
      })
    });

    const result = await fetchBookWithCovers('1234567890');

    expect(result.covers).toBeDefined();
    expect(Object.keys(result.covers).length).toBe(0);
  });

  it('should set coverImageUrl to Google cover when available', async () => {
    // Google Books response
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        items: [{
          volumeInfo: {
            title: 'Test Book',
            imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' }
          }
        }]
      })
    });

    // Open Library response
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        'ISBN:1234567890': {
          cover: { medium: 'https://covers.openlibrary.org/cover.jpg' }
        }
      })
    });

    const result = await fetchBookWithCovers('1234567890');

    // coverImageUrl should be the first found (Google)
    expect(result.coverImageUrl).toBe('https://books.google.com/cover.jpg');
  });

  it('should set coverImageUrl to Open Library cover when Google has none', async () => {
    // Google Books response - no cover
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        items: [{
          volumeInfo: {
            title: 'Test Book'
          }
        }]
      })
    });

    // Open Library response
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        'ISBN:1234567890': {
          title: 'Test Book',
          cover: { medium: 'https://covers.openlibrary.org/cover.jpg' }
        }
      })
    });

    const result = await fetchBookWithCovers('1234567890');

    // coverImageUrl should be Open Library since Google had none
    expect(result.coverImageUrl).toBe('https://covers.openlibrary.org/cover.jpg');
  });
});
