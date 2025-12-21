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
