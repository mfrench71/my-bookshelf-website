/**
 * Tests for image-upload utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firebase modules
vi.mock('../src/js/firebase-config.js', () => ({
  storage: {}
}));

const mockUploadTask = {
  on: vi.fn(),
  snapshot: { ref: 'mockRef' }
};

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js', () => ({
  ref: vi.fn(() => 'mockStorageRef'),
  uploadBytesResumable: vi.fn(() => mockUploadTask),
  getDownloadURL: vi.fn(() => Promise.resolve('https://example.com/image.jpg')),
  deleteObject: vi.fn(() => Promise.resolve())
}));

import { validateImage, deleteImage, deleteImages } from '../src/js/utils/image-upload.js';
import { ref, deleteObject } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

describe('image-upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateImage', () => {
    it('should return error when no file provided', () => {
      const result = validateImage(null);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('should return error when undefined file provided', () => {
      const result = validateImage(undefined);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('should return error for invalid file type - text', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const result = validateImage(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should return error for invalid file type - svg', () => {
      const file = new File(['test'], 'test.svg', { type: 'image/svg+xml' });
      const result = validateImage(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid file type');
    });

    it('should return error for file too large', () => {
      // Create a mock file object with large size
      const file = {
        type: 'image/jpeg',
        size: 10 * 1024 * 1024 // 10MB
      };
      const result = validateImage(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
      expect(result.error).toContain('10.0MB');
    });

    it('should return error for file exactly at limit', () => {
      const file = {
        type: 'image/jpeg',
        size: 5 * 1024 * 1024 + 1 // Just over 5MB
      };
      const result = validateImage(file);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
    });

    it('should validate JPEG files', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const result = validateImage(file);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate PNG files', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' });
      const result = validateImage(file);
      
      expect(result.valid).toBe(true);
    });

    it('should validate WebP files', () => {
      const file = new File(['test'], 'test.webp', { type: 'image/webp' });
      const result = validateImage(file);
      
      expect(result.valid).toBe(true);
    });

    it('should validate GIF files', () => {
      const file = new File(['test'], 'test.gif', { type: 'image/gif' });
      const result = validateImage(file);
      
      expect(result.valid).toBe(true);
    });

    it('should validate file at size limit', () => {
      const file = {
        type: 'image/jpeg',
        size: 5 * 1024 * 1024 // Exactly 5MB
      };
      const result = validateImage(file);
      
      expect(result.valid).toBe(true);
    });

    it('should validate small file', () => {
      const file = {
        type: 'image/jpeg',
        size: 100 * 1024 // 100KB
      };
      const result = validateImage(file);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('deleteImage', () => {
    it('should throw error when no storage path provided', async () => {
      await expect(deleteImage('')).rejects.toThrow('No storage path provided');
    });

    it('should throw error when null storage path provided', async () => {
      await expect(deleteImage(null)).rejects.toThrow('No storage path provided');
    });

    it('should throw error when undefined storage path provided', async () => {
      await expect(deleteImage(undefined)).rejects.toThrow('No storage path provided');
    });

    it('should delete image from storage', async () => {
      await deleteImage('users/user123/books/book456/images/img.jpg');

      expect(ref).toHaveBeenCalledWith(expect.anything(), 'users/user123/books/book456/images/img.jpg');
      expect(deleteObject).toHaveBeenCalled();
    });

    it('should ignore "object not found" errors', async () => {
      const error = new Error('Object not found');
      error.code = 'storage/object-not-found';
      deleteObject.mockRejectedValueOnce(error);

      // Should not throw
      await expect(deleteImage('path/to/deleted.jpg')).resolves.toBeUndefined();
    });

    it('should throw on unauthorized error', async () => {
      const error = new Error('Permission denied');
      error.code = 'storage/unauthorized';
      deleteObject.mockRejectedValueOnce(error);

      await expect(deleteImage('path/to/image.jpg')).rejects.toThrow('Failed to delete image');
    });

    it('should throw on quota exceeded error', async () => {
      const error = new Error('Quota exceeded');
      error.code = 'storage/quota-exceeded';
      deleteObject.mockRejectedValueOnce(error);

      await expect(deleteImage('path/to/image.jpg')).rejects.toThrow('Failed to delete image');
    });

    it('should throw on unknown error', async () => {
      const error = new Error('Unknown error');
      error.code = 'storage/unknown';
      deleteObject.mockRejectedValueOnce(error);

      await expect(deleteImage('path/to/image.jpg')).rejects.toThrow('Failed to delete image');
    });
  });

  describe('deleteImages', () => {
    it('should do nothing when null provided', async () => {
      await deleteImages(null);
      expect(deleteObject).not.toHaveBeenCalled();
    });

    it('should do nothing when undefined provided', async () => {
      await deleteImages(undefined);
      expect(deleteObject).not.toHaveBeenCalled();
    });

    it('should do nothing when empty array provided', async () => {
      await deleteImages([]);
      expect(deleteObject).not.toHaveBeenCalled();
    });

    it('should delete single image', async () => {
      const images = [{ storagePath: 'path/1.jpg' }];

      await deleteImages(images);

      expect(ref).toHaveBeenCalledTimes(1);
      expect(deleteObject).toHaveBeenCalledTimes(1);
    });

    it('should delete multiple images', async () => {
      const images = [
        { storagePath: 'path/1.jpg' },
        { storagePath: 'path/2.jpg' },
        { storagePath: 'path/3.jpg' }
      ];

      await deleteImages(images);

      expect(ref).toHaveBeenCalledTimes(3);
      expect(deleteObject).toHaveBeenCalledTimes(3);
    });

    it('should continue even if some deletions fail', async () => {
      const images = [
        { storagePath: 'path/1.jpg' },
        { storagePath: 'path/2.jpg' }
      ];

      // First deletion fails
      deleteObject.mockRejectedValueOnce(new Error('Delete failed'));
      deleteObject.mockResolvedValueOnce();

      // Should not throw (uses Promise.allSettled)
      await expect(deleteImages(images)).resolves.toBeUndefined();
      expect(deleteObject).toHaveBeenCalledTimes(2);
    });

    it('should handle all deletions failing', async () => {
      const images = [
        { storagePath: 'path/1.jpg' },
        { storagePath: 'path/2.jpg' }
      ];

      deleteObject.mockRejectedValue(new Error('Delete failed'));

      // Should not throw (uses Promise.allSettled)
      await expect(deleteImages(images)).resolves.toBeUndefined();
      expect(deleteObject).toHaveBeenCalledTimes(2);
    });
  });
});
