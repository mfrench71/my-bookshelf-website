// URL State Utility Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseUrlFilters,
  buildFilterParams,
  buildFilterUrl,
  updateUrlWithFilters,
  clearUrlFilters,
  hasUrlFilters,
  getUrlFilter,
  mergeWithUrlState,
  DEFAULT_FILTER_STATE,
} from '../src/js/utils/url-state.js';

describe('url-state', () => {
  describe('parseUrlFilters', () => {
    it('should return empty object for empty search string', () => {
      const result = parseUrlFilters('');
      expect(result).toEqual({});
    });

    it('should parse sort parameter', () => {
      const result = parseUrlFilters('?sort=title-asc');
      expect(result.sort).toBe('title-asc');
    });

    it('should parse numeric rating', () => {
      const result = parseUrlFilters('?rating=4');
      expect(result.rating).toBe(4);
    });

    it('should parse unrated rating', () => {
      const result = parseUrlFilters('?rating=unrated');
      expect(result.rating).toBe('unrated');
    });

    it('should parse status as array', () => {
      const result = parseUrlFilters('?status=reading,finished');
      expect(result.statuses).toEqual(['reading', 'finished']);
    });

    it('should parse single status', () => {
      const result = parseUrlFilters('?status=reading');
      expect(result.statuses).toEqual(['reading']);
    });

    it('should parse genres as array', () => {
      const result = parseUrlFilters('?genres=genre1,genre2,genre3');
      expect(result.genres).toEqual(['genre1', 'genre2', 'genre3']);
    });

    it('should parse series as array', () => {
      const result = parseUrlFilters('?series=series1,series2');
      expect(result.series).toEqual(['series1', 'series2']);
    });

    it('should parse author', () => {
      const result = parseUrlFilters('?author=Stephen%20King');
      expect(result.author).toBe('Stephen King');
    });

    it('should parse multiple parameters', () => {
      const result = parseUrlFilters('?sort=author-asc&rating=3&status=reading&genres=fantasy');
      expect(result).toEqual({
        sort: 'author-asc',
        rating: 3,
        statuses: ['reading'],
        genres: ['fantasy'],
      });
    });

    it('should filter empty values from arrays', () => {
      const result = parseUrlFilters('?status=reading,,finished,');
      expect(result.statuses).toEqual(['reading', 'finished']);
    });

    it('should handle invalid rating as 0', () => {
      const result = parseUrlFilters('?rating=invalid');
      expect(result.rating).toBe(0);
    });
  });

  describe('buildFilterParams', () => {
    it('should return empty params for default state', () => {
      const params = buildFilterParams(DEFAULT_FILTER_STATE);
      expect(params.toString()).toBe('');
    });

    it('should include non-default sort', () => {
      const state = { ...DEFAULT_FILTER_STATE, sort: 'title-asc' };
      const params = buildFilterParams(state);
      expect(params.get('sort')).toBe('title-asc');
    });

    it('should not include default sort', () => {
      const state = { ...DEFAULT_FILTER_STATE, sort: 'createdAt-desc' };
      const params = buildFilterParams(state);
      expect(params.has('sort')).toBe(false);
    });

    it('should include numeric rating', () => {
      const state = { ...DEFAULT_FILTER_STATE, rating: 4 };
      const params = buildFilterParams(state);
      expect(params.get('rating')).toBe('4');
    });

    it('should include unrated rating', () => {
      const state = { ...DEFAULT_FILTER_STATE, rating: 'unrated' };
      const params = buildFilterParams(state);
      expect(params.get('rating')).toBe('unrated');
    });

    it('should not include zero rating', () => {
      const state = { ...DEFAULT_FILTER_STATE, rating: 0 };
      const params = buildFilterParams(state);
      expect(params.has('rating')).toBe(false);
    });

    it('should include statuses as comma-separated', () => {
      const state = { ...DEFAULT_FILTER_STATE, statuses: ['reading', 'finished'] };
      const params = buildFilterParams(state);
      expect(params.get('status')).toBe('reading,finished');
    });

    it('should not include empty statuses', () => {
      const state = { ...DEFAULT_FILTER_STATE, statuses: [] };
      const params = buildFilterParams(state);
      expect(params.has('status')).toBe(false);
    });

    it('should include genres as comma-separated', () => {
      const state = { ...DEFAULT_FILTER_STATE, genres: ['g1', 'g2'] };
      const params = buildFilterParams(state);
      expect(params.get('genres')).toBe('g1,g2');
    });

    it('should include series as comma-separated', () => {
      const state = { ...DEFAULT_FILTER_STATE, series: ['s1', 's2'] };
      const params = buildFilterParams(state);
      expect(params.get('series')).toBe('s1,s2');
    });

    it('should include author', () => {
      const state = { ...DEFAULT_FILTER_STATE, author: 'Stephen King' };
      const params = buildFilterParams(state);
      expect(params.get('author')).toBe('Stephen King');
    });

    it('should not include empty author', () => {
      const state = { ...DEFAULT_FILTER_STATE, author: '' };
      const params = buildFilterParams(state);
      expect(params.has('author')).toBe(false);
    });

    it('should build params with multiple values', () => {
      const state = {
        sort: 'author-asc',
        rating: 5,
        statuses: ['finished'],
        genres: ['fantasy', 'scifi'],
        series: [],
        author: 'Tolkien',
      };
      const params = buildFilterParams(state);
      expect(params.get('sort')).toBe('author-asc');
      expect(params.get('rating')).toBe('5');
      expect(params.get('status')).toBe('finished');
      expect(params.get('genres')).toBe('fantasy,scifi');
      expect(params.has('series')).toBe(false);
      expect(params.get('author')).toBe('Tolkien');
    });
  });

  describe('buildFilterUrl', () => {
    it('should return pathname only for default state', () => {
      const url = buildFilterUrl('/books/', DEFAULT_FILTER_STATE);
      expect(url).toBe('/books/');
    });

    it('should append query params for non-default state', () => {
      const state = { ...DEFAULT_FILTER_STATE, sort: 'title-asc' };
      const url = buildFilterUrl('/books/', state);
      expect(url).toBe('/books/?sort=title-asc');
    });

    it('should build URL with multiple params', () => {
      const state = { ...DEFAULT_FILTER_STATE, sort: 'title-asc', rating: 4 };
      const url = buildFilterUrl('/books/', state);
      expect(url).toContain('sort=title-asc');
      expect(url).toContain('rating=4');
    });
  });

  describe('updateUrlWithFilters', () => {
    beforeEach(() => {
      // Mock window.history and window.location
      delete window.location;
      window.location = { pathname: '/books/', search: '' };
      window.history.replaceState = vi.fn();
    });

    it('should call replaceState with correct URL', () => {
      const state = { ...DEFAULT_FILTER_STATE, sort: 'title-asc' };
      updateUrlWithFilters(state);
      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/books/?sort=title-asc'
      );
    });

    it('should use pathname only for default state', () => {
      updateUrlWithFilters(DEFAULT_FILTER_STATE);
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/books/');
    });
  });

  describe('clearUrlFilters', () => {
    beforeEach(() => {
      delete window.location;
      window.location = { pathname: '/books/', search: '?sort=title-asc' };
      window.history.replaceState = vi.fn();
    });

    it('should clear search params when present', () => {
      clearUrlFilters();
      expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/books/');
    });

    it('should not call replaceState if no search params', () => {
      window.location.search = '';
      clearUrlFilters();
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });
  });

  describe('hasUrlFilters', () => {
    it('should return false for empty search', () => {
      expect(hasUrlFilters('')).toBe(false);
    });

    it('should return true for sort param', () => {
      expect(hasUrlFilters('?sort=title-asc')).toBe(true);
    });

    it('should return true for rating param', () => {
      expect(hasUrlFilters('?rating=4')).toBe(true);
    });

    it('should return true for status param', () => {
      expect(hasUrlFilters('?status=reading')).toBe(true);
    });

    it('should return true for genres param', () => {
      expect(hasUrlFilters('?genres=fantasy')).toBe(true);
    });

    it('should return true for series param', () => {
      expect(hasUrlFilters('?series=s1')).toBe(true);
    });

    it('should return true for author param', () => {
      expect(hasUrlFilters('?author=King')).toBe(true);
    });

    it('should return false for unrelated params', () => {
      expect(hasUrlFilters('?foo=bar&baz=qux')).toBe(false);
    });
  });

  describe('getUrlFilter', () => {
    it('should return value for existing param', () => {
      expect(getUrlFilter('?sort=title-asc', 'sort')).toBe('title-asc');
    });

    it('should return null for missing param', () => {
      expect(getUrlFilter('?sort=title-asc', 'rating')).toBe(null);
    });

    it('should return null for empty search', () => {
      expect(getUrlFilter('', 'sort')).toBe(null);
    });
  });

  describe('mergeWithUrlState', () => {
    it('should merge URL state with existing state', () => {
      const existing = { ...DEFAULT_FILTER_STATE, sort: 'title-asc' };
      const urlState = { rating: 4 };
      const result = mergeWithUrlState(existing, urlState);
      expect(result.sort).toBe('title-asc');
      expect(result.rating).toBe(4);
    });

    it('should override existing values with URL values', () => {
      const existing = { ...DEFAULT_FILTER_STATE, sort: 'title-asc' };
      const urlState = { sort: 'author-desc' };
      const result = mergeWithUrlState(existing, urlState);
      expect(result.sort).toBe('author-desc');
    });

    it('should preserve existing values not in URL', () => {
      const existing = {
        sort: 'title-asc',
        rating: 3,
        statuses: ['reading'],
        genres: ['fantasy'],
        series: ['s1'],
        author: 'King',
      };
      const urlState = { rating: 5 };
      const result = mergeWithUrlState(existing, urlState);
      expect(result).toEqual({
        sort: 'title-asc',
        rating: 5,
        statuses: ['reading'],
        genres: ['fantasy'],
        series: ['s1'],
        author: 'King',
      });
    });
  });

  describe('DEFAULT_FILTER_STATE', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_FILTER_STATE).toEqual({
        sort: 'createdAt-desc',
        rating: 0,
        statuses: [],
        genres: [],
        series: [],
        author: '',
      });
    });
  });
});
