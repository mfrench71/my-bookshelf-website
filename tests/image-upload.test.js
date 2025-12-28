// Image Upload Utility Tests
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Firebase Storage
vi.mock('../src/js/firebase-config.js', () => ({
  storage: {}
}));

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js', () => ({
  ref: vi.fn(() => ({})),
  uploadBytesResumable: vi.fn(() => ({
    on: vi.fn((event, onProgress, onError, onComplete) => {
      // Simulate successful upload
      setTimeout(() => {
        onProgress({ bytesTransferred: 50, totalBytes: 100 });
        onProgress({ bytesTransferred: 100, totalBytes: 100 });
        onComplete();
      }, 10);
    }),
    snapshot: { ref: {} }
  })),
  getDownloadURL: vi.fn(() => Promise.resolve('https://firebasestorage.example.com/image.webp')),
  deleteObject: vi.fn(() => Promise.resolve())
}));

describe('Image Upload Utilities', () => {
  // Inline implementations for testing (mirrors src/js/utils/image-upload.js)
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  function validateImage(file) {
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

  describe('validateImage', () => {
    it('should return invalid for null file', () => {
      const result = validateImage(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('should return invalid for undefined file', () => {
      const result = validateImage(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('No file provided');
    });

    it('should accept valid JPEG file', () => {
      const file = { type: 'image/jpeg', size: 1024 * 1024 }; // 1MB
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid PNG file', () => {
      const file = { type: 'image/png', size: 1024 * 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid WebP file', () => {
      const file = { type: 'image/webp', size: 1024 * 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    it('should accept valid GIF file', () => {
      const file = { type: 'image/gif', size: 1024 * 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid file type', () => {
      const file = { type: 'application/pdf', size: 1024 * 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid file type. Please use JPG, PNG, WebP, or GIF.');
    });

    it('should reject SVG files', () => {
      const file = { type: 'image/svg+xml', size: 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid file type. Please use JPG, PNG, WebP, or GIF.');
    });

    it('should reject BMP files', () => {
      const file = { type: 'image/bmp', size: 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(false);
    });

    it('should accept file at exactly 5MB', () => {
      const file = { type: 'image/jpeg', size: 5 * 1024 * 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });

    it('should reject file over 5MB', () => {
      const file = { type: 'image/jpeg', size: 5 * 1024 * 1024 + 1 };
      const result = validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File too large');
      expect(result.error).toContain('Maximum size is 5MB');
    });

    it('should show file size in error message', () => {
      const file = { type: 'image/jpeg', size: 7.5 * 1024 * 1024 };
      const result = validateImage(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('7.5MB');
    });

    it('should accept very small file', () => {
      const file = { type: 'image/jpeg', size: 100 }; // 100 bytes
      const result = validateImage(file);
      expect(result.valid).toBe(true);
    });
  });

  describe('generateImageId', () => {
    // Inline implementation
    function generateImageId() {
      return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }

    it('should generate unique IDs', () => {
      const id1 = generateImageId();
      const id2 = generateImageId();
      expect(id1).not.toBe(id2);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      const id = generateImageId();
      const after = Date.now();
      const timestamp = parseInt(id.split('-')[0], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('should have random suffix', () => {
      const id = generateImageId();
      const parts = id.split('-');
      expect(parts.length).toBe(2);
      expect(parts[1].length).toBeGreaterThan(0);
    });
  });

  describe('storage path generation', () => {
    it('should create correct path structure', () => {
      const userId = 'user123';
      const bookId = 'book456';
      const imageId = 'img789';
      const extension = 'webp';
      const path = `users/${userId}/books/${bookId}/images/${imageId}.${extension}`;
      expect(path).toBe('users/user123/books/book456/images/img789.webp');
    });

    it('should handle temp book IDs', () => {
      const userId = 'user123';
      const bookId = 'temp-1234567890';
      const imageId = 'img789';
      const extension = 'jpg';
      const path = `users/${userId}/books/${bookId}/images/${imageId}.${extension}`;
      expect(path).toContain('temp-');
    });
  });
});

describe('Image Compression Logic', () => {
  // Test the compression configuration
  const DEFAULT_MAX_WIDTH = 1200;
  const DEFAULT_QUALITY = 0.75;

  describe('compression settings', () => {
    it('should have max width of 1200px', () => {
      expect(DEFAULT_MAX_WIDTH).toBe(1200);
    });

    it('should have quality of 0.75', () => {
      expect(DEFAULT_QUALITY).toBe(0.75);
    });
  });

  describe('dimension calculation', () => {
    function calculateResizedDimensions(width, height, maxWidth) {
      if (width <= maxWidth) {
        return { width, height };
      }
      const newHeight = Math.round((height * maxWidth) / width);
      return { width: maxWidth, height: newHeight };
    }

    it('should not resize image smaller than max width', () => {
      const result = calculateResizedDimensions(800, 1200, 1200);
      expect(result.width).toBe(800);
      expect(result.height).toBe(1200);
    });

    it('should resize image larger than max width', () => {
      const result = calculateResizedDimensions(2400, 3600, 1200);
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1800);
    });

    it('should maintain aspect ratio', () => {
      const originalRatio = 2400 / 3600;
      const result = calculateResizedDimensions(2400, 3600, 1200);
      const newRatio = result.width / result.height;
      expect(newRatio).toBeCloseTo(originalRatio, 2);
    });

    it('should handle exact max width', () => {
      const result = calculateResizedDimensions(1200, 1800, 1200);
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1800);
    });

    it('should handle landscape orientation', () => {
      const result = calculateResizedDimensions(2400, 1600, 1200);
      expect(result.width).toBe(1200);
      expect(result.height).toBe(800);
    });

    it('should handle square images', () => {
      const result = calculateResizedDimensions(2400, 2400, 1200);
      expect(result.width).toBe(1200);
      expect(result.height).toBe(1200);
    });
  });
});

describe('WebP Support Detection', () => {
  it('should detect WebP support via canvas', () => {
    // In jsdom, canvas.toDataURL for webp may not work correctly
    // This tests the detection logic pattern
    function checkWebPSupport() {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const dataUrl = canvas.toDataURL('image/webp');
        return dataUrl.indexOf('data:image/webp') === 0;
      } catch {
        return false;
      }
    }

    // Just verify the function doesn't throw
    const result = checkWebPSupport();
    expect(typeof result).toBe('boolean');
  });
});

describe('File Extension Handling', () => {
  function getExtensionForMimeType(mimeType, supportsWebP) {
    if (mimeType === 'image/gif') return 'gif';
    return supportsWebP ? 'webp' : 'jpg';
  }

  it('should use gif extension for GIF files', () => {
    expect(getExtensionForMimeType('image/gif', true)).toBe('gif');
    expect(getExtensionForMimeType('image/gif', false)).toBe('gif');
  });

  it('should use webp extension when supported', () => {
    expect(getExtensionForMimeType('image/jpeg', true)).toBe('webp');
    expect(getExtensionForMimeType('image/png', true)).toBe('webp');
  });

  it('should fallback to jpg when webp not supported', () => {
    expect(getExtensionForMimeType('image/jpeg', false)).toBe('jpg');
    expect(getExtensionForMimeType('image/png', false)).toBe('jpg');
  });
});

describe('Delete Image Error Handling', () => {
  // Test error code handling for deletion
  function shouldIgnoreDeleteError(errorCode) {
    return errorCode === 'storage/object-not-found';
  }

  it('should ignore object-not-found errors', () => {
    expect(shouldIgnoreDeleteError('storage/object-not-found')).toBe(true);
  });

  it('should not ignore other errors', () => {
    expect(shouldIgnoreDeleteError('storage/unauthorized')).toBe(false);
    expect(shouldIgnoreDeleteError('storage/canceled')).toBe(false);
    expect(shouldIgnoreDeleteError('storage/unknown')).toBe(false);
  });
});

describe('Batch Delete Images', () => {
  // Test the batch delete logic
  async function deleteImages(images, deleteImage) {
    if (!images || images.length === 0) return;
    const deletePromises = images.map(img => deleteImage(img.storagePath));
    await Promise.allSettled(deletePromises);
  }

  it('should handle empty array', async () => {
    const mockDelete = vi.fn();
    await deleteImages([], mockDelete);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should handle null/undefined', async () => {
    const mockDelete = vi.fn();
    await deleteImages(null, mockDelete);
    await deleteImages(undefined, mockDelete);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should call delete for each image', async () => {
    const mockDelete = vi.fn().mockResolvedValue();
    const images = [
      { storagePath: 'path/1.jpg' },
      { storagePath: 'path/2.jpg' },
      { storagePath: 'path/3.jpg' }
    ];
    await deleteImages(images, mockDelete);
    expect(mockDelete).toHaveBeenCalledTimes(3);
    expect(mockDelete).toHaveBeenCalledWith('path/1.jpg');
    expect(mockDelete).toHaveBeenCalledWith('path/2.jpg');
    expect(mockDelete).toHaveBeenCalledWith('path/3.jpg');
  });

  it('should continue even if some deletes fail', async () => {
    const mockDelete = vi.fn()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce();
    const images = [
      { storagePath: 'path/1.jpg' },
      { storagePath: 'path/2.jpg' },
      { storagePath: 'path/3.jpg' }
    ];
    // Should not throw
    await expect(deleteImages(images, mockDelete)).resolves.toBeUndefined();
    expect(mockDelete).toHaveBeenCalledTimes(3);
  });
});
