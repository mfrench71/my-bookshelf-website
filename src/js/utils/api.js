// API Utilities - Network requests and book APIs

import {
  normalizeTitle,
  normalizeAuthor,
  normalizePublisher,
  normalizePublishedDate,
  normalizeGenreName
} from './format.js';
import { getISBNCache, setISBNCache } from './cache.js';
import { parseHierarchicalGenres } from './genre-parser.js';
import { parseSeriesFromAPI } from './series-parser.js';

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

/**
 * Look up book data by ISBN from Google Books and Open Library APIs
 * Results are cached for 24 hours to reduce API calls
 * @param {string} isbn - ISBN to look up
 * @param {Object} options - Options
 * @param {boolean} options.skipCache - If true, skip cache and fetch fresh data
 * @returns {Promise<Object|null>} Book data or null if not found
 */
export async function lookupISBN(isbn, options = {}) {
  if (!isbn) return null;

  const { skipCache = false } = options;

  // Check cache first (unless skipCache is true)
  if (!skipCache) {
    const cached = getISBNCache(isbn);
    if (cached !== null) {
      // If cached result is missing physicalFormat or covers, refetch to get complete data
      if (cached && (!cached.physicalFormat || !cached.covers)) {
        // Return null to trigger a fresh fetch (cache will be updated)
        // This ensures we get covers from both APIs
      } else {
        return cached;
      }
    }
  }

  let result = null;
  let googleBooksCover = '';
  let openLibraryCover = '';

  // Try Google Books first
  try {
    const response = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );
    const data = await response.json();

    if (data.items?.length > 0) {
      const book = data.items[0].volumeInfo;
      googleBooksCover = book.imageLinks?.thumbnail?.replace('http:', 'https:') || '';
      result = {
        title: normalizeTitle(book.title || ''),
        author: normalizeAuthor(book.authors?.join(', ') || ''),
        coverImageUrl: googleBooksCover,
        publisher: normalizePublisher(book.publisher || ''),
        publishedDate: normalizePublishedDate(book.publishedDate),
        physicalFormat: '',
        pageCount: book.pageCount || null,
        genres: parseHierarchicalGenres(book.categories || [])
      };
    }
  } catch (e) {
    console.error('Google Books API error:', e);
  }

  // Try Open Library (as fallback or to supplement missing fields)
  try {
    const response = await fetchWithTimeout(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const data = await response.json();
    const book = data[`ISBN:${isbn}`];

    if (book) {
      // Parse all Open Library subjects (no limit)
      const olGenres = parseHierarchicalGenres(
        book.subjects?.map(s => s.name || s) || []
      );
      openLibraryCover = book.cover?.medium || '';

      if (result) {
        // Supplement missing fields from Open Library
        if (!result.publisher) result.publisher = normalizePublisher(book.publishers?.[0]?.name || '');
        if (!result.publishedDate) result.publishedDate = normalizePublishedDate(book.publish_date);
        if (!result.coverImageUrl) result.coverImageUrl = openLibraryCover;
        if (!result.pageCount && book.number_of_pages) result.pageCount = book.number_of_pages;
        // Merge Open Library genres with Google Books genres (deduplicate)
        if (olGenres.length > 0) {
          const existingNormalized = new Set(result.genres.map(g => normalizeGenreName(g)));
          olGenres.forEach(g => {
            if (!existingNormalized.has(normalizeGenreName(g))) {
              result.genres.push(g);
            }
          });
        }
      } else {
        // Use Open Library as primary source
        result = {
          title: normalizeTitle(book.title || ''),
          author: normalizeAuthor(book.authors?.map(a => a.name).join(', ') || ''),
          coverImageUrl: openLibraryCover,
          publisher: normalizePublisher(book.publishers?.[0]?.name || ''),
          publishedDate: normalizePublishedDate(book.publish_date),
          physicalFormat: '',
          pageCount: book.number_of_pages || null,
          genres: olGenres
        };
      }
    }
  } catch (e) {
    console.error('Open Library API error:', e);
  }

  // Add covers object with all available sources
  if (result) {
    result.covers = {};
    if (googleBooksCover) result.covers.googleBooks = googleBooksCover;
    if (openLibraryCover) result.covers.openLibrary = openLibraryCover;
  }

  // Try Open Library edition endpoint for physical_format, page count, and series (not in jscmd=data)
  if (result && (!result.physicalFormat || !result.pageCount || !result.seriesName)) {
    try {
      const editionResponse = await fetchWithTimeout(
        `https://openlibrary.org/isbn/${isbn}.json`
      );
      // Only parse if response is OK (ISBN exists in Open Library)
      if (editionResponse.ok) {
        const edition = await editionResponse.json();
        if (!result.physicalFormat && edition.physical_format) {
          // Normalize to title case to match select options (e.g., "paperback" -> "Paperback")
          result.physicalFormat = edition.physical_format
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
        if (!result.pageCount && edition.number_of_pages) {
          result.pageCount = edition.number_of_pages;
        }
        // Extract series information
        if (edition.series) {
          const seriesInfo = parseSeriesFromAPI(edition.series);
          if (seriesInfo) {
            result.seriesName = seriesInfo.name;
            result.seriesPosition = seriesInfo.position;
          }
        }
      }
      // 404 responses are expected for ISBNs not in Open Library - silently skip
    } catch (e) {
      // Network errors or timeouts - silently skip
    }
  }

  // Cache the result (including null for not found)
  setISBNCache(isbn, result);

  return result;
}

/**
 * Search for books by title/author from Google Books and Open Library APIs
 * @param {string} query - Search query (title and/or author)
 * @param {Object} options - Search options
 * @param {number} options.startIndex - Starting index for pagination (default: 0)
 * @param {number} options.maxResults - Max results to return (default: 10)
 * @param {boolean} options.useOpenLibrary - Force use of Open Library (default: false)
 * @returns {Promise<{books: Array, hasMore: boolean, totalItems: number, useOpenLibrary: boolean}>}
 */
export async function searchBooks(query, options = {}) {
  const { startIndex = 0, maxResults = 10, useOpenLibrary = false } = options;
  let books = [];
  let hasMore = false;
  let totalItems = 0;
  let shouldUseOpenLibrary = useOpenLibrary;

  // Try Google Books first (unless forcing Open Library)
  if (!useOpenLibrary) {
    try {
      const response = await fetchWithTimeout(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&startIndex=${startIndex}&maxResults=${maxResults}`
      );
      if (response.ok) {
        const data = await response.json();
        totalItems = data.totalItems || 0;
        if (data.items?.length > 0) {
          books = data.items.map(item => {
            const book = item.volumeInfo;
            return {
              title: normalizeTitle(book.title) || 'Unknown Title',
              author: normalizeAuthor(book.authors?.join(', ') || '') || 'Unknown Author',
              cover: book.imageLinks?.thumbnail?.replace('http:', 'https:') || '',
              publisher: normalizePublisher(book.publisher || ''),
              publishedDate: normalizePublishedDate(book.publishedDate),
              pageCount: book.pageCount || '',
              isbn: book.industryIdentifiers?.[0]?.identifier || '',
              categories: parseHierarchicalGenres(book.categories || [])
            };
          });
          hasMore = (startIndex + books.length) < totalItems;
        }
      } else {
        shouldUseOpenLibrary = true;
      }
    } catch (error) {
      console.warn('Google Books API failed:', error.message);
      shouldUseOpenLibrary = true;
    }
  }

  // Fallback to Open Library
  if (books.length === 0 && shouldUseOpenLibrary) {
    try {
      const response = await fetchWithTimeout(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&offset=${startIndex}&limit=${maxResults}`
      );
      if (response.ok) {
        const data = await response.json();
        totalItems = data.numFound || 0;
        if (data.docs?.length > 0) {
          books = data.docs.map(doc => ({
            title: normalizeTitle(doc.title) || 'Unknown Title',
            author: normalizeAuthor(doc.author_name?.join(', ') || '') || 'Unknown Author',
            cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '',
            publisher: normalizePublisher(doc.publisher?.[0] || ''),
            publishedDate: normalizePublishedDate(doc.first_publish_year),
            pageCount: doc.number_of_pages_median || '',
            isbn: doc.isbn?.[0] || '',
            categories: parseHierarchicalGenres(doc.subject || [])
          }));
          hasMore = (startIndex + books.length) < totalItems;
        }
      }
    } catch (error) {
      console.error('Open Library API failed:', error.message);
    }
  }

  return { books, hasMore, totalItems, useOpenLibrary: shouldUseOpenLibrary };
}
