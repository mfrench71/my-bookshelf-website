import { describe, it, expect } from 'vitest';
import {
  parseSeriesString,
  parseSeriesFromAPI,
  normalizeSeriesName,
  seriesNamesMatch,
  formatSeriesDisplay
} from '../src/js/utils/series-parser.js';

describe('parseSeriesString', () => {
  describe('hash notation (#N)', () => {
    it('should parse "Harry Potter #1"', () => {
      expect(parseSeriesString('Harry Potter #1')).toEqual({
        name: 'Harry Potter',
        position: 1
      });
    });

    it('should parse "Harry Potter #4"', () => {
      expect(parseSeriesString('Harry Potter #4')).toEqual({
        name: 'Harry Potter',
        position: 4
      });
    });

    it('should parse "Harry Potter # 1" (space after #)', () => {
      expect(parseSeriesString('Harry Potter # 1')).toEqual({
        name: 'Harry Potter',
        position: 1
      });
    });

    it('should parse decimal positions like "#1.5"', () => {
      expect(parseSeriesString('Series Name #1.5')).toEqual({
        name: 'Series Name',
        position: 1.5
      });
    });

    it('should parse "A Song of Ice and Fire #1"', () => {
      expect(parseSeriesString('A Song of Ice and Fire #1')).toEqual({
        name: 'A Song of Ice and Fire',
        position: 1
      });
    });
  });

  describe('Book N notation', () => {
    it('should parse "Discworld, Book 1"', () => {
      expect(parseSeriesString('Discworld, Book 1')).toEqual({
        name: 'Discworld',
        position: 1
      });
    });

    it('should parse "Discworld Book 1" (no comma)', () => {
      expect(parseSeriesString('Discworld Book 1')).toEqual({
        name: 'Discworld',
        position: 1
      });
    });

    it('should parse word numbers like "Book One"', () => {
      expect(parseSeriesString('The Hunger Games Book One')).toEqual({
        name: 'The Hunger Games',
        position: 1
      });
    });

    it('should parse "Book Ten"', () => {
      expect(parseSeriesString('Series Name Book Ten')).toEqual({
        name: 'Series Name',
        position: 10
      });
    });
  });

  describe('Volume notation', () => {
    it('should parse "Manga Title Vol. 1"', () => {
      expect(parseSeriesString('Manga Title Vol. 1')).toEqual({
        name: 'Manga Title',
        position: 1
      });
    });

    it('should parse "Manga Title Vol 1" (no period)', () => {
      expect(parseSeriesString('Manga Title Vol 1')).toEqual({
        name: 'Manga Title',
        position: 1
      });
    });

    it('should parse "Manga Title Volume 1"', () => {
      expect(parseSeriesString('Manga Title Volume 1')).toEqual({
        name: 'Manga Title',
        position: 1
      });
    });

    it('should parse "Manga Title, Volume 12"', () => {
      expect(parseSeriesString('Manga Title, Volume 12')).toEqual({
        name: 'Manga Title',
        position: 12
      });
    });
  });

  describe('Part notation', () => {
    it('should parse "Series Name Part 1"', () => {
      expect(parseSeriesString('Series Name Part 1')).toEqual({
        name: 'Series Name',
        position: 1
      });
    });

    it('should parse "Series Name, Part 3"', () => {
      expect(parseSeriesString('Series Name, Part 3')).toEqual({
        name: 'Series Name',
        position: 3
      });
    });
  });

  describe('Parentheses notation', () => {
    it('should parse "Series Name (1)"', () => {
      expect(parseSeriesString('Series Name (1)')).toEqual({
        name: 'Series Name',
        position: 1
      });
    });

    it('should parse "Series Name ( 5 )" (spaces)', () => {
      expect(parseSeriesString('Series Name ( 5 )')).toEqual({
        name: 'Series Name',
        position: 5
      });
    });
  });

  describe('Comma/colon notation', () => {
    it('should parse "Series Name, 1"', () => {
      expect(parseSeriesString('Series Name, 1')).toEqual({
        name: 'Series Name',
        position: 1
      });
    });

    it('should parse "Series Name: 3"', () => {
      expect(parseSeriesString('Series Name: 3')).toEqual({
        name: 'Series Name',
        position: 3
      });
    });
  });

  describe('No position', () => {
    it('should return null position for series name only', () => {
      expect(parseSeriesString('Harry Potter')).toEqual({
        name: 'Harry Potter',
        position: null
      });
    });

    it('should return null position for "Series Name Series"', () => {
      expect(parseSeriesString('The Lord of the Rings')).toEqual({
        name: 'The Lord of the Rings',
        position: null
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(parseSeriesString('')).toEqual({
        name: '',
        position: null
      });
    });

    it('should handle null', () => {
      expect(parseSeriesString(null)).toEqual({
        name: '',
        position: null
      });
    });

    it('should handle undefined', () => {
      expect(parseSeriesString(undefined)).toEqual({
        name: '',
        position: null
      });
    });

    it('should handle whitespace-only string', () => {
      expect(parseSeriesString('   ')).toEqual({
        name: '',
        position: null
      });
    });

    it('should trim whitespace', () => {
      expect(parseSeriesString('  Harry Potter #1  ')).toEqual({
        name: 'Harry Potter',
        position: 1
      });
    });
  });
});

describe('parseSeriesFromAPI', () => {
  it('should parse single string', () => {
    expect(parseSeriesFromAPI('Harry Potter #1')).toEqual({
      name: 'Harry Potter',
      position: 1
    });
  });

  it('should parse array with single item', () => {
    expect(parseSeriesFromAPI(['Discworld #5'])).toEqual({
      name: 'Discworld',
      position: 5
    });
  });

  it('should prefer item with position from array', () => {
    expect(parseSeriesFromAPI(['Fantasy Series', 'Harry Potter #4'])).toEqual({
      name: 'Harry Potter',
      position: 4
    });
  });

  it('should take first item if none have position', () => {
    expect(parseSeriesFromAPI(['Harry Potter', 'Wizarding World'])).toEqual({
      name: 'Harry Potter',
      position: null
    });
  });

  it('should return null for empty array', () => {
    expect(parseSeriesFromAPI([])).toBeNull();
  });

  it('should return null for null input', () => {
    expect(parseSeriesFromAPI(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(parseSeriesFromAPI(undefined)).toBeNull();
  });

  it('should handle array with empty strings', () => {
    expect(parseSeriesFromAPI(['', 'Real Series #1'])).toEqual({
      name: 'Real Series',
      position: 1
    });
  });
});

describe('normalizeSeriesName', () => {
  it('should lowercase the name', () => {
    expect(normalizeSeriesName('Harry Potter')).toBe('harry potter');
  });

  it('should trim whitespace', () => {
    expect(normalizeSeriesName('  Harry Potter  ')).toBe('harry potter');
  });

  it('should normalize multiple spaces', () => {
    expect(normalizeSeriesName('Harry   Potter')).toBe('harry potter');
  });

  it('should normalize quotes', () => {
    expect(normalizeSeriesName("Harry's Magic")).toBe("harry's magic");
    expect(normalizeSeriesName("Harry's Magic")).toBe("harry's magic");
  });

  it('should return empty string for null', () => {
    expect(normalizeSeriesName(null)).toBe('');
  });

  it('should return empty string for empty string', () => {
    expect(normalizeSeriesName('')).toBe('');
  });
});

describe('seriesNamesMatch', () => {
  it('should match identical names', () => {
    expect(seriesNamesMatch('Harry Potter', 'Harry Potter')).toBe(true);
  });

  it('should match case-insensitively', () => {
    expect(seriesNamesMatch('harry potter', 'Harry Potter')).toBe(true);
  });

  it('should match when one contains the other', () => {
    expect(seriesNamesMatch('Harry Potter', 'Harry Potter Series')).toBe(true);
  });

  it('should match "Harry Potter" with "The Harry Potter"', () => {
    expect(seriesNamesMatch('Harry Potter', 'The Harry Potter')).toBe(true);
  });

  it('should not match completely different names', () => {
    expect(seriesNamesMatch('Harry Potter', 'Lord of the Rings')).toBe(false);
  });

  it('should return false for empty names', () => {
    expect(seriesNamesMatch('', 'Harry Potter')).toBe(false);
    expect(seriesNamesMatch('Harry Potter', '')).toBe(false);
    expect(seriesNamesMatch('', '')).toBe(false);
  });

  it('should return false for null names', () => {
    expect(seriesNamesMatch(null, 'Harry Potter')).toBe(false);
    expect(seriesNamesMatch('Harry Potter', null)).toBe(false);
  });
});

describe('formatSeriesDisplay', () => {
  it('should format with integer position', () => {
    expect(formatSeriesDisplay('Harry Potter', 4)).toBe('Harry Potter #4');
  });

  it('should format with decimal position', () => {
    expect(formatSeriesDisplay('Series Name', 1.5)).toBe('Series Name #1.5');
  });

  it('should return name only when position is null', () => {
    expect(formatSeriesDisplay('Harry Potter', null)).toBe('Harry Potter');
  });

  it('should return name only when position is undefined', () => {
    expect(formatSeriesDisplay('Harry Potter', undefined)).toBe('Harry Potter');
  });

  it('should return empty string for empty name', () => {
    expect(formatSeriesDisplay('', 1)).toBe('');
  });

  it('should return empty string for null name', () => {
    expect(formatSeriesDisplay(null, 1)).toBe('');
  });

  it('should handle position 0', () => {
    expect(formatSeriesDisplay('Prequel Series', 0)).toBe('Prequel Series #0');
  });
});

describe('Real-world Open Library examples', () => {
  it('should parse "Harry Potter #1" (from OL22856696M)', () => {
    expect(parseSeriesFromAPI(['Harry Potter #1'])).toEqual({
      name: 'Harry Potter',
      position: 1
    });
  });

  it('should parse "The Wheel of Time #1"', () => {
    expect(parseSeriesFromAPI(['The Wheel of Time #1'])).toEqual({
      name: 'The Wheel of Time',
      position: 1
    });
  });

  it('should parse "Discworld #1"', () => {
    expect(parseSeriesFromAPI(['Discworld #1'])).toEqual({
      name: 'Discworld',
      position: 1
    });
  });

  it('should parse "A Song of Ice and Fire #1"', () => {
    expect(parseSeriesFromAPI(['A Song of Ice and Fire #1'])).toEqual({
      name: 'A Song of Ice and Fire',
      position: 1
    });
  });

  it('should handle series without position', () => {
    expect(parseSeriesFromAPI(['Wizarding World'])).toEqual({
      name: 'Wizarding World',
      position: null
    });
  });
});
