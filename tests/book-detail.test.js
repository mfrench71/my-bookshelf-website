/**
 * Tests for src/js/book-detail.js
 * Tests API refresh functionality and book detail operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resetMocks,
  mockGoogleBooksResponse,
  mockOpenLibraryResponse
} from './setup.js';

// Replicate fetchBookDataFromAPI function for testing
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
          coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || ''
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
          coverImageUrl: volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:') || ''
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
          coverImageUrl: bookData.cover?.medium || bookData.cover?.small || ''
        };
      }
    } catch (e) {
      console.error('Open Library API error:', e);
    }
  }

  return null;
}

describe('fetchBookDataFromAPI', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('Google Books by ISBN', () => {
    it('should fetch book data by ISBN from Google Books', async () => {
      const mockBook = {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        coverImageUrl: 'https://books.google.com/cover.jpg'
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockGoogleBooksResponse([mockBook]))
      });

      const result = await fetchBookDataFromAPI('9780743273565', 'The Great Gatsby', 'F. Scott Fitzgerald');

      expect(result).toBeTruthy();
      expect(result.title).toBe('The Great Gatsby');
      expect(result.author).toBe('F. Scott Fitzgerald');
      expect(result.coverImageUrl).toBe('https://books.google.com/cover.jpg');
    });

    it('should convert http to https for cover images', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Test Book',
            authors: ['Test Author'],
            imageLinks: {
              thumbnail: 'http://books.google.com/cover.jpg'
            }
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Test Book', 'Test Author');

      expect(result.coverImageUrl).toBe('https://books.google.com/cover.jpg');
    });

    it('should handle multiple authors', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Collaborative Work',
            authors: ['Author One', 'Author Two', 'Author Three']
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Collaborative Work', '');

      expect(result.author).toBe('Author One, Author Two, Author Three');
    });

    it('should handle missing fields gracefully', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Minimal Book'
            // No authors or imageLinks
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Minimal Book', '');

      expect(result.title).toBe('Minimal Book');
      expect(result.author).toBe('');
      expect(result.coverImageUrl).toBe('');
    });
  });

  describe('Google Books by title/author search', () => {
    it('should search by title when no ISBN', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Searched Book',
            authors: ['Search Author'],
            imageLinks: { thumbnail: 'https://example.com/cover.jpg' }
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await fetchBookDataFromAPI(null, 'Searched Book', 'Search Author');

      expect(result.title).toBe('Searched Book');
      expect(result.author).toBe('Search Author');
      // URL is encoded, so check for encoded form
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('intitle')
      );
    });

    it('should search by title and author when both provided', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Found Book',
            authors: ['Found Author']
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      await fetchBookDataFromAPI(null, 'Test Title', 'Test Author');

      // URL is encoded, so check that it contains the key parts
      const callUrl = global.fetch.mock.calls[0][0];
      expect(callUrl).toContain('intitle');
      expect(callUrl).toContain('inauthor');
    });

    it('should search by title only when author not provided', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Title Only Book'
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      await fetchBookDataFromAPI(null, 'Title Only Book', '');

      const callUrl = global.fetch.mock.calls[0][0];
      expect(callUrl).toContain('intitle');
      expect(callUrl).not.toContain('inauthor');
    });

    it('should fall back to title search when ISBN search returns no results', async () => {
      // ISBN search returns empty
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      // Title search returns book
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          items: [{
            volumeInfo: {
              title: 'Fallback Book',
              authors: ['Fallback Author']
            }
          }]
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Fallback Book', 'Fallback Author');

      expect(result.title).toBe('Fallback Book');
      expect(result.author).toBe('Fallback Author');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Open Library fallback', () => {
    it('should fall back to Open Library when Google Books fails', async () => {
      // ISBN search returns empty
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      // Title search returns empty
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      // Open Library returns book
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockOpenLibraryResponse('1234567890', {
          title: 'Open Library Book',
          author: 'OL Author',
          coverImageUrl: 'https://covers.openlibrary.org/cover.jpg'
        }))
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Some Title', 'Some Author');

      expect(result.title).toBe('Open Library Book');
      expect(result.author).toBe('OL Author');
    });

    it('should use medium cover from Open Library', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            title: 'Test',
            cover: {
              medium: 'https://covers.openlibrary.org/medium.jpg',
              small: 'https://covers.openlibrary.org/small.jpg'
            }
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Test', '');

      expect(result.coverImageUrl).toBe('https://covers.openlibrary.org/medium.jpg');
    });

    it('should fall back to small cover when medium not available', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            title: 'Test',
            cover: {
              small: 'https://covers.openlibrary.org/small.jpg'
            }
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Test', '');

      expect(result.coverImageUrl).toBe('https://covers.openlibrary.org/small.jpg');
    });
  });

  describe('error handling', () => {
    it('should handle Google Books ISBN API error and continue', async () => {
      // ISBN search fails
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      // Title search succeeds
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          items: [{
            volumeInfo: {
              title: 'Recovered Book',
              authors: ['Author']
            }
          }]
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Recovered Book', 'Author');

      expect(result.title).toBe('Recovered Book');
    });

    it('should handle Google Books title search error and fall back to Open Library', async () => {
      // ISBN search returns empty
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      // Title search fails
      global.fetch.mockRejectedValueOnce(new Error('Search error'));

      // Open Library succeeds
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockOpenLibraryResponse('1234567890', {
          title: 'OL Fallback',
          author: 'OL Author'
        }))
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Some Title', 'Some Author');

      expect(result.title).toBe('OL Fallback');
    });

    it('should return null when all APIs fail', async () => {
      global.fetch.mockRejectedValueOnce(new Error('ISBN error'));
      global.fetch.mockRejectedValueOnce(new Error('Search error'));
      global.fetch.mockRejectedValueOnce(new Error('Open Library error'));

      const result = await fetchBookDataFromAPI('1234567890', 'Test', 'Author');

      expect(result).toBe(null);
    });

    it('should return null when all APIs return no results', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Nonexistent', 'Author');

      expect(result).toBe(null);
    });
  });

  describe('edge cases', () => {
    it('should return null when no ISBN, title, or author provided', async () => {
      const result = await fetchBookDataFromAPI(null, '', '');

      expect(result).toBe(null);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should skip ISBN search when ISBN is empty string', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          items: [{
            volumeInfo: { title: 'Title Search Result' }
          }]
        })
      });

      const result = await fetchBookDataFromAPI('', 'Some Title', '');

      expect(result.title).toBe('Title Search Result');
      // Should have only made one call (title search), not ISBN search
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toContain('intitle');
    });

    it('should not call Open Library when no ISBN provided', async () => {
      // Title search returns empty
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      const result = await fetchBookDataFromAPI(null, 'Unknown Book', 'Author');

      expect(result).toBe(null);
      // Should only have called title search, not Open Library
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
