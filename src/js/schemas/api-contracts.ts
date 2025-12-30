// API Contract Schemas
// Zod schemas for validating external API responses (Google Books, Open Library)

import { z } from '/js/vendor/zod.js';

// ============================================================================
// Google Books API
// https://developers.google.com/books/docs/v1/reference/volumes
// ============================================================================

/**
 * Google Books image links object
 */
export const GoogleBooksImageLinksSchema = z
  .object({
    thumbnail: z.string().optional(),
    small: z.string().optional(),
    medium: z.string().optional(),
    large: z.string().optional(),
    smallThumbnail: z.string().optional(),
    extraLarge: z.string().optional(),
  })
  .optional();

/**
 * Google Books volume info
 */
export const GoogleBooksVolumeInfoSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  authors: z.array(z.string()).optional(),
  publisher: z.string().optional(),
  publishedDate: z.string().optional(),
  description: z.string().optional(),
  pageCount: z.number().optional(),
  categories: z.array(z.string()).optional(),
  imageLinks: GoogleBooksImageLinksSchema,
  language: z.string().optional(),
  industryIdentifiers: z
    .array(
      z.object({
        type: z.string(),
        identifier: z.string(),
      })
    )
    .optional(),
});

/**
 * Google Books volume item
 */
export const GoogleBooksVolumeSchema = z.object({
  id: z.string(),
  volumeInfo: GoogleBooksVolumeInfoSchema,
});

/**
 * Google Books API response (volumes endpoint)
 */
export const GoogleBooksResponseSchema = z.object({
  kind: z.string().optional(),
  totalItems: z.number().optional(),
  items: z.array(GoogleBooksVolumeSchema).optional(),
});

// ============================================================================
// Open Library API
// https://openlibrary.org/dev/docs/api/books
// ============================================================================

/**
 * Open Library cover object
 */
export const OpenLibraryCoverSchema = z
  .object({
    small: z.string().optional(),
    medium: z.string().optional(),
    large: z.string().optional(),
  })
  .optional();

/**
 * Open Library author object
 */
export const OpenLibraryAuthorSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});

/**
 * Open Library publisher object
 */
export const OpenLibraryPublisherSchema = z.object({
  name: z.string(),
});

/**
 * Open Library subject object
 */
export const OpenLibrarySubjectSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    url: z.string().optional(),
  }),
]);

/**
 * Open Library book data (jscmd=data response)
 */
export const OpenLibraryBookDataSchema = z
  .object({
    title: z.string().optional(),
    authors: z.array(OpenLibraryAuthorSchema).optional(),
    publishers: z.array(OpenLibraryPublisherSchema).optional(),
    publish_date: z.string().optional(),
    number_of_pages: z.number().optional(),
    subjects: z.array(OpenLibrarySubjectSchema).optional(),
    cover: OpenLibraryCoverSchema,
    url: z.string().optional(),
    identifiers: z.record(z.array(z.string())).optional(),
  })
  .passthrough();

/**
 * Open Library books API response (jscmd=data)
 * Response is keyed by ISBN, e.g., { "ISBN:9780123456789": { ... } }
 */
export const OpenLibraryBooksResponseSchema = z.record(z.string(), OpenLibraryBookDataSchema);

/**
 * Open Library edition endpoint response (/isbn/{isbn}.json)
 */
export const OpenLibraryEditionSchema = z.object({
  title: z.string().optional(),
  physical_format: z.string().optional(),
  number_of_pages: z.number().optional(),
  series: z.array(z.string()).optional(),
  publishers: z.array(z.string()).optional(),
  publish_date: z.string().optional(),
  covers: z.array(z.number()).optional(),
  works: z.array(z.object({ key: z.string() })).optional(),
});

/**
 * Open Library search result document
 */
export const OpenLibrarySearchDocSchema = z.object({
  key: z.string(),
  title: z.string().optional(),
  author_name: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  cover_i: z.number().optional(),
  isbn: z.array(z.string()).optional(),
  publisher: z.array(z.string()).optional(),
  number_of_pages_median: z.number().optional(),
});

/**
 * Open Library search API response
 */
export const OpenLibrarySearchResponseSchema = z.object({
  numFound: z.number(),
  start: z.number(),
  docs: z.array(OpenLibrarySearchDocSchema),
});

// ============================================================================
// Internal Book Data (normalized from APIs)
// ============================================================================

/**
 * Normalized book data returned by lookupISBN
 */
export const NormalizedBookDataSchema = z.object({
  title: z.string(),
  author: z.string(),
  coverImageUrl: z.string(),
  publisher: z.string(),
  publishedDate: z.string().nullable(),
  physicalFormat: z.string(),
  pageCount: z.number().nullable(),
  genres: z.array(z.string()),
  covers: z
    .object({
      googleBooks: z.string().optional(),
      openLibrary: z.string().optional(),
    })
    .optional(),
  seriesName: z.string().optional(),
  seriesPosition: z.number().nullable().optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type GoogleBooksImageLinks = z.infer<typeof GoogleBooksImageLinksSchema>;
export type GoogleBooksVolumeInfo = z.infer<typeof GoogleBooksVolumeInfoSchema>;
export type GoogleBooksVolume = z.infer<typeof GoogleBooksVolumeSchema>;
export type GoogleBooksResponse = z.infer<typeof GoogleBooksResponseSchema>;

export type OpenLibraryCover = z.infer<typeof OpenLibraryCoverSchema>;
export type OpenLibraryAuthor = z.infer<typeof OpenLibraryAuthorSchema>;
export type OpenLibraryBookData = z.infer<typeof OpenLibraryBookDataSchema>;
export type OpenLibraryBooksResponse = z.infer<typeof OpenLibraryBooksResponseSchema>;
export type OpenLibraryEdition = z.infer<typeof OpenLibraryEditionSchema>;
export type OpenLibrarySearchDoc = z.infer<typeof OpenLibrarySearchDocSchema>;
export type OpenLibrarySearchResponse = z.infer<typeof OpenLibrarySearchResponseSchema>;

export type NormalizedBookData = z.infer<typeof NormalizedBookDataSchema>;
