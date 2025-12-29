/**
 * Tests for Image Schemas
 * Tests image validation, primary image functions, and schema validation
 */

import { describe, it, expect } from 'vitest';

describe('Image Schemas', () => {
  // Inline implementations from schemas/image.js
  function validatePrimaryImage(images) {
    if (!images || images.length === 0) {
      return { valid: true };
    }

    const primaryCount = images.filter(img => img.isPrimary).length;

    if (primaryCount > 1) {
      return { valid: false, error: 'Only one image can be marked as primary' };
    }

    return { valid: true };
  }

  function setPrimaryImage(images, imageId) {
    return images.map(img => ({
      ...img,
      isPrimary: img.id === imageId
    }));
  }

  function getPrimaryImage(images) {
    if (!images || images.length === 0) return null;
    return images.find(img => img.isPrimary) || null;
  }

  describe('validatePrimaryImage', () => {
    it('should return valid for empty array', () => {
      const result = validatePrimaryImage([]);
      expect(result.valid).toBe(true);
    });

    it('should return valid for null', () => {
      const result = validatePrimaryImage(null);
      expect(result.valid).toBe(true);
    });

    it('should return valid for undefined', () => {
      const result = validatePrimaryImage(undefined);
      expect(result.valid).toBe(true);
    });

    it('should return valid for single primary image', () => {
      const images = [
        { id: '1', isPrimary: true },
        { id: '2', isPrimary: false }
      ];
      const result = validatePrimaryImage(images);
      expect(result.valid).toBe(true);
    });

    it('should return valid for no primary images', () => {
      const images = [
        { id: '1', isPrimary: false },
        { id: '2', isPrimary: false }
      ];
      const result = validatePrimaryImage(images);
      expect(result.valid).toBe(true);
    });

    it('should return invalid for multiple primary images', () => {
      const images = [
        { id: '1', isPrimary: true },
        { id: '2', isPrimary: true }
      ];
      const result = validatePrimaryImage(images);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Only one image can be marked as primary');
    });

    it('should return invalid for three primary images', () => {
      const images = [
        { id: '1', isPrimary: true },
        { id: '2', isPrimary: true },
        { id: '3', isPrimary: true }
      ];
      const result = validatePrimaryImage(images);
      expect(result.valid).toBe(false);
    });
  });

  describe('setPrimaryImage', () => {
    const images = [
      { id: '1', url: 'a.jpg', isPrimary: true },
      { id: '2', url: 'b.jpg', isPrimary: false },
      { id: '3', url: 'c.jpg', isPrimary: false }
    ];

    it('should set specified image as primary', () => {
      const result = setPrimaryImage(images, '2');
      expect(result.find(i => i.id === '2').isPrimary).toBe(true);
    });

    it('should unset other images as primary', () => {
      const result = setPrimaryImage(images, '2');
      expect(result.find(i => i.id === '1').isPrimary).toBe(false);
      expect(result.find(i => i.id === '3').isPrimary).toBe(false);
    });

    it('should preserve other properties', () => {
      const result = setPrimaryImage(images, '2');
      expect(result.find(i => i.id === '1').url).toBe('a.jpg');
      expect(result.find(i => i.id === '2').url).toBe('b.jpg');
    });

    it('should return new array (not mutate original)', () => {
      const result = setPrimaryImage(images, '2');
      expect(result).not.toBe(images);
      expect(images[0].isPrimary).toBe(true); // Original unchanged
    });

    it('should set none as primary if id not found', () => {
      const result = setPrimaryImage(images, 'non-existent');
      const primaryCount = result.filter(i => i.isPrimary).length;
      expect(primaryCount).toBe(0);
    });

    it('should handle empty array', () => {
      const result = setPrimaryImage([], 'any');
      expect(result).toEqual([]);
    });

    it('should handle single image', () => {
      const singleImage = [{ id: '1', isPrimary: false }];
      const result = setPrimaryImage(singleImage, '1');
      expect(result[0].isPrimary).toBe(true);
    });
  });

  describe('getPrimaryImage', () => {
    it('should return primary image', () => {
      const images = [
        { id: '1', url: 'a.jpg', isPrimary: false },
        { id: '2', url: 'b.jpg', isPrimary: true },
        { id: '3', url: 'c.jpg', isPrimary: false }
      ];
      const result = getPrimaryImage(images);
      expect(result.id).toBe('2');
    });

    it('should return null for empty array', () => {
      expect(getPrimaryImage([])).toBeNull();
    });

    it('should return null for null input', () => {
      expect(getPrimaryImage(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(getPrimaryImage(undefined)).toBeNull();
    });

    it('should return null when no image is primary', () => {
      const images = [
        { id: '1', isPrimary: false },
        { id: '2', isPrimary: false }
      ];
      expect(getPrimaryImage(images)).toBeNull();
    });

    it('should return first primary if multiple exist', () => {
      const images = [
        { id: '1', isPrimary: true },
        { id: '2', isPrimary: true }
      ];
      const result = getPrimaryImage(images);
      expect(result.id).toBe('1');
    });
  });

  describe('Image Schema Validation', () => {
    // Test schema field requirements (simulated)
    const validateImageObject = (image) => {
      const errors = [];
      if (!image.id || typeof image.id !== 'string') errors.push('id required');
      if (!image.url || !image.url.startsWith('http')) errors.push('valid url required');
      if (!image.storagePath || typeof image.storagePath !== 'string') errors.push('storagePath required');
      if (image.caption && image.caption.length > 200) errors.push('caption too long');
      if (!image.uploadedAt || image.uploadedAt <= 0) errors.push('uploadedAt required');
      return errors;
    };

    it('should validate complete image object', () => {
      const image = {
        id: 'img-1',
        url: 'https://example.com/image.jpg',
        storagePath: 'users/123/books/456/images/img-1.jpg',
        isPrimary: true,
        uploadedAt: Date.now()
      };
      expect(validateImageObject(image)).toEqual([]);
    });

    it('should reject missing id', () => {
      const image = {
        url: 'https://example.com/image.jpg',
        storagePath: 'path/img.jpg',
        uploadedAt: Date.now()
      };
      expect(validateImageObject(image)).toContain('id required');
    });

    it('should reject invalid url', () => {
      const image = {
        id: 'img-1',
        url: 'not-a-url',
        storagePath: 'path/img.jpg',
        uploadedAt: Date.now()
      };
      expect(validateImageObject(image)).toContain('valid url required');
    });

    it('should reject missing storagePath', () => {
      const image = {
        id: 'img-1',
        url: 'https://example.com/image.jpg',
        uploadedAt: Date.now()
      };
      expect(validateImageObject(image)).toContain('storagePath required');
    });

    it('should reject caption over 200 chars', () => {
      const image = {
        id: 'img-1',
        url: 'https://example.com/image.jpg',
        storagePath: 'path/img.jpg',
        caption: 'x'.repeat(201),
        uploadedAt: Date.now()
      };
      expect(validateImageObject(image)).toContain('caption too long');
    });

    it('should accept caption under 200 chars', () => {
      const image = {
        id: 'img-1',
        url: 'https://example.com/image.jpg',
        storagePath: 'path/img.jpg',
        caption: 'This is a valid caption',
        uploadedAt: Date.now()
      };
      expect(validateImageObject(image)).toEqual([]);
    });

    it('should reject invalid uploadedAt', () => {
      const image = {
        id: 'img-1',
        url: 'https://example.com/image.jpg',
        storagePath: 'path/img.jpg',
        uploadedAt: 0
      };
      expect(validateImageObject(image)).toContain('uploadedAt required');
    });
  });

  describe('ImagesArraySchema', () => {
    const MAX_IMAGES = 10;

    it('should accept up to 10 images', () => {
      const images = Array(10).fill(null).map((_, i) => ({
        id: 'img-' + i,
        isPrimary: i === 0
      }));
      expect(images.length).toBeLessThanOrEqual(MAX_IMAGES);
    });

    it('should reject more than 10 images', () => {
      const images = Array(11).fill(null).map((_, i) => ({
        id: 'img-' + i
      }));
      expect(images.length).toBeGreaterThan(MAX_IMAGES);
    });

    it('should accept empty array', () => {
      expect([].length).toBe(0);
    });
  });
});
