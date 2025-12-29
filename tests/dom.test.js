// DOM Utilities Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  escapeHtml,
  escapeAttr,
  lockBodyScroll,
  unlockBodyScroll,
  initIcons,
  updateRatingStars,
  isMobile,
  getContrastColor
} from '../src/js/utils/dom.js';

describe('DOM Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('Say "Hello"')).toBe('Say "Hello"');
    });

    it('should return empty string for null', () => {
      expect(escapeHtml(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(escapeHtml('')).toBe('');
    });

    it('should handle plain text without escaping', () => {
      expect(escapeHtml('Hello World')).toBe('Hello World');
    });
  });

  describe('escapeAttr', () => {
    it('should escape double quotes', () => {
      expect(escapeAttr('value with "quotes"')).toBe('value with &quot;quotes&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeAttr("value with 'quotes'")).toBe('value with &#39;quotes&#39;');
    });

    it('should escape both quote types', () => {
      expect(escapeAttr(`"double" and 'single'`)).toBe('&quot;double&quot; and &#39;single&#39;');
    });

    it('should return empty string for null', () => {
      expect(escapeAttr(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(escapeAttr(undefined)).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(escapeAttr('')).toBe('');
    });

    it('should not escape other characters', () => {
      expect(escapeAttr('plain text')).toBe('plain text');
    });
  });

  describe('lockBodyScroll', () => {
    it('should set body overflow to hidden', () => {
      document.body.style.overflow = '';
      lockBodyScroll();
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  describe('unlockBodyScroll', () => {
    it('should reset body overflow', () => {
      document.body.style.overflow = 'hidden';
      unlockBodyScroll();
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('initIcons', () => {
    it('should call lucide.createIcons when lucide is defined', () => {
      const mockCreateIcons = vi.fn();
      globalThis.lucide = { createIcons: mockCreateIcons };

      initIcons();

      expect(mockCreateIcons).toHaveBeenCalled();
      delete globalThis.lucide;
    });

    it('should not throw when lucide is undefined', () => {
      delete globalThis.lucide;
      expect(() => initIcons()).not.toThrow();
    });
  });

  describe('updateRatingStars', () => {
    let starBtns;

    beforeEach(() => {
      // Create mock star buttons
      starBtns = [];
      for (let i = 1; i <= 5; i++) {
        const btn = document.createElement('button');
        btn.dataset.rating = i.toString();
        btn.classList.remove('active');
        starBtns.push(btn);
      }

      // Mock lucide
      globalThis.lucide = { createIcons: vi.fn() };
    });

    afterEach(() => {
      delete globalThis.lucide;
    });

    it('should add active class to stars up to current rating', () => {
      updateRatingStars(starBtns, 3);

      expect(starBtns[0].classList.contains('active')).toBe(true);
      expect(starBtns[1].classList.contains('active')).toBe(true);
      expect(starBtns[2].classList.contains('active')).toBe(true);
      expect(starBtns[3].classList.contains('active')).toBe(false);
      expect(starBtns[4].classList.contains('active')).toBe(false);
    });

    it('should handle rating of 0', () => {
      updateRatingStars(starBtns, 0);

      starBtns.forEach(btn => {
        expect(btn.classList.contains('active')).toBe(false);
      });
    });

    it('should handle rating of 5', () => {
      updateRatingStars(starBtns, 5);

      starBtns.forEach(btn => {
        expect(btn.classList.contains('active')).toBe(true);
      });
    });

    it('should call initIcons after updating stars', () => {
      updateRatingStars(starBtns, 3);
      expect(globalThis.lucide.createIcons).toHaveBeenCalled();
    });
  });

  describe('isMobile', () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalInnerWidth
      });
    });

    it('should return true for width < 768', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 767
      });
      expect(isMobile()).toBe(true);
    });

    it('should return false for width >= 768', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });
      expect(isMobile()).toBe(false);
    });

    it('should return false for large desktop width', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1920
      });
      expect(isMobile()).toBe(false);
    });

    it('should return true for small mobile width', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      expect(isMobile()).toBe(true);
    });
  });

  describe('getContrastColor', () => {
    it('should return black for light backgrounds', () => {
      expect(getContrastColor('#ffffff')).toBe('#000000');
      expect(getContrastColor('#ffff00')).toBe('#000000');
      expect(getContrastColor('#00ff00')).toBe('#000000');
    });

    it('should return white for dark backgrounds', () => {
      expect(getContrastColor('#000000')).toBe('#ffffff');
      expect(getContrastColor('#333333')).toBe('#ffffff');
      expect(getContrastColor('#0000ff')).toBe('#ffffff');
    });

    it('should handle hex without #', () => {
      expect(getContrastColor('ffffff')).toBe('#000000');
      expect(getContrastColor('000000')).toBe('#ffffff');
    });

    it('should return black for null', () => {
      expect(getContrastColor(null)).toBe('#000000');
    });

    it('should return black for undefined', () => {
      expect(getContrastColor(undefined)).toBe('#000000');
    });

    it('should return black for non-string values', () => {
      expect(getContrastColor(123)).toBe('#000000');
      expect(getContrastColor({})).toBe('#000000');
    });

    it('should handle mid-tone colours correctly', () => {
      // Gray should be on the border
      expect(getContrastColor('#808080')).toBe('#000000'); // Light enough
    });
  });
});
