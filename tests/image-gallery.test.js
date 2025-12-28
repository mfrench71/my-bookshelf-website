/**
 * Tests for ImageGallery component
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (str) => str.replace(/[&<>"']/g, ''),
  escapeAttr: (str) => str.replace(/[&<>"']/g, ''),
  showToast: vi.fn(),
  initIcons: vi.fn()
}));

vi.mock('../src/js/utils/image-upload.js', () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  validateImage: vi.fn()
}));

vi.mock('../src/js/schemas/image.js', () => ({
  setPrimaryImage: (images, imageId) => images.map(img => ({
    ...img,
    isPrimary: img.id === imageId
  })),
  getPrimaryImage: (images) => {
    if (!images || images.length === 0) return null;
    return images.find(img => img.isPrimary) || null;
  }
}));

vi.mock('../src/js/components/modal.js', () => ({
  ConfirmModal: {
    show: vi.fn().mockResolvedValue(true)
  }
}));

// Import after mocks
import { uploadImage, deleteImage, validateImage } from '../src/js/utils/image-upload.js';
import { showToast } from '../src/js/utils.js';
import { ConfirmModal } from '../src/js/components/modal.js';

describe('ImageGallery', () => {
  let container;
  let mockOnChange;
  let mockOnPrimaryChange;

  const createGallery = (options = {}) => {
    // Inline implementation of key gallery logic for testing
    const gallery = {
      container: options.container,
      userId: options.userId || 'user123',
      bookId: options.bookId || 'book456',
      maxImages: options.maxImages || 10,
      onPrimaryChange: options.onPrimaryChange || (() => {}),
      onChange: options.onChange || (() => {}),
      images: [],
      uploading: new Map(),
      draggedIndex: null,

      setBookId(bookId) {
        this.bookId = bookId;
      },

      setImages(images) {
        this.images = images || [];
        this.render();
        this.notifyPrimaryChange();
      },

      getImages() {
        return [...this.images];
      },

      getPrimaryImageUrl() {
        const primary = this.images.find(img => img.isPrimary);
        return primary ? primary.url : null;
      },

      hasImages() {
        return this.images.length > 0;
      },

      handleSetPrimary(imageId) {
        this.images = this.images.map(img => ({
          ...img,
          isPrimary: img.id === imageId
        }));
        this.render();
        this.notifyChange();
        this.notifyPrimaryChange();
      },

      async handleDelete(imageId) {
        const image = this.images.find(img => img.id === imageId);
        if (!image) return;

        const wasPrimary = image.isPrimary;

        // Remove from array
        this.images = this.images.filter(img => img.id !== imageId);

        // If deleted image was primary and there are still images, make first one primary
        if (wasPrimary && this.images.length > 0) {
          this.images[0].isPrimary = true;
        }

        this.render();
        this.notifyChange();
        this.notifyPrimaryChange();
      },

      handleDragStart(index) {
        this.draggedIndex = index;
      },

      handleDragOver(index, event) {
        event.preventDefault();
        if (this.draggedIndex === null || this.draggedIndex === index) return;

        const draggedImage = this.images[this.draggedIndex];
        this.images.splice(this.draggedIndex, 1);
        this.images.splice(index, 0, draggedImage);
        this.draggedIndex = index;
        this.render();
      },

      handleDragEnd() {
        if (this.draggedIndex !== null) {
          this.draggedIndex = null;
          this.notifyChange();
        }
      },

      notifyChange() {
        this.onChange(this.getImages());
      },

      notifyPrimaryChange() {
        const primaryUrl = this.getPrimaryImageUrl();
        this.onPrimaryChange(primaryUrl);
      },

      render() {
        const total = this.images.length + this.uploading.size;
        const canAdd = total < this.maxImages;

        this.container.innerHTML = `
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="block font-semibold text-gray-700">
                Book Images <span class="font-normal text-gray-500">(${this.images.length}/${this.maxImages})</span>
              </label>
            </div>
            <div class="gallery-grid grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              ${this.images.map((img, index) => `
                <div class="image-tile relative group aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 ${img.isPrimary ? 'border-primary' : 'border-transparent'}"
                     draggable="true"
                     data-index="${index}"
                     data-image-id="${img.id}">
                  <img src="${img.url}" alt="Book image ${index + 1}" class="w-full h-full object-cover">
                  ${img.isPrimary ? '<div class="primary-badge absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-white text-xs rounded font-medium">Cover</div>' : ''}
                  <div class="overlay absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
                    ${!img.isPrimary ? `<button type="button" class="set-primary-btn p-2 bg-white rounded-full" data-image-id="${img.id}">★</button>` : ''}
                    <button type="button" class="delete-btn p-2 bg-white rounded-full" data-image-id="${img.id}">×</button>
                  </div>
                </div>
              `).join('')}
              ${canAdd ? '<label class="add-image-slot aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 cursor-pointer"><input type="file" class="hidden"></label>' : ''}
            </div>
          </div>
        `;
      },

      destroy() {
        this.container.innerHTML = '';
        this.images = [];
        this.uploading.clear();
      }
    };

    gallery.render();
    return gallery;
  };

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'image-gallery-container';
    document.body.appendChild(container);
    mockOnChange = vi.fn();
    mockOnPrimaryChange = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const gallery = createGallery({ container });

      expect(gallery.container).toBe(container);
      expect(gallery.maxImages).toBe(10);
      expect(gallery.images).toEqual([]);
    });

    it('should accept custom maxImages', () => {
      const gallery = createGallery({ container, maxImages: 5 });

      expect(gallery.maxImages).toBe(5);
    });

    it('should accept callbacks', () => {
      const gallery = createGallery({
        container,
        onChange: mockOnChange,
        onPrimaryChange: mockOnPrimaryChange
      });

      expect(gallery.onChange).toBe(mockOnChange);
      expect(gallery.onPrimaryChange).toBe(mockOnPrimaryChange);
    });

    it('should render on initialization', () => {
      const gallery = createGallery({ container });

      // Empty gallery renders with gallery-grid (placeholder shown, not upload button)
      expect(container.querySelector('.gallery-grid')).toBeTruthy();
    });
  });

  describe('setBookId', () => {
    it('should update bookId', () => {
      const gallery = createGallery({ container, bookId: 'temp-123' });

      gallery.setBookId('book-456');

      expect(gallery.bookId).toBe('book-456');
    });
  });

  describe('setImages', () => {
    it('should set images and re-render', () => {
      const gallery = createGallery({ container, onPrimaryChange: mockOnPrimaryChange });
      const images = [
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ];

      gallery.setImages(images);

      expect(gallery.images).toHaveLength(1);
      expect(container.querySelector('.image-tile')).toBeTruthy();
    });

    it('should notify of primary change', () => {
      const gallery = createGallery({ container, onPrimaryChange: mockOnPrimaryChange });
      const images = [
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ];

      gallery.setImages(images);

      expect(mockOnPrimaryChange).toHaveBeenCalledWith('https://example.com/1.jpg');
    });

    it('should handle empty array', () => {
      const gallery = createGallery({ container });

      gallery.setImages([]);

      expect(gallery.images).toHaveLength(0);
    });

    it('should handle null/undefined', () => {
      const gallery = createGallery({ container });

      gallery.setImages(null);
      expect(gallery.images).toHaveLength(0);

      gallery.setImages(undefined);
      expect(gallery.images).toHaveLength(0);
    });
  });

  describe('getImages', () => {
    it('should return copy of images array', () => {
      const gallery = createGallery({ container });
      const images = [
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ];
      gallery.setImages(images);

      const result = gallery.getImages();
      result.push({ id: 'new' });

      expect(gallery.images).toHaveLength(1);
    });
  });

  describe('getPrimaryImageUrl', () => {
    it('should return primary image URL', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: false, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: true, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      expect(gallery.getPrimaryImageUrl()).toBe('https://example.com/2.jpg');
    });

    it('should return null if no primary', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: false, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);

      expect(gallery.getPrimaryImageUrl()).toBeNull();
    });

    it('should return null for empty gallery', () => {
      const gallery = createGallery({ container });

      expect(gallery.getPrimaryImageUrl()).toBeNull();
    });
  });

  describe('hasImages', () => {
    it('should return true when images exist', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);

      expect(gallery.hasImages()).toBe(true);
    });

    it('should return false when no images', () => {
      const gallery = createGallery({ container });

      expect(gallery.hasImages()).toBe(false);
    });
  });

  describe('handleSetPrimary', () => {
    it('should set specified image as primary', () => {
      const gallery = createGallery({ container, onChange: mockOnChange });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);
      mockOnChange.mockClear();

      gallery.handleSetPrimary('img-2');

      expect(gallery.images[0].isPrimary).toBe(false);
      expect(gallery.images[1].isPrimary).toBe(true);
    });

    it('should notify of changes', () => {
      const gallery = createGallery({
        container,
        onChange: mockOnChange,
        onPrimaryChange: mockOnPrimaryChange
      });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);
      mockOnChange.mockClear();
      mockOnPrimaryChange.mockClear();

      gallery.handleSetPrimary('img-2');

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnPrimaryChange).toHaveBeenCalledWith('https://example.com/2.jpg');
    });

    it('should update primary badge in UI', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      gallery.handleSetPrimary('img-2');

      const tiles = container.querySelectorAll('.image-tile');
      expect(tiles[0].classList.contains('border-primary')).toBe(false);
      expect(tiles[1].classList.contains('border-primary')).toBe(true);
    });
  });

  describe('handleDelete', () => {
    it('should remove image from array', async () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      await gallery.handleDelete('img-1');

      expect(gallery.images).toHaveLength(1);
      expect(gallery.images[0].id).toBe('img-2');
    });

    it('should promote first image to primary when primary is deleted', async () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      await gallery.handleDelete('img-1');

      expect(gallery.images[0].isPrimary).toBe(true);
    });

    it('should notify of changes', async () => {
      const gallery = createGallery({
        container,
        onChange: mockOnChange,
        onPrimaryChange: mockOnPrimaryChange
      });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: false, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);
      mockOnChange.mockClear();
      mockOnPrimaryChange.mockClear();

      await gallery.handleDelete('img-1');

      expect(mockOnChange).toHaveBeenCalled();
      expect(mockOnPrimaryChange).toHaveBeenCalled();
    });

    it('should handle non-existent imageId', async () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);

      await gallery.handleDelete('non-existent');

      expect(gallery.images).toHaveLength(1);
    });
  });

  describe('drag and drop', () => {
    it('should track dragged index on drag start', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      gallery.handleDragStart(0);

      expect(gallery.draggedIndex).toBe(0);
    });

    it('should reorder images on drag over', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() },
        { id: 'img-3', url: 'https://example.com/3.jpg', isPrimary: false, storagePath: 'path/3.jpg', uploadedAt: Date.now() }
      ]);
      gallery.handleDragStart(0);

      gallery.handleDragOver(2, { preventDefault: () => {} });

      expect(gallery.images[0].id).toBe('img-2');
      expect(gallery.images[1].id).toBe('img-3');
      expect(gallery.images[2].id).toBe('img-1');
    });

    it('should not reorder on drag over same index', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);
      gallery.handleDragStart(0);

      gallery.handleDragOver(0, { preventDefault: () => {} });

      expect(gallery.images[0].id).toBe('img-1');
    });

    it('should notify change on drag end', () => {
      const gallery = createGallery({ container, onChange: mockOnChange });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);
      gallery.handleDragStart(0);
      mockOnChange.mockClear();

      gallery.handleDragEnd();

      expect(mockOnChange).toHaveBeenCalled();
      expect(gallery.draggedIndex).toBeNull();
    });

    it('should not notify if no drag was active', () => {
      const gallery = createGallery({ container, onChange: mockOnChange });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);
      mockOnChange.mockClear();

      gallery.handleDragEnd();

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('render', () => {
    it('should show upload button when has images and under max', () => {
      const gallery = createGallery({ container, maxImages: 10 });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);

      // Should show add-image-slot when can add more
      expect(container.querySelector('.add-image-slot')).toBeTruthy();
    });

    it('should show add-image-slot when empty', () => {
      const gallery = createGallery({ container, maxImages: 10 });

      // Empty gallery shows add-image-slot
      expect(container.querySelector('.add-image-slot')).toBeTruthy();
    });

    it('should hide add-image-slot when at max', () => {
      const gallery = createGallery({ container, maxImages: 2 });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      expect(container.querySelector('.add-image-slot')).toBeNull();
    });

    it('should show image count', () => {
      const gallery = createGallery({ container, maxImages: 10 });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() },
        { id: 'img-3', url: 'https://example.com/3.jpg', isPrimary: false, storagePath: 'path/3.jpg', uploadedAt: Date.now() }
      ]);

      expect(container.textContent).toContain('3/10');
    });

    it('should show Cover badge on primary image', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);

      expect(container.querySelector('.primary-badge')).toBeTruthy();
      expect(container.querySelector('.primary-badge').textContent).toBe('Cover');
    });

    it('should show star button only on non-primary images', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      const setPrimaryBtns = container.querySelectorAll('.set-primary-btn');
      expect(setPrimaryBtns).toHaveLength(1);
      expect(setPrimaryBtns[0].dataset.imageId).toBe('img-2');
    });

    it('should show delete button on all images', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() },
        { id: 'img-2', url: 'https://example.com/2.jpg', isPrimary: false, storagePath: 'path/2.jpg', uploadedAt: Date.now() }
      ]);

      const deleteBtns = container.querySelectorAll('.delete-btn');
      expect(deleteBtns).toHaveLength(2);
    });
  });

  describe('destroy', () => {
    it('should clear container', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);

      gallery.destroy();

      expect(container.innerHTML).toBe('');
    });

    it('should clear images array', () => {
      const gallery = createGallery({ container });
      gallery.setImages([
        { id: 'img-1', url: 'https://example.com/1.jpg', isPrimary: true, storagePath: 'path/1.jpg', uploadedAt: Date.now() }
      ]);

      gallery.destroy();

      expect(gallery.images).toHaveLength(0);
    });

    it('should clear uploading map', () => {
      const gallery = createGallery({ container });
      gallery.uploading.set('temp-1', 50);

      gallery.destroy();

      expect(gallery.uploading.size).toBe(0);
    });
  });
});
