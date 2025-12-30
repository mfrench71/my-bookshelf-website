// API Contract Tests
// Validates external API response shapes against Zod schemas

import { describe, it, expect } from 'vitest';
import {
  GoogleBooksResponseSchema,
  GoogleBooksVolumeInfoSchema,
  OpenLibraryBooksResponseSchema,
  OpenLibraryEditionSchema,
  OpenLibrarySearchResponseSchema,
  NormalizedBookDataSchema,
} from '../src/js/schemas/api-contracts.js';

describe('API Contract Schemas', () => {
  describe('GoogleBooksResponseSchema', () => {
    it('should validate empty response', () => {
      const response = {
        kind: 'books#volumes',
        totalItems: 0,
      };
      const result = GoogleBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate response with items', () => {
      const response = {
        kind: 'books#volumes',
        totalItems: 1,
        items: [
          {
            id: 'abc123',
            volumeInfo: {
              title: 'Test Book',
              authors: ['Test Author'],
              publisher: 'Test Publisher',
              publishedDate: '2024-01-01',
              pageCount: 300,
              categories: ['Fiction', 'Fantasy'],
              imageLinks: {
                thumbnail: 'https://example.com/thumb.jpg',
                small: 'https://example.com/small.jpg',
              },
            },
          },
        ],
      };
      const result = GoogleBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate minimal volume info', () => {
      const volumeInfo = {
        title: 'Minimal Book',
      };
      const result = GoogleBooksVolumeInfoSchema.safeParse(volumeInfo);
      expect(result.success).toBe(true);
    });

    it('should validate all image link sizes', () => {
      const volumeInfo = {
        title: 'Book with All Images',
        imageLinks: {
          smallThumbnail: 'https://example.com/smallThumb.jpg',
          thumbnail: 'https://example.com/thumb.jpg',
          small: 'https://example.com/small.jpg',
          medium: 'https://example.com/medium.jpg',
          large: 'https://example.com/large.jpg',
          extraLarge: 'https://example.com/extraLarge.jpg',
        },
      };
      const result = GoogleBooksVolumeInfoSchema.safeParse(volumeInfo);
      expect(result.success).toBe(true);
    });

    it('should validate industry identifiers', () => {
      const volumeInfo = {
        title: 'Book with ISBNs',
        industryIdentifiers: [
          { type: 'ISBN_10', identifier: '0123456789' },
          { type: 'ISBN_13', identifier: '9780123456789' },
        ],
      };
      const result = GoogleBooksVolumeInfoSchema.safeParse(volumeInfo);
      expect(result.success).toBe(true);
    });
  });

  describe('OpenLibraryBooksResponseSchema', () => {
    it('should validate empty response', () => {
      const response = {};
      const result = OpenLibraryBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate response with book data', () => {
      const response = {
        'ISBN:9780123456789': {
          title: 'Test Book',
          authors: [{ name: 'Test Author', url: '/authors/OL123A' }],
          publishers: [{ name: 'Test Publisher' }],
          publish_date: '2024',
          number_of_pages: 300,
          subjects: [
            { name: 'Fiction', url: '/subjects/fiction' },
            'Fantasy',
          ],
          cover: {
            small: 'https://covers.openlibrary.org/b/id/123-S.jpg',
            medium: 'https://covers.openlibrary.org/b/id/123-M.jpg',
            large: 'https://covers.openlibrary.org/b/id/123-L.jpg',
          },
        },
      };
      const result = OpenLibraryBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate book with minimal data', () => {
      const response = {
        'ISBN:9780123456789': {
          title: 'Minimal Book',
        },
      };
      const result = OpenLibraryBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should handle multiple ISBN keys', () => {
      const response = {
        'ISBN:9780123456789': { title: 'Book 1' },
        'ISBN:9780987654321': { title: 'Book 2' },
      };
      const result = OpenLibraryBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('OpenLibraryEditionSchema', () => {
    it('should validate edition data', () => {
      const edition = {
        title: 'Test Book',
        physical_format: 'Hardcover',
        number_of_pages: 350,
        series: ['Series Name'],
        publishers: ['Publisher Name'],
        publish_date: 'Jan 2024',
        covers: [12345, 67890],
        works: [{ key: '/works/OL123W' }],
      };
      const result = OpenLibraryEditionSchema.safeParse(edition);
      expect(result.success).toBe(true);
    });

    it('should validate minimal edition', () => {
      const edition = {};
      const result = OpenLibraryEditionSchema.safeParse(edition);
      expect(result.success).toBe(true);
    });

    it('should validate edition with series', () => {
      const edition = {
        title: 'Book in Series',
        series: ['The Series Name', 'Volume 1'],
      };
      const result = OpenLibraryEditionSchema.safeParse(edition);
      expect(result.success).toBe(true);
    });
  });

  describe('OpenLibrarySearchResponseSchema', () => {
    it('should validate search response', () => {
      const response = {
        numFound: 100,
        start: 0,
        docs: [
          {
            key: '/works/OL123W',
            title: 'Test Book',
            author_name: ['Test Author'],
            first_publish_year: 2020,
            cover_i: 12345,
            isbn: ['9780123456789', '0123456789'],
            publisher: ['Test Publisher'],
            number_of_pages_median: 300,
          },
        ],
      };
      const result = OpenLibrarySearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate empty search response', () => {
      const response = {
        numFound: 0,
        start: 0,
        docs: [],
      };
      const result = OpenLibrarySearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate minimal doc', () => {
      const response = {
        numFound: 1,
        start: 0,
        docs: [{ key: '/works/OL123W' }],
      };
      const result = OpenLibrarySearchResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('NormalizedBookDataSchema', () => {
    it('should validate full book data', () => {
      const bookData = {
        title: 'Test Book',
        author: 'Test Author',
        coverImageUrl: 'https://example.com/cover.jpg',
        publisher: 'Test Publisher',
        publishedDate: '2024',
        physicalFormat: 'Hardcover',
        pageCount: 350,
        genres: ['Fiction', 'Fantasy'],
        covers: {
          googleBooks: 'https://books.google.com/cover.jpg',
          openLibrary: 'https://covers.openlibrary.org/cover.jpg',
        },
        seriesName: 'Test Series',
        seriesPosition: 1,
      };
      const result = NormalizedBookDataSchema.safeParse(bookData);
      expect(result.success).toBe(true);
    });

    it('should validate minimal book data', () => {
      const bookData = {
        title: 'Minimal Book',
        author: '',
        coverImageUrl: '',
        publisher: '',
        publishedDate: null,
        physicalFormat: '',
        pageCount: null,
        genres: [],
      };
      const result = NormalizedBookDataSchema.safeParse(bookData);
      expect(result.success).toBe(true);
    });

    it('should require title', () => {
      const bookData = {
        author: 'Test Author',
        coverImageUrl: '',
        publisher: '',
        publishedDate: null,
        physicalFormat: '',
        pageCount: null,
        genres: [],
      };
      const result = NormalizedBookDataSchema.safeParse(bookData);
      expect(result.success).toBe(false);
    });

    it('should validate optional covers object', () => {
      const bookData = {
        title: 'Book',
        author: 'Author',
        coverImageUrl: '',
        publisher: '',
        publishedDate: null,
        physicalFormat: '',
        pageCount: null,
        genres: [],
        covers: {
          googleBooks: 'https://example.com/google.jpg',
        },
      };
      const result = NormalizedBookDataSchema.safeParse(bookData);
      expect(result.success).toBe(true);
    });

    it('should validate null series position', () => {
      const bookData = {
        title: 'Book',
        author: 'Author',
        coverImageUrl: '',
        publisher: '',
        publishedDate: null,
        physicalFormat: '',
        pageCount: null,
        genres: [],
        seriesName: 'Series',
        seriesPosition: null,
      };
      const result = NormalizedBookDataSchema.safeParse(bookData);
      expect(result.success).toBe(true);
    });
  });

  describe('Schema edge cases', () => {
    it('should reject invalid Google Books response', () => {
      const response = {
        items: 'not an array',
      };
      const result = GoogleBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should reject Google Books volume without id', () => {
      const response = {
        items: [{ volumeInfo: { title: 'Test' } }],
      };
      const result = GoogleBooksResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should reject Open Library search without numFound', () => {
      const response = {
        start: 0,
        docs: [],
      };
      const result = OpenLibrarySearchResponseSchema.safeParse(response);
      expect(result.success).toBe(false);
    });

    it('should reject NormalizedBookData with invalid genres', () => {
      const bookData = {
        title: 'Book',
        author: 'Author',
        coverImageUrl: '',
        publisher: '',
        publishedDate: null,
        physicalFormat: '',
        pageCount: null,
        genres: 'not an array',
      };
      const result = NormalizedBookDataSchema.safeParse(bookData);
      expect(result.success).toBe(false);
    });
  });
});
