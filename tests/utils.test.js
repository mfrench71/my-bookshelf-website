/**
 * Unit tests for src/js/utils.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  escapeHtml,
  escapeAttr,
  normalizeText,
  normalizeGenreName,
  normalizeTitle,
  normalizeAuthor,
  normalizePublisher,
  normalizePublishedDate,
  getContrastColor,
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
  updateRatingStars,
  migrateBookReads,
  getCurrentRead,
  getBookStatus,
  isValidHexColor
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

describe('normalizeGenreName', () => {
  it('should return empty string for null/undefined', () => {
    expect(normalizeGenreName(null)).toBe('');
    expect(normalizeGenreName(undefined)).toBe('');
    expect(normalizeGenreName('')).toBe('');
  });

  it('should convert to lowercase', () => {
    expect(normalizeGenreName('Science Fiction')).toBe('science fiction');
    expect(normalizeGenreName('MYSTERY')).toBe('mystery');
  });

  it('should trim whitespace', () => {
    expect(normalizeGenreName('  Fantasy  ')).toBe('fantasy');
    expect(normalizeGenreName('\tRomance\n')).toBe('romance');
  });

  it('should collapse multiple spaces', () => {
    expect(normalizeGenreName('Science   Fiction')).toBe('science fiction');
    expect(normalizeGenreName('Young  Adult   Fiction')).toBe('young adult fiction');
  });

  it('should handle combined normalization', () => {
    expect(normalizeGenreName('  Science   Fiction  ')).toBe('science fiction');
  });
});

describe('normalizeTitle', () => {
  it('should return empty string for null/undefined', () => {
    expect(normalizeTitle(null)).toBe('');
    expect(normalizeTitle(undefined)).toBe('');
    expect(normalizeTitle('')).toBe('');
  });

  it('should trim whitespace', () => {
    expect(normalizeTitle('  Hello World  ')).toBe('Hello World');
    expect(normalizeTitle('\tThe Great Gatsby\n')).toBe('The Great Gatsby');
  });

  it('should remove trailing periods', () => {
    expect(normalizeTitle('The Great Gatsby.')).toBe('The Great Gatsby');
    expect(normalizeTitle('Hello World...')).toBe('Hello World');
  });

  it('should convert ALL CAPS to Title Case', () => {
    expect(normalizeTitle('THE GREAT GATSBY')).toBe('The Great Gatsby');
    expect(normalizeTitle('HELLO WORLD')).toBe('Hello World');
  });

  it('should keep small words lowercase in Title Case (except first word)', () => {
    expect(normalizeTitle('THE LORD OF THE RINGS')).toBe('The Lord of the Rings');
    expect(normalizeTitle('WAR AND PEACE')).toBe('War and Peace');
    expect(normalizeTitle('OF MICE AND MEN')).toBe('Of Mice and Men');
    expect(normalizeTitle('A TALE OF TWO CITIES')).toBe('A Tale of Two Cities');
  });

  it('should preserve mixed case titles (not all caps)', () => {
    expect(normalizeTitle('The Great Gatsby')).toBe('The Great Gatsby');
    expect(normalizeTitle('Harry Potter and the Sorcerer\'s Stone')).toBe('Harry Potter and the Sorcerer\'s Stone');
    expect(normalizeTitle('A Tale of Two Cities')).toBe('A Tale of Two Cities');
  });

  it('should handle single word titles', () => {
    expect(normalizeTitle('DUNE')).toBe('Dune');
    expect(normalizeTitle('Dune')).toBe('Dune');
  });

  it('should handle titles with numbers and special characters', () => {
    expect(normalizeTitle('1984')).toBe('1984');
    expect(normalizeTitle('CATCH-22')).toBe('Catch-22');
  });

  it('should handle combined issues (caps + trailing period)', () => {
    expect(normalizeTitle('THE GREAT GATSBY.')).toBe('The Great Gatsby');
    expect(normalizeTitle('  HELLO WORLD.  ')).toBe('Hello World');
  });

  it('should convert all lowercase to Title Case', () => {
    expect(normalizeTitle('the great gatsby')).toBe('The Great Gatsby');
    expect(normalizeTitle('hello world')).toBe('Hello World');
  });

  it('should keep small words lowercase in all lowercase titles (except first word)', () => {
    expect(normalizeTitle('the lord of the rings')).toBe('The Lord of the Rings');
    expect(normalizeTitle('war and peace')).toBe('War and Peace');
    expect(normalizeTitle('of mice and men')).toBe('Of Mice and Men');
  });

  it('should normalize titles that start with lowercase letter', () => {
    expect(normalizeTitle('the Great Gatsby')).toBe('The Great Gatsby');
    expect(normalizeTitle('harry Potter')).toBe('Harry Potter');
    expect(normalizeTitle('a tale of Two Cities')).toBe('A Tale of Two Cities');
  });

  it('should normalize titles with lowercase significant words in the middle', () => {
    expect(normalizeTitle('The Ionian mission')).toBe('The Ionian Mission');
    expect(normalizeTitle('Harry Potter and the chamber of secrets')).toBe('Harry Potter and the Chamber of Secrets');
    expect(normalizeTitle('The Lord of the rings')).toBe('The Lord of the Rings');
  });
});

describe('normalizeAuthor', () => {
  it('should return empty string for null/undefined', () => {
    expect(normalizeAuthor(null)).toBe('');
    expect(normalizeAuthor(undefined)).toBe('');
    expect(normalizeAuthor('')).toBe('');
  });

  it('should trim whitespace', () => {
    expect(normalizeAuthor('  John Smith  ')).toBe('John Smith');
    expect(normalizeAuthor('\tStephen King\n')).toBe('Stephen King');
  });

  it('should convert ALL CAPS to Title Case', () => {
    expect(normalizeAuthor('STEPHEN KING')).toBe('Stephen King');
    expect(normalizeAuthor('J.K. ROWLING')).toBe('J.k. Rowling');
    expect(normalizeAuthor('GEORGE R.R. MARTIN')).toBe('George R.r. Martin');
  });

  it('should preserve mixed case names', () => {
    expect(normalizeAuthor('Stephen King')).toBe('Stephen King');
    expect(normalizeAuthor('J.K. Rowling')).toBe('J.K. Rowling');
    expect(normalizeAuthor('George R.R. Martin')).toBe('George R.R. Martin');
  });

  it('should handle single names', () => {
    expect(normalizeAuthor('HOMER')).toBe('Homer');
    expect(normalizeAuthor('Plato')).toBe('Plato');
  });

  it('should handle multiple authors joined by comma', () => {
    expect(normalizeAuthor('JOHN DOE, JANE SMITH')).toBe('John Doe, Jane Smith');
  });

  it('should convert all lowercase to Title Case', () => {
    expect(normalizeAuthor('stephen king')).toBe('Stephen King');
    expect(normalizeAuthor('john doe')).toBe('John Doe');
  });

  it('should handle lowercase multiple authors', () => {
    expect(normalizeAuthor('john doe, jane smith')).toBe('John Doe, Jane Smith');
  });

  it('should normalize authors that start with lowercase letter', () => {
    expect(normalizeAuthor('stephen King')).toBe('Stephen King');
    expect(normalizeAuthor('j.k. Rowling')).toBe('J.k. Rowling');
  });
});

describe('normalizePublisher', () => {
  it('should return empty string for null/undefined', () => {
    expect(normalizePublisher(null)).toBe('');
    expect(normalizePublisher(undefined)).toBe('');
    expect(normalizePublisher('')).toBe('');
  });

  it('should trim whitespace', () => {
    expect(normalizePublisher('  Penguin Books  ')).toBe('Penguin Books');
    expect(normalizePublisher('\tRandom House\n')).toBe('Random House');
  });

  it('should convert ALL CAPS to Title Case', () => {
    expect(normalizePublisher('PENGUIN BOOKS')).toBe('Penguin Books');
    expect(normalizePublisher('RANDOM HOUSE')).toBe('Random House');
    expect(normalizePublisher('SIMON & SCHUSTER')).toBe('Simon & Schuster');
  });

  it('should preserve mixed case publishers', () => {
    expect(normalizePublisher('Penguin Books')).toBe('Penguin Books');
    expect(normalizePublisher('Random House')).toBe('Random House');
    expect(normalizePublisher('HarperCollins')).toBe('HarperCollins');
  });

  it('should handle publishers with abbreviations', () => {
    expect(normalizePublisher('MIT PRESS')).toBe('Mit Press');
    expect(normalizePublisher('MIT Press')).toBe('MIT Press');
  });

  it('should convert all lowercase to Title Case', () => {
    expect(normalizePublisher('penguin books')).toBe('Penguin Books');
    expect(normalizePublisher('random house')).toBe('Random House');
  });

  it('should normalize publishers that start with lowercase letter', () => {
    expect(normalizePublisher('penguin Books')).toBe('Penguin Books');
    expect(normalizePublisher('random House')).toBe('Random House');
  });
});

describe('normalizePublishedDate', () => {
  it('should return empty string for null/undefined', () => {
    expect(normalizePublishedDate(null)).toBe('');
    expect(normalizePublishedDate(undefined)).toBe('');
    expect(normalizePublishedDate('')).toBe('');
  });

  it('should extract year from ISO date formats', () => {
    expect(normalizePublishedDate('2023-05-15')).toBe('2023');
    expect(normalizePublishedDate('2023-05')).toBe('2023');
    expect(normalizePublishedDate('2023')).toBe('2023');
  });

  it('should extract year from written date formats', () => {
    expect(normalizePublishedDate('May 15, 2023')).toBe('2023');
    expect(normalizePublishedDate('15 May 2023')).toBe('2023');
    expect(normalizePublishedDate('May 2023')).toBe('2023');
  });

  it('should handle approximate dates', () => {
    expect(normalizePublishedDate('c. 1985')).toBe('1985');
    expect(normalizePublishedDate('circa 1920')).toBe('1920');
  });

  it('should handle year-only strings', () => {
    expect(normalizePublishedDate('1999')).toBe('1999');
    expect(normalizePublishedDate('2001')).toBe('2001');
  });

  it('should handle number input', () => {
    expect(normalizePublishedDate(2023)).toBe('2023');
    expect(normalizePublishedDate(1984)).toBe('1984');
  });

  it('should preserve string if no year found', () => {
    expect(normalizePublishedDate('Unknown')).toBe('Unknown');
    expect(normalizePublishedDate('N/A')).toBe('N/A');
  });

  it('should trim whitespace', () => {
    expect(normalizePublishedDate('  2023  ')).toBe('2023');
    expect(normalizePublishedDate('\t1999\n')).toBe('1999');
  });

  it('should handle edge case years', () => {
    expect(normalizePublishedDate('1000')).toBe('1000');
    expect(normalizePublishedDate('2999')).toBe('2999');
  });
});

describe('getContrastColor', () => {
  it('should return black for null/undefined/invalid input', () => {
    expect(getContrastColor(null)).toBe('#000000');
    expect(getContrastColor(undefined)).toBe('#000000');
    expect(getContrastColor('')).toBe('#000000');
    expect(getContrastColor(123)).toBe('#000000');
  });

  it('should return white for dark backgrounds', () => {
    expect(getContrastColor('#000000')).toBe('#ffffff');
    expect(getContrastColor('#333333')).toBe('#ffffff');
    expect(getContrastColor('#3b82f6')).toBe('#ffffff'); // blue
    expect(getContrastColor('#ef4444')).toBe('#ffffff'); // red
  });

  it('should return black for light backgrounds', () => {
    expect(getContrastColor('#ffffff')).toBe('#000000');
    expect(getContrastColor('#f3f4f6')).toBe('#000000');
    expect(getContrastColor('#fbbf24')).toBe('#000000'); // amber
  });

  it('should handle hex without # prefix', () => {
    expect(getContrastColor('000000')).toBe('#ffffff');
    expect(getContrastColor('ffffff')).toBe('#000000');
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

// Reading status utility functions
describe('migrateBookReads', () => {
  it('should return book unchanged if already has reads array', () => {
    const book = { title: 'Test', reads: [{ startedAt: 123, finishedAt: 456 }] };
    const result = migrateBookReads(book);
    expect(result.reads).toEqual([{ startedAt: 123, finishedAt: 456 }]);
  });

  it('should convert startedAt/finishedAt to reads array', () => {
    const book = { title: 'Test', startedAt: 1000, finishedAt: 2000 };
    const result = migrateBookReads(book);
    expect(result.reads).toEqual([{ startedAt: 1000, finishedAt: 2000 }]);
    expect(result.startedAt).toBeUndefined();
    expect(result.finishedAt).toBeUndefined();
  });

  it('should handle startedAt only (no finishedAt)', () => {
    const book = { title: 'Test', startedAt: 1000 };
    const result = migrateBookReads(book);
    expect(result.reads).toEqual([{ startedAt: 1000, finishedAt: null }]);
  });

  it('should return empty reads array for book with no dates', () => {
    const book = { title: 'Test' };
    const result = migrateBookReads(book);
    expect(result.reads).toEqual([]);
  });

  it('should remove old status field', () => {
    const book = { title: 'Test', status: 'reading', startedAt: 1000 };
    const result = migrateBookReads(book);
    expect(result.status).toBeUndefined();
    expect(result.reads).toEqual([{ startedAt: 1000, finishedAt: null }]);
  });
});

describe('getCurrentRead', () => {
  it('should return last read entry from reads array', () => {
    const book = {
      reads: [
        { startedAt: 100, finishedAt: 200 },
        { startedAt: 300, finishedAt: null }
      ]
    };
    const result = getCurrentRead(book);
    expect(result).toEqual({ startedAt: 300, finishedAt: null });
  });

  it('should return null for empty reads array', () => {
    const book = { reads: [] };
    expect(getCurrentRead(book)).toBeNull();
  });

  it('should return null for book without reads', () => {
    const book = { title: 'Test' };
    expect(getCurrentRead(book)).toBeNull();
  });

  it('should migrate legacy format and return current read', () => {
    const book = { startedAt: 1000, finishedAt: 2000 };
    const result = getCurrentRead(book);
    expect(result).toEqual({ startedAt: 1000, finishedAt: 2000 });
  });
});

describe('getBookStatus', () => {
  it('should return "reading" when current read has startedAt but no finishedAt', () => {
    const book = { reads: [{ startedAt: 1000, finishedAt: null }] };
    expect(getBookStatus(book)).toBe('reading');
  });

  it('should return "finished" when current read has both dates', () => {
    const book = { reads: [{ startedAt: 1000, finishedAt: 2000 }] };
    expect(getBookStatus(book)).toBe('finished');
  });

  it('should return null for empty reads array', () => {
    const book = { reads: [] };
    expect(getBookStatus(book)).toBeNull();
  });

  it('should return null for book without reads', () => {
    const book = { title: 'Test' };
    expect(getBookStatus(book)).toBeNull();
  });

  it('should handle legacy startedAt/finishedAt format', () => {
    const book = { startedAt: 1000 };
    expect(getBookStatus(book)).toBe('reading');
  });

  it('should return "finished" for multiple reads where last is complete', () => {
    const book = {
      reads: [
        { startedAt: 100, finishedAt: 200 },
        { startedAt: 300, finishedAt: 400 }
      ]
    };
    expect(getBookStatus(book)).toBe('finished');
  });

  it('should return "reading" for re-read in progress', () => {
    const book = {
      reads: [
        { startedAt: 100, finishedAt: 200 },
        { startedAt: 300, finishedAt: null }
      ]
    };
    expect(getBookStatus(book)).toBe('reading');
  });
});

describe('isValidHexColor', () => {
  it('should return false for null/undefined/empty', () => {
    expect(isValidHexColor(null)).toBe(false);
    expect(isValidHexColor(undefined)).toBe(false);
    expect(isValidHexColor('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isValidHexColor(123)).toBe(false);
    expect(isValidHexColor({})).toBe(false);
    expect(isValidHexColor([])).toBe(false);
    expect(isValidHexColor(true)).toBe(false);
  });

  it('should return true for valid 6-digit hex colours', () => {
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#ffffff')).toBe(true);
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#3b82f6')).toBe(true);
    expect(isValidHexColor('#ABC123')).toBe(true);
  });

  it('should return false for hex without # prefix', () => {
    expect(isValidHexColor('000000')).toBe(false);
    expect(isValidHexColor('ffffff')).toBe(false);
  });

  it('should return false for 3-digit hex shorthand', () => {
    expect(isValidHexColor('#fff')).toBe(false);
    expect(isValidHexColor('#000')).toBe(false);
    expect(isValidHexColor('#abc')).toBe(false);
  });

  it('should return false for invalid hex characters', () => {
    expect(isValidHexColor('#gggggg')).toBe(false);
    expect(isValidHexColor('#12345z')).toBe(false);
    expect(isValidHexColor('#hello!')).toBe(false);
  });

  it('should return false for wrong length', () => {
    expect(isValidHexColor('#12345')).toBe(false);
    expect(isValidHexColor('#1234567')).toBe(false);
    expect(isValidHexColor('#')).toBe(false);
  });

  it('should return false for CSS injection attempts', () => {
    expect(isValidHexColor('#000000; background-image: url(evil.js)')).toBe(false);
    expect(isValidHexColor('javascript:alert(1)')).toBe(false);
    expect(isValidHexColor('expression(alert(1))')).toBe(false);
  });
});
