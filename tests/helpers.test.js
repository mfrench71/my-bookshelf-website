/**
 * Unit tests for src/js/utils/helpers.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  debounce,
  throttle,
  checkPasswordStrength,
  isOnline,
  isValidImageUrl,
  isValidHexColor
} from '../src/js/utils/helpers.js';

describe('helpers', () => {
  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay function call', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only call once after multiple rapid calls', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to function', () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('arg1', 'arg2');
      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });
  });

  describe('throttle', () => {
    it('should call function immediately on first call', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should ignore calls within delay period', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow call after delay period', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      let now = Date.now();
      vi.spyOn(Date, 'now').mockImplementation(() => now);

      throttled();
      expect(fn).toHaveBeenCalledTimes(1);

      now += 150;
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to function', () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled('test');
      expect(fn).toHaveBeenCalledWith('test');
    });
  });

  describe('checkPasswordStrength', () => {
    it('should return low score for weak password', () => {
      const result = checkPasswordStrength('abc');
      expect(result.score).toBe(0);
    });

    it('should check length >= 6', () => {
      const short = checkPasswordStrength('abcde');
      const long = checkPasswordStrength('abcdef');
      expect(short.checks.length).toBe(false);
      expect(long.checks.length).toBe(true);
    });

    it('should check for uppercase', () => {
      const noUpper = checkPasswordStrength('password');
      const hasUpper = checkPasswordStrength('Password');
      expect(noUpper.checks.uppercase).toBe(false);
      expect(hasUpper.checks.uppercase).toBe(true);
    });

    it('should check for number', () => {
      const noNumber = checkPasswordStrength('password');
      const hasNumber = checkPasswordStrength('password1');
      expect(noNumber.checks.number).toBe(false);
      expect(hasNumber.checks.number).toBe(true);
    });

    it('should check for special characters', () => {
      const noSpecial = checkPasswordStrength('password');
      const hasSpecial = checkPasswordStrength('password!');
      expect(noSpecial.checks.special).toBe(false);
      expect(hasSpecial.checks.special).toBe(true);
    });

    it('should give max score for strong password', () => {
      const result = checkPasswordStrength('Password1!');
      expect(result.score).toBe(4);
    });

    it('should give bonus for length >= 10', () => {
      const short = checkPasswordStrength('Password1');
      const long = checkPasswordStrength('Password12');
      expect(long.score).toBeGreaterThanOrEqual(short.score);
    });
  });

  describe('isOnline', () => {
    it('should return navigator.onLine value', () => {
      // navigator.onLine is typically true in test environment
      expect(typeof isOnline()).toBe('boolean');
    });
  });

  describe('isValidImageUrl', () => {
    it('should accept https URLs', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
    });

    it('should accept http URLs', () => {
      expect(isValidImageUrl('http://example.com/image.jpg')).toBe(true);
    });

    it('should reject data URLs', () => {
      expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(false);
    });

    it('should reject javascript URLs', () => {
      expect(isValidImageUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidImageUrl('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidImageUrl(null)).toBe(false);
      expect(isValidImageUrl(undefined)).toBe(false);
    });

    it('should reject non-strings', () => {
      expect(isValidImageUrl(123)).toBe(false);
      expect(isValidImageUrl({})).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidImageUrl('not a url')).toBe(false);
    });
  });

  describe('isValidHexColor', () => {
    it('should accept valid hex colors', () => {
      expect(isValidHexColor('#3b82f6')).toBe(true);
      expect(isValidHexColor('#FFFFFF')).toBe(true);
      expect(isValidHexColor('#000000')).toBe(true);
    });

    it('should reject short hex colors', () => {
      expect(isValidHexColor('#fff')).toBe(false);
    });

    it('should reject colors without #', () => {
      expect(isValidHexColor('3b82f6')).toBe(false);
    });

    it('should reject invalid characters', () => {
      expect(isValidHexColor('#gggggg')).toBe(false);
    });

    it('should reject empty/null values', () => {
      expect(isValidHexColor('')).toBe(false);
      expect(isValidHexColor(null)).toBe(false);
    });

    it('should reject non-strings', () => {
      expect(isValidHexColor(123)).toBe(false);
    });
  });
});
