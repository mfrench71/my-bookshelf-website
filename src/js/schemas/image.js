// Image Validation Schema
// Zod schema for book image metadata

import { z } from '/js/vendor/zod.js';

/**
 * Schema for a single book image
 */
export const ImageSchema = z.object({
  id: z.string().min(1, 'Image ID is required'),
  url: z.string().url('Invalid image URL'),
  storagePath: z.string().min(1, 'Storage path is required'),
  isPrimary: z.boolean().default(false),
  caption: z.string().max(200, 'Caption must be 200 characters or less').optional(),
  uploadedAt: z.number().positive('Invalid upload timestamp'),
  sizeBytes: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional()
});

/**
 * Schema for array of book images (max 10)
 */
export const ImagesArraySchema = z.array(ImageSchema).max(10, 'Maximum 10 images per book').default([]);

/**
 * Schema for creating a new image (from upload result)
 */
export const CreateImageSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  storagePath: z.string().min(1),
  isPrimary: z.boolean().default(false),
  caption: z.string().max(200).optional(),
  sizeBytes: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional()
}).transform((data) => ({
  ...data,
  uploadedAt: Date.now()
}));

/**
 * Schema for updating image caption
 */
export const UpdateImageCaptionSchema = z.object({
  caption: z.string().max(200, 'Caption must be 200 characters or less').optional()
});

/**
 * Validate that only one image is marked as primary
 * @param {Array} images - Array of image objects
 * @returns {{valid: boolean, error?: string}}
 */
export function validatePrimaryImage(images) {
  if (!images || images.length === 0) {
    return { valid: true };
  }

  const primaryCount = images.filter(img => img.isPrimary).length;

  if (primaryCount > 1) {
    return { valid: false, error: 'Only one image can be marked as primary' };
  }

  return { valid: true };
}

/**
 * Set an image as primary, unsetting others
 * @param {Array} images - Array of image objects
 * @param {string} imageId - ID of image to set as primary
 * @returns {Array} Updated images array
 */
export function setPrimaryImage(images, imageId) {
  return images.map(img => ({
    ...img,
    isPrimary: img.id === imageId
  }));
}

/**
 * Get the primary image from array
 * @param {Array} images - Array of image objects
 * @returns {Object|null} Primary image or null
 */
export function getPrimaryImage(images) {
  if (!images || images.length === 0) return null;
  return images.find(img => img.isPrimary) || null;
}
