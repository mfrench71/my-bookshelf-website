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
  let result = null;

  // Try Google Books API first (by ISBN if available)
  if (isbn) {
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
      const data = await response.json();
      if (data.items?.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        result = {
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

  // Try Google Books by title/author search if no result yet
  if (!result && title) {
    try {
      const searchQuery = author ? `intitle:${title}+inauthor:${author}` : `intitle:${title}`;
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.items?.length > 0) {
        const volumeInfo = data.items[0].volumeInfo;
        result = {
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

  // Try Open Library by ISBN (as fallback, or to supplement missing fields)
  if (isbn) {
    try {
      const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const data = await response.json();
      const bookData = data[`ISBN:${isbn}`];
      if (bookData) {
        if (result) {
          // Supplement missing fields from Open Library
          if (!result.publisher) result.publisher = bookData.publishers?.[0]?.name || '';
          if (!result.publishedDate) result.publishedDate = bookData.publish_date || '';
          if (!result.physicalFormat) result.physicalFormat = bookData.physical_format || '';
          if (!result.coverImageUrl) result.coverImageUrl = bookData.cover?.medium || bookData.cover?.small || '';
        } else {
          // Use Open Library as primary source
          result = {
            title: bookData.title || '',
            author: bookData.authors?.[0]?.name || '',
            coverImageUrl: bookData.cover?.medium || bookData.cover?.small || '',
            publisher: bookData.publishers?.[0]?.name || '',
            publishedDate: bookData.publish_date || '',
            physicalFormat: bookData.physical_format || ''
          };
        }
      }
    } catch (e) {
      console.error('Open Library API error:', e);
    }
  }

  return result;
}

// Replicate fillEmptyField helper for testing
function fillEmptyField(currentValue, newValue) {
  // Only fill if current value is empty and new value exists
  if (newValue && !currentValue.trim()) {
    return { updated: true, value: newValue };
  }
  return { updated: false, value: currentValue };
}

describe('fetchBookDataFromAPI', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('Google Books by ISBN', () => {
    it('should fetch book data by ISBN from Google Books and supplement with Open Library', async () => {
      const mockBook = {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        coverImageUrl: 'https://books.google.com/cover.jpg'
      };

      // Google Books response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockGoogleBooksResponse([mockBook]))
      });

      // Open Library response for physical format
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:9780743273565': {
            physical_format: 'Paperback'
          }
        })
      });

      const result = await fetchBookDataFromAPI('9780743273565', 'The Great Gatsby', 'F. Scott Fitzgerald');

      expect(result).toBeTruthy();
      expect(result.title).toBe('The Great Gatsby');
      expect(result.author).toBe('F. Scott Fitzgerald');
      expect(result.coverImageUrl).toBe('https://books.google.com/cover.jpg');
      expect(result.physicalFormat).toBe('Paperback');
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

      // Open Library response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
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

      // Open Library response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
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

      // Open Library response
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({})
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Minimal Book', '');

      expect(result.title).toBe('Minimal Book');
      expect(result.author).toBe('');
      expect(result.coverImageUrl).toBe('');
    });

    it('should return publisher and publishedDate from Google Books with physicalFormat from Open Library', async () => {
      const mockResponse = {
        items: [{
          volumeInfo: {
            title: 'Test Book',
            authors: ['Test Author'],
            publisher: 'Test Publisher',
            publishedDate: '2023-05-15'
          }
        }]
      };

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockResponse)
      });

      // Open Library provides physical format
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            physical_format: 'Hardcover'
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Test Book', 'Test Author');

      expect(result.publisher).toBe('Test Publisher');
      expect(result.publishedDate).toBe('2023-05-15');
      expect(result.physicalFormat).toBe('Hardcover');
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

      // Open Library called for physical format (since we have ISBN)
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            physical_format: 'Paperback'
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Fallback Book', 'Fallback Author');

      expect(result.title).toBe('Fallback Book');
      expect(result.author).toBe('Fallback Author');
      expect(result.physicalFormat).toBe('Paperback');
      expect(global.fetch).toHaveBeenCalledTimes(3);
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

    it('should return publisher, publishedDate, and physicalFormat from Open Library', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ items: null })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            title: 'Open Library Book',
            publishers: [{ name: 'OL Publisher' }],
            publish_date: 'January 2022',
            physical_format: 'Hardcover'
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Some Title', '');

      expect(result.publisher).toBe('OL Publisher');
      expect(result.publishedDate).toBe('January 2022');
      expect(result.physicalFormat).toBe('Hardcover');
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

  describe('supplement all missing fields from Open Library', () => {
    it('should supplement missing publisher from Open Library', async () => {
      // Google Books returns book without publisher
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          items: [{
            volumeInfo: {
              title: 'Test Book',
              authors: ['Test Author']
              // No publisher
            }
          }]
        })
      });

      // Open Library has publisher
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            publishers: [{ name: 'Open Library Publisher' }]
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Test Book', 'Test Author');

      expect(result.publisher).toBe('Open Library Publisher');
    });

    it('should supplement missing publishedDate from Open Library', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          items: [{
            volumeInfo: {
              title: 'Test Book'
              // No publishedDate
            }
          }]
        })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            publish_date: '2020'
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Test Book', '');

      expect(result.publishedDate).toBe('2020');
    });

    it('should supplement missing coverImageUrl from Open Library', async () => {
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

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            cover: { medium: 'https://covers.openlibrary.org/cover.jpg' }
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Test Book', '');

      expect(result.coverImageUrl).toBe('https://covers.openlibrary.org/cover.jpg');
    });

    it('should not overwrite existing Google Books data with Open Library data', async () => {
      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          items: [{
            volumeInfo: {
              title: 'Google Book',
              publisher: 'Google Publisher',
              publishedDate: '2021',
              imageLinks: { thumbnail: 'https://books.google.com/cover.jpg' }
            }
          }]
        })
      });

      global.fetch.mockResolvedValueOnce({
        json: () => Promise.resolve({
          'ISBN:1234567890': {
            publishers: [{ name: 'OL Publisher' }],
            publish_date: '2020',
            cover: { medium: 'https://covers.openlibrary.org/cover.jpg' },
            physical_format: 'Hardcover'
          }
        })
      });

      const result = await fetchBookDataFromAPI('1234567890', 'Google Book', '');

      // Existing data preserved
      expect(result.publisher).toBe('Google Publisher');
      expect(result.publishedDate).toBe('2021');
      expect(result.coverImageUrl).toBe('https://books.google.com/cover.jpg');
      // Only physicalFormat comes from Open Library (Google doesn't have it)
      expect(result.physicalFormat).toBe('Hardcover');
    });
  });
});

describe('checkFormDirty', () => {
  // Replicate checkFormDirty helper for testing (includes status field)
  // genrePickerReady simulates whether the genre picker has been initialized
  function checkFormDirty(currentValues, originalValues, genrePickerReady = true) {
    if (currentValues.title !== originalValues.title) return true;
    if (currentValues.author !== originalValues.author) return true;
    if (currentValues.coverImageUrl !== originalValues.coverImageUrl) return true;
    if (currentValues.publisher !== originalValues.publisher) return true;
    if (currentValues.publishedDate !== originalValues.publishedDate) return true;
    if (currentValues.physicalFormat !== originalValues.physicalFormat) return true;
    if (currentValues.notes !== originalValues.notes) return true;
    if (currentValues.rating !== originalValues.rating) return true;
    if (currentValues.status !== originalValues.status) return true;
    // If picker not ready, use original genres to avoid false positive
    const currentGenres = genrePickerReady ? currentValues.genres : originalValues.genres;
    if (currentGenres.length !== originalValues.genres.length) return true;
    if (!currentGenres.every(g => originalValues.genres.includes(g))) return true;
    return false;
  }

  const baseValues = {
    title: 'Test Book',
    author: 'Test Author',
    coverImageUrl: 'http://example.com/cover.jpg',
    publisher: 'Test Publisher',
    publishedDate: '2020',
    physicalFormat: 'Hardcover',
    notes: 'Some notes',
    rating: 4,
    status: null,
    genres: ['genre1', 'genre2']
  };

  it('should return false when no values have changed', () => {
    const current = { ...baseValues, genres: [...baseValues.genres] };
    expect(checkFormDirty(current, baseValues)).toBe(false);
  });

  it('should return true when title changes', () => {
    const current = { ...baseValues, title: 'Different Title', genres: [...baseValues.genres] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return true when rating changes', () => {
    const current = { ...baseValues, rating: 5, genres: [...baseValues.genres] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return true when a genre is added', () => {
    const current = { ...baseValues, genres: ['genre1', 'genre2', 'genre3'] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return true when a genre is removed', () => {
    const current = { ...baseValues, genres: ['genre1'] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return true when genres are completely different', () => {
    const current = { ...baseValues, genres: ['genre3', 'genre4'] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return true when publisher changes', () => {
    const current = { ...baseValues, publisher: 'New Publisher', genres: [...baseValues.genres] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return true when status changes from null to reading', () => {
    const current = { ...baseValues, status: 'reading', genres: [...baseValues.genres] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return true when status changes from reading to finished', () => {
    const originalWithReading = { ...baseValues, status: 'reading' };
    const current = { ...originalWithReading, status: 'finished', genres: [...baseValues.genres] };
    expect(checkFormDirty(current, originalWithReading)).toBe(true);
  });

  it('should return true when status changes to want-to-read', () => {
    const current = { ...baseValues, status: 'want-to-read', genres: [...baseValues.genres] };
    expect(checkFormDirty(current, baseValues)).toBe(true);
  });

  it('should return false when status remains the same', () => {
    const originalWithReading = { ...baseValues, status: 'reading', genres: [...baseValues.genres] };
    const current = { ...originalWithReading };
    expect(checkFormDirty(current, originalWithReading)).toBe(false);
  });

  it('should return true when status is cleared (set to null)', () => {
    const originalWithReading = { ...baseValues, status: 'reading' };
    const current = { ...originalWithReading, status: null, genres: [...baseValues.genres] };
    expect(checkFormDirty(current, originalWithReading)).toBe(true);
  });

  it('should return false when genre picker is not ready (avoids false positive)', () => {
    // Simulates page load where genre picker hasn't initialized yet
    // Current genres would be empty [], but we should use original genres instead
    const current = { ...baseValues, genres: [] }; // Would be empty if picker not ready
    expect(checkFormDirty(current, baseValues, false)).toBe(false);
  });

  it('should correctly detect genre changes when picker is ready', () => {
    const current = { ...baseValues, genres: ['genre3'] };
    expect(checkFormDirty(current, baseValues, true)).toBe(true);
  });
});

describe('Status Timestamp Logic', () => {
  // Replicate the auto-timestamp logic from book-detail.js
  function getStatusUpdates(currentStatus, originalStatus) {
    const updates = {};

    // Auto-set startedAt when status changes to 'reading'
    if (currentStatus === 'reading' && originalStatus !== 'reading') {
      updates.startedAt = 'SERVER_TIMESTAMP';
    }

    // Auto-set finishedAt when status changes to 'finished'
    if (currentStatus === 'finished' && originalStatus !== 'finished') {
      updates.finishedAt = 'SERVER_TIMESTAMP';
    }

    return updates;
  }

  it('should set startedAt when status changes to reading', () => {
    const updates = getStatusUpdates('reading', null);
    expect(updates.startedAt).toBe('SERVER_TIMESTAMP');
  });

  it('should set startedAt when status changes from want-to-read to reading', () => {
    const updates = getStatusUpdates('reading', 'want-to-read');
    expect(updates.startedAt).toBe('SERVER_TIMESTAMP');
  });

  it('should NOT set startedAt when status is already reading', () => {
    const updates = getStatusUpdates('reading', 'reading');
    expect(updates.startedAt).toBeUndefined();
  });

  it('should set finishedAt when status changes to finished', () => {
    const updates = getStatusUpdates('finished', null);
    expect(updates.finishedAt).toBe('SERVER_TIMESTAMP');
  });

  it('should set finishedAt when status changes from reading to finished', () => {
    const updates = getStatusUpdates('finished', 'reading');
    expect(updates.finishedAt).toBe('SERVER_TIMESTAMP');
  });

  it('should NOT set finishedAt when status is already finished', () => {
    const updates = getStatusUpdates('finished', 'finished');
    expect(updates.finishedAt).toBeUndefined();
  });

  it('should not set timestamps when status changes to want-to-read', () => {
    const updates = getStatusUpdates('want-to-read', null);
    expect(updates.startedAt).toBeUndefined();
    expect(updates.finishedAt).toBeUndefined();
  });

  it('should not set timestamps when status is cleared (set to null)', () => {
    const updates = getStatusUpdates(null, 'reading');
    expect(updates.startedAt).toBeUndefined();
    expect(updates.finishedAt).toBeUndefined();
  });

  it('should set both startedAt when going directly to reading', () => {
    const updates = getStatusUpdates('reading', null);
    expect(updates.startedAt).toBe('SERVER_TIMESTAMP');
    expect(updates.finishedAt).toBeUndefined();
  });

  it('should only set finishedAt when going from reading to finished', () => {
    // This is the typical flow: reading -> finished
    const updates = getStatusUpdates('finished', 'reading');
    expect(updates.finishedAt).toBe('SERVER_TIMESTAMP');
    expect(updates.startedAt).toBeUndefined();
  });
});

describe('fillEmptyField', () => {
  it('should update when current value is empty and new value exists', () => {
    const result = fillEmptyField('', 'New Value');
    expect(result.updated).toBe(true);
    expect(result.value).toBe('New Value');
  });

  it('should update when current value is only whitespace', () => {
    const result = fillEmptyField('   ', 'New Value');
    expect(result.updated).toBe(true);
    expect(result.value).toBe('New Value');
  });

  it('should NOT update when current value already has content', () => {
    const result = fillEmptyField('Existing Value', 'New Value');
    expect(result.updated).toBe(false);
    expect(result.value).toBe('Existing Value');
  });

  it('should NOT update when new value is empty', () => {
    const result = fillEmptyField('', '');
    expect(result.updated).toBe(false);
    expect(result.value).toBe('');
  });

  it('should NOT update when new value is null/undefined', () => {
    const result1 = fillEmptyField('', null);
    expect(result1.updated).toBe(false);

    const result2 = fillEmptyField('', undefined);
    expect(result2.updated).toBe(false);
  });

  it('should preserve existing data even if new value is different', () => {
    const result = fillEmptyField('Scribner', 'Charles Scribner\'s Sons');
    expect(result.updated).toBe(false);
    expect(result.value).toBe('Scribner');
  });
});
