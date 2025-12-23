/**
 * Unit tests for src/js/components/cover-picker.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CoverPicker } from '../src/js/components/cover-picker.js';

describe('CoverPicker', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'cover-picker';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('initialization', () => {
    it('should render cover options', () => {
      const picker = new CoverPicker({ container });

      expect(container.querySelector('[data-source="googleBooks"]')).toBeTruthy();
      expect(container.querySelector('[data-source="openLibrary"]')).toBeTruthy();
    });

    it('should render no cover message', () => {
      const picker = new CoverPicker({ container });

      expect(container.querySelector('.no-cover-msg')).toBeTruthy();
    });

    it('should hide options by default', () => {
      const picker = new CoverPicker({ container });

      expect(container.querySelector('[data-source="googleBooks"]').classList.contains('hidden')).toBe(true);
      expect(container.querySelector('[data-source="openLibrary"]').classList.contains('hidden')).toBe(true);
    });

    it('should handle missing container', () => {
      const picker = new CoverPicker({ container: null });

      expect(picker.covers).toEqual({});
    });
  });

  describe('setCovers', () => {
    it('should show Google Books option when available', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      expect(container.querySelector('[data-source="googleBooks"]').classList.contains('hidden')).toBe(false);
      expect(container.querySelector('[data-source="openLibrary"]').classList.contains('hidden')).toBe(true);
    });

    it('should show Open Library option when available', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ openLibrary: 'https://example.com/ol.jpg' });

      expect(container.querySelector('[data-source="googleBooks"]').classList.contains('hidden')).toBe(true);
      expect(container.querySelector('[data-source="openLibrary"]').classList.contains('hidden')).toBe(false);
    });

    it('should show both options when both available', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/ol.jpg'
      });

      expect(container.querySelector('[data-source="googleBooks"]').classList.contains('hidden')).toBe(false);
      expect(container.querySelector('[data-source="openLibrary"]').classList.contains('hidden')).toBe(false);
    });

    it('should show no cover message when no covers available', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({});

      expect(container.querySelector('.no-cover-msg').classList.contains('hidden')).toBe(false);
    });

    it('should set image src correctly', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/ol.jpg'
      });

      const googleImg = container.querySelector('[data-source="googleBooks"] img');
      const olImg = container.querySelector('[data-source="openLibrary"] img');

      expect(googleImg.src).toBe('https://example.com/google.jpg');
      expect(olImg.src).toBe('https://example.com/ol.jpg');
    });

    it('should highlight current URL', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers(
        {
          googleBooks: 'https://example.com/google.jpg',
          openLibrary: 'https://example.com/ol.jpg'
        },
        'https://example.com/ol.jpg'
      );

      const olOption = container.querySelector('[data-source="openLibrary"]');
      expect(olOption.classList.contains('border-primary')).toBe(true);
    });

    it('should auto-select Google Books when no current URL', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/ol.jpg'
      });

      const googleOption = container.querySelector('[data-source="googleBooks"]');
      expect(googleOption.classList.contains('border-primary')).toBe(true);
    });
  });

  describe('select', () => {
    it('should call onSelect callback when cover selected', () => {
      const onSelect = vi.fn();
      const picker = new CoverPicker({ container, onSelect });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });
      picker.select('googleBooks');

      expect(onSelect).toHaveBeenCalledWith('https://example.com/google.jpg', 'googleBooks');
    });

    it('should update currentUrl when selected', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });
      picker.select('googleBooks');

      expect(picker.getSelectedUrl()).toBe('https://example.com/google.jpg');
    });

    it('should not call callback for invalid source', () => {
      const onSelect = vi.fn();
      const picker = new CoverPicker({ container, onSelect });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });
      picker.select('openLibrary'); // Not available

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should highlight selected option', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/ol.jpg'
      });
      picker.select('openLibrary');

      const olOption = container.querySelector('[data-source="openLibrary"]');
      const googleOption = container.querySelector('[data-source="googleBooks"]');

      expect(olOption.classList.contains('border-primary')).toBe(true);
      expect(googleOption.classList.contains('border-primary')).toBe(false);
    });
  });

  describe('click interaction', () => {
    it('should select cover when option clicked', () => {
      const onSelect = vi.fn();
      const picker = new CoverPicker({ container, onSelect });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      const googleOption = container.querySelector('[data-source="googleBooks"]');
      googleOption.click();

      expect(onSelect).toHaveBeenCalledWith('https://example.com/google.jpg', 'googleBooks');
    });
  });

  describe('getters', () => {
    it('should return selected URL', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });
      picker.select('googleBooks');

      expect(picker.getSelectedUrl()).toBe('https://example.com/google.jpg');
    });

    it('should return covers object', () => {
      const picker = new CoverPicker({ container });

      const covers = {
        googleBooks: 'https://example.com/google.jpg',
        openLibrary: 'https://example.com/ol.jpg'
      };
      picker.setCovers(covers);

      expect(picker.getCovers()).toEqual(covers);
    });

    it('should check if has covers', () => {
      const picker = new CoverPicker({ container });

      expect(picker.hasCovers()).toBe(false);

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });

      expect(picker.hasCovers()).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear covers and reset UI', () => {
      const picker = new CoverPicker({ container });

      picker.setCovers({ googleBooks: 'https://example.com/google.jpg' });
      picker.clear();

      expect(picker.getCovers()).toEqual({});
      expect(picker.getSelectedUrl()).toBe('');
      expect(picker.hasCovers()).toBe(false);
    });
  });
});
