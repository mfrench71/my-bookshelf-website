// Wishlist Item Validation Schema
import { z } from '/js/vendor/zod.js';

/**
 * Schema for validating wishlist item data
 * Wishlist items are books the user wants to buy but doesn't own yet
 */
export const WishlistItemSchema = z.object({
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
    .or(z.literal(''))
    .transform(s => s || null),

  coverImageUrl: z.string()
    .url('Invalid cover image URL')
    .optional()
    .or(z.literal(''))
    .transform(s => s || null),

  // Cover options from APIs
  covers: z.object({
    googleBooks: z.string().url().optional().or(z.literal('')),
    openLibrary: z.string().url().optional().or(z.literal(''))
  }).optional().nullable(),

  publisher: z.string()
    .max(200, 'Publisher must be 200 characters or less')
    .optional()
    .transform(s => s?.trim() || null),

  publishedDate: z.string()
    .max(50, 'Published date must be 50 characters or less')
    .optional()
    .transform(s => s?.trim() || null),

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
  ]).optional().default(null),

  priority: z.enum(['high', 'medium', 'low'])
    .optional()
    .nullable()
    .default(null),

  notes: z.string()
    .max(2000, 'Notes must be 2000 characters or less')
    .optional()
    .transform(s => s?.trim() || null),

  addedFrom: z.enum(['search', 'isbn', 'manual'])
    .optional()
    .default('manual')
});

/**
 * Schema for wishlist item form input
 * More lenient - accepts string inputs that get transformed
 */
export const WishlistItemFormSchema = WishlistItemSchema.extend({
  pageCount: z.string()
    .optional()
    .transform((val) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) return null;
      return num;
    })
});

/**
 * Partial schema for updating specific fields
 */
export const WishlistItemUpdateSchema = WishlistItemSchema.partial();
