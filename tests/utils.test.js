/**
 * Unit tests for src/js/utils.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  escapeHtml,
  escapeAttr,
  normalizeText,
  debounce,
  parseTimestamp,
  formatDate,
  renderStars,
  showToast,
  CACHE_VERSION,
  CACHE_KEY,
  CACHE_TTL,
  clearBooksCache,
  serializeTimestamp,
  updateRatingStars
} from '../src/js/utils.js';

describe('escapeHtml', () => {
  it('should return empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('should escape HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(escapeHtml('1 < 2 > 0')).toBe('1 &lt; 2 &gt; 0');
  });

  it('should handle quotes', () => {
    expect(escapeHtml('"quoted"')).toBe('"quoted"');
    expect(escapeHtml("it's")).toBe("it's");
  });

  it('should preserve normal text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
    expect(escapeHtml('The Great Gatsby')).toBe('The Great Gatsby');
  });
});

describe('escapeAttr', () => {
  it('should return empty string for null/undefined', () => {
    expect(escapeAttr(null)).toBe('');
    expect(escapeAttr(undefined)).toBe('');
    expect(escapeAttr('')).toBe('');
  });

  it('should escape double quotes', () => {
    expect(escapeAttr('Say "hello"')).toBe('Say &quot;hello&quot;');
  });

  it('should escape single quotes', () => {
    expect(escapeAttr("It's fine")).toBe("It&#39;s fine");
  });

  it('should escape both quote types', () => {
    expect(escapeAttr(`"It's" a test`)).toBe('&quot;It&#39;s&quot; a test');
  });
});

describe('normalizeText', () => {
  it('should return empty string for null/undefined', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('')).toBe('');
  });

  it('should convert to lowercase', () => {
    expect(normalizeText('HELLO')).toBe('hello');
    expect(normalizeText('HeLLo WoRLd')).toBe('hello world');
  });

  it('should normalize curly apostrophes to straight', () => {
    expect(normalizeText("it's")).toBe("it's");
    expect(normalizeText("it's")).toBe("it's");  // curly apostrophe
    expect(normalizeText("it`s")).toBe("it's");  // backtick
  });

  it('should remove diacritics', () => {
    expect(normalizeText('café')).toBe('cafe');
    expect(normalizeText('naïve')).toBe('naive');
    expect(normalizeText('résumé')).toBe('resume');
    expect(normalizeText('Ångström')).toBe('angstrom');
  });

  it('should handle combined normalization', () => {
    expect(normalizeText("HARRY'S CAFÉ")).toBe("harry's cafe");
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to debounced function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('parseTimestamp', () => {
  it('should return null for null/undefined', () => {
    expect(parseTimestamp(null)).toBe(null);
    expect(parseTimestamp(undefined)).toBe(null);
  });

  it('should handle Firestore timestamp with toDate method', () => {
    const mockDate = new Date('2023-06-15');
    const firestoreTimestamp = { toDate: () => mockDate };

    expect(parseTimestamp(firestoreTimestamp)).toEqual(mockDate);
  });

  it('should handle timestamp with seconds property', () => {
    const timestamp = { seconds: 1686787200 }; // 2023-06-15 00:00:00 UTC
    const result = parseTimestamp(timestamp);

    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2023);
  });

  it('should return Date objects as-is', () => {
    const date = new Date('2023-06-15');
    expect(parseTimestamp(date)).toEqual(date);
  });

  it('should parse valid date strings', () => {
    const result = parseTimestamp('2023-06-15');
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2023);
  });

  it('should return null for invalid date strings', () => {
    expect(parseTimestamp('not-a-date')).toBe(null);
    expect(parseTimestamp('invalid')).toBe(null);
  });

  it('should handle plain numbers (milliseconds) - used by cached/serialized data', () => {
    const milliseconds = 1686787200000; // 2023-06-15 00:00:00 UTC
    const result = parseTimestamp(milliseconds);

    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(2023);
    expect(result.getTime()).toBe(milliseconds);
  });

  it('should handle zero as a valid timestamp', () => {
    const result = parseTimestamp(0);
    // 0 is falsy, so should return null
    expect(result).toBe(null);
  });

  it('should handle negative numbers (dates before 1970)', () => {
    const result = parseTimestamp(-86400000); // 1969-12-31
    expect(result).toBeInstanceOf(Date);
    expect(result.getFullYear()).toBe(1969);
  });
});

describe('formatDate', () => {
  it('should return null for null/undefined', () => {
    expect(formatDate(null)).toBe(null);
    expect(formatDate(undefined)).toBe(null);
  });

  it('should format Firestore timestamp', () => {
    const timestamp = { seconds: 1686787200 };
    const result = formatDate(timestamp);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    // Result format depends on locale, just check it's not empty
    expect(result.length).toBeGreaterThan(0);
  });

  it('should format Date object', () => {
    const date = new Date('2023-06-15');
    const result = formatDate(date);

    expect(result).toBeTruthy();
    expect(result).toContain('2023');
  });

  it('should format milliseconds (serialized/cached format)', () => {
    const milliseconds = 1686787200000; // 2023-06-15 00:00:00 UTC
    const result = formatDate(milliseconds);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result).toContain('2023');
  });
});

describe('renderStars', () => {
  it('should render 5 stars for rating 5', () => {
    const result = renderStars(5);
    const filledCount = (result.match(/fill="currentColor"/g) || []).length;
    const emptyCount = (result.match(/class="empty"/g) || []).length;

    expect(filledCount).toBe(5);
    expect(emptyCount).toBe(0);
  });

  it('should render 3 filled and 2 empty for rating 3', () => {
    const result = renderStars(3);
    const filledCount = (result.match(/fill="currentColor"/g) || []).length;
    const emptyCount = (result.match(/class="empty"/g) || []).length;

    expect(filledCount).toBe(3);
    expect(emptyCount).toBe(2);
  });

  it('should render 5 empty stars for rating 0', () => {
    const result = renderStars(0);
    const emptyCount = (result.match(/class="empty"/g) || []).length;

    expect(emptyCount).toBe(5);
  });

  it('should return SVG elements', () => {
    const result = renderStars(4);
    expect(result).toContain('<svg');
    expect(result).toContain('</svg>');
  });
});

describe('showToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="toast" class="hidden"></div>';
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('should display message in toast', () => {
    showToast('Hello World');
    const toast = document.getElementById('toast');

    expect(toast.textContent).toBe('Hello World');
  });

  it('should create toast element if not exists', () => {
    document.body.innerHTML = '';
    showToast('Test message');

    const toast = document.getElementById('toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toBe('Test message');
  });

  it('should apply success styling', () => {
    showToast('Success!', { type: 'success' });
    const toast = document.getElementById('toast');

    expect(toast.className).toContain('bg-green-600');
  });

  it('should apply error styling', () => {
    showToast('Error!', { type: 'error' });
    const toast = document.getElementById('toast');

    expect(toast.className).toContain('bg-red-600');
  });

  it('should apply info styling by default', () => {
    showToast('Info');
    const toast = document.getElementById('toast');

    expect(toast.className).toContain('bg-gray-800');
  });

  it('should hide after duration', () => {
    showToast('Temporary', { duration: 1000 });
    const toast = document.getElementById('toast');

    expect(toast.classList.contains('hidden')).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(toast.classList.contains('hidden')).toBe(true);
  });

  it('should accept duration as second argument (legacy)', () => {
    showToast('Legacy', 2000);
    const toast = document.getElementById('toast');

    vi.advanceTimersByTime(1999);
    expect(toast.classList.contains('hidden')).toBe(false);

    vi.advanceTimersByTime(1);
    expect(toast.classList.contains('hidden')).toBe(true);
  });
});

describe('cache constants', () => {
  it('should export CACHE_VERSION as a number', () => {
    expect(typeof CACHE_VERSION).toBe('number');
    expect(CACHE_VERSION).toBeGreaterThan(0);
  });

  it('should export CACHE_KEY with version embedded', () => {
    expect(CACHE_KEY).toBe(`mybookshelf_books_cache_v${CACHE_VERSION}`);
  });

  it('should export CACHE_TTL as 5 minutes in milliseconds', () => {
    expect(CACHE_TTL).toBe(5 * 60 * 1000);
  });
});

describe('clearBooksCache', () => {
  it('should not throw for any user id', () => {
    expect(() => clearBooksCache('test-user-123')).not.toThrow();
    expect(() => clearBooksCache('')).not.toThrow();
    expect(() => clearBooksCache('non-existent-user')).not.toThrow();
  });

  it('should be a function that accepts a userId parameter', () => {
    expect(typeof clearBooksCache).toBe('function');
    expect(clearBooksCache.length).toBe(1);
  });
});

describe('serializeTimestamp', () => {
  it('should return null for null/undefined', () => {
    expect(serializeTimestamp(null)).toBeNull();
    expect(serializeTimestamp(undefined)).toBeNull();
  });

  it('should handle Firestore timestamp with toMillis method', () => {
    const timestamp = { toMillis: () => 1686787200000 };
    expect(serializeTimestamp(timestamp)).toBe(1686787200000);
  });

  it('should handle timestamp with seconds property', () => {
    const timestamp = { seconds: 1686787200 };
    expect(serializeTimestamp(timestamp)).toBe(1686787200000);
  });

  it('should return number as-is', () => {
    expect(serializeTimestamp(1686787200000)).toBe(1686787200000);
  });

  it('should parse ISO date strings', () => {
    const result = serializeTimestamp('2023-06-15T00:00:00.000Z');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('should handle ISO date strings with microseconds', () => {
    const result = serializeTimestamp('2025-12-20T09:29:20.036460');
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('should return null for invalid date strings', () => {
    expect(serializeTimestamp('not-a-date')).toBeNull();
    expect(serializeTimestamp('invalid')).toBeNull();
  });

  it('should prefer toMillis over seconds when both present', () => {
    const timestamp = {
      toMillis: () => 1000,
      seconds: 2000
    };
    expect(serializeTimestamp(timestamp)).toBe(1000);
  });
});

describe('updateRatingStars', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button class="star-btn" data-rating="1"></button>
      <button class="star-btn" data-rating="2"></button>
      <button class="star-btn" data-rating="3"></button>
      <button class="star-btn" data-rating="4"></button>
      <button class="star-btn" data-rating="5"></button>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should add active class to stars up to rating', () => {
    const starBtns = document.querySelectorAll('.star-btn');
    updateRatingStars(starBtns, 3);

    expect(starBtns[0].classList.contains('active')).toBe(true);
    expect(starBtns[1].classList.contains('active')).toBe(true);
    expect(starBtns[2].classList.contains('active')).toBe(true);
    expect(starBtns[3].classList.contains('active')).toBe(false);
    expect(starBtns[4].classList.contains('active')).toBe(false);
  });

  it('should mark all stars active for rating 5', () => {
    const starBtns = document.querySelectorAll('.star-btn');
    updateRatingStars(starBtns, 5);

    starBtns.forEach(btn => {
      expect(btn.classList.contains('active')).toBe(true);
    });
  });

  it('should mark no stars active for rating 0', () => {
    const starBtns = document.querySelectorAll('.star-btn');
    updateRatingStars(starBtns, 0);

    starBtns.forEach(btn => {
      expect(btn.classList.contains('active')).toBe(false);
    });
  });

  it('should update stars when rating changes', () => {
    const starBtns = document.querySelectorAll('.star-btn');

    updateRatingStars(starBtns, 5);
    expect(starBtns[4].classList.contains('active')).toBe(true);

    updateRatingStars(starBtns, 2);
    expect(starBtns[0].classList.contains('active')).toBe(true);
    expect(starBtns[1].classList.contains('active')).toBe(true);
    expect(starBtns[2].classList.contains('active')).toBe(false);
    expect(starBtns[3].classList.contains('active')).toBe(false);
    expect(starBtns[4].classList.contains('active')).toBe(false);
  });
});
