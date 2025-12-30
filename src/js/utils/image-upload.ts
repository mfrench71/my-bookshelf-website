// Image Upload Utilities
// Firebase Storage upload, compression, and validation for book images

import { storage } from '../firebase-config.js';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

/** Image validation result */
interface ValidationResult {
  valid: boolean;
  error?: string;
}

/** Image dimensions */
interface ImageDimensions {
  width: number;
  height: number;
}

/** Compression result */
interface CompressionResult {
  blob: Blob;
  mimeType: string;
  extension: string;
}

/** Compression options */
interface CompressionOptions {
  maxWidth?: number;
  quality?: number;
}

/** Upload result */
interface UploadResult {
  id: string;
  url: string;
  storagePath: string;
  sizeBytes: number;
  width: number;
  height: number;
}

/** Progress callback type */
type ProgressCallback = (progress: number) => void;

/** Image with storage path */
interface ImageWithStoragePath {
  storagePath: string;
}

// Configuration
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const DEFAULT_MAX_WIDTH = 1200; // Good for lightbox viewing
const DEFAULT_QUALITY = 0.75; // Balance between quality and size

// Check WebP support (better compression than JPEG)
const supportsWebP = ((): boolean => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
})();

/**
 * Generate a unique ID for image storage
 * @returns UUID-like string
 */
function generateImageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate image file before upload
 * @param file - File to validate
 * @returns Validation result
 */
export function validateImage(file: File | null | undefined): ValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Please use JPG, PNG, WebP, or GIF.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return { valid: false, error: `File too large (${sizeMB}MB). Maximum size is 5MB.` };
  }

  return { valid: true };
}

/**
 * Get image dimensions from file
 * @param file - Image file
 * @returns Promise resolving to dimensions
 */
export function getImageDimensions(file: File | Blob): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Compress and resize image before upload
 * Uses WebP for better compression when supported, falls back to JPEG
 * @param file - Original image file
 * @param options - Compression options
 * @returns Promise resolving to compressed image with metadata
 */
export async function compressImage(file: File, options: CompressionOptions = {}): Promise<CompressionResult> {
  const { maxWidth = DEFAULT_MAX_WIDTH, quality = DEFAULT_QUALITY } = options;

  // Skip compression for GIFs (animated)
  if (file.type === 'image/gif') {
    return { blob: file, mimeType: 'image/gif', extension: 'gif' };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Calculate new dimensions
      let { naturalWidth: width, naturalHeight: height } = img;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Use WebP for better compression, fallback to JPEG
      const mimeType = supportsWebP ? 'image/webp' : 'image/jpeg';
      const extension = supportsWebP ? 'webp' : 'jpg';

      // Convert to blob
      canvas.toBlob(
        blob => {
          if (blob) {
            resolve({ blob, mimeType, extension });
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

/**
 * Upload image to Firebase Storage
 * @param file - Image file to upload
 * @param userId - User ID for storage path
 * @param bookId - Book ID for storage path
 * @param onProgress - Progress callback (0-100)
 * @returns Promise resolving to upload result
 */
export async function uploadImage(
  file: File,
  userId: string,
  bookId: string,
  onProgress: ProgressCallback = () => {}
): Promise<UploadResult> {
  // Validate
  const validation = validateImage(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Compress image (returns blob with metadata)
  const { blob: compressedBlob, mimeType, extension } = await compressImage(file);

  // Get compressed dimensions
  const dimensions = await getImageDimensions(compressedBlob);

  // Generate unique ID and storage path with correct extension
  const imageId = generateImageId();
  const storagePath = `users/${userId}/books/${bookId}/images/${imageId}.${extension}`;
  const storageRef = ref(storage, storagePath);

  // Upload with progress tracking
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, compressedBlob, {
      contentType: mimeType,
    });

    uploadTask.on(
      'state_changed',
      snapshot => {
        const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        onProgress(progress);
      },
      error => {
        console.error('Upload error:', error);
        reject(new Error('Failed to upload image. Please try again.'));
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            id: imageId,
            url,
            storagePath,
            sizeBytes: compressedBlob.size,
            width: dimensions.width,
            height: dimensions.height,
          });
        } catch (error) {
          console.error('Error getting download URL:', error);
          reject(new Error('Failed to get image URL. Please try again.'));
        }
      }
    );
  });
}

/**
 * Delete image from Firebase Storage
 * @param storagePath - Full storage path to delete
 */
export async function deleteImage(storagePath: string): Promise<void> {
  if (!storagePath) {
    throw new Error('No storage path provided');
  }

  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error: unknown) {
    // Ignore "object not found" errors (already deleted)
    const firebaseError = error as { code?: string };
    if (firebaseError.code !== 'storage/object-not-found') {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image. Please try again.');
    }
  }
}

/**
 * Delete multiple images from Firebase Storage
 * @param images - Array of image objects with storagePath
 */
export async function deleteImages(images: ImageWithStoragePath[] | null | undefined): Promise<void> {
  if (!images || images.length === 0) return;

  const deletePromises = images.map(img => deleteImage(img.storagePath));
  await Promise.allSettled(deletePromises);
}
