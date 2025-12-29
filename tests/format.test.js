// Format Utilities Tests
import { describe, it, expect, vi } from 'vitest';

import {
  serializeTimestamp,
  parseTimestamp,
  formatDate,
  normalizeText,
  normalizeGenreName,
  normalizeTitle,
  normalizeAuthor,
  normalizePublisher,
  normalizePublishedDate,
  renderStars
} from '../src/js/utils/format.js';

describe('Format Utilities', () => {
  describe('serializeTimestamp', () => {
    it('should return null for null input', () => {
      expect(serializeTimestamp(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(serializeTimestamp(undefined)).toBe(null);
    });

    it('should handle toMillis() method', () => {
      const mockTimestamp = { toMillis: () => 1704067200000 };
      expect(serializeTimestamp(mockTimestamp)).toBe(1704067200000);
    });

    it('should handle seconds property', () => {
      const mockTimestamp = { seconds: 1704067200 };
      expect(serializeTimestamp(mockTimestamp)).toBe(1704067200000);
    });

    it('should handle number input', () => {
      expect(serializeTimestamp(1704067200000)).toBe(1704067200000);
    });

    it('should handle ISO string input', () => {
      const result = serializeTimestamp('2024-01-01T00:00:00.000Z');
      expect(result).toBe(new Date('2024-01-01T00:00:00.000Z').getTime());
    });

    it('should return null for invalid string', () => {
      expect(serializeTimestamp('invalid-date')).toBe(null);
    });
  });

  describe('parseTimestamp', () => {
    it('should return null for null input', () => {
      expect(parseTimestamp(null)).toBe(null);
    });

    it('should return null for undefined input', () => {
      expect(parseTimestamp(undefined)).toBe(null);
    });

    it('should handle toDate() method', () => {
      const expectedDate = new Date('2024-01-01');
      const mockTimestamp = { toDate: () => expectedDate };
      expect(parseTimestamp(mockTimestamp)).toEqual(expectedDate);
    });

    it('should handle seconds property', () => {
      const mockTimestamp = { seconds: 1704067200 };
      const result = parseTimestamp(mockTimestamp);
      expect(result).toEqual(new Date(1704067200000));
    });

    it('should handle Date object input', () => {
      const date = new Date('2024-01-01');
      expect(parseTimestamp(date)).toEqual(date);
    });

    it('should handle number input', () => {
      const result = parseTimestamp(1704067200000);
      expect(result).toEqual(new Date(1704067200000));
    });

    it('should handle valid string input', () => {
      const result = parseTimestamp('2024-01-01T00:00:00.000Z');
      expect(result).toEqual(new Date('2024-01-01T00:00:00.000Z'));
    });

    it('should return null for invalid string', () => {
      expect(parseTimestamp('invalid-date')).toBe(null);
    });
  });

  describe('formatDate', () => {
    it('should return null for null input', () => {
      expect(formatDate(null)).toBe(null);
    });

    it('should format a valid date', () => {
      // Format varies by locale, so just check it's a string
      const result = formatDate(new Date('2024-01-15'));
      expect(typeof result).toBe('string');
      expect(result).toContain('2024');
    });

    it('should handle timestamp with seconds', () => {
      const result = formatDate({ seconds: 1704067200 });
      expect(typeof result).toBe('string');
    });
  });

  describe('normalizeText', () => {
    it('should lowercase text', () => {
      expect(normalizeText('Hello World')).toBe('hello world');
    });

    it('should normalize apostrophes', () => {
      expect(normalizeText("it's")).toBe("it's");
      expect(normalizeText("it's")).toBe("it's");
      expect(normalizeText("it`s")).toBe("it's");
    });

    it('should remove diacritics', () => {
      expect(normalizeText('café')).toBe('cafe');
      expect(normalizeText('naïve')).toBe('naive');
      expect(normalizeText('résumé')).toBe('resume');
    });

    it('should handle null input', () => {
      expect(normalizeText(null)).toBe('');
    });

    it('should handle undefined input', () => {
      expect(normalizeText(undefined)).toBe('');
    });

    it('should handle empty string', () => {
      expect(normalizeText('')).toBe('');
    });
  });

  describe('normalizeGenreName', () => {
    it('should lowercase text', () => {
      expect(normalizeGenreName('FICTION')).toBe('fiction');
    });

    it('should trim whitespace', () => {
      expect(normalizeGenreName('  fiction  ')).toBe('fiction');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeGenreName('science   fiction')).toBe('science fiction');
    });

    it('should handle null input', () => {
      expect(normalizeGenreName(null)).toBe('');
    });

    it('should handle undefined input', () => {
      expect(normalizeGenreName(undefined)).toBe('');
    });
  });

  describe('normalizeTitle', () => {
    it('should trim whitespace', () => {
      expect(normalizeTitle('  The Book  ')).toBe('The Book');
    });

    it('should remove trailing periods', () => {
      expect(normalizeTitle('The Book.')).toBe('The Book');
      expect(normalizeTitle('The Book...')).toBe('The Book');
    });

    it('should convert ALL CAPS to Title Case', () => {
      expect(normalizeTitle('THE GREAT GATSBY')).toBe('The Great Gatsby');
    });

    it('should convert all lowercase to Title Case', () => {
      expect(normalizeTitle('the great gatsby')).toBe('The Great Gatsby');
    });

    it('should keep proper Title Case unchanged', () => {
      expect(normalizeTitle('The Great Gatsby')).toBe('The Great Gatsby');
    });

    it('should lowercase small words except first word', () => {
      expect(normalizeTitle('THE LORD OF THE RINGS')).toBe('The Lord of the Rings');
    });

    it('should handle null input', () => {
      expect(normalizeTitle(null)).toBe('');
    });

    it('should handle empty string', () => {
      expect(normalizeTitle('')).toBe('');
    });
  });

  describe('normalizeAuthor', () => {
    it('should trim whitespace', () => {
      expect(normalizeAuthor('  John Smith  ')).toBe('John Smith');
    });

    it('should convert ALL CAPS to Title Case', () => {
      expect(normalizeAuthor('JOHN SMITH')).toBe('John Smith');
    });

    it('should convert all lowercase to Title Case', () => {
      expect(normalizeAuthor('john smith')).toBe('John Smith');
    });

    it('should keep proper Title Case unchanged', () => {
      expect(normalizeAuthor('John Smith')).toBe('John Smith');
    });

    it('should handle null input', () => {
      expect(normalizeAuthor(null)).toBe('');
    });
  });

  describe('normalizePublisher', () => {
    it('should trim whitespace', () => {
      expect(normalizePublisher('  Penguin Books  ')).toBe('Penguin Books');
    });

    it('should convert ALL CAPS to Title Case', () => {
      expect(normalizePublisher('PENGUIN BOOKS')).toBe('Penguin Books');
    });

    it('should handle null input', () => {
      expect(normalizePublisher(null)).toBe('');
    });
  });

  describe('normalizePublishedDate', () => {
    it('should extract year from full date', () => {
      expect(normalizePublishedDate('2024-01-15')).toBe('2024');
    });

    it('should extract year from date string', () => {
      expect(normalizePublishedDate('January 15, 2024')).toBe('2024');
    });

    it('should return year-only input unchanged', () => {
      expect(normalizePublishedDate('2024')).toBe('2024');
    });

    it('should handle null input', () => {
      expect(normalizePublishedDate(null)).toBe('');
    });

    it('should handle undefined input', () => {
      expect(normalizePublishedDate(undefined)).toBe('');
    });

    it('should return non-year string unchanged', () => {
      expect(normalizePublishedDate('unknown')).toBe('unknown');
    });

    it('should handle number input', () => {
      expect(normalizePublishedDate(2024)).toBe('2024');
    });
  });

  describe('renderStars', () => {
    it('should render 5 filled stars for rating 5', () => {
      const result = renderStars(5);
      // Count SVGs without empty class
      const filledCount = (result.match(/<svg xmlns/g) || []).length;
      const emptyCount = (result.match(/class="empty"/g) || []).length;
      expect(filledCount).toBe(5);
      expect(emptyCount).toBe(0);
    });

    it('should render 0 filled stars for rating 0', () => {
      const result = renderStars(0);
      const emptyCount = (result.match(/class="empty"/g) || []).length;
      expect(emptyCount).toBe(5);
    });

    it('should render correct number of filled stars for rating 3', () => {
      const result = renderStars(3);
      const emptyCount = (result.match(/class="empty"/g) || []).length;
      expect(emptyCount).toBe(2); // 5 - 3 = 2 empty
    });

    it('should contain SVG elements', () => {
      const result = renderStars(3);
      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
    });
  });
});
