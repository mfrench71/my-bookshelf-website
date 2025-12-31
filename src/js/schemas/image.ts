// Image Validation Schema
// Zod schema for book image metadata

import { z } from '/js/vendor/zod.js';

/** Image data structure */
export interface ImageData {
  id: string;
  url: string;
  storagePath: string;
  isPrimary: boolean;
  caption?: string;
  uploadedAt: number;
  sizeBytes?: number;
  width?: number;
  height?: number;
}

/** Validation result for primary image check */
interface PrimaryImageValidation {
  valid: boolean;
  error?: string;
}

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
  height: z.number().positive().optional(),
});

/**
 * Schema for array of book images (max 10)
 */
export const ImagesArraySchema = z.array(ImageSchema).max(10, 'Maximum 10 images per book').default([]);

/**
 * Schema for creating a new image (from upload result)
 */
export const CreateImageSchema = z
  .object({
    id: z.string().min(1),
    url: z.string().url(),
    storagePath: z.string().min(1),
    isPrimary: z.boolean().default(false),
    caption: z.string().max(200).optional(),
    sizeBytes: z.number().positive().optional(),
    width: z.number().positive().optional(),
    height: z.number().positive().optional(),
  })
  .transform(data => ({
    ...data,
    uploadedAt: Date.now(),
  }));

/**
 * Schema for updating image caption
 */
export const UpdateImageCaptionSchema = z.object({
  caption: z.string().max(200, 'Caption must be 200 characters or less').optional(),
});

/**
 * Validate that only one image is marked as primary
 * @param images - Array of image objects
 * @returns Validation result
 */
export function validatePrimaryImage(images: ImageData[] | null | undefined): PrimaryImageValidation {
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
 * @param images - Array of image objects
 * @param imageId - ID of image to set as primary
 * @returns Updated images array
 */
export function setPrimaryImage(images: ImageData[], imageId: string): ImageData[] {
  return images.map(img => ({
    ...img,
    isPrimary: img.id === imageId,
  }));
}

/**
 * Get the primary image from array
 * @param images - Array of image objects
 * @returns Primary image or null
 */
export function getPrimaryImage(images: ImageData[] | null | undefined): ImageData | null {
  if (!images || images.length === 0) return null;
  return images.find(img => img.isPrimary) || null;
}

/** Inferred type from ImageSchema */
export type Image = z.infer<typeof ImageSchema>;
