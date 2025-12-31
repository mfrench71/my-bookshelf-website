// Genre Validation Schema
import { z } from '/js/vendor/zod.js';
import { GENRE_COLORS } from '../genres.js';

/** Genre data structure */
interface Genre {
  id: string;
  name: string;
  color: string;
}

/**
 * Schema for validating genre data
 * - name: required for both add and edit
 * - color: optional for add (auto-assigned), required for edit
 */
export const GenreSchema = z.object({
  name: z
    .string()
    .min(1, 'Genre name is required')
    .max(50, 'Genre name must be 50 characters or less')
    .transform(s => s.trim())
    .refine(name => name.length > 0, 'Genre name cannot be only whitespace'),

  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid colour format')
    .refine(
      color => GENRE_COLORS.map(c => c.toLowerCase()).includes(color.toLowerCase()),
      'Please select a colour from the palette'
    )
    .optional(),
});

/**
 * Schema for creating a new genre (validates uniqueness separately)
 */
export const CreateGenreSchema = GenreSchema;

/**
 * Schema for updating an existing genre
 */
export const UpdateGenreSchema = GenreSchema.partial();

/**
 * Helper to validate genre name is unique
 * @param name - Genre name to check
 * @param existingGenres - Array of existing genre objects
 * @param excludeId - Genre ID to exclude (for updates)
 * @returns Error message or null if valid
 */
export function validateGenreUniqueness(
  name: string,
  existingGenres: Genre[],
  excludeId: string | null = null
): string | null {
  const normalizedName = name.trim().toLowerCase();
  const duplicate = existingGenres.find(g => g.name.toLowerCase() === normalizedName && g.id !== excludeId);

  if (duplicate) {
    return 'A genre with this name already exists';
  }

  return null;
}

/**
 * Helper to validate colour is not already in use
 * @param color - Colour to check
 * @param existingGenres - Array of existing genre objects
 * @param excludeId - Genre ID to exclude (for updates)
 * @returns Error message or null if valid
 */
export function validateColourUniqueness(
  color: string,
  existingGenres: Genre[],
  excludeId: string | null = null
): string | null {
  const normalizedColor = color.toLowerCase();
  const duplicate = existingGenres.find(g => g.color.toLowerCase() === normalizedColor && g.id !== excludeId);

  if (duplicate) {
    return 'This colour is already in use';
  }

  return null;
}

/** Inferred type from GenreSchema */
export type GenreData = z.infer<typeof GenreSchema>;
