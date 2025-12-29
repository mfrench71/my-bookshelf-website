// Toast Store Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { showToast, clearAllToasts, resetToastState } from '../src/js/stores/toast.js';

describe('Toast Store', () => {
  beforeEach(() => {
    // Reset toast state completely between tests
    resetToastState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetToastState();
  });

  /**
   * Helper to get toast container
   */
  function getContainer() {
    return document.getElementById('toast-container');
  }

  /**
   * Helper to get all active toast items
   */
  function getToasts() {
    const container = getContainer();
    return container ? Array.from(container.querySelectorAll('.toast-item')) : [];
  }

  describe('showToast', () => {
    it('should create toast container if it does not exist', () => {
      showToast('Test message');
      const container = getContainer();
      expect(container).not.toBeNull();
      expect(container.id).toBe('toast-container');
    });

    it('should display the message', () => {
      showToast('Test message');
      const toasts = getToasts();
      expect(toasts.length).toBe(1);
      expect(toasts[0].textContent).toContain('Test message');
    });

    it('should remove toast after default duration plus exit animation', () => {
      showToast('Test message');
      expect(getToasts().length).toBe(1);

      // After 3000ms (default duration), exit animation starts
      vi.advanceTimersByTime(3000);
      const toast = getToasts()[0];
      expect(toast.classList.contains('toast-queue-exit')).toBe(true);

      // After exit animation (150ms), toast should be removed
      vi.advanceTimersByTime(150);
      expect(getToasts().length).toBe(0);
    });

    it('should accept custom duration as number', () => {
      showToast('Test message', 5000);
      expect(getToasts().length).toBe(1);

      vi.advanceTimersByTime(3000);
      expect(getToasts().length).toBe(1);

      // Wait for duration (5000ms total) + exit animation (150ms)
      vi.advanceTimersByTime(2000);
      expect(getToasts()[0].classList.contains('toast-queue-exit')).toBe(true);
      vi.advanceTimersByTime(150);
      expect(getToasts().length).toBe(0);
    });

    it('should accept custom duration in options', () => {
      showToast('Test message', { duration: 5000 });
      expect(getToasts().length).toBe(1);

      vi.advanceTimersByTime(3000);
      expect(getToasts().length).toBe(1);

      // Wait for duration (5000ms total) + exit animation (150ms)
      vi.advanceTimersByTime(2000);
      expect(getToasts()[0].classList.contains('toast-queue-exit')).toBe(true);
      vi.advanceTimersByTime(150);
      expect(getToasts().length).toBe(0);
    });

    it('should apply success type styling', () => {
      showToast('Success!', { type: 'success' });
      const toast = getToasts()[0];
      expect(toast.className).toContain('bg-green-600');
    });

    it('should apply error type styling', () => {
      showToast('Error!', { type: 'error' });
      const toast = getToasts()[0];
      expect(toast.className).toContain('bg-red-600');
    });

    it('should apply info type styling by default', () => {
      showToast('Info');
      const toast = getToasts()[0];
      expect(toast.className).toContain('bg-gray-800');
    });

    it('should apply info type styling when specified', () => {
      showToast('Info', { type: 'info' });
      const toast = getToasts()[0];
      expect(toast.className).toContain('bg-gray-800');
    });

    it('should handle unknown type gracefully', () => {
      showToast('Test', { type: 'unknown' });
      const toast = getToasts()[0];
      // Should fall back to info styling
      expect(toast.className).toContain('bg-gray-800');
    });

    it('should include success icon for success type', () => {
      showToast('Success!', { type: 'success' });
      const toast = getToasts()[0];
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('check-circle');
    });

    it('should include error icon for error type', () => {
      showToast('Error!', { type: 'error' });
      const toast = getToasts()[0];
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('x-circle');
    });

    it('should include info icon for info type', () => {
      showToast('Info', { type: 'info' });
      const toast = getToasts()[0];
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('info');
    });

    it('should include info icon by default', () => {
      showToast('Default');
      const toast = getToasts()[0];
      const icon = toast.querySelector('[data-lucide]');
      expect(icon).not.toBeNull();
      expect(icon.getAttribute('data-lucide')).toBe('info');
    });

    it('should have flex layout for icon alignment', () => {
      showToast('Test');
      const toast = getToasts()[0];
      expect(toast.className).toContain('flex');
      expect(toast.className).toContain('items-center');
      expect(toast.className).toContain('gap-3');
    });

    it('should have cursor-pointer class for tap-to-dismiss affordance', () => {
      showToast('Test');
      const toast = getToasts()[0];
      expect(toast.className).toContain('cursor-pointer');
    });

    it('should dismiss toast when clicked', () => {
      showToast('Test message');
      const toast = getToasts()[0];

      // Click the toast
      toast.click();

      // Exit animation should start immediately
      expect(toast.classList.contains('toast-queue-exit')).toBe(true);

      // After exit animation (150ms), toast should be removed
      vi.advanceTimersByTime(150);
      expect(getToasts().length).toBe(0);
    });

    it('should clear scheduled timeout when clicked early', () => {
      showToast('Test message', { duration: 5000 });
      const toast = getToasts()[0];

      // Wait 1 second then click
      vi.advanceTimersByTime(1000);
      toast.click();

      // Exit animation should start immediately
      expect(toast.classList.contains('toast-queue-exit')).toBe(true);

      // Wait for exit animation
      vi.advanceTimersByTime(150);
      expect(getToasts().length).toBe(0);
    });
  });

  describe('Toast Queue', () => {
    it('should show multiple toasts simultaneously (up to 3)', () => {
      showToast('Toast 1');
      showToast('Toast 2');
      showToast('Toast 3');

      // Allow requestAnimationFrame to run
      vi.advanceTimersByTime(0);

      const toasts = getToasts();
      expect(toasts.length).toBe(3);
    });

    it('should queue toasts beyond the maximum (3)', () => {
      showToast('Toast 1');
      showToast('Toast 2');
      showToast('Toast 3');
      showToast('Toast 4'); // This should be queued

      vi.advanceTimersByTime(0);
      expect(getToasts().length).toBe(3);
    });

    it('should show queued toast when one dismisses', () => {
      showToast('Toast 1', { duration: 1000 });
      showToast('Toast 2', { duration: 5000 }); // Longer duration
      showToast('Toast 3', { duration: 5000 }); // Longer duration
      showToast('Toast 4', { duration: 1000 }); // Queued

      vi.advanceTimersByTime(0);
      expect(getToasts().length).toBe(3);

      // First toast dismisses after 1000ms + 150ms animation
      vi.advanceTimersByTime(1000 + 150);

      // Now Toast 4 should appear (replacing Toast 1)
      const toasts = getToasts();
      expect(toasts.length).toBe(3);
      expect(toasts.some(t => t.textContent.includes('Toast 4'))).toBe(true);
      expect(toasts.some(t => t.textContent.includes('Toast 2'))).toBe(true);
      expect(toasts.some(t => t.textContent.includes('Toast 3'))).toBe(true);
    });

    it('should not replace existing toasts like old system did', () => {
      showToast('First message');
      vi.advanceTimersByTime(0);

      showToast('Second message');
      vi.advanceTimersByTime(0);

      const toasts = getToasts();
      expect(toasts.length).toBe(2);
      expect(toasts.some(t => t.textContent.includes('First message'))).toBe(true);
      expect(toasts.some(t => t.textContent.includes('Second message'))).toBe(true);
    });

    it('should have toast container with aria-live attribute', () => {
      showToast('Test');
      const container = getContainer();
      expect(container.getAttribute('aria-live')).toBe('polite');
    });

    it('should position container at bottom of screen', () => {
      showToast('Test');
      const container = getContainer();
      expect(container.className).toContain('fixed');
      expect(container.className).toContain('bottom-6');
    });
  });

  describe('clearAllToasts', () => {
    it('should clear all active toasts', () => {
      showToast('Toast 1');
      showToast('Toast 2');
      showToast('Toast 3');
      vi.advanceTimersByTime(0);

      expect(getToasts().length).toBe(3);

      clearAllToasts();
      vi.advanceTimersByTime(150); // Wait for exit animation

      expect(getToasts().length).toBe(0);
    });

    it('should clear queued toasts as well', () => {
      showToast('Toast 1', { duration: 5000 });
      showToast('Toast 2', { duration: 5000 });
      showToast('Toast 3', { duration: 5000 });
      showToast('Toast 4', { duration: 5000 }); // Queued
      vi.advanceTimersByTime(0);

      clearAllToasts();
      vi.advanceTimersByTime(150);

      expect(getToasts().length).toBe(0);

      // Ensure queued toast doesn't appear later
      vi.advanceTimersByTime(5000);
      expect(getToasts().length).toBe(0);
    });
  });
});
