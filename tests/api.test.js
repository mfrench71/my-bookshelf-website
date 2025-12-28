/**
 * Unit tests for src/js/utils/api.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock cache
vi.mock('../src/js/utils/cache.js', () => ({
  getISBNCache: vi.fn(),
  setISBNCache: vi.fn()
}));

// Mock format
vi.mock('../src/js/utils/format.js', () => ({
  normalizeTitle: vi.fn(s => s?.trim() || ''),
  normalizeAuthor: vi.fn(s => s?.trim() || ''),
  normalizePublisher: vi.fn(s => s?.trim() || ''),
  normalizePublishedDate: vi.fn(s => s || ''),
  normalizeGenreName: vi.fn(s => s?.toLowerCase().replace(/\s+/g, '') || '')
}));

// Mock genre-parser
vi.mock('../src/js/utils/genre-parser.js', () => ({
  parseHierarchicalGenres: vi.fn(arr => arr || [])
}));

// Mock series-parser
vi.mock('../src/js/utils/series-parser.js', () => ({
  parseSeriesFromAPI: vi.fn(() => null)
}));

import { getISBNCache, setISBNCache } from '../src/js/utils/cache.js';
import { parseSeriesFromAPI } from '../src/js/utils/series-parser.js';
import { fetchWithTimeout, lookupISBN, searchBooks } from '../src/js/utils/api.js';

describe('api utilities', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('fetchWithTimeout', () => {
    it('should return response on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => ({}) });

      const response = await fetchWithTimeout('https://example.com');

      expect(response.ok).toBe(true);
    });

    it('should throw timeout error when request times out', async () => {
      global.fetch = vi.fn().mockImplementation(() =>
        new Promise((_, reject) => {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 50);
        })
      );

      await expect(fetchWithTimeout('https://example.com', {}, 10))
        .rejects.toThrow('Request timed out');
    });

    it('should propagate other errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchWithTimeout('https://example.com'))
        .rejects.toThrow('Network error');
    });
  });

  describe('lookupISBN', () => {
    const mockGoogleBooksResponse = {
      items: [{
        volumeInfo: {
          title: 'Test Book',
          authors: ['Test Author'],
          publisher: 'Test Publisher',
          publishedDate: '2020-01-01',
          pageCount: 300,
          categories: ['Fiction'],
          imageLinks: { large: 'https://example.com/cover.jpg' }
        }
      }]
    };

    const mockOpenLibraryResponse = {
      'ISBN:9780123456789': {
        title: 'OL Test Book',
        authors: [{ name: 'OL Author' }],
        publishers: [{ name: 'OL Publisher' }],
        publish_date: '2020',
        number_of_pages: 250,
        subjects: [{ name: 'Fantasy' }],
        cover: { large: 'https://covers.openlibrary.org/cover.jpg' }
      }
    };

    it('should return null for empty ISBN', async () => {
      const result = await lookupISBN('');
      expect(result).toBeNull();
    });

    it('should return cached result if available', async () => {
      const cachedData = {
        title: 'Cached Book',
        physicalFormat: 'Hardcover',
        covers: { googleBooks: 'http://example.com' }
      };
      getISBNCache.mockReturnValue(cachedData);
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const result = await lookupISBN('9780123456789');

      expect(result).toEqual(cachedData);
      expect(mockFetch).not.toHaveBeenCalled(); // fetch not called
    });

    it('should skip cache when skipCache is true', async () => {
      getISBNCache.mockReturnValue({ title: 'Cached' });
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGoogleBooksResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: false
        });

      const result = await lookupISBN('9780123456789', { skipCache: true });

      expect(result.title).toBe('Test Book');
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should fetch from Google Books and Open Library', async () => {
      getISBNCache.mockReturnValue(null);
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGoogleBooksResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOpenLibraryResponse)
        })
        .mockResolvedValueOnce({
          ok: false // edition endpoint fails
        });

      const result = await lookupISBN('9780123456789');

      expect(result).not.toBeNull();
      expect(result.title).toBe('Test Book');
      expect(result.author).toBe('Test Author');
      expect(result.covers.googleBooks).toBe('https://example.com/cover.jpg');
      expect(setISBNCache).toHaveBeenCalled();
    });

    it('should use Open Library as primary when Google Books fails', async () => {
      getISBNCache.mockReturnValue(null);
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }) // No Google results
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOpenLibraryResponse)
        })
        .mockResolvedValueOnce({
          ok: false
        });

      const result = await lookupISBN('9780123456789');

      expect(result.title).toBe('OL Test Book');
    });

    it('should handle edition endpoint for physical format', async () => {
      getISBNCache.mockReturnValue(null);
      // Mock Google response without page count so edition can provide it
      const googleResponseNoPageCount = {
        items: [{
          volumeInfo: {
            title: 'Test Book',
            authors: ['Test Author'],
            publisher: 'Test Publisher',
            publishedDate: '2020-01-01',
            categories: ['Fiction'],
            imageLinks: { large: 'https://example.com/cover.jpg' }
          }
        }]
      };
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(googleResponseNoPageCount)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            physical_format: 'hardcover',
            number_of_pages: 400
          })
        });

      const result = await lookupISBN('9780123456789');

      expect(result.physicalFormat).toBe('Hardcover');
      expect(result.pageCount).toBe(400);
    });

    it('should parse series from edition endpoint', async () => {
      getISBNCache.mockReturnValue(null);
      parseSeriesFromAPI.mockReturnValue({ name: 'Test Series', position: 1 });
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGoogleBooksResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            series: ['Test Series #1']
          })
        });

      const result = await lookupISBN('9780123456789');

      expect(result.seriesName).toBe('Test Series');
      expect(result.seriesPosition).toBe(1);
    });

    it('should handle API errors gracefully', async () => {
      getISBNCache.mockReturnValue(null);
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await lookupISBN('9780123456789');

      expect(result).toBeNull();
      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    it('should refetch if cached result missing physicalFormat', async () => {
      getISBNCache.mockReturnValue({ title: 'Cached', covers: {} }); // missing physicalFormat
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockGoogleBooksResponse)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: false
        });

      const result = await lookupISBN('9780123456789');

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('searchBooks', () => {
    const mockGoogleSearchResponse = {
      totalItems: 100,
      items: [{
        volumeInfo: {
          title: 'Search Result',
          authors: ['Author'],
          publisher: 'Publisher',
          publishedDate: '2021',
          pageCount: 200,
          industryIdentifiers: [{ identifier: '9780123456789' }],
          categories: ['Fiction'],
          imageLinks: { thumbnail: 'https://example.com/thumb.jpg' }
        }
      }]
    };

    const mockOpenLibrarySearchResponse = {
      numFound: 50,
      docs: [{
        title: 'OL Search Result',
        author_name: ['OL Author'],
        publisher: ['OL Publisher'],
        first_publish_year: 2019,
        number_of_pages_median: 180,
        isbn: ['9780987654321'],
        subject: ['Fantasy'],
        cover_i: 12345
      }]
    };

    it('should search Google Books by default', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGoogleSearchResponse)
      });

      const result = await searchBooks('test query');

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe('Search Result');
      expect(result.totalItems).toBe(100);
      expect(result.useOpenLibrary).toBe(false);
    });

    it('should use Open Library when specified', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenLibrarySearchResponse)
      });

      const result = await searchBooks('test query', { useOpenLibrary: true });

      expect(result.books).toHaveLength(1);
      expect(result.books[0].title).toBe('OL Search Result');
      expect(result.useOpenLibrary).toBe(true);
    });

    it('should fallback to Open Library when Google fails', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false }) // Google fails
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockOpenLibrarySearchResponse)
        });

      const result = await searchBooks('test query');

      expect(result.books[0].title).toBe('OL Search Result');
      expect(result.useOpenLibrary).toBe(true);
    });

    it('should handle pagination', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          totalItems: 50,
          items: Array(10).fill(mockGoogleSearchResponse.items[0])
        })
      });

      const result = await searchBooks('test', { startIndex: 10, maxResults: 10 });

      expect(result.hasMore).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('startIndex=10'),
        expect.any(Object)
      );
    });

    it('should handle empty results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ totalItems: 0, items: [] })
      });

      const result = await searchBooks('nonexistent book');

      expect(result.books).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await searchBooks('test');

      expect(result.books).toHaveLength(0);
      consoleSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should format Open Library cover URLs correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockOpenLibrarySearchResponse)
      });

      const result = await searchBooks('test', { useOpenLibrary: true });

      expect(result.books[0].cover).toBe('https://covers.openlibrary.org/b/id/12345-M.jpg');
    });
  });
});
