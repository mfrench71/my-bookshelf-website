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
  showToast
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
