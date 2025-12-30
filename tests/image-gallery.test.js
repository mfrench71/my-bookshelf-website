/**
 * Tests for ImageGallery component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('../src/js/utils/image-upload.js', () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  validateImage: vi.fn()
}));

vi.mock('../src/js/schemas/image.js', () => ({
  setPrimaryImage: vi.fn((images, id) => {
    return images.map(img => ({
      ...img,
      isPrimary: img.id === id
    }));
  }),
  getPrimaryImage: vi.fn((images) => {
    return images.find(img => img.isPrimary) || null;
  })
}));

vi.mock('../src/js/components/modal.js', () => ({
  ConfirmModal: {
    show: vi.fn()
  }
}));

vi.mock('../src/js/utils.js', () => ({
  escapeHtml: vi.fn((str) => str),
  escapeAttr: vi.fn((str) => str),
  showToast: vi.fn(),
  initIcons: vi.fn()
}));

import { ImageGallery } from '../src/js/components/image-gallery.js';
import { uploadImage, deleteImage, validateImage } from '../src/js/utils/image-upload.js';
import { ConfirmModal } from '../src/js/components/modal.js';
import { showToast, initIcons } from '../src/js/utils.js';
import { setPrimaryImage, getPrimaryImage } from '../src/js/schemas/image.js';

describe('ImageGallery', () => {
  let container;
  let gallery;
  let onPrimaryChange;
  let onChange;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'gallery-container';
    document.body.appendChild(container);
    
    onPrimaryChange = vi.fn();
    onChange = vi.fn();

    // Setup global lucide mock
    window.lucide = { createIcons: vi.fn() };

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (gallery) {
      gallery.destroy();
      gallery = null;
    }
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      expect(gallery.userId).toBe('user123');
      expect(gallery.maxImages).toBe(10);
      expect(gallery.images).toEqual([]);
      expect(gallery.bookId).toMatch(/^temp-\d+$/);
    });

    it('should initialize with custom values', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        bookId: 'book456',
        maxImages: 5,
        onPrimaryChange,
        onChange
      });

      expect(gallery.bookId).toBe('book456');
      expect(gallery.maxImages).toBe(5);
    });

    it('should render initial UI', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      expect(container.innerHTML).toContain('Book Images');
      expect(container.innerHTML).toContain('(0/10)');
      expect(initIcons).toHaveBeenCalled();
    });
  });

  describe('setBookId', () => {
    it('should update book ID', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setBookId('newBookId');
      expect(gallery.bookId).toBe('newBookId');
    });
  });

  describe('setImages', () => {
    it('should set images and re-render', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        onPrimaryChange
      });

      const images = [
        { id: 'img1', url: 'http://example.com/1.jpg', isPrimary: true },
        { id: 'img2', url: 'http://example.com/2.jpg', isPrimary: false }
      ];

      gallery.setImages(images);

      expect(gallery.images).toEqual(images);
      expect(container.innerHTML).toContain('(2/10)');
    });

    it('should handle empty images array', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([]);
      expect(gallery.images).toEqual([]);
    });

    it('should handle null images', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages(null);
      expect(gallery.images).toEqual([]);
    });
  });

  describe('getImages', () => {
    it('should return a copy of images array', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      const images = [{ id: 'img1', url: 'http://example.com/1.jpg' }];
      gallery.setImages(images);

      const result = gallery.getImages();
      expect(result).toEqual(images);
      expect(result).not.toBe(gallery.images);
    });
  });

  describe('getPrimaryImageUrl', () => {
    it('should return primary image URL when exists', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      const images = [
        { id: 'img1', url: 'http://example.com/1.jpg', isPrimary: true }
      ];
      gallery.setImages(images);
      getPrimaryImage.mockReturnValue(images[0]);

      expect(gallery.getPrimaryImageUrl()).toBe('http://example.com/1.jpg');
    });

    it('should return null when no primary image', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      getPrimaryImage.mockReturnValue(null);
      expect(gallery.getPrimaryImageUrl()).toBeNull();
    });
  });

  describe('hasImages', () => {
    it('should return true when images exist', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([{ id: 'img1' }]);
      expect(gallery.hasImages()).toBe(true);
    });

    it('should return false when no images', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      expect(gallery.hasImages()).toBe(false);
    });
  });

  describe('handleFileSelect', () => {
    it('should show error when too many files selected', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        maxImages: 2
      });

      gallery.setImages([{ id: 'img1' }]);

      const files = [
        new File(['test'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test'], 'test2.jpg', { type: 'image/jpeg' })
      ];

      await gallery.handleFileSelect(files);

      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Can only add 1 more image'),
        { type: 'error' }
      );
    });

    it('should show error for invalid file', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      validateImage.mockReturnValue({ valid: false, error: 'File too large' });

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await gallery.handleFileSelect(files);

      expect(showToast).toHaveBeenCalledWith('File too large', { type: 'error' });
    });

    it('should upload valid files', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        onChange
      });

      validateImage.mockReturnValue({ valid: true });
      uploadImage.mockResolvedValue({
        id: 'newImg',
        url: 'http://example.com/new.jpg',
        storagePath: 'path/to/new.jpg',
        sizeBytes: 1000,
        width: 800,
        height: 600
      });

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await gallery.handleFileSelect(files);

      expect(uploadImage).toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith('Image uploaded', { type: 'success' });
      expect(gallery.images).toHaveLength(1);
      expect(onChange).toHaveBeenCalled();
    });

    it('should handle upload error', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      validateImage.mockReturnValue({ valid: true });
      uploadImage.mockRejectedValue(new Error('Network error'));

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await gallery.handleFileSelect(files);

      expect(showToast).toHaveBeenCalledWith(
        'Failed to upload image. Please try again.',
        { type: 'error' }
      );
    });
  });

  describe('handleDelete', () => {
    it('should not delete when image not found', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      await gallery.handleDelete('nonexistent');
      expect(ConfirmModal.show).not.toHaveBeenCalled();
    });

    it('should not delete when user cancels', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([{ id: 'img1', url: 'http://example.com/1.jpg', isPrimary: false }]);
      ConfirmModal.show.mockResolvedValue(false);

      await gallery.handleDelete('img1');

      expect(gallery.images).toHaveLength(1);
    });

    it('should delete image when confirmed', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        onChange,
        onPrimaryChange
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg', storagePath: 'path/1.jpg', isPrimary: false }
      ]);
      ConfirmModal.show.mockResolvedValue(true);
      deleteImage.mockResolvedValue();

      await gallery.handleDelete('img1');

      expect(gallery.images).toHaveLength(0);
      expect(deleteImage).toHaveBeenCalledWith('path/1.jpg');
      expect(showToast).toHaveBeenCalledWith('Image deleted', { type: 'success' });
      expect(onChange).toHaveBeenCalled();
    });

    it('should show special message for primary image', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg', isPrimary: true }
      ]);
      ConfirmModal.show.mockResolvedValue(false);

      await gallery.handleDelete('img1');

      expect(ConfirmModal.show).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('cover image')
        })
      );
    });

    it('should make first remaining image primary when deleting primary', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg', storagePath: 'path/1.jpg', isPrimary: true },
        { id: 'img2', url: 'http://example.com/2.jpg', storagePath: 'path/2.jpg', isPrimary: false }
      ]);
      ConfirmModal.show.mockResolvedValue(true);
      deleteImage.mockResolvedValue();

      await gallery.handleDelete('img1');

      expect(gallery.images).toHaveLength(1);
      expect(gallery.images[0].id).toBe('img2');
      expect(gallery.images[0].isPrimary).toBe(true);
    });

    it('should handle storage delete failure gracefully', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg', storagePath: 'path/1.jpg', isPrimary: false }
      ]);
      ConfirmModal.show.mockResolvedValue(true);
      deleteImage.mockRejectedValue(new Error('Storage error'));

      await gallery.handleDelete('img1');

      expect(gallery.images).toHaveLength(0);
      expect(showToast).toHaveBeenCalledWith('Image deleted', { type: 'success' });
    });
  });

  describe('handleSetPrimary', () => {
    it('should set image as primary', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        onChange,
        onPrimaryChange
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg', isPrimary: false },
        { id: 'img2', url: 'http://example.com/2.jpg', isPrimary: false }
      ]);

      vi.clearAllMocks();

      // Mock getPrimaryImage to return the newly set primary after setPrimaryImage is called
      getPrimaryImage.mockReturnValue({ id: 'img2', url: 'http://example.com/2.jpg', isPrimary: true });

      gallery.handleSetPrimary('img2');

      expect(setPrimaryImage).toHaveBeenCalledWith(expect.any(Array), 'img2');
      expect(onChange).toHaveBeenCalled();
      // First arg is primary URL (or null), second arg is userInitiated flag
      expect(onPrimaryChange).toHaveBeenCalledWith('http://example.com/2.jpg', true);
    });
  });

  describe('drag and drop', () => {
    it('should track drag start', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.handleDragStart(2);
      expect(gallery.draggedIndex).toBe(2);
    });

    it('should reorder on drag over', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1' },
        { id: 'img2' },
        { id: 'img3' }
      ]);

      gallery.handleDragStart(0);
      gallery.handleDragOver(2, { preventDefault: vi.fn() });

      expect(gallery.images[2].id).toBe('img1');
      expect(gallery.draggedIndex).toBe(2);
    });

    it('should not reorder when dragging over same index', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1' },
        { id: 'img2' }
      ]);

      gallery.handleDragStart(0);
      const mockEvent = { preventDefault: vi.fn() };
      gallery.handleDragOver(0, mockEvent);

      expect(gallery.images[0].id).toBe('img1');
    });

    it('should notify change on drag end', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        onChange
      });

      gallery.handleDragStart(0);
      vi.clearAllMocks();
      gallery.handleDragEnd();

      expect(gallery.draggedIndex).toBeNull();
      expect(onChange).toHaveBeenCalled();
    });

    it('should not notify when no drag in progress', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        onChange
      });

      vi.clearAllMocks();
      gallery.handleDragEnd();

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('cleanup tracking', () => {
    it('should track newly uploaded images', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      validateImage.mockReturnValue({ valid: true });
      uploadImage.mockResolvedValue({
        id: 'newImg',
        url: 'http://example.com/new.jpg',
        storagePath: 'path/to/new.jpg'
      });

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await gallery.handleFileSelect(files);

      expect(gallery.hasUnsavedUploads()).toBe(true);
      expect(gallery.getNewlyUploadedImages()).toHaveLength(1);
    });

    it('should clear tracking on markAsSaved', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      validateImage.mockReturnValue({ valid: true });
      uploadImage.mockResolvedValue({
        id: 'newImg',
        url: 'http://example.com/new.jpg',
        storagePath: 'path/to/new.jpg'
      });

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await gallery.handleFileSelect(files);

      gallery.markAsSaved();

      expect(gallery.hasUnsavedUploads()).toBe(false);
      expect(gallery.getNewlyUploadedImages()).toHaveLength(0);
    });

    it('should cleanup unsaved uploads', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      validateImage.mockReturnValue({ valid: true });
      uploadImage.mockResolvedValue({
        id: 'newImg',
        url: 'http://example.com/new.jpg',
        storagePath: 'path/to/new.jpg'
      });
      deleteImage.mockResolvedValue();

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await gallery.handleFileSelect(files);

      const deletedCount = await gallery.cleanupUnsavedUploads();

      expect(deletedCount).toBe(1);
      expect(deleteImage).toHaveBeenCalledWith('path/to/new.jpg');
      expect(gallery.images).toHaveLength(0);
      expect(gallery.hasUnsavedUploads()).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      validateImage.mockReturnValue({ valid: true });
      uploadImage.mockResolvedValue({
        id: 'newImg',
        url: 'http://example.com/new.jpg',
        storagePath: 'path/to/new.jpg'
      });
      deleteImage.mockRejectedValue(new Error('Delete failed'));

      const files = [new File(['test'], 'test.jpg', { type: 'image/jpeg' })];
      await gallery.handleFileSelect(files);

      const deletedCount = await gallery.cleanupUnsavedUploads();

      expect(deletedCount).toBe(0);
    });

    it('should return 0 when no unsaved uploads', async () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      const deletedCount = await gallery.cleanupUnsavedUploads();
      expect(deletedCount).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should clean up state and container', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([{ id: 'img1' }]);
      gallery.destroy();

      expect(container.innerHTML).toBe('');
      expect(gallery.images).toEqual([]);
    });
  });

  describe('render', () => {
    it('should render empty slot when can add more images', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        maxImages: 5
      });

      expect(container.innerHTML).toContain('Add image');
    });

    it('should not render empty slot when at max images', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123',
        maxImages: 1
      });

      gallery.setImages([{ id: 'img1', url: 'http://example.com/1.jpg' }]);

      expect(container.innerHTML).not.toContain('Add image');
    });

    it('should render image tiles with correct attributes', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg', isPrimary: true }
      ]);

      expect(container.innerHTML).toContain('data-image-id="img1"');
      expect(container.innerHTML).toContain('Cover');
      expect(container.innerHTML).toContain('border-primary');
    });

    it('should render set as cover button for non-primary images', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg', isPrimary: false }
      ]);

      expect(container.innerHTML).toContain('Set as cover');
    });

    it('should show drag hint for multiple images', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg' },
        { id: 'img2', url: 'http://example.com/2.jpg' }
      ]);

      expect(container.innerHTML).toContain('Drag to reorder');
    });

    it('should not show drag hint for single image', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      gallery.setImages([
        { id: 'img1', url: 'http://example.com/1.jpg' }
      ]);

      expect(container.innerHTML).not.toContain('Drag to reorder');
    });

    it('should show uploading tile with progress', () => {
      gallery = new ImageGallery({
        container,
        userId: 'user123'
      });

      // Simulate upload in progress
      gallery.uploading.set('temp-123', 50);
      gallery.render();

      expect(container.innerHTML).toContain('50%');
    });
  });
});
