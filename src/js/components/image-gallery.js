// Image Gallery Component
// Upload, display, reorder, and manage book images

import { escapeHtml, escapeAttr, showToast, initIcons } from '../utils.js';
import { uploadImage, deleteImage, validateImage } from '../utils/image-upload.js';
import { setPrimaryImage, getPrimaryImage } from '../schemas/image.js';
import { ConfirmModal } from './modal.js';

/**
 * ImageGallery - Upload, display, and manage book images
 *
 * @example
 * const gallery = new ImageGallery({
 *   container: document.getElementById('image-gallery-container'),
 *   userId: 'user123',
 *   bookId: 'book456',
 *   maxImages: 10,
 *   onPrimaryChange: (url) => coverPicker.setUserUpload(url),
 *   onChange: (images) => console.log('Images changed:', images)
 * });
 */
export class ImageGallery {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element to render into
   * @param {string} options.userId - Current user's ID
   * @param {string} [options.bookId] - Book ID (null for new books, uses temp ID)
   * @param {number} [options.maxImages=10] - Maximum images allowed
   * @param {Function} [options.onPrimaryChange] - Callback when primary image changes (url or null)
   * @param {Function} [options.onChange] - Callback when images array changes
   */
  constructor({ container, userId, bookId = null, maxImages = 10, onPrimaryChange = () => {}, onChange = () => {} }) {
    this.container = container;
    this.userId = userId;
    this.bookId = bookId || `temp-${Date.now()}`;
    this.maxImages = maxImages;
    this.onPrimaryChange = onPrimaryChange;
    this.onChange = onChange;

    this.images = [];
    this.uploading = new Map(); // id -> progress
    this.newlyUploaded = new Set(); // Track images uploaded this session (for cleanup on cancel)
    this.draggedIndex = null;

    this.render();
  }

  /**
   * Set book ID (call when saving new book)
   * @param {string} bookId
   */
  setBookId(bookId) {
    this.bookId = bookId;
  }

  /**
   * Load existing images
   * @param {Array} images - Array of image objects
   */
  setImages(images) {
    this.images = images || [];
    this.render();
    this.notifyPrimaryChange();
  }

  /**
   * Get current images array
   * @returns {Array}
   */
  getImages() {
    return [...this.images];
  }

  /**
   * Get primary image URL
   * @returns {string|null}
   */
  getPrimaryImageUrl() {
    const primary = getPrimaryImage(this.images);
    return primary ? primary.url : null;
  }

  /**
   * Check if there are any images
   * @returns {boolean}
   */
  hasImages() {
    return this.images.length > 0;
  }

  /**
   * Handle file selection from input
   * @param {FileList} files
   */
  async handleFileSelect(files) {
    const fileArray = Array.from(files);
    const availableSlots = this.maxImages - this.images.length - this.uploading.size;

    if (fileArray.length > availableSlots) {
      showToast(`Can only add ${availableSlots} more image${availableSlots !== 1 ? 's' : ''}`, { type: 'error' });
      return;
    }

    // Validate all files first
    for (const file of fileArray) {
      const validation = validateImage(file);
      if (!validation.valid) {
        showToast(validation.error, { type: 'error' });
        return;
      }
    }

    // Upload each file
    for (const file of fileArray) {
      await this.uploadSingleImage(file);
    }
  }

  /**
   * Upload a single image
   * @param {File} file
   */
  async uploadSingleImage(file) {
    const tempId = `uploading-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.uploading.set(tempId, 0);
    this.render();

    try {
      const result = await uploadImage(
        file,
        this.userId,
        this.bookId,
        (progress) => {
          this.uploading.set(tempId, progress);
          this.render();
        }
      );

      // Create image object
      const newImage = {
        id: result.id,
        url: result.url,
        storagePath: result.storagePath,
        isPrimary: false, // User must explicitly set as cover
        uploadedAt: Date.now(),
        sizeBytes: result.sizeBytes,
        width: result.width,
        height: result.height
      };

      this.images.push(newImage);
      this.newlyUploaded.add(newImage.id); // Track for cleanup on cancel
      this.uploading.delete(tempId);
      this.render();
      this.notifyChange();
      this.notifyPrimaryChange();

      showToast('Image uploaded', { type: 'success' });
    } catch (error) {
      console.error('Upload error:', error);
      this.uploading.delete(tempId);
      this.render();
      showToast('Failed to upload image. Please try again.', { type: 'error' });
    }
  }

  /**
   * Delete an image
   * @param {string} imageId
   */
  async handleDelete(imageId) {
    const image = this.images.find(img => img.id === imageId);
    if (!image) return;

    const wasPrimary = image.isPrimary;

    // Show confirmation
    const confirmed = await ConfirmModal.show({
      title: 'Delete Image',
      message: wasPrimary
        ? 'This is your cover image. Delete it anyway?'
        : 'Are you sure you want to delete this image?',
      confirmText: 'Delete',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white'
    });

    if (!confirmed) return;

    // Always remove from array, even if storage delete fails
    this.images = this.images.filter(img => img.id !== imageId);
    this.newlyUploaded.delete(imageId);

    // If deleted image was primary and there are still images, make first one primary
    if (wasPrimary && this.images.length > 0) {
      this.images[0].isPrimary = true;
    }

    this.render();
    this.notifyChange();
    this.notifyPrimaryChange();

    // Try to delete from storage (best effort, don't block on failure)
    try {
      await deleteImage(image.storagePath);
    } catch (error) {
      // Ignore storage errors - file may already be deleted
      console.warn('Storage delete failed (file may already be deleted):', error.message);
    }

    showToast('Image deleted', { type: 'success' });
  }

  /**
   * Set an image as primary cover
   * @param {string} imageId
   */
  handleSetPrimary(imageId) {
    this.images = setPrimaryImage(this.images, imageId);
    this.render();
    this.notifyChange();
    this.notifyPrimaryChange(true); // User explicitly set this as cover
  }

  /**
   * Handle drag start
   * @param {number} index
   */
  handleDragStart(index) {
    this.draggedIndex = index;
  }

  /**
   * Handle drag over
   * @param {number} index
   * @param {DragEvent} event
   */
  handleDragOver(index, event) {
    event.preventDefault();
    if (this.draggedIndex === null || this.draggedIndex === index) return;

    // Reorder images
    const draggedImage = this.images[this.draggedIndex];
    this.images.splice(this.draggedIndex, 1);
    this.images.splice(index, 0, draggedImage);
    this.draggedIndex = index;
    this.render();
  }

  /**
   * Handle drag end
   */
  handleDragEnd() {
    if (this.draggedIndex !== null) {
      this.draggedIndex = null;
      this.notifyChange();
    }
  }

  /**
   * Notify parent of images change
   */
  notifyChange() {
    this.onChange(this.getImages());
  }

  /**
   * Notify parent of primary image change
   * @param {boolean} [userInitiated=false] - True if user explicitly clicked to set as cover
   */
  notifyPrimaryChange(userInitiated = false) {
    const primaryUrl = this.getPrimaryImageUrl();
    this.onPrimaryChange(primaryUrl, userInitiated);
  }

  /**
   * Render the gallery UI
   */
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

        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          ${this.images.map((img, index) => this.renderImageTile(img, index)).join('')}
          ${Array.from(this.uploading.entries()).map(([id, progress]) => this.renderUploadingTile(id, progress)).join('')}
          ${canAdd ? this.renderEmptySlot() : ''}
        </div>

        ${this.images.length > 0 ? `
          <p class="text-xs text-gray-500">
            ${this.images.length > 1 ? 'Drag to reorder. ' : ''}Tap to set as cover image.
          </p>
        ` : ''}
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners();
    initIcons();
  }

  /**
   * Render a single image tile
   * @param {Object} img
   * @param {number} index
   * @returns {string}
   */
  renderImageTile(img, index) {
    const isPrimary = img.isPrimary;

    return `
      <div class="relative group aspect-square bg-gray-100 rounded-lg border-2 ${isPrimary ? 'border-primary ring-2 ring-primary/30' : 'border-transparent'}"
           draggable="true"
           data-index="${index}"
           data-image-id="${escapeAttr(img.id)}">
        <!-- Loading skeleton -->
        <div class="image-loading absolute inset-0 flex items-center justify-center bg-gray-100">
          <div class="w-6 h-6 border-2 border-gray-300 border-t-primary rounded-full animate-spin"></div>
        </div>

        <!-- Image with load/error handling -->
        <img src="${escapeAttr(img.url)}"
             alt="Book image ${index + 1}"
             class="w-full h-full object-cover hidden"
             onload="this.classList.remove('hidden'); this.previousElementSibling.classList.add('hidden');"
             onerror="this.style.display='none'; this.previousElementSibling.innerHTML='<i data-lucide=\\'image-off\\' class=\\'w-8 h-8 text-gray-400\\'></i>'; lucide.createIcons();">

        <!-- Primary badge -->
        ${isPrimary ? `
          <div class="absolute top-1 left-1 px-1.5 py-0.5 bg-primary text-white text-xs rounded font-medium z-10">
            Cover
          </div>
        ` : ''}

        <!-- Delete button (always visible, overlapping top-right corner) -->
        <button type="button"
                class="delete-btn absolute p-2 bg-white hover:bg-red-50 rounded-full shadow-md transition-colors z-20"
                style="top: -8px; right: -8px;"
                data-image-id="${escapeAttr(img.id)}"
                aria-label="Delete image">
          <i data-lucide="x" class="w-4 h-4 text-gray-600" aria-hidden="true"></i>
        </button>

        <!-- Set as cover overlay (visible on hover, only if not primary) -->
        ${!isPrimary ? `
          <button type="button"
                  class="set-primary-btn absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 cursor-pointer"
                  data-image-id="${escapeAttr(img.id)}"
                  aria-label="Set as cover">
            <span class="text-white text-xs font-medium text-center px-2">Set as cover</span>
          </button>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render an uploading tile with progress
   * @param {string} id
   * @param {number} progress
   * @returns {string}
   */
  renderUploadingTile(id, progress) {
    return `
      <div class="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border-2 border-dashed border-gray-300">
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span class="mt-2 text-sm text-gray-600">${progress}%</span>
        </div>
        <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
          <div class="h-full bg-primary transition-all duration-300" style="width: ${progress}%"></div>
        </div>
      </div>
    `;
  }

  /**
   * Render empty slot placeholder
   * @returns {string}
   */
  renderEmptySlot() {
    return `
      <label class="aspect-square bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer flex flex-col items-center justify-center">
        <i data-lucide="image-plus" class="w-8 h-8 text-gray-400" aria-hidden="true"></i>
        <span class="mt-1 text-xs text-gray-500">Add image</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple class="hidden" id="image-gallery-input-empty">
      </label>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // File input listeners
    const fileInputs = this.container.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleFileSelect(e.target.files);
          e.target.value = ''; // Reset for same file selection
        }
      });
    });

    // Delete buttons
    this.container.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const imageId = btn.dataset.imageId;
        this.handleDelete(imageId);
      });
    });

    // Set primary buttons
    this.container.querySelectorAll('.set-primary-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const imageId = btn.dataset.imageId;
        this.handleSetPrimary(imageId);
      });
    });

    // Drag and drop (desktop)
    const tiles = this.container.querySelectorAll('[draggable="true"]');
    tiles.forEach(tile => {
      tile.addEventListener('dragstart', () => {
        const index = parseInt(tile.dataset.index, 10);
        this.handleDragStart(index);
        tile.classList.add('opacity-50');
      });

      tile.addEventListener('dragend', () => {
        tile.classList.remove('opacity-50');
        this.handleDragEnd();
      });

      tile.addEventListener('dragover', (e) => {
        e.preventDefault();
        const index = parseInt(tile.dataset.index, 10);
        this.handleDragOver(index, e);
      });

      // Touch events for mobile drag and drop
      tile.addEventListener('touchstart', (e) => {
        // Only handle if more than one image (reordering makes sense)
        if (this.images.length <= 1) return;

        const index = parseInt(tile.dataset.index, 10);
        this.touchStartIndex = index;
        this.touchStartTime = Date.now();
        this.touchStartY = e.touches[0].clientY;
        this.touchStartX = e.touches[0].clientX;
        this.isTouchDragging = false;
      }, { passive: true });

      tile.addEventListener('touchmove', (e) => {
        if (this.touchStartIndex === undefined) return;

        const touch = e.touches[0];
        const deltaX = Math.abs(touch.clientX - this.touchStartX);
        const deltaY = Math.abs(touch.clientY - this.touchStartY);

        // Start dragging after moving 10px
        if (!this.isTouchDragging && (deltaX > 10 || deltaY > 10)) {
          this.isTouchDragging = true;
          this.handleDragStart(this.touchStartIndex);
          tile.classList.add('opacity-50', 'ring-2', 'ring-primary');
        }

        if (this.isTouchDragging) {
          e.preventDefault();

          // Temporarily hide tile to find element below
          tile.style.pointerEvents = 'none';
          const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
          tile.style.pointerEvents = '';

          const tileBelow = elementBelow?.closest('[draggable="true"]');

          if (tileBelow && tileBelow !== tile) {
            const targetIndex = parseInt(tileBelow.dataset.index, 10);
            if (!isNaN(targetIndex) && targetIndex !== this.draggedIndex) {
              this.handleDragOver(targetIndex, e);
            }
          }
        }
      }, { passive: false });

      tile.addEventListener('touchend', () => {
        if (this.isTouchDragging) {
          tile.classList.remove('opacity-50', 'ring-2', 'ring-primary');
          this.handleDragEnd();
        }
        this.touchStartIndex = undefined;
        this.isTouchDragging = false;
      });
    });
  }

  /**
   * Check if there are unsaved uploads
   * @returns {boolean}
   */
  hasUnsavedUploads() {
    return this.newlyUploaded.size > 0;
  }

  /**
   * Get newly uploaded images (for cleanup)
   * @returns {Array} Array of image objects that were uploaded this session
   */
  getNewlyUploadedImages() {
    return this.images.filter(img => this.newlyUploaded.has(img.id));
  }

  /**
   * Mark all uploads as saved (call after successful book save)
   * Clears the tracking so images won't be deleted on navigation
   */
  markAsSaved() {
    this.newlyUploaded.clear();
  }

  /**
   * Delete all newly uploaded images (call on cancel/navigation)
   * Best effort - may not complete if page unloads
   * @returns {Promise<number>} Number of images deleted
   */
  async cleanupUnsavedUploads() {
    if (this.newlyUploaded.size === 0) return 0;

    const imagesToDelete = this.getNewlyUploadedImages();
    let deletedCount = 0;

    for (const image of imagesToDelete) {
      try {
        await deleteImage(image.storagePath);
        deletedCount++;
      } catch (error) {
        console.error('Failed to cleanup image:', image.storagePath, error);
      }
    }

    // Clear tracking
    this.newlyUploaded.clear();
    this.images = this.images.filter(img => !imagesToDelete.some(d => d.id === img.id));

    return deletedCount;
  }

  /**
   * Cleanup - call when component is removed
   */
  destroy() {
    this.container.innerHTML = '';
    this.images = [];
    this.uploading.clear();
    this.newlyUploaded.clear();
  }
}
