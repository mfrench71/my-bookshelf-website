// Book Validation Schema
import { z } from '../vendor/zod.js';

/**
 * Schema for validating book data
 * Used for both adding new books and editing existing ones
 */
export const BookSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or less')
    .transform(s => s.trim()),

  author: z.string()
    .min(1, 'Author is required')
    .max(500, 'Author must be 500 characters or less')
    .transform(s => s.trim()),

  isbn: z.string()
    .regex(/^(\d{10}|\d{13})?$/, 'ISBN must be 10 or 13 digits')
    .optional()
    .or(z.literal('')),

  coverImageUrl: z.string()
    .url('Invalid cover image URL')
    .optional()
    .or(z.literal('')),

  publisher: z.string()
    .max(200, 'Publisher must be 200 characters or less')
    .optional()
    .transform(s => s?.trim() || ''),

  publishedDate: z.string()
    .max(50, 'Published date must be 50 characters or less')
    .optional()
    .transform(s => s?.trim() || ''),

  physicalFormat: z.enum([
    '',
    'Paperback',
    'Hardcover',
    'Mass Market Paperback',
    'Trade Paperback',
    'Library Binding',
    'Spiral-bound',
    'Audio CD',
    'Ebook'
  ]).optional(),

  pageCount: z.union([
    z.number().int().positive('Page count must be a positive number'),
    z.string().transform((val, ctx) => {
      if (val === '') return null;
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Page count must be a positive number'
        });
        return z.NEVER;
      }
      return num;
    }),
    z.null()
  ]).optional(),

  rating: z.union([
    z.number().int().min(0).max(5).transform(val => val === 0 ? null : val),
    z.null()
  ]).optional(),

  genres: z.array(z.string()).optional().default([]),

  // Series reference (links to /users/{userId}/series/{seriesId})
  seriesId: z.string()
    .max(100, 'Series ID must be 100 characters or less')
    .nullable()
    .optional(),

  seriesPosition: z.union([
    z.number().positive('Series position must be a positive number'),
    z.null()
  ]).optional(),

  notes: z.string()
    .max(5000, 'Notes must be 5000 characters or less')
    .optional()
    .transform(s => s?.trim() || ''),

  // Reading tracking
  reads: z.array(z.object({
    startedAt: z.string().nullable().optional(),
    finishedAt: z.string().nullable().optional()
  })).optional().default([]),

  // Cover options from APIs
  covers: z.object({
    googleBooks: z.string().url().optional().or(z.literal('')),
    openLibrary: z.string().url().optional().or(z.literal(''))
  }).optional()
});

/**
 * Schema for book form input (before transformation)
 * More lenient - accepts string inputs that get transformed
 */
export const BookFormSchema = BookSchema.extend({
  pageCount: z.string()
    .optional()
    .transform((val, ctx) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Page count must be a positive number'
        });
        return z.NEVER;
      }
      return num;
    }),

  rating: z.union([
    z.number().int().min(0).max(5).transform(val => val === 0 ? null : val),
    z.string().transform((val) => val === '' ? null : parseInt(val, 10)),
    z.null()
  ]).optional()
});

/**
 * Partial schema for updating specific fields
 */
export const BookUpdateSchema = BookSchema.partial();
