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
      expect(toast.textContent).toContain('Test message');
    });

    it('should hide toast after default duration plus exit animation', () => {
      showToast('Test message');
      const toast = document.getElementById('toast');

      // Toast should be visible initially with enter animation
      expect(toast.classList.contains('hidden')).toBe(false);
      expect(toast.classList.contains('toast-enter')).toBe(true);

      // After 3000ms (default duration), exit animation starts
      vi.advanceTimersByTime(3000);
      expect(toast.classList.contains('toast-exit')).toBe(true);
      expect(toast.classList.contains('hidden')).toBe(false);

      // After exit animation (150ms), toast should be hidden
      vi.advanceTimersByTime(150);
      expect(toast.classList.contains('hidden')).toBe(true);
    });

    it('should accept custom duration as number', () => {
      showToast('Test message', 5000);
      const toast = document.getElementById('toast');

      vi.advanceTimersByTime(3000);
      expect(toast.classList.contains('hidden')).toBe(false);

      // Wait for duration (5000ms total) + exit animation (150ms)
      vi.advanceTimersByTime(2000);
      expect(toast.classList.contains('toast-exit')).toBe(true);
      vi.advanceTimersByTime(150);
      expect(toast.classList.contains('hidden')).toBe(true);
    });

    it('should accept custom duration in options', () => {
      showToast('Test message', { duration: 5000 });
      const toast = document.getElementById('toast');

      vi.advanceTimersByTime(3000);
      expect(toast.classList.contains('hidden')).toBe(false);

      // Wait for duration (5000ms total) + exit animation (150ms)
      vi.advanceTimersByTime(2000);
      expect(toast.classList.contains('toast-exit')).toBe(true);
      vi.advanceTimersByTime(150);
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
      expect(secondToast.textContent).toContain('Second message');
    });

    it('should clear previous timeout when showing new toast', () => {
      showToast('First message');

      vi.advanceTimersByTime(1500);
      showToast('Second message');

      // Original timeout would have fired at 3000ms, but we reset it
      vi.advanceTimersByTime(2000);
      const toast = document.getElementById('toast');
      expect(toast.classList.contains('hidden')).toBe(false);

      // New timeout fires at 1500 + 3000 = 4500ms from start (exit animation begins)
      vi.advanceTimersByTime(1000);
      expect(toast.classList.contains('toast-exit')).toBe(true);
      expect(toast.classList.contains('hidden')).toBe(false);

      // After exit animation (150ms), toast should be hidden
      vi.advanceTimersByTime(150);
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

    it('should include success icon for success type', () => {
      showToast('Success!', { type: 'success' });
      const toast = document.getElementById('toast');
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('check-circle');
    });

    it('should include error icon for error type', () => {
      showToast('Error!', { type: 'error' });
      const toast = document.getElementById('toast');
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('x-circle');
    });

    it('should include info icon for info type', () => {
      showToast('Info', { type: 'info' });
      const toast = document.getElementById('toast');
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('info');
    });

    it('should include info icon by default', () => {
      showToast('Default');
      const toast = document.getElementById('toast');
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('info');
    });

    it('should have flex layout for icon alignment', () => {
      showToast('Test');
      const toast = document.getElementById('toast');
      expect(toast.className).toContain('flex');
      expect(toast.className).toContain('items-center');
      expect(toast.className).toContain('gap-3');
    });
  });
});
