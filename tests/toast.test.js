// Toast Store Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { showToast } from '../src/js/stores/toast.js';

describe('Toast Store', () => {
  beforeEach(() => {
    // Clear any existing toasts
    const existingToast = document.getElementById('toast');
    if (existingToast) {
      existingToast.remove();
    }
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    const toast = document.getElementById('toast');
    if (toast) {
      toast.remove();
    }
  });

  describe('showToast', () => {
    it('should create toast element if it does not exist', () => {
      showToast('Test message');
      const toast = document.getElementById('toast');
      expect(toast).not.toBeNull();
    });

    it('should display the message', () => {
      showToast('Test message');
      const toast = document.getElementById('toast');
      expect(toast.textContent).toBe('Test message');
    });

    it('should hide toast after default duration', () => {
      showToast('Test message');
      const toast = document.getElementById('toast');

      // Toast should be visible initially
      expect(toast.classList.contains('hidden')).toBe(false);

      // After 3000ms (default duration), toast should be hidden
      vi.advanceTimersByTime(3000);
      expect(toast.classList.contains('hidden')).toBe(true);
    });

    it('should accept custom duration as number', () => {
      showToast('Test message', 5000);
      const toast = document.getElementById('toast');

      vi.advanceTimersByTime(3000);
      expect(toast.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(2000);
      expect(toast.classList.contains('hidden')).toBe(true);
    });

    it('should accept custom duration in options', () => {
      showToast('Test message', { duration: 5000 });
      const toast = document.getElementById('toast');

      vi.advanceTimersByTime(3000);
      expect(toast.classList.contains('hidden')).toBe(false);

      vi.advanceTimersByTime(2000);
      expect(toast.classList.contains('hidden')).toBe(true);
    });

    it('should apply success type styling', () => {
      showToast('Success!', { type: 'success' });
      const toast = document.getElementById('toast');
      expect(toast.className).toContain('bg-green-600');
    });

    it('should apply error type styling', () => {
      showToast('Error!', { type: 'error' });
      const toast = document.getElementById('toast');
      expect(toast.className).toContain('bg-red-600');
    });

    it('should apply info type styling by default', () => {
      showToast('Info');
      const toast = document.getElementById('toast');
      expect(toast.className).toContain('bg-gray-800');
    });

    it('should apply info type styling when specified', () => {
      showToast('Info', { type: 'info' });
      const toast = document.getElementById('toast');
      expect(toast.className).toContain('bg-gray-800');
    });

    it('should reuse existing toast element', () => {
      showToast('First message');
      const firstToast = document.getElementById('toast');

      showToast('Second message');
      const secondToast = document.getElementById('toast');

      expect(firstToast).toBe(secondToast);
      expect(secondToast.textContent).toBe('Second message');
    });

    it('should clear previous timeout when showing new toast', () => {
      showToast('First message');

      vi.advanceTimersByTime(1500);
      showToast('Second message');

      // Original timeout would have fired at 3000ms, but we reset it
      vi.advanceTimersByTime(2000);
      const toast = document.getElementById('toast');
      expect(toast.classList.contains('hidden')).toBe(false);

      // New timeout fires at 1500 + 3000 = 4500ms from start
      vi.advanceTimersByTime(1000);
      expect(toast.classList.contains('hidden')).toBe(true);
    });

    it('should have correct base classes', () => {
      showToast('Test');
      const toast = document.getElementById('toast');

      expect(toast.className).toContain('fixed');
      expect(toast.className).toContain('bottom-6');
      expect(toast.className).toContain('rounded-lg');
      expect(toast.className).toContain('shadow-lg');
      expect(toast.className).toContain('z-50');
    });

    it('should handle unknown type gracefully', () => {
      showToast('Test', { type: 'unknown' });
      const toast = document.getElementById('toast');
      // Should fall back to info styling
      expect(toast.className).toContain('bg-gray-800');
    });
  });
});
