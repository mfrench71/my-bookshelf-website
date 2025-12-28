/**
 * Unit tests for src/js/utils/settings-indicators.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Firebase
vi.mock('/js/firebase-config.js', () => ({
  auth: {},
  db: {}
}));

const mockGetDocs = vi.fn();

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(() => 'mock-collection'),
  getDocs: (...args) => mockGetDocs(...args),
  query: vi.fn((col) => col),
  limit: vi.fn((n) => n)
}));

import {
  updateSettingsIndicators,
  clearIndicatorsCache
} from '../src/js/utils/settings-indicators.js';

describe('settings-indicators', () => {
  let binBadge;
  let maintenanceIndicator;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Create DOM elements
    binBadge = document.createElement('span');
    binBadge.id = 'bin-count-badge';
    binBadge.className = 'hidden';
    document.body.appendChild(binBadge);

    maintenanceIndicator = document.createElement('span');
    maintenanceIndicator.id = 'maintenance-indicator';
    maintenanceIndicator.className = 'hidden';
    document.body.appendChild(maintenanceIndicator);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  describe('updateSettingsIndicators', () => {
    it('should do nothing when no userId provided', async () => {
      await updateSettingsIndicators(null);
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    it('should show bin badge when books in bin', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ deletedAt: new Date() }) },
          { data: () => ({ deletedAt: new Date() }) },
          { data: () => ({}) } // not deleted
        ]
      });

      await updateSettingsIndicators('user123');

      expect(binBadge.classList.contains('hidden')).toBe(false);
      expect(binBadge.textContent).toBe('2');
    });

    it('should hide bin badge when no books in bin', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({}) },
          { data: () => ({}) }
        ]
      });

      await updateSettingsIndicators('user123');

      expect(binBadge.classList.contains('hidden')).toBe(true);
    });

    it('should show 99+ for large bin counts', async () => {
      const deletedBooks = Array.from({ length: 150 }, () => ({
        data: () => ({ deletedAt: new Date() })
      }));
      mockGetDocs.mockResolvedValue({ docs: deletedBooks });

      await updateSettingsIndicators('user123');

      expect(binBadge.textContent).toBe('99+');
    });

    it('should show maintenance indicator when books missing covers', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ coverImageUrl: null, genres: ['fiction'] }) }
        ]
      });

      await updateSettingsIndicators('user123');

      expect(maintenanceIndicator.classList.contains('hidden')).toBe(false);
    });

    it('should show maintenance indicator when books missing genres', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ coverImageUrl: 'http://example.com/cover.jpg', genres: [] }) }
        ]
      });

      await updateSettingsIndicators('user123');

      expect(maintenanceIndicator.classList.contains('hidden')).toBe(false);
    });

    it('should hide maintenance indicator when all books complete', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ coverImageUrl: 'http://example.com/cover.jpg', genres: ['fiction'] }) }
        ]
      });

      await updateSettingsIndicators('user123');

      expect(maintenanceIndicator.classList.contains('hidden')).toBe(true);
    });

    it('should skip deleted books when checking maintenance issues', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          // Deleted book missing cover - should be skipped
          { data: () => ({ deletedAt: new Date(), coverImageUrl: null }) },
          // Active book with cover and genres - no issues
          { data: () => ({ coverImageUrl: 'http://example.com/cover.jpg', genres: ['fiction'] }) }
        ]
      });

      await updateSettingsIndicators('user123');

      // Should not show indicator because the incomplete book is deleted
      expect(maintenanceIndicator.classList.contains('hidden')).toBe(true);
    });

    it('should use cached data within TTL', async () => {
      // Set cache
      localStorage.setItem('mybookshelf_settings_indicators', JSON.stringify({
        data: { binCount: 5, hasIssues: true },
        timestamp: Date.now()
      }));

      await updateSettingsIndicators('user123');

      // Should not call Firestore
      expect(mockGetDocs).not.toHaveBeenCalled();
      // Should apply cached values
      expect(binBadge.textContent).toBe('5');
      expect(maintenanceIndicator.classList.contains('hidden')).toBe(false);
    });

    it('should fetch fresh data when cache expired', async () => {
      // Set expired cache
      localStorage.setItem('mybookshelf_settings_indicators', JSON.stringify({
        data: { binCount: 5, hasIssues: true },
        timestamp: Date.now() - 120 * 1000 // 2 minutes ago
      }));

      mockGetDocs.mockResolvedValue({ docs: [] });

      await updateSettingsIndicators('user123');

      // Should call Firestore
      expect(mockGetDocs).toHaveBeenCalled();
    });

    it('should handle Firestore errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetDocs.mockRejectedValue(new Error('Network error'));

      // Should not throw
      await expect(updateSettingsIndicators('user123')).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should cache results after fetching', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [{ data: () => ({ deletedAt: new Date() }) }]
      });

      await updateSettingsIndicators('user123');

      const cached = JSON.parse(localStorage.getItem('mybookshelf_settings_indicators'));
      expect(cached.data.binCount).toBe(1);
    });

    it('should handle missing DOM elements gracefully', async () => {
      // Remove DOM elements
      document.body.innerHTML = '';

      mockGetDocs.mockResolvedValue({ docs: [] });

      // Should not throw
      await expect(updateSettingsIndicators('user123')).resolves.not.toThrow();
    });
  });

  describe('clearIndicatorsCache', () => {
    it('should remove cache from localStorage', () => {
      localStorage.setItem('mybookshelf_settings_indicators', 'cached data');

      clearIndicatorsCache();

      expect(localStorage.getItem('mybookshelf_settings_indicators')).toBeNull();
    });

    it('should not throw when cache does not exist', () => {
      expect(() => clearIndicatorsCache()).not.toThrow();
    });
  });
});
