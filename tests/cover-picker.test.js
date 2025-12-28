/**
 * Tests for CoverPicker component
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoverPicker } from '../src/js/components/cover-picker.js';

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  initIcons: vi.fn(),
  isValidImageUrl: (url) => url && (url.startsWith('http://') || url.startsWith('https://'))
}));

describe('CoverPicker', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'cover-picker';
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const picker = new CoverPicker({ container });

      expect(picker.container).toBe(container);
      expect(picker.currentUrl).toBe('');
      expect(picker.covers).toEqual({});
    });

    it('should accept onSelect callback', () => {
      const onSelect = vi.fn();
      const picker = new CoverPicker({ container, onSelect });

      expect(picker.onSelect).toBe(onSelect);
    });

    it('should accept currentUrl option', () => {
      const picker = new CoverPicker({
        container,
        currentUrl: 'https://example.com/cover.jpg'
      });

      expect(picker.currentUrl).toBe('https://example.com/cover.jpg');
    });

    it('should render when container is provided', () => {
      const picker = new CoverPicker({ container });

      expect(container.querySelector('.cover-options')).toBeTruthy();
    });

    it('should not render when container is null', () => {
      const picker = new CoverPicker({ container: null });

      expect(picker.elements).toEqual({});
    });
  });

  describe('render', () => {
    it('should render Google Books option', () => {
      const picker = new CoverPicker({ container });

      expect(container.querySelector('[data-source="googleBooks"]')).toBeTruthy();
      expect(container.textContent).toContain('Google Books');
    });

    it('should render Open Library option', () => {
      const picker = new CoverPicker({ container });

      expect(container.querySelector('[data-source="openLibrary"]')).toBeTruthy();
      expect(container.textContent).toContain('Open Library');
    });

    it('should render placeholder for no cover', () => {
      const picker = new CoverPicker({ container });

      expect(container.querySelector('.no-cover-placeholder')).toBeTruthy();
    });

    it('should hide cover options by default', () => {
      const picker = new CoverPicker({ container });

      const googleOption = container.querySelector('[data-source="googleBooks"]');
      const openLibraryOption = container.querySelector('[data-source="openLibrary"]');

      expect(googleOption.classList.contains('hidden')).toBe(true);
      expect(openLibraryOption.classList.contains('hidden')).toBe(true);
    });
  });

  describe('setCovers', () => {
    it('should show Google Books option when URL is provided', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      const googleOption = container.querySelector('[data-source="googleBooks"]');
      expect(googleOption.classList.contains('hidden')).toBe(false);
    });

    it('should show Open Library option when URL is provided', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ openLibrary: 'https://example.com/openlibrary.jpg' });

      const openLibraryOption = container.querySelector('[data-source="openLibrary"]');
      expect(openLibraryOption.classList.contains('hidden')).toBe(false);
    });

    it('should show both options when both URLs are provided', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      });

      const googleOption = container.querySelector('[data-source="googleBooks"]');
      const openLibraryOption = container.querySelector('[data-source="openLibrary"]');

      expect(googleOption.classList.contains('hidden')).toBe(false);
      expect(openLibraryOption.classList.contains('hidden')).toBe(false);
    });

    it('should hide placeholder when covers are available', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      const placeholder = container.querySelector('.no-cover-placeholder');
      expect(placeholder.classList.contains('hidden')).toBe(true);
    });

    it('should show placeholder when no valid covers', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: null, openLibrary: null });

      const placeholder = container.querySelector('.no-cover-placeholder');
      expect(placeholder.classList.contains('hidden')).toBe(false);
    });

    it('should auto-select first available cover (Google Books)', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      expect(picker.currentUrl).toBe('https://example.com/google.jpg');
    });

    it('should auto-select Open Library if Google Books unavailable', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ openLibrary: 'https://example.com/openlibrary.jpg' });

      expect(picker.currentUrl).toBe('https://example.com/openlibrary.jpg');
    });

    it('should highlight current selection', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      }, 'https://example.com/openlibrary.jpg');

      const openLibraryOption = container.querySelector('[data-source="openLibrary"]');
      expect(openLibraryOption.classList.contains('border-primary')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'invalid-url' });

      const googleOption = container.querySelector('[data-source="googleBooks"]');
      expect(googleOption.classList.contains('hidden')).toBe(true);
    });

    it('should handle null covers object', () => {
      const picker = new CoverPicker({ container });

      expect(() => picker.setCovers(null)).not.toThrow();
    });
  });

  describe('select', () => {
    it('should update currentUrl', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      });

      picker.select('openLibrary');

      expect(picker.currentUrl).toBe('https://example.com/openlibrary.jpg');
    });

    it('should call onSelect callback', () => {
      const onSelect = vi.fn();
      const picker = new CoverPicker({ container, onSelect });
      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      });

      picker.select('googleBooks');

      expect(onSelect).toHaveBeenCalledWith('https://example.com/google.jpg', 'googleBooks');
    });

    it('should not update if cover does not exist', () => {
      const onSelect = vi.fn();
      const picker = new CoverPicker({ container, onSelect });
      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });
      const originalUrl = picker.currentUrl;

      picker.select('openLibrary');

      expect(picker.currentUrl).toBe(originalUrl);
    });
  });

  describe('getSelectedUrl', () => {
    it('should return current URL', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      expect(picker.getSelectedUrl()).toBe('https://example.com/google.jpg');
    });

    it('should return empty string when no selection', () => {
      const picker = new CoverPicker({ container });

      expect(picker.getSelectedUrl()).toBe('');
    });
  });

  describe('getCovers', () => {
    it('should return copy of covers object', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      });

      const covers = picker.getCovers();
      covers.googleBooks = 'modified';

      expect(picker.covers.googleBooks).toBe('https://example.com/google.jpg');
    });
  });

  describe('hasCovers', () => {
    it('should return true when Google Books cover exists', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      expect(picker.hasCovers()).toBe(true);
    });

    it('should return false when no covers', () => {
      const picker = new CoverPicker({ container });

      expect(picker.hasCovers()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear covers and current URL', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      picker.clear();

      expect(picker.covers).toEqual({});
      expect(picker.currentUrl).toBe('');
    });
  });

  describe('destroy', () => {
    it('should clear container', () => {
      const picker = new CoverPicker({ container });

      picker.destroy();

      expect(container.innerHTML).toBe('');
    });

    it('should clear element references', () => {
      const picker = new CoverPicker({ container });

      picker.destroy();

      expect(picker.elements).toEqual({});
    });
  });

  describe('click handlers', () => {
    it('should select Google Books on click', () => {
      const onSelect = vi.fn();
      const picker = new CoverPicker({ container, onSelect });
      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      });
      onSelect.mockClear();

      const googleOption = container.querySelector('[data-source="googleBooks"]');
      googleOption.click();

      expect(onSelect).toHaveBeenCalledWith('https://example.com/google.jpg', 'googleBooks');
    });
  });

  describe('image load handlers', () => {
    it('should hide loading spinner on image load', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      picker.elements.googleImg.onload();

      expect(picker.elements.googleLoading.classList.contains('hidden')).toBe(true);
      expect(picker.elements.googleImg.classList.contains('hidden')).toBe(false);
    });

    it('should hide option on image error', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      });
      picker.currentUrl = picker.covers.googleBooks;

      picker.elements.googleImg.onerror();

      expect(picker.elements.googleOption.classList.contains('hidden')).toBe(true);
    });

    it('should switch to other cover on error if available', () => {
      const picker = new CoverPicker({ container });
      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/openlibrary.jpg'
      });
      picker.currentUrl = picker.covers.googleBooks;

      picker.elements.googleImg.onerror();

      expect(picker.currentUrl).toBe('https://example.com/openlibrary.jpg');
    });
  });
});
