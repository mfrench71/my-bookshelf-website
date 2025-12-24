/**
 * Tests for src/js/books/view.js
 * Tests book view page logic: loading, rendering, and deletion
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseTimestamp, formatDate, renderStars, getContrastColor, migrateBookReads, getBookStatus } from '../src/js/utils.js';

// Replicate getLargeCoverUrl logic from view.js for testing
// (can't import directly due to Firebase dependencies)
function getLargeCoverUrl(url) {
  if (!url) return url;
  if (url.includes('covers.openlibrary.org') && url.includes('-M.jpg')) {
    return url.replace('-M.jpg', '-L.jpg');
  }
  return url;
}

describe('getLargeCoverUrl', () => {
  it('should upgrade Open Library medium URL to large', () => {
    const mediumUrl = 'https://covers.openlibrary.org/b/id/12345-M.jpg';
    const result = getLargeCoverUrl(mediumUrl);
    expect(result).toBe('https://covers.openlibrary.org/b/id/12345-L.jpg');
  });

  it('should not modify Open Library small URL', () => {
    const smallUrl = 'https://covers.openlibrary.org/b/id/12345-S.jpg';
    const result = getLargeCoverUrl(smallUrl);
    expect(result).toBe(smallUrl);
  });

  it('should not modify Open Library large URL (already large)', () => {
    const largeUrl = 'https://covers.openlibrary.org/b/id/12345-L.jpg';
    const result = getLargeCoverUrl(largeUrl);
    expect(result).toBe(largeUrl);
  });

  it('should not modify Google Books URL', () => {
    const googleUrl = 'https://books.google.com/books/content?id=abc123&printsec=frontcover&img=1&zoom=1';
    const result = getLargeCoverUrl(googleUrl);
    expect(result).toBe(googleUrl);
  });

  it('should handle null URL', () => {
    expect(getLargeCoverUrl(null)).toBe(null);
  });

  it('should handle undefined URL', () => {
    expect(getLargeCoverUrl(undefined)).toBe(undefined);
  });

  it('should handle empty string', () => {
    expect(getLargeCoverUrl('')).toBe('');
  });

  it('should handle URL with -M in path but not Open Library', () => {
    const otherUrl = 'https://example.com/images/book-M.jpg';
    const result = getLargeCoverUrl(otherUrl);
    expect(result).toBe(otherUrl);
  });
});

describe('Book View Page', () => {
  describe('renderBook - Cover handling', () => {
    // Replicate cover rendering logic
    function renderCover(coverImageUrl) {
      return {
        showImage: !!coverImageUrl,
        showPlaceholder: !coverImageUrl
      };
    }

    it('should show cover image when URL is provided', () => {
      const result = renderCover('https://example.com/cover.jpg');
      expect(result.showImage).toBe(true);
      expect(result.showPlaceholder).toBe(false);
    });

    it('should show placeholder when no cover URL', () => {
      const result = renderCover('');
      expect(result.showImage).toBe(false);
      expect(result.showPlaceholder).toBe(true);
    });

    it('should show placeholder when cover URL is null', () => {
      const result = renderCover(null);
      expect(result.showImage).toBe(false);
      expect(result.showPlaceholder).toBe(true);
    });
  });

  describe('renderBook - Rating display', () => {
    it('should render stars for rating', () => {
      const html = renderStars(4);
      // renderStars returns raw SVG elements
      expect(html).toContain('svg');
      expect(html).toContain('fill="currentColor"');
    });

    it('should render empty stars for unrated portion', () => {
      const html = renderStars(3);
      expect(html).toContain('class="empty"');
    });

    it('should not show rating section when rating is 0', () => {
      const showRating = (rating) => !!rating;
      expect(showRating(0)).toBe(false);
      expect(showRating(null)).toBe(false);
      expect(showRating(3)).toBe(true);
    });
  });

  describe('renderBook - Reading status display', () => {
    it('should show reading status for book in progress', () => {
      const book = { reads: [{ startedAt: Date.now() - 86400000, finishedAt: null }] };
      const status = getBookStatus(book);
      expect(status).toBe('reading');
    });

    it('should show finished status for completed book', () => {
      const book = { reads: [{ startedAt: Date.now() - 86400000, finishedAt: Date.now() }] };
      const status = getBookStatus(book);
      expect(status).toBe('finished');
    });

    it('should return null for book with no reads', () => {
      const book = { reads: [] };
      const status = getBookStatus(book);
      expect(status).toBe(null);
    });

    it('should handle legacy book format via migration', () => {
      const legacyBook = { startedAt: Date.now() - 86400000, finishedAt: null };
      const migrated = migrateBookReads(legacyBook);
      expect(migrated.reads).toBeDefined();
      expect(migrated.reads.length).toBe(1);
    });
  });

  describe('renderBook - Genre badges', () => {
    function renderGenreBadges(genreIds, genreLookup) {
      if (!genreIds || genreIds.length === 0 || !genreLookup) {
        return { show: false, badges: [] };
      }

      const badges = genreIds
        .map(gId => genreLookup.get(gId))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(g => ({
          name: g.name,
          color: g.color,
          textColor: getContrastColor(g.color)
        }));

      return { show: badges.length > 0, badges };
    }

    it('should render genre badges with correct colors', () => {
      const genreLookup = new Map([
        ['g1', { id: 'g1', name: 'Fantasy', color: '#3b82f6' }],
        ['g2', { id: 'g2', name: 'Adventure', color: '#10b981' }]
      ]);

      const result = renderGenreBadges(['g1', 'g2'], genreLookup);

      expect(result.show).toBe(true);
      expect(result.badges).toHaveLength(2);
      // Sorted alphabetically
      expect(result.badges[0].name).toBe('Adventure');
      expect(result.badges[1].name).toBe('Fantasy');
    });

    it('should not show section when no genres', () => {
      const result = renderGenreBadges([], new Map());
      expect(result.show).toBe(false);
    });

    it('should handle missing genre lookup entries', () => {
      const genreLookup = new Map([
        ['g1', { id: 'g1', name: 'Fantasy', color: '#3b82f6' }]
      ]);

      const result = renderGenreBadges(['g1', 'g2', 'g3'], genreLookup);

      expect(result.badges).toHaveLength(1);
      expect(result.badges[0].name).toBe('Fantasy');
    });
  });

  describe('renderBook - Metadata display', () => {
    function shouldShowMetadataRow(value) {
      return !!value && value !== '';
    }

    it('should show ISBN row when ISBN exists', () => {
      expect(shouldShowMetadataRow('9780743273565')).toBe(true);
    });

    it('should hide ISBN row when ISBN is empty', () => {
      expect(shouldShowMetadataRow('')).toBe(false);
      expect(shouldShowMetadataRow(null)).toBe(false);
      expect(shouldShowMetadataRow(undefined)).toBe(false);
    });

    it('should show page count when provided', () => {
      expect(shouldShowMetadataRow(320)).toBe(true);
      expect(shouldShowMetadataRow(0)).toBe(false);
    });

    it('should show publisher when provided', () => {
      expect(shouldShowMetadataRow('Scribner')).toBe(true);
    });

    it('should show published date when provided', () => {
      expect(shouldShowMetadataRow('1925')).toBe(true);
    });
  });

  describe('renderBook - Reading history', () => {
    function renderReadingHistory(reads) {
      if (!reads || reads.length === 0) {
        return { show: false, entries: [] };
      }

      const entries = reads.slice().reverse().map(read => ({
        started: formatDate(read.startedAt) || 'Unknown',
        finished: read.finishedAt ? formatDate(read.finishedAt) : 'In progress'
      }));

      return { show: true, entries };
    }

    it('should render reading history entries', () => {
      const reads = [
        { startedAt: new Date('2024-01-01').getTime(), finishedAt: new Date('2024-02-01').getTime() },
        { startedAt: new Date('2024-06-01').getTime(), finishedAt: null }
      ];

      const result = renderReadingHistory(reads);

      expect(result.show).toBe(true);
      expect(result.entries).toHaveLength(2);
      // Should be reversed (most recent first)
      expect(result.entries[0].finished).toBe('In progress');
    });

    it('should not show history when no reads', () => {
      const result = renderReadingHistory([]);
      expect(result.show).toBe(false);
    });
  });

  describe('renderBook - Notes display', () => {
    function shouldShowNotes(notes) {
      if (!notes) return false;
      return notes.trim().length > 0;
    }

    it('should show notes section when notes exist', () => {
      expect(shouldShowNotes('Great book, loved it!')).toBe(true);
    });

    it('should hide notes when empty', () => {
      expect(shouldShowNotes('')).toBe(false);
      expect(shouldShowNotes('   ')).toBe(false);
      expect(shouldShowNotes(null)).toBe(false);
    });
  });

  describe('Delete book functionality', () => {
    // Replicate delete logic for testing
    function prepareDeleteData(book) {
      return {
        genresToUpdate: book.genres || [],
        needsGenreUpdate: (book.genres || []).length > 0
      };
    }

    it('should identify genres to update on delete', () => {
      const book = { genres: ['g1', 'g2', 'g3'] };
      const result = prepareDeleteData(book);

      expect(result.needsGenreUpdate).toBe(true);
      expect(result.genresToUpdate).toHaveLength(3);
    });

    it('should handle book with no genres', () => {
      const book = { genres: [] };
      const result = prepareDeleteData(book);

      expect(result.needsGenreUpdate).toBe(false);
      expect(result.genresToUpdate).toHaveLength(0);
    });

    it('should handle book with undefined genres', () => {
      const book = {};
      const result = prepareDeleteData(book);

      expect(result.needsGenreUpdate).toBe(false);
      expect(result.genresToUpdate).toHaveLength(0);
    });
  });

  describe('URL handling', () => {
    function getBookIdFromUrl(searchParams) {
      return searchParams.get('id');
    }

    function shouldRedirectToList(bookId) {
      return !bookId;
    }

    it('should extract book ID from URL', () => {
      const params = new URLSearchParams('?id=abc123');
      expect(getBookIdFromUrl(params)).toBe('abc123');
    });

    it('should return null for missing ID', () => {
      const params = new URLSearchParams('');
      expect(getBookIdFromUrl(params)).toBe(null);
    });

    it('should redirect when no book ID', () => {
      expect(shouldRedirectToList(null)).toBe(true);
      expect(shouldRedirectToList('')).toBe(true);
      expect(shouldRedirectToList('abc123')).toBe(false);
    });
  });

  describe('Navigation', () => {
    function getBackNavigation(historyLength) {
      if (historyLength > 1) {
        return 'back';
      }
      return 'redirect';
    }

    it('should go back when history exists', () => {
      expect(getBackNavigation(5)).toBe('back');
    });

    it('should redirect when no history', () => {
      expect(getBackNavigation(1)).toBe('redirect');
      expect(getBackNavigation(0)).toBe('redirect');
    });
  });
});

describe('Date formatting', () => {
  describe('parseTimestamp', () => {
    it('should parse Firestore timestamp object', () => {
      const timestamp = { toDate: () => new Date('2024-01-15') };
      const result = parseTimestamp(timestamp);
      expect(result instanceof Date).toBe(true);
    });

    it('should parse numeric timestamp', () => {
      const timestamp = new Date('2024-01-15').getTime();
      const result = parseTimestamp(timestamp);
      expect(result instanceof Date).toBe(true);
    });

    it('should handle null/undefined', () => {
      expect(parseTimestamp(null)).toBe(null);
      expect(parseTimestamp(undefined)).toBe(null);
    });
  });

  describe('formatDate', () => {
    it('should format valid timestamp', () => {
      const timestamp = new Date('2024-06-15').getTime();
      const result = formatDate(timestamp);
      expect(result).toContain('2024');
    });

    it('should handle null timestamp', () => {
      expect(formatDate(null)).toBe(null);
    });
  });
});

describe('Reading status logic', () => {
  describe('migrateBookReads', () => {
    it('should return book unchanged if already has reads array', () => {
      const book = { title: 'Test', reads: [{ startedAt: 123, finishedAt: 456 }] };
      const result = migrateBookReads(book);
      expect(result.reads).toEqual(book.reads);
    });

    it('should migrate legacy startedAt/finishedAt to reads', () => {
      const book = {
        title: 'Test',
        startedAt: new Date('2024-01-01').getTime(),
        finishedAt: new Date('2024-02-01').getTime()
      };
      const result = migrateBookReads(book);
      expect(result.reads).toBeDefined();
      expect(result.reads.length).toBe(1);
      expect(result.reads[0].startedAt).toBe(book.startedAt);
      expect(result.reads[0].finishedAt).toBe(book.finishedAt);
    });

    it('should handle book with only startedAt', () => {
      const book = {
        title: 'Test',
        startedAt: new Date('2024-01-01').getTime()
      };
      const result = migrateBookReads(book);
      expect(result.reads).toBeDefined();
      expect(result.reads.length).toBe(1);
      expect(result.reads[0].finishedAt).toBeFalsy();
    });

    it('should return empty reads for book with no dates', () => {
      const book = { title: 'Test' };
      const result = migrateBookReads(book);
      expect(result.reads).toEqual([]);
    });
  });

  describe('getBookStatus', () => {
    it('should return "reading" when last read has no finish date', () => {
      const book = { reads: [{ startedAt: Date.now(), finishedAt: null }] };
      expect(getBookStatus(book)).toBe('reading');
    });

    it('should return "finished" when last read has finish date', () => {
      const book = { reads: [{ startedAt: Date.now() - 100000, finishedAt: Date.now() }] };
      expect(getBookStatus(book)).toBe('finished');
    });

    it('should return null for empty reads array', () => {
      const book = { reads: [] };
      expect(getBookStatus(book)).toBe(null);
    });

    it('should return null when book has no reads property', () => {
      const book = {};
      expect(getBookStatus(book)).toBe(null);
    });

    it('should check last read in array for multi-read books', () => {
      const book = {
        reads: [
          { startedAt: 100, finishedAt: 200 },
          { startedAt: 300, finishedAt: null } // Currently reading
        ]
      };
      expect(getBookStatus(book)).toBe('reading');
    });
  });
});

describe('Contrast color calculation', () => {
  it('should return white for dark backgrounds', () => {
    const result = getContrastColor('#000000');
    expect(result).toBe('#ffffff');
  });

  it('should return black for light backgrounds', () => {
    const result = getContrastColor('#ffffff');
    expect(result).toBe('#000000');
  });

  it('should handle hex colors with hash', () => {
    const result = getContrastColor('#3b82f6');
    expect(['#000000', '#ffffff']).toContain(result);
  });

  it('should handle 6-character hex colors', () => {
    const result = getContrastColor('#ffffff');
    expect(result).toBe('#000000');
  });
});
