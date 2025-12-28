// Tests for genre-parser.js - Genre parsing and normalization utilities

import { describe, it, expect } from 'vitest';
import {
  parseHierarchicalGenres,
  normalizeGenreVariation,
  getGenreVariations
} from '../src/js/utils/genre-parser.js';

describe('parseHierarchicalGenres', () => {
  describe('basic parsing', () => {
    it('returns empty array for null/undefined input', () => {
      expect(parseHierarchicalGenres(null)).toEqual([]);
      expect(parseHierarchicalGenres(undefined)).toEqual([]);
    });

    it('returns empty array for empty array input', () => {
      expect(parseHierarchicalGenres([])).toEqual([]);
    });

    it('returns single genre unchanged', () => {
      expect(parseHierarchicalGenres(['Thriller'])).toEqual(['Thriller']);
    });

    it('returns multiple genres unchanged when no hierarchy', () => {
      const result = parseHierarchicalGenres(['Fantasy', 'Romance']);
      expect(result).toContain('Fantasy');
      expect(result).toContain('Romance');
      expect(result).toHaveLength(2);
    });
  });

  describe('hierarchical splitting', () => {
    it('splits on forward slash with spaces', () => {
      const result = parseHierarchicalGenres(['Fiction / Science Fiction / Space Opera']);
      expect(result).toContain('Fiction');
      expect(result).toContain('Science Fiction');
      expect(result).toContain('Space Opera');
      expect(result).toHaveLength(3);
    });

    it('splits on hyphen with spaces', () => {
      const result = parseHierarchicalGenres(['Young Adult - Fantasy']);
      expect(result).toContain('Young Adult');
      expect(result).toContain('Fantasy');
      expect(result).toHaveLength(2);
    });

    it('splits on greater than sign', () => {
      const result = parseHierarchicalGenres(['Mystery > Cozy Mystery']);
      expect(result).toContain('Mystery');
      expect(result).toContain('Cozy Mystery');
    });

    it('splits on em dash', () => {
      const result = parseHierarchicalGenres(['Horror — Supernatural']);
      expect(result).toContain('Horror');
      expect(result).toContain('Supernatural');
    });

    it('splits on en dash', () => {
      const result = parseHierarchicalGenres(['Biography – Autobiography']);
      expect(result).toContain('Biography');
      expect(result).toContain('Autobiography');
    });

    it('splits on comma-space (Open Library format)', () => {
      const result = parseHierarchicalGenres(['Fiction, humorous']);
      expect(result).toContain('Fiction');
      expect(result).toContain('Humour'); // humorous → Humour
      expect(result).toHaveLength(2);
    });

    it('handles friendship, fiction format', () => {
      const result = parseHierarchicalGenres(['Friendship, fiction']);
      expect(result).toContain('Friendship');
      expect(result).toContain('Fiction');
    });

    it('handles multiple categories with hierarchies', () => {
      const result = parseHierarchicalGenres([
        'Fiction / Fantasy / Epic',
        'Young Adult - Adventure'
      ]);
      expect(result).toContain('Fiction');
      expect(result).toContain('Fantasy');
      expect(result).toContain('Epic');
      expect(result).toContain('Young Adult');
      expect(result).toContain('Adventure');
    });
  });

  describe('deduplication', () => {
    it('removes duplicate genres', () => {
      const result = parseHierarchicalGenres([
        'Fiction / Fantasy',
        'Fantasy / Epic Fantasy'
      ]);
      const fantasyCount = result.filter(g => g === 'Fantasy').length;
      expect(fantasyCount).toBe(1);
    });

    it('normalizes case and deduplicates (fiction → Fiction)', () => {
      const result = parseHierarchicalGenres(['fiction', 'Fiction']);
      // Both are title-cased to "Fiction" and deduplicated
      expect(result).toEqual(['Fiction']);
    });
  });

  describe('trimming and empty values', () => {
    it('trims whitespace from genres', () => {
      const result = parseHierarchicalGenres(['  Fantasy  ']);
      expect(result).toEqual(['Fantasy']);
    });

    it('handles extra spaces around separators', () => {
      const result = parseHierarchicalGenres(['Fiction  /   Fantasy']);
      expect(result).toContain('Fiction');
      expect(result).toContain('Fantasy');
    });

    it('filters out empty strings', () => {
      const result = parseHierarchicalGenres(['', 'Fantasy', '']);
      expect(result).toEqual(['Fantasy']);
    });

    it('handles null values in array', () => {
      const result = parseHierarchicalGenres([null, 'Fantasy', undefined]);
      expect(result).toEqual(['Fantasy']);
    });
  });

  describe('variation normalization integration', () => {
    it('normalizes sci-fi to Science Fiction', () => {
      const result = parseHierarchicalGenres(['Sci-Fi']);
      expect(result).toContain('Science Fiction');
    });

    it('normalizes YA to Young Adult', () => {
      const result = parseHierarchicalGenres(['YA']);
      expect(result).toContain('Young Adult');
    });

    it('normalizes nonfiction to Non-Fiction', () => {
      const result = parseHierarchicalGenres(['nonfiction']);
      expect(result).toContain('Non-Fiction');
    });

    it('preserves unknown genres unchanged', () => {
      const result = parseHierarchicalGenres(['Magical Realism']);
      expect(result).toEqual(['Magical Realism']);
    });
  });
});

describe('normalizeGenreVariation', () => {
  describe('abbreviations', () => {
    it('normalizes sci-fi variations', () => {
      expect(normalizeGenreVariation('sci-fi')).toBe('Science Fiction');
      expect(normalizeGenreVariation('Sci-Fi')).toBe('Science Fiction');
      expect(normalizeGenreVariation('scifi')).toBe('Science Fiction');
      expect(normalizeGenreVariation('sf')).toBe('Science Fiction');
    });

    it('normalizes YA to Young Adult', () => {
      expect(normalizeGenreVariation('ya')).toBe('Young Adult');
      expect(normalizeGenreVariation('YA')).toBe('Young Adult');
    });

    it('normalizes rom-com variations', () => {
      expect(normalizeGenreVariation('rom-com')).toBe('Romantic Comedy');
      expect(normalizeGenreVariation('romcom')).toBe('Romantic Comedy');
    });

    it('normalizes lit-fic variations', () => {
      expect(normalizeGenreVariation('lit fic')).toBe('Literary Fiction');
      expect(normalizeGenreVariation('lit-fic')).toBe('Literary Fiction');
    });
  });

  describe('spelling variations', () => {
    it('normalizes humor to Humour (British spelling)', () => {
      expect(normalizeGenreVariation('humor')).toBe('Humour');
      // British spelling preserved
      expect(normalizeGenreVariation('humour')).toBe('humour');
    });
  });

  describe('synonyms', () => {
    it('normalizes nonfiction variations', () => {
      expect(normalizeGenreVariation('nonfiction')).toBe('Non-Fiction');
      expect(normalizeGenreVariation('non fiction')).toBe('Non-Fiction');
      expect(normalizeGenreVariation('non-fiction')).toBe('Non-Fiction');
    });

    it('normalizes mystery synonyms', () => {
      expect(normalizeGenreVariation('whodunit')).toBe('Mystery');
      expect(normalizeGenreVariation('whodunnit')).toBe('Mystery');
    });

    it('normalizes children literature terms', () => {
      expect(normalizeGenreVariation('juvenile')).toBe('Children');
      expect(normalizeGenreVariation('juvenile fiction')).toBe('Children');
      expect(normalizeGenreVariation("children's")).toBe('Children');
    });

    it('normalizes young adult terms', () => {
      expect(normalizeGenreVariation('teen')).toBe('Young Adult');
      expect(normalizeGenreVariation('teens')).toBe('Young Adult');
      expect(normalizeGenreVariation('adolescent')).toBe('Young Adult');
      expect(normalizeGenreVariation('young adult fiction')).toBe('Young Adult');
    });

    it('normalizes literary fiction terms', () => {
      expect(normalizeGenreVariation('literary')).toBe('Literary Fiction');
      expect(normalizeGenreVariation('general fiction')).toBe('Fiction');
    });
  });

  describe('subgenres preserved (not folded into parent)', () => {
    it('preserves fantasy subgenres as distinct', () => {
      expect(normalizeGenreVariation('urban fantasy')).toBe('urban fantasy');
      expect(normalizeGenreVariation('high fantasy')).toBe('high fantasy');
      expect(normalizeGenreVariation('epic fantasy')).toBe('epic fantasy');
    });

    it('preserves science fiction subgenres as distinct', () => {
      expect(normalizeGenreVariation('space opera')).toBe('space opera');
      expect(normalizeGenreVariation('hard science fiction')).toBe('hard science fiction');
    });

    it('preserves mystery subgenres as distinct', () => {
      expect(normalizeGenreVariation('cozy mystery')).toBe('cozy mystery');
      expect(normalizeGenreVariation('cosy mystery')).toBe('cosy mystery');
    });

    it('preserves romance subgenres as distinct', () => {
      expect(normalizeGenreVariation('contemporary romance')).toBe('contemporary romance');
      expect(normalizeGenreVariation('paranormal romance')).toBe('paranormal romance');
    });
  });

  describe('filtered terms (returns empty string)', () => {
    it('filters out "general" as not useful alone', () => {
      expect(normalizeGenreVariation('general')).toBe('');
      expect(normalizeGenreVariation('General')).toBe('');
      expect(normalizeGenreVariation('GENERAL')).toBe('');
    });

    it('filters out "accessible" and "readable"', () => {
      expect(normalizeGenreVariation('accessible')).toBe('');
      expect(normalizeGenreVariation('readable')).toBe('');
    });
  });

  describe('edge cases', () => {
    it('returns empty string for null/undefined', () => {
      expect(normalizeGenreVariation(null)).toBe('');
      expect(normalizeGenreVariation(undefined)).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeGenreVariation('')).toBe('');
    });

    it('preserves unknown genres (trimmed)', () => {
      expect(normalizeGenreVariation('Magical Realism')).toBe('Magical Realism');
      expect(normalizeGenreVariation('  Dystopian  ')).toBe('Dystopian');
    });

    it('is case-insensitive for lookups', () => {
      expect(normalizeGenreVariation('SCI-FI')).toBe('Science Fiction');
      expect(normalizeGenreVariation('Sci-fi')).toBe('Science Fiction');
      expect(normalizeGenreVariation('SCI-fi')).toBe('Science Fiction');
    });
  });
});

describe('getGenreVariations', () => {
  it('returns a copy of the variations mapping', () => {
    const variations = getGenreVariations();
    expect(variations).toBeTypeOf('object');
    expect(variations['sci-fi']).toBe('Science Fiction');
  });

  it('returns a copy (not the original)', () => {
    const variations1 = getGenreVariations();
    const variations2 = getGenreVariations();
    variations1['test'] = 'Test Genre';
    expect(variations2['test']).toBeUndefined();
  });
});

describe('real-world API category examples', () => {
  it('handles Google Books hierarchical categories', () => {
    const googleCategories = [
      'Fiction / Science Fiction / Space Opera',
      'Fiction / Action & Adventure'
    ];
    const result = parseHierarchicalGenres(googleCategories);
    expect(result).toContain('Fiction');
    expect(result).toContain('Science Fiction');
    expect(result).toContain('Space Opera');
    expect(result).toContain('Adventure'); // 'Action & Adventure' normalized to 'Adventure'
  });

  it('handles Open Library subjects', () => {
    const olSubjects = [
      'Science fiction',
      'Space vehicles',
      'Fiction',
      'Adventure and adventurers'
    ];
    const result = parseHierarchicalGenres(olSubjects);
    expect(result).toContain('Science Fiction'); // normalized casing
    expect(result).toContain('Fiction');
  });

  it('handles abbreviations from APIs', () => {
    const categories = [
      'ya fiction',
      'Sci-Fi'
    ];
    const result = parseHierarchicalGenres(categories);
    // Abbreviations get normalized
    expect(result).toContain('Young Adult'); // from 'ya fiction'
    expect(result).toContain('Science Fiction'); // from 'Sci-Fi'
  });

  it('preserves case when no variation match', () => {
    const categories = [
      'FICTION / Thriller',
      'MYSTERY'
    ];
    const result = parseHierarchicalGenres(categories);
    // ALL CAPS converted to Title Case for consistency
    expect(result).toContain('Fiction');
    expect(result).toContain('Thriller');
    expect(result).toContain('Mystery');
  });

  it('filters out "General" as not useful alone', () => {
    const categories = [
      'Fiction / General',
      'FICTION / General'
    ];
    const result = parseHierarchicalGenres(categories);
    expect(result).toContain('Fiction');
    expect(result).not.toContain('General');
    expect(result).toHaveLength(1); // Only Fiction, not General
  });
});
