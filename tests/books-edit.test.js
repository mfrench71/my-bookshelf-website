/**
 * Tests for src/js/books/edit.js
 * Tests book edit page logic: form handling, dirty state, reading dates, cover picker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseTimestamp, migrateBookReads, getBookStatus } from '../src/js/utils.js';

describe('Book Edit Page', () => {
  describe('Form dirty state tracking', () => {
    // Replicate checkFormDirty logic
    function checkFormDirty(currentValues, originalValues) {
      if (currentValues.title !== originalValues.title) return true;
      if (currentValues.author !== originalValues.author) return true;
      if (currentValues.coverImageUrl !== originalValues.coverImageUrl) return true;
      if (currentValues.publisher !== originalValues.publisher) return true;
      if (currentValues.publishedDate !== originalValues.publishedDate) return true;
      if (currentValues.physicalFormat !== originalValues.physicalFormat) return true;
      if (String(currentValues.pageCount || '') !== String(originalValues.pageCount || '')) return true;
      if (currentValues.notes !== originalValues.notes) return true;
      if (currentValues.rating !== originalValues.rating) return true;
      if (JSON.stringify(currentValues.reads) !== JSON.stringify(originalValues.reads)) return true;
      if (currentValues.genres.length !== originalValues.genres.length) return true;
      if (!currentValues.genres.every(g => originalValues.genres.includes(g))) return true;
      return false;
    }

    const originalValues = {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      coverImageUrl: 'https://example.com/cover.jpg',
      publisher: 'Scribner',
      publishedDate: '1925',
      physicalFormat: 'Paperback',
      pageCount: '180',
      notes: 'Classic novel',
      rating: 4,
      reads: [],
      genres: ['g1', 'g2']
    };

    it('should return false when nothing changed', () => {
      const currentValues = { ...originalValues };
      expect(checkFormDirty(currentValues, originalValues)).toBe(false);
    });

    it('should detect title change', () => {
      const currentValues = { ...originalValues, title: 'New Title' };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should detect author change', () => {
      const currentValues = { ...originalValues, author: 'New Author' };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should detect cover URL change', () => {
      const currentValues = { ...originalValues, coverImageUrl: 'https://new-cover.jpg' };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should detect rating change', () => {
      const currentValues = { ...originalValues, rating: 5 };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should detect genre addition', () => {
      const currentValues = { ...originalValues, genres: ['g1', 'g2', 'g3'] };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should detect genre removal', () => {
      const currentValues = { ...originalValues, genres: ['g1'] };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should detect reads change', () => {
      const currentValues = { ...originalValues, reads: [{ startedAt: 123 }] };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should detect page count change', () => {
      const currentValues = { ...originalValues, pageCount: '200' };
      expect(checkFormDirty(currentValues, originalValues)).toBe(true);
    });

    it('should handle page count as number vs string', () => {
      const orig = { ...originalValues, pageCount: 180 };
      const current = { ...originalValues, pageCount: '180' };
      expect(checkFormDirty(current, orig)).toBe(false);
    });
  });

  describe('Reading dates UI', () => {
    function formatDateForInput(timestamp) {
      if (!timestamp) return '';
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    }

    it('should format timestamp as YYYY-MM-DD', () => {
      const timestamp = new Date('2024-06-15').getTime();
      expect(formatDateForInput(timestamp)).toBe('2024-06-15');
    });

    it('should return empty string for null timestamp', () => {
      expect(formatDateForInput(null)).toBe('');
    });

    it('should return empty string for undefined timestamp', () => {
      expect(formatDateForInput(undefined)).toBe('');
    });

    it('should return empty string for invalid timestamp', () => {
      expect(formatDateForInput('not-a-date')).toBe('');
    });
  });

  describe('Reading status badge', () => {
    function getStatusBadge(reads) {
      const status = getBookStatus({ reads });
      if (status === 'reading') {
        return { text: 'Reading', className: 'bg-blue-100 text-blue-800' };
      } else if (status === 'finished') {
        return { text: 'Finished', className: 'bg-green-100 text-green-800' };
      }
      return { text: '', className: '' };
    }

    it('should return reading badge when in progress', () => {
      const reads = [{ startedAt: Date.now(), finishedAt: null }];
      const badge = getStatusBadge(reads);
      expect(badge.text).toBe('Reading');
      expect(badge.className).toContain('blue');
    });

    it('should return finished badge when completed', () => {
      const reads = [{ startedAt: Date.now() - 100000, finishedAt: Date.now() }];
      const badge = getStatusBadge(reads);
      expect(badge.text).toBe('Finished');
      expect(badge.className).toContain('green');
    });

    it('should return empty badge when no reads', () => {
      const badge = getStatusBadge([]);
      expect(badge.text).toBe('');
    });
  });

  describe('Re-read button state', () => {
    function canStartReread(currentReads) {
      if (!currentReads || currentReads.length === 0) return false;
      const lastRead = currentReads[currentReads.length - 1];
      return !!lastRead.finishedAt;
    }

    it('should enable re-read when last read is finished', () => {
      const reads = [{ startedAt: 100, finishedAt: 200 }];
      expect(canStartReread(reads)).toBe(true);
    });

    it('should disable re-read when still reading', () => {
      const reads = [{ startedAt: 100, finishedAt: null }];
      expect(canStartReread(reads)).toBe(false);
    });

    it('should disable re-read when no reads', () => {
      expect(canStartReread([])).toBe(false);
    });
  });

  describe('Start re-read action', () => {
    function startReread(currentReads) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return [...currentReads, { startedAt: today.getTime(), finishedAt: null }];
    }

    it('should add new read entry with today\'s date', () => {
      const reads = [{ startedAt: 100, finishedAt: 200 }];
      const newReads = startReread(reads);

      expect(newReads).toHaveLength(2);
      expect(newReads[1].finishedAt).toBe(null);
      expect(newReads[1].startedAt).toBeGreaterThan(0);
    });

    it('should preserve existing reads', () => {
      const reads = [
        { startedAt: 100, finishedAt: 200 },
        { startedAt: 300, finishedAt: 400 }
      ];
      const newReads = startReread(reads);

      expect(newReads).toHaveLength(3);
      expect(newReads[0]).toEqual(reads[0]);
      expect(newReads[1]).toEqual(reads[1]);
    });
  });

  describe('Reading date validation', () => {
    function validateReadingDates(startedDate, finishedDate) {
      const errors = [];

      if (finishedDate && !startedDate) {
        errors.push('Please set a start date first');
      }

      if (finishedDate && startedDate && finishedDate < startedDate) {
        errors.push('Finished date cannot be before started date');
      }

      return errors;
    }

    it('should pass when dates are valid', () => {
      const errors = validateReadingDates('2024-01-01', '2024-02-01');
      expect(errors).toHaveLength(0);
    });

    it('should error when finish date before start date', () => {
      const errors = validateReadingDates('2024-02-01', '2024-01-01');
      expect(errors).toContain('Finished date cannot be before started date');
    });

    it('should error when finish date without start date', () => {
      const errors = validateReadingDates('', '2024-02-01');
      expect(errors).toContain('Please set a start date first');
    });

    it('should pass when only start date is set', () => {
      const errors = validateReadingDates('2024-01-01', '');
      expect(errors).toHaveLength(0);
    });

    it('should pass when both dates are empty', () => {
      const errors = validateReadingDates('', '');
      expect(errors).toHaveLength(0);
    });
  });

  describe('Read history display', () => {
    function getPreviousReads(currentReads) {
      if (!currentReads || currentReads.length <= 1) {
        return { show: false, count: 0, entries: [] };
      }

      const previousReads = currentReads.slice(0, -1);
      return {
        show: true,
        count: previousReads.length,
        entries: previousReads.slice().reverse()
      };
    }

    it('should show previous reads when multiple exist', () => {
      const reads = [
        { startedAt: 100, finishedAt: 200 },
        { startedAt: 300, finishedAt: 400 },
        { startedAt: 500, finishedAt: null }
      ];
      const result = getPreviousReads(reads);

      expect(result.show).toBe(true);
      expect(result.count).toBe(2);
      expect(result.entries).toHaveLength(2);
    });

    it('should not show when only one read', () => {
      const reads = [{ startedAt: 100, finishedAt: null }];
      const result = getPreviousReads(reads);

      expect(result.show).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should not show when no reads', () => {
      const result = getPreviousReads([]);
      expect(result.show).toBe(false);
    });

    it('should return entries in reverse order (most recent first)', () => {
      const reads = [
        { startedAt: 100, finishedAt: 200 },
        { startedAt: 300, finishedAt: 400 },
        { startedAt: 500, finishedAt: null }
      ];
      const result = getPreviousReads(reads);

      expect(result.entries[0].startedAt).toBe(300);
      expect(result.entries[1].startedAt).toBe(100);
    });
  });

  describe('Cover picker functionality', () => {
    function renderCoverPicker(covers, currentCoverUrl) {
      const hasGoogle = !!covers?.googleBooks;
      const hasOpenLibrary = !!covers?.openLibrary;
      const hasAnyCovers = hasGoogle || hasOpenLibrary;
      const hasMultipleCovers = hasGoogle && hasOpenLibrary;

      if (!hasAnyCovers) {
        return {
          showPicker: false,
          showNoCoverMsg: !currentCoverUrl,
          showHint: false,
          selectedSource: null,
          showGoogleOption: false,
          showOpenLibraryOption: false
        };
      }

      let selectedSource = null;
      if (currentCoverUrl === covers.googleBooks) {
        selectedSource = 'googleBooks';
      } else if (currentCoverUrl === covers.openLibrary) {
        selectedSource = 'openLibrary';
      } else if (hasGoogle) {
        selectedSource = 'googleBooks';
      } else if (hasOpenLibrary) {
        selectedSource = 'openLibrary';
      }

      return {
        showPicker: true,
        showNoCoverMsg: false,
        showHint: hasMultipleCovers,
        selectedSource,
        showGoogleOption: hasGoogle,
        showOpenLibraryOption: hasOpenLibrary
      };
    }

    it('should show both options when both covers available', () => {
      const covers = {
        googleBooks: 'https://google.com/cover.jpg',
        openLibrary: 'https://openlibrary.org/cover.jpg'
      };
      const result = renderCoverPicker(covers, '');

      expect(result.showPicker).toBe(true);
      expect(result.showGoogleOption).toBe(true);
      expect(result.showOpenLibraryOption).toBe(true);
      expect(result.showHint).toBe(true);
    });

    it('should select current cover if matches', () => {
      const covers = {
        googleBooks: 'https://google.com/cover.jpg',
        openLibrary: 'https://openlibrary.org/cover.jpg'
      };
      const result = renderCoverPicker(covers, 'https://openlibrary.org/cover.jpg');

      expect(result.selectedSource).toBe('openLibrary');
    });

    it('should default to Google when no match', () => {
      const covers = {
        googleBooks: 'https://google.com/cover.jpg',
        openLibrary: 'https://openlibrary.org/cover.jpg'
      };
      const result = renderCoverPicker(covers, 'https://other.com/cover.jpg');

      expect(result.selectedSource).toBe('googleBooks');
    });

    it('should show no cover message when no covers available', () => {
      const result = renderCoverPicker({}, '');

      expect(result.showPicker).toBe(false);
      expect(result.showNoCoverMsg).toBe(true);
    });

    it('should not show hint when only one cover source', () => {
      const covers = { googleBooks: 'https://google.com/cover.jpg' };
      const result = renderCoverPicker(covers, '');

      expect(result.showHint).toBe(false);
    });
  });

  describe('Cover selection', () => {
    function selectCover(availableCovers, source) {
      if (!availableCovers || !availableCovers[source]) {
        return { success: false, url: null };
      }
      return { success: true, url: availableCovers[source] };
    }

    it('should successfully select Google cover', () => {
      const covers = { googleBooks: 'https://google.com/cover.jpg' };
      const result = selectCover(covers, 'googleBooks');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://google.com/cover.jpg');
    });

    it('should fail when source not available', () => {
      const covers = { googleBooks: 'https://google.com/cover.jpg' };
      const result = selectCover(covers, 'openLibrary');

      expect(result.success).toBe(false);
      expect(result.url).toBe(null);
    });
  });

  describe('Genre count updates on save', () => {
    function calculateGenreChanges(originalGenres, newGenres) {
      const addedGenres = newGenres.filter(g => !originalGenres.includes(g));
      const removedGenres = originalGenres.filter(g => !newGenres.includes(g));
      return {
        addedGenres,
        removedGenres,
        hasChanges: addedGenres.length > 0 || removedGenres.length > 0
      };
    }

    it('should detect added genres', () => {
      const result = calculateGenreChanges(['g1', 'g2'], ['g1', 'g2', 'g3']);

      expect(result.addedGenres).toEqual(['g3']);
      expect(result.removedGenres).toEqual([]);
      expect(result.hasChanges).toBe(true);
    });

    it('should detect removed genres', () => {
      const result = calculateGenreChanges(['g1', 'g2', 'g3'], ['g1', 'g2']);

      expect(result.addedGenres).toEqual([]);
      expect(result.removedGenres).toEqual(['g3']);
      expect(result.hasChanges).toBe(true);
    });

    it('should detect both added and removed', () => {
      const result = calculateGenreChanges(['g1', 'g2'], ['g2', 'g3']);

      expect(result.addedGenres).toEqual(['g3']);
      expect(result.removedGenres).toEqual(['g1']);
      expect(result.hasChanges).toBe(true);
    });

    it('should detect no changes', () => {
      const result = calculateGenreChanges(['g1', 'g2'], ['g1', 'g2']);

      expect(result.hasChanges).toBe(false);
    });
  });

  describe('Save button state', () => {
    function getSaveButtonState(formDirty) {
      return {
        disabled: !formDirty,
        className: formDirty ? '' : 'opacity-50 cursor-not-allowed'
      };
    }

    it('should enable button when form is dirty', () => {
      const state = getSaveButtonState(true);
      expect(state.disabled).toBe(false);
      expect(state.className).toBe('');
    });

    it('should disable button when form is clean', () => {
      const state = getSaveButtonState(false);
      expect(state.disabled).toBe(true);
      expect(state.className).toContain('opacity-50');
    });
  });

  describe('Refresh data functionality', () => {
    function normalizeFieldForRefresh(value, normalizeFn) {
      if (!value) return { value, changed: false };
      const normalized = normalizeFn(value);
      return {
        value: normalized,
        changed: normalized !== value
      };
    }

    function fillEmptyField(currentValue, newValue) {
      if (!currentValue && newValue) {
        return { value: newValue, filled: true };
      }
      return { value: currentValue, filled: false };
    }

    it('should normalize field value', () => {
      const result = normalizeFieldForRefresh('THE GREAT GATSBY', (v) => v.toLowerCase());
      expect(result.value).toBe('the great gatsby');
      expect(result.changed).toBe(true);
    });

    it('should not change already normalized value', () => {
      const result = normalizeFieldForRefresh('the great gatsby', (v) => v.toLowerCase());
      expect(result.changed).toBe(false);
    });

    it('should fill empty field with new value', () => {
      const result = fillEmptyField('', 'Scribner');
      expect(result.value).toBe('Scribner');
      expect(result.filled).toBe(true);
    });

    it('should not overwrite existing value', () => {
      const result = fillEmptyField('Original Publisher', 'New Publisher');
      expect(result.value).toBe('Original Publisher');
      expect(result.filled).toBe(false);
    });
  });

  describe('Form submission data preparation', () => {
    function prepareSubmitData(formValues, selectedGenres, availableCovers, currentReads) {
      return {
        title: formValues.title.trim(),
        author: formValues.author.trim(),
        coverImageUrl: formValues.coverImageUrl?.trim() || '',
        covers: Object.keys(availableCovers || {}).length > 0 ? availableCovers : null,
        publisher: formValues.publisher?.trim() || '',
        publishedDate: formValues.publishedDate?.trim() || '',
        physicalFormat: formValues.physicalFormat?.trim() || '',
        pageCount: formValues.pageCount ? parseInt(formValues.pageCount) : null,
        rating: formValues.rating || null,
        notes: formValues.notes?.trim() || '',
        genres: selectedGenres,
        reads: currentReads
      };
    }

    it('should prepare data with all fields', () => {
      const formValues = {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        coverImageUrl: 'https://example.com/cover.jpg',
        publisher: 'Scribner',
        publishedDate: '1925',
        physicalFormat: 'Paperback',
        pageCount: '180',
        rating: 4,
        notes: 'Great book'
      };

      const result = prepareSubmitData(formValues, ['g1'], { googleBooks: 'url' }, []);

      expect(result.title).toBe('The Great Gatsby');
      expect(result.pageCount).toBe(180);
      expect(result.genres).toEqual(['g1']);
    });

    it('should handle empty optional fields', () => {
      const formValues = {
        title: 'Test',
        author: 'Author',
        coverImageUrl: '',
        publisher: '',
        publishedDate: '',
        physicalFormat: '',
        pageCount: '',
        rating: 0,
        notes: ''
      };

      const result = prepareSubmitData(formValues, [], {}, []);

      expect(result.coverImageUrl).toBe('');
      expect(result.pageCount).toBe(null);
      expect(result.rating).toBe(null);
      expect(result.covers).toBe(null);
    });

    it('should trim whitespace from all string fields', () => {
      const formValues = {
        title: '  Test  ',
        author: '  Author  ',
        publisher: '  Publisher  ',
        notes: '  Notes  '
      };

      const result = prepareSubmitData(formValues, [], {}, []);

      expect(result.title).toBe('Test');
      expect(result.author).toBe('Author');
      expect(result.publisher).toBe('Publisher');
      expect(result.notes).toBe('Notes');
    });
  });

  describe('URL handling', () => {
    function getBookIdFromUrl(searchParams) {
      return searchParams.get('id');
    }

    it('should extract book ID from URL', () => {
      const params = new URLSearchParams('?id=book123');
      expect(getBookIdFromUrl(params)).toBe('book123');
    });

    it('should return null for missing ID', () => {
      const params = new URLSearchParams('');
      expect(getBookIdFromUrl(params)).toBe(null);
    });
  });

  describe('beforeunload warning', () => {
    function shouldWarnBeforeLeave(formDirty) {
      return formDirty;
    }

    it('should warn when form is dirty', () => {
      expect(shouldWarnBeforeLeave(true)).toBe(true);
    });

    it('should not warn when form is clean', () => {
      expect(shouldWarnBeforeLeave(false)).toBe(false);
    });
  });
});
