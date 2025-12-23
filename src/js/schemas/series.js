// Series Validation Schema
import { z } from '../vendor/zod.js';

/**
 * Schema for expected book entries (books user doesn't own yet)
 */
export const ExpectedBookSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(500, 'Title must be 500 characters or less')
    .transform(s => s.trim()),

  isbn: z.string()
    .regex(/^(\d{10}|\d{13})?$/, 'ISBN must be 10 or 13 digits')
    .nullable()
    .optional()
    .or(z.literal('')),

  position: z.union([
    z.number().positive('Position must be a positive number'),
    z.null()
  ]).optional(),

  source: z.enum(['api', 'manual']).default('manual')
});

/**
 * Schema for validating series data
 */
export const SeriesSchema = z.object({
  name: z.string()
    .min(1, 'Series name is required')
    .max(200, 'Series name must be 200 characters or less')
    .transform(s => s.trim()),

  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .nullable()
    .optional()
    .transform(s => s?.trim() || null),

  totalBooks: z.union([
    z.number().int().positive('Total books must be a positive number'),
    z.string().transform((val, ctx) => {
      if (val === '') return null;
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Total books must be a positive number'
        });
        return z.NEVER;
      }
      return num;
    }),
    z.null()
  ]).optional(),

  expectedBooks: z.array(ExpectedBookSchema).optional().default([])
});

/**
 * Schema for series form input
 */
export const SeriesFormSchema = SeriesSchema.extend({
  totalBooks: z.string()
    .optional()
    .transform((val, ctx) => {
      if (!val || val === '') return null;
      const num = parseInt(val, 10);
      if (isNaN(num) || num <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Total books must be a positive number'
        });
        return z.NEVER;
      }
      return num;
    })
});

/**
 * Partial schema for updating specific fields
 */
export const SeriesUpdateSchema = SeriesSchema.partial();
