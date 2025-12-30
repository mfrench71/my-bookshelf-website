// Recent Searches Utility Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
  hasRecentSearches,
  removeRecentSearch,
  RECENT_SEARCHES_KEY,
  MAX_RECENT_SEARCHES,
} from '../src/js/utils/recent-searches.js';

describe('recent-searches', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getRecentSearches', () => {
    it('should return empty array when no searches saved', () => {
      expect(getRecentSearches()).toEqual([]);
    });

    it('should return saved searches', () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['test1', 'test2']));
      expect(getRecentSearches()).toEqual(['test1', 'test2']);
    });

    it('should return empty array on parse error', () => {
      localStorage.setItem(RECENT_SEARCHES_KEY, 'invalid json');
      expect(getRecentSearches()).toEqual([]);
    });
  });

  describe('saveRecentSearch', () => {
    it('should save a search query', () => {
      saveRecentSearch('test query');
      expect(getRecentSearches()).toEqual(['test query']);
    });

    it('should not save empty query', () => {
      saveRecentSearch('');
      expect(getRecentSearches()).toEqual([]);
    });

    it('should not save query shorter than 2 characters', () => {
      saveRecentSearch('a');
      expect(getRecentSearches()).toEqual([]);
    });

    it('should save query with exactly 2 characters', () => {
      saveRecentSearch('ab');
      expect(getRecentSearches()).toEqual(['ab']);
    });

    it('should add new search to beginning', () => {
      saveRecentSearch('first');
      saveRecentSearch('second');
      expect(getRecentSearches()).toEqual(['second', 'first']);
    });

    it('should move duplicate to top', () => {
      saveRecentSearch('first');
      saveRecentSearch('second');
      saveRecentSearch('first');
      expect(getRecentSearches()).toEqual(['first', 'second']);
    });

    it('should limit to max recent searches', () => {
      for (let i = 1; i <= MAX_RECENT_SEARCHES + 2; i++) {
        saveRecentSearch(`search ${i}`);
      }
      const searches = getRecentSearches();
      expect(searches.length).toBe(MAX_RECENT_SEARCHES);
      expect(searches[0]).toBe(`search ${MAX_RECENT_SEARCHES + 2}`);
    });

    it('should handle localStorage errors gracefully', () => {
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');
      mockSetItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      expect(() => saveRecentSearch('test')).not.toThrow();

      mockSetItem.mockRestore();
    });
  });

  describe('clearRecentSearches', () => {
    it('should clear all recent searches', () => {
      saveRecentSearch('test1');
      saveRecentSearch('test2');
      clearRecentSearches();
      expect(getRecentSearches()).toEqual([]);
    });

    it('should not throw when nothing to clear', () => {
      expect(() => clearRecentSearches()).not.toThrow();
    });

    it('should handle localStorage errors gracefully', () => {
      const mockRemoveItem = vi.spyOn(Storage.prototype, 'removeItem');
      mockRemoveItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => clearRecentSearches()).not.toThrow();

      mockRemoveItem.mockRestore();
    });
  });

  describe('hasRecentSearches', () => {
    it('should return false when no searches', () => {
      expect(hasRecentSearches()).toBe(false);
    });

    it('should return true when searches exist', () => {
      saveRecentSearch('test');
      expect(hasRecentSearches()).toBe(true);
    });
  });

  describe('removeRecentSearch', () => {
    it('should remove a specific search', () => {
      saveRecentSearch('first');
      saveRecentSearch('second');
      saveRecentSearch('third');
      removeRecentSearch('second');
      expect(getRecentSearches()).toEqual(['third', 'first']);
    });

    it('should not throw when search does not exist', () => {
      saveRecentSearch('test');
      expect(() => removeRecentSearch('nonexistent')).not.toThrow();
      expect(getRecentSearches()).toEqual(['test']);
    });

    it('should handle localStorage errors gracefully', () => {
      saveRecentSearch('test');
      const mockSetItem = vi.spyOn(Storage.prototype, 'setItem');
      mockSetItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(() => removeRecentSearch('test')).not.toThrow();

      mockSetItem.mockRestore();
    });
  });

  describe('constants', () => {
    it('should export expected key', () => {
      expect(RECENT_SEARCHES_KEY).toBe('mybookshelf_recent_searches');
    });

    it('should export max limit of 5', () => {
      expect(MAX_RECENT_SEARCHES).toBe(5);
    });
  });
});
