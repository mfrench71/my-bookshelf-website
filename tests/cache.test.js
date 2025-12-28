/**
 * Unit tests for src/js/utils/cache.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CACHE_KEY,
  CACHE_TTL,
  clearBooksCache,
  getHomeSettings,
  saveHomeSettings,
  getCachedUserProfile,
  clearUserProfileCache,
  getISBNCache,
  setISBNCache
} from '../src/js/utils/cache.js';

describe('cache utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserProfileCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('constants', () => {
    it('should export CACHE_KEY with version', () => {
      expect(CACHE_KEY).toMatch(/mybookshelf_books_cache_v\d+/);
    });

    it('should export CACHE_TTL as 5 minutes', () => {
      expect(CACHE_TTL).toBe(5 * 60 * 1000);
    });
  });

  describe('clearBooksCache', () => {
    it('should remove cache entry for user', () => {
      const userId = 'user123';
      localStorage.setItem(`${CACHE_KEY}_${userId}`, 'cached data');

      clearBooksCache(userId);

      expect(localStorage.getItem(`${CACHE_KEY}_${userId}`)).toBeNull();
    });

    it('should not throw when cache does not exist', () => {
      expect(() => clearBooksCache('nonexistent')).not.toThrow();
    });
  });

  describe('getHomeSettings', () => {
    it('should return defaults when no stored settings', () => {
      const settings = getHomeSettings();

      expect(settings.currentlyReading).toEqual({ enabled: true, count: 6 });
      expect(settings.recentlyAdded).toEqual({ enabled: true, count: 6 });
      expect(settings.topRated).toEqual({ enabled: true, count: 6 });
      expect(settings.recentlyFinished).toEqual({ enabled: true, count: 6 });
    });

    it('should merge stored settings with defaults', () => {
      localStorage.setItem('homeSettings', JSON.stringify({
        currentlyReading: { enabled: false, count: 3 }
      }));

      const settings = getHomeSettings();

      expect(settings.currentlyReading).toEqual({ enabled: false, count: 3 });
      expect(settings.recentlyAdded).toEqual({ enabled: true, count: 6 }); // default
    });

    it('should return defaults for invalid JSON', () => {
      localStorage.setItem('homeSettings', 'invalid json');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const settings = getHomeSettings();

      expect(settings.currentlyReading).toEqual({ enabled: true, count: 6 });
      consoleSpy.mockRestore();
    });
  });

  describe('saveHomeSettings', () => {
    it('should save settings to localStorage', () => {
      const settings = { currentlyReading: { enabled: false, count: 10 } };

      saveHomeSettings(settings);

      const stored = JSON.parse(localStorage.getItem('homeSettings'));
      expect(stored.currentlyReading).toEqual({ enabled: false, count: 10 });
    });
  });

  describe('getCachedUserProfile', () => {
    it('should fetch and cache profile on first call', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ name: 'John' });

      const profile = await getCachedUserProfile(fetchFn, 'user123');

      expect(profile).toEqual({ name: 'John' });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should return cached profile on subsequent calls', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ name: 'John' });

      await getCachedUserProfile(fetchFn, 'user123');
      const profile2 = await getCachedUserProfile(fetchFn, 'user123');

      expect(profile2).toEqual({ name: 'John' });
      expect(fetchFn).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should re-fetch for different user', async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ name: 'John' })
        .mockResolvedValueOnce({ name: 'Jane' });

      await getCachedUserProfile(fetchFn, 'user123');
      const profile2 = await getCachedUserProfile(fetchFn, 'user456');

      expect(profile2).toEqual({ name: 'Jane' });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });

    it('should force refresh when forceRefresh is true', async () => {
      const fetchFn = vi.fn()
        .mockResolvedValueOnce({ name: 'John' })
        .mockResolvedValueOnce({ name: 'Updated John' });

      await getCachedUserProfile(fetchFn, 'user123');
      const profile2 = await getCachedUserProfile(fetchFn, 'user123', true);

      expect(profile2).toEqual({ name: 'Updated John' });
      expect(fetchFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearUserProfileCache', () => {
    it('should clear cached profile', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ name: 'John' });

      await getCachedUserProfile(fetchFn, 'user123');
      clearUserProfileCache();
      await getCachedUserProfile(fetchFn, 'user123');

      expect(fetchFn).toHaveBeenCalledTimes(2); // Called again after clear
    });
  });

  describe('getISBNCache / setISBNCache', () => {
    it('should cache and retrieve ISBN data', () => {
      const isbn = '9780123456789';
      const data = { title: 'Test Book', author: 'Author Name' };

      setISBNCache(isbn, data);
      const cached = getISBNCache(isbn);

      expect(cached).toEqual(data);
    });

    it('should return null for non-existent ISBN', () => {
      const cached = getISBNCache('nonexistent');
      expect(cached).toBeNull();
    });

    it('should return null for expired cache', () => {
      const isbn = '9780123456789';

      // Set cache with old timestamp
      localStorage.setItem(`mybookshelf_isbn_cache_${isbn}`, JSON.stringify({
        data: { title: 'Old Book' },
        timestamp: Date.now() - 25 * 60 * 60 * 1000 // 25 hours ago
      }));

      const cached = getISBNCache(isbn);

      expect(cached).toBeNull();
      // Should also remove expired entry
      expect(localStorage.getItem(`mybookshelf_isbn_cache_${isbn}`)).toBeNull();
    });

    it('should handle invalid JSON gracefully', () => {
      const isbn = '9780123456789';
      localStorage.setItem(`mybookshelf_isbn_cache_${isbn}`, 'invalid json');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const cached = getISBNCache(isbn);

      expect(cached).toBeNull();
      consoleSpy.mockRestore();
    });

    it('should cache null results', () => {
      const isbn = '9780000000000';

      setISBNCache(isbn, null);
      const cached = getISBNCache(isbn);

      expect(cached).toBeNull();
    });
  });
});
