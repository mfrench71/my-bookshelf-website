// Reusable Cover Picker Component
import { initIcons, isValidImageUrl } from '../utils.js';

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
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element to render into
   * @param {Function} options.onSelect - Callback when cover is selected (url, source)
   * @param {string} options.currentUrl - Currently selected cover URL (optional)
   */
  constructor(options = {}) {
    this.container = options.container;
    this.onSelect = options.onSelect || (() => {});
    this.currentUrl = options.currentUrl || '';
    this.covers = {};
    this.elements = {};

    if (this.container) {
      this.render();
    }
  }

  /**
   * Render the cover picker UI
   */
  render() {
    this.container.innerHTML = `
      <div class="cover-options flex gap-4 flex-wrap">
        <div data-source="googleBooks" class="cover-option hidden cursor-pointer rounded-lg border-2 border-transparent hover:border-primary p-1 transition-colors relative">
          <div class="text-xs text-gray-500 text-center mb-1">Google Books</div>
          <img src="" alt="Google Books cover" class="w-16 h-24 rounded object-cover mx-auto">
          <div class="cover-selected-badge hidden absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow">
            <i data-lucide="check" class="w-3 h-3 text-white"></i>
          </div>
        </div>
        <div data-source="openLibrary" class="cover-option hidden cursor-pointer rounded-lg border-2 border-transparent hover:border-primary p-1 transition-colors relative">
          <div class="text-xs text-gray-500 text-center mb-1">Open Library</div>
          <img src="" alt="Open Library cover" class="w-16 h-24 rounded object-cover mx-auto">
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
    this.elements.googleOption = this.container.querySelector('[data-source="googleBooks"]');
    this.elements.openLibraryOption = this.container.querySelector('[data-source="openLibrary"]');
    this.elements.googleImg = this.elements.googleOption.querySelector('img');
    this.elements.openLibraryImg = this.elements.openLibraryOption.querySelector('img');
    this.elements.coverOptions = this.container.querySelector('.cover-options');
    this.elements.placeholder = this.container.querySelector('.no-cover-placeholder');

    // Bind click handlers
    this.elements.googleOption.addEventListener('click', () => this.select('googleBooks'));
    this.elements.openLibraryOption.addEventListener('click', () => this.select('openLibrary'));

    // Handle image load errors
    this.elements.googleImg.onerror = () => {
      this.elements.googleOption.classList.add('hidden');
      // Switch to other if this was selected
      if (this.currentUrl === this.covers.googleBooks && this.covers.openLibrary) {
        this.select('openLibrary');
      }
    };

    this.elements.openLibraryImg.onerror = () => {
      this.elements.openLibraryOption.classList.add('hidden');
      // Switch to other if this was selected
      if (this.currentUrl === this.covers.openLibrary && this.covers.googleBooks) {
        this.select('googleBooks');
      }
    };
  }

  /**
   * Set available covers and update display
   * @param {Object} covers - Object with googleBooks and/or openLibrary URLs
   * @param {string} currentUrl - Currently selected URL (optional)
   */
  setCovers(covers, currentUrl = null) {
    this.covers = covers || {};
    if (currentUrl !== null) {
      this.currentUrl = currentUrl;
    }

    const hasGoogle = !!this.covers.googleBooks && isValidImageUrl(this.covers.googleBooks);
    const hasOpenLibrary = !!this.covers.openLibrary && isValidImageUrl(this.covers.openLibrary);
    const hasAnyCovers = hasGoogle || hasOpenLibrary;

    // Reset UI - hide cover options, reset selection styles
    this.elements.googleOption.classList.add('hidden');
    this.elements.openLibraryOption.classList.add('hidden');
    this.elements.googleOption.classList.remove('border-primary', 'bg-primary/15');
    this.elements.openLibraryOption.classList.remove('border-primary', 'bg-primary/15');

    // Show placeholder if no covers available
    this.elements.coverOptions.classList.toggle('hidden', !hasAnyCovers);
    this.elements.placeholder.classList.toggle('hidden', hasAnyCovers);

    if (!hasAnyCovers) {
      initIcons();
      return;
    }

    // Show available options
    if (hasGoogle) {
      this.elements.googleOption.classList.remove('hidden');
      this.elements.googleImg.src = this.covers.googleBooks;
    }

    if (hasOpenLibrary) {
      this.elements.openLibraryOption.classList.remove('hidden');
      this.elements.openLibraryImg.src = this.covers.openLibrary;
    }

    // Highlight current selection or auto-select first
    if (this.currentUrl === this.covers.googleBooks) {
      this.highlightOption('googleBooks');
    } else if (this.currentUrl === this.covers.openLibrary) {
      this.highlightOption('openLibrary');
    } else if (hasGoogle) {
      this.highlightOption('googleBooks');
    } else if (hasOpenLibrary) {
      this.highlightOption('openLibrary');
    }

    initIcons();
  }

  /**
   * Select a cover source
   * @param {string} source - 'googleBooks' or 'openLibrary'
   */
  select(source) {
    const url = this.covers[source];
    if (!url) return;

    this.currentUrl = url;
    this.highlightOption(source);
    this.onSelect(url, source);
  }

  /**
   * Highlight the selected option
   * @param {string} source - 'googleBooks' or 'openLibrary'
   */
  highlightOption(source) {
    const googleBadge = this.elements.googleOption.querySelector('.cover-selected-badge');
    const openLibraryBadge = this.elements.openLibraryOption.querySelector('.cover-selected-badge');

    this.elements.googleOption.classList.toggle('border-primary', source === 'googleBooks');
    this.elements.googleOption.classList.toggle('bg-primary/15', source === 'googleBooks');
    googleBadge?.classList.toggle('hidden', source !== 'googleBooks');

    this.elements.openLibraryOption.classList.toggle('border-primary', source === 'openLibrary');
    this.elements.openLibraryOption.classList.toggle('bg-primary/15', source === 'openLibrary');
    openLibraryBadge?.classList.toggle('hidden', source !== 'openLibrary');

    initIcons();
  }

  /**
   * Get the currently selected cover URL
   * @returns {string} Selected cover URL
   */
  getSelectedUrl() {
    return this.currentUrl;
  }

  /**
   * Get all available covers
   * @returns {Object} Available covers object
   */
  getCovers() {
    return { ...this.covers };
  }

  /**
   * Check if any covers are available
   * @returns {boolean} True if at least one cover is available
   */
  hasCovers() {
    return !!(this.covers.googleBooks || this.covers.openLibrary);
  }

  /**
   * Clear covers and reset UI
   */
  clear() {
    this.covers = {};
    this.currentUrl = '';
    this.setCovers(null);
  }
}
