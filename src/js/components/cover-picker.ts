// Reusable Cover Picker Component
import { initIcons, isValidImageUrl } from '../utils.js';

/** Cover source type */
export type CoverSource = 'googleBooks' | 'openLibrary' | 'userUpload';

/** Available covers object */
export interface CoverOptions {
  googleBooks?: string;
  openLibrary?: string;
  userUpload?: string;
}

/** Options for CoverPicker constructor */
export interface CoverPickerOptions {
  /** Container element to render into */
  container?: HTMLElement | null;
  /** Callback when cover is selected (url, source) */
  onSelect?: (url: string, source: CoverSource) => void;
  /** Currently selected cover URL */
  currentUrl?: string;
}

/** Internal element references */
interface CoverPickerElements {
  googleOption?: HTMLElement;
  openLibraryOption?: HTMLElement;
  userUploadOption?: HTMLElement;
  googleImg?: HTMLImageElement;
  openLibraryImg?: HTMLImageElement;
  userUploadImg?: HTMLImageElement;
  googleLoading?: HTMLElement;
  openLibraryLoading?: HTMLElement;
  userUploadLoading?: HTMLElement;
  coverOptions?: HTMLElement;
  placeholder?: HTMLElement;
}

/**
 * CoverPicker - Select book cover from multiple API sources
 *
 * @example
 * const picker = new CoverPicker({
 *   container: document.getElementById('cover-picker-container'),
 *   onSelect: (url, source) => console.log('Selected:', url, source)
 * });
 * picker.setCovers({ googleBooks: 'url1', openLibrary: 'url2' });
 */
export class CoverPicker {
  private container: HTMLElement | null;
  private onSelect: (url: string, source: CoverSource) => void;
  private currentUrl: string;
  private covers: CoverOptions;
  private elements: CoverPickerElements;

  constructor(options: CoverPickerOptions = {}) {
    this.container = options.container ?? null;
    this.onSelect = options.onSelect ?? (() => {});
    this.currentUrl = options.currentUrl ?? '';
    this.covers = {};
    this.elements = {};

    if (this.container) {
      this.render();
    }
  }

  /**
   * Render the cover picker UI
   */
  private render(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="cover-options flex gap-4 flex-wrap">
        <div data-source="googleBooks" class="cover-option hidden cursor-pointer rounded-lg border-2 border-transparent hover:border-primary p-2 transition-colors relative">
          <div class="text-xs text-gray-500 text-center mb-1">Google Books</div>
          <div class="relative w-16 h-24 mx-auto">
            <div class="cover-loading absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
              <i data-lucide="loader-2" class="w-5 h-5 text-gray-400 animate-spin"></i>
            </div>
            <img src="" alt="Google Books cover" class="w-16 h-24 rounded object-cover hidden">
          </div>
          <div class="cover-selected-badge hidden absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
            <i data-lucide="check" class="w-3 h-3 text-white"></i>
          </div>
        </div>
        <div data-source="openLibrary" class="cover-option hidden cursor-pointer rounded-lg border-2 border-transparent hover:border-primary p-2 transition-colors relative">
          <div class="text-xs text-gray-500 text-center mb-1">Open Library</div>
          <div class="relative w-16 h-24 mx-auto">
            <div class="cover-loading absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
              <i data-lucide="loader-2" class="w-5 h-5 text-gray-400 animate-spin"></i>
            </div>
            <img src="" alt="Open Library cover" class="w-16 h-24 rounded object-cover hidden">
          </div>
          <div class="cover-selected-badge hidden absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
            <i data-lucide="check" class="w-3 h-3 text-white"></i>
          </div>
        </div>
        <div data-source="userUpload" class="cover-option hidden cursor-pointer rounded-lg border-2 border-transparent hover:border-primary p-2 transition-colors relative">
          <div class="text-xs text-gray-500 text-center mb-1">Your Upload</div>
          <div class="relative w-16 h-24 mx-auto">
            <div class="cover-loading absolute inset-0 flex items-center justify-center bg-gray-100 rounded">
              <i data-lucide="loader-2" class="w-5 h-5 text-gray-400 animate-spin"></i>
            </div>
            <img src="" alt="Your uploaded cover" class="w-16 h-24 rounded object-cover hidden">
          </div>
          <div class="cover-selected-badge hidden absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
            <i data-lucide="check" class="w-3 h-3 text-white"></i>
          </div>
        </div>
      </div>
      <div class="no-cover-placeholder hidden">
        <div class="w-24 h-36 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300">
          <i data-lucide="book" class="w-10 h-10"></i>
        </div>
        <p class="text-xs text-gray-400 mt-1">No cover available</p>
      </div>
    `;

    // Store element references
    this.elements.googleOption = this.container.querySelector('[data-source="googleBooks"]') as HTMLElement;
    this.elements.openLibraryOption = this.container.querySelector('[data-source="openLibrary"]') as HTMLElement;
    this.elements.userUploadOption = this.container.querySelector('[data-source="userUpload"]') as HTMLElement;
    this.elements.googleImg = this.elements.googleOption?.querySelector('img') as HTMLImageElement;
    this.elements.openLibraryImg = this.elements.openLibraryOption?.querySelector('img') as HTMLImageElement;
    this.elements.userUploadImg = this.elements.userUploadOption?.querySelector('img') as HTMLImageElement;
    this.elements.googleLoading = this.elements.googleOption?.querySelector('.cover-loading') as HTMLElement;
    this.elements.openLibraryLoading = this.elements.openLibraryOption?.querySelector('.cover-loading') as HTMLElement;
    this.elements.userUploadLoading = this.elements.userUploadOption?.querySelector('.cover-loading') as HTMLElement;
    this.elements.coverOptions = this.container.querySelector('.cover-options') as HTMLElement;
    this.elements.placeholder = this.container.querySelector('.no-cover-placeholder') as HTMLElement;

    // Bind click handlers
    this.elements.googleOption?.addEventListener('click', () => this.select('googleBooks'));
    this.elements.openLibraryOption?.addEventListener('click', () => this.select('openLibrary'));
    this.elements.userUploadOption?.addEventListener('click', () => this.select('userUpload'));

    // Handle image load success - show image, hide spinner
    if (this.elements.googleImg) {
      this.elements.googleImg.onload = () => {
        this.elements.googleLoading?.classList.add('hidden');
        this.elements.googleImg?.classList.remove('hidden');
      };
    }

    if (this.elements.openLibraryImg) {
      this.elements.openLibraryImg.onload = () => {
        this.elements.openLibraryLoading?.classList.add('hidden');
        this.elements.openLibraryImg?.classList.remove('hidden');
      };
    }

    if (this.elements.userUploadImg) {
      this.elements.userUploadImg.onload = () => {
        this.elements.userUploadLoading?.classList.add('hidden');
        this.elements.userUploadImg?.classList.remove('hidden');
      };
    }

    // Handle image load errors
    if (this.elements.googleImg) {
      this.elements.googleImg.onerror = () => {
        this.elements.googleLoading?.classList.add('hidden');
        this.elements.googleOption?.classList.add('hidden');
        // Switch to other if this was selected
        if (this.currentUrl === this.covers.googleBooks && this.covers.openLibrary) {
          this.select('openLibrary');
        }
      };
    }

    if (this.elements.openLibraryImg) {
      this.elements.openLibraryImg.onerror = () => {
        this.elements.openLibraryLoading?.classList.add('hidden');
        this.elements.openLibraryOption?.classList.add('hidden');
        // Switch to other if this was selected
        if (this.currentUrl === this.covers.openLibrary && this.covers.googleBooks) {
          this.select('googleBooks');
        }
      };
    }

    if (this.elements.userUploadImg) {
      this.elements.userUploadImg.onerror = () => {
        this.elements.userUploadLoading?.classList.add('hidden');
        this.elements.userUploadOption?.classList.add('hidden');
      };
    }
  }

  /**
   * Set available covers and update display
   * @param covers - Object with googleBooks, openLibrary, and/or userUpload URLs
   * @param currentUrl - Currently selected URL (optional)
   */
  setCovers(covers: CoverOptions | null, currentUrl: string | null = null): void {
    this.covers = covers || {};
    if (currentUrl !== null) {
      this.currentUrl = currentUrl;
    }

    const hasGoogle = !!this.covers.googleBooks && isValidImageUrl(this.covers.googleBooks);
    const hasOpenLibrary = !!this.covers.openLibrary && isValidImageUrl(this.covers.openLibrary);
    const hasUserUpload = !!this.covers.userUpload && isValidImageUrl(this.covers.userUpload);
    const hasAnyCovers = hasGoogle || hasOpenLibrary || hasUserUpload;

    // Reset UI - hide cover options, reset selection styles, reset loading state
    this.elements.googleOption?.classList.add('hidden');
    this.elements.openLibraryOption?.classList.add('hidden');
    this.elements.userUploadOption?.classList.add('hidden');
    this.elements.googleOption?.classList.remove('border-primary', 'bg-primary/15');
    this.elements.openLibraryOption?.classList.remove('border-primary', 'bg-primary/15');
    this.elements.userUploadOption?.classList.remove('border-primary', 'bg-primary/15');
    // Reset images to loading state
    this.elements.googleImg?.classList.add('hidden');
    this.elements.openLibraryImg?.classList.add('hidden');
    this.elements.userUploadImg?.classList.add('hidden');
    this.elements.googleLoading?.classList.remove('hidden');
    this.elements.openLibraryLoading?.classList.remove('hidden');
    this.elements.userUploadLoading?.classList.remove('hidden');

    // Show placeholder if no covers available
    this.elements.coverOptions?.classList.toggle('hidden', !hasAnyCovers);
    this.elements.placeholder?.classList.toggle('hidden', hasAnyCovers);

    if (!hasAnyCovers) {
      initIcons();
      return;
    }

    // Show available options
    if (hasGoogle && this.elements.googleImg) {
      this.elements.googleOption?.classList.remove('hidden');
      this.elements.googleImg.src = this.covers.googleBooks!;
    }

    if (hasOpenLibrary && this.elements.openLibraryImg) {
      this.elements.openLibraryOption?.classList.remove('hidden');
      this.elements.openLibraryImg.src = this.covers.openLibrary!;
    }

    if (hasUserUpload && this.elements.userUploadImg) {
      this.elements.userUploadOption?.classList.remove('hidden');
      this.elements.userUploadImg.src = this.covers.userUpload!;
    }

    // Highlight current selection or auto-select first
    if (this.currentUrl === this.covers.userUpload) {
      this.highlightOption('userUpload');
    } else if (this.currentUrl === this.covers.googleBooks) {
      this.highlightOption('googleBooks');
    } else if (this.currentUrl === this.covers.openLibrary) {
      this.highlightOption('openLibrary');
    } else if (hasGoogle) {
      // Auto-select first available - use select() to set currentUrl
      this.currentUrl = this.covers.googleBooks!;
      this.highlightOption('googleBooks');
    } else if (hasOpenLibrary) {
      this.currentUrl = this.covers.openLibrary!;
      this.highlightOption('openLibrary');
    } else if (hasUserUpload) {
      this.currentUrl = this.covers.userUpload!;
      this.highlightOption('userUpload');
    }

    initIcons();
  }

  /**
   * Select a cover source
   * @param source - 'googleBooks', 'openLibrary', or 'userUpload'
   */
  select(source: CoverSource): void {
    const url = this.covers[source];
    if (!url) return;

    this.currentUrl = url;
    this.highlightOption(source);
    this.onSelect(url, source);
  }

  /**
   * Highlight the selected option
   * @param source - 'googleBooks', 'openLibrary', or 'userUpload'
   */
  private highlightOption(source: CoverSource): void {
    const googleBadge = this.elements.googleOption?.querySelector('.cover-selected-badge');
    const openLibraryBadge = this.elements.openLibraryOption?.querySelector('.cover-selected-badge');
    const userUploadBadge = this.elements.userUploadOption?.querySelector('.cover-selected-badge');

    this.elements.googleOption?.classList.toggle('border-primary', source === 'googleBooks');
    this.elements.googleOption?.classList.toggle('bg-primary/15', source === 'googleBooks');
    googleBadge?.classList.toggle('hidden', source !== 'googleBooks');

    this.elements.openLibraryOption?.classList.toggle('border-primary', source === 'openLibrary');
    this.elements.openLibraryOption?.classList.toggle('bg-primary/15', source === 'openLibrary');
    openLibraryBadge?.classList.toggle('hidden', source !== 'openLibrary');

    this.elements.userUploadOption?.classList.toggle('border-primary', source === 'userUpload');
    this.elements.userUploadOption?.classList.toggle('bg-primary/15', source === 'userUpload');
    userUploadBadge?.classList.toggle('hidden', source !== 'userUpload');

    initIcons();
  }

  /**
   * Get the currently selected cover URL
   * @returns Selected cover URL
   */
  getSelectedUrl(): string {
    return this.currentUrl;
  }

  /**
   * Get all available covers
   * @returns Available covers object
   */
  getCovers(): CoverOptions {
    return { ...this.covers };
  }

  /**
   * Check if any covers are available
   * @returns True if at least one cover is available
   */
  hasCovers(): boolean {
    return !!(this.covers.googleBooks || this.covers.openLibrary || this.covers.userUpload);
  }

  /**
   * Set a user-uploaded image as a cover option
   * Called when user marks an image as primary in ImageGallery
   * @param url - The Firebase Storage URL of the uploaded image, or null to clear
   * @param forceSelect - If true, select this as the cover even if another is selected
   */
  setUserUpload(url: string | null, forceSelect = false): void {
    // If no URL, remove user upload option
    if (!url) {
      const wasUserUploadSelected = this.currentUrl === this.covers.userUpload;
      delete this.covers.userUpload;

      if (wasUserUploadSelected) {
        // Switch to first available API cover
        const newUrl = this.covers.googleBooks || this.covers.openLibrary || '';
        this.setCovers(this.covers, newUrl);
        // Notify parent of the new selection
        if (newUrl) {
          const source: CoverSource = newUrl === this.covers.googleBooks ? 'googleBooks' : 'openLibrary';
          this.onSelect(newUrl, source);
        }
      } else {
        this.setCovers(this.covers, this.currentUrl);
      }
      return;
    }

    // Add to covers
    this.covers.userUpload = url;

    // Select if forced or if no cover is currently selected
    const shouldSelect = forceSelect || !this.currentUrl;
    this.setCovers(this.covers, shouldSelect ? url : this.currentUrl);
  }

  /**
   * Clear covers and reset UI
   */
  clear(): void {
    this.covers = {};
    this.currentUrl = '';
    this.setCovers(null);
  }

  /**
   * Destroy the component and clean up event listeners
   */
  destroy(): void {
    // Clear image event handlers
    if (this.elements.googleImg) {
      this.elements.googleImg.onload = null;
      this.elements.googleImg.onerror = null;
    }
    if (this.elements.openLibraryImg) {
      this.elements.openLibraryImg.onload = null;
      this.elements.openLibraryImg.onerror = null;
    }
    if (this.elements.userUploadImg) {
      this.elements.userUploadImg.onload = null;
      this.elements.userUploadImg.onerror = null;
    }

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Clear references
    this.elements = {};
    this.covers = {};
    this.currentUrl = '';
    this.container = null;
  }
}
