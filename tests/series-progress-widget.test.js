/**
 * Unit tests for src/js/widgets/widgets/series-progress.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SeriesProgressWidget } from '../src/js/widgets/widgets/series-progress.js';

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (s) => s ? s.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '',
  initIcons: vi.fn()
}));

describe('SeriesProgressWidget', () => {
  describe('static properties', () => {
    it('should have correct id', () => {
      expect(SeriesProgressWidget.id).toBe('seriesProgress');
    });

    it('should have correct name', () => {
      expect(SeriesProgressWidget.name).toBe('Series Progress');
    });

    it('should have correct icon', () => {
      expect(SeriesProgressWidget.icon).toBe('library');
    });

    it('should have correct icon color', () => {
      expect(SeriesProgressWidget.iconColor).toBe('text-purple-600');
    });

    it('should have default size of 6', () => {
      expect(SeriesProgressWidget.defaultSize).toBe(6);
    });

    it('should have default settings', () => {
      expect(SeriesProgressWidget.defaultSettings).toEqual({ count: 6, sortBy: 'name' });
    });
  });

  describe('filterAndSort', () => {
    it('should return empty array (widget does not use book filtering)', () => {
      const books = [{ id: '1' }, { id: '2' }];
      expect(SeriesProgressWidget.filterAndSort(books)).toEqual([]);
    });
  });

  describe('getEmptyMessage', () => {
    it('should return appropriate message', () => {
      expect(SeriesProgressWidget.getEmptyMessage()).toContain('No series yet');
    });
  });

  describe('getSeeAllLink', () => {
    it('should return settings page link', () => {
      expect(SeriesProgressWidget.getSeeAllLink()).toBe('/settings/');
    });
  });

  describe('sortSeries', () => {
    const series = [
      { id: 's1', name: 'Harry Potter', bookCount: 5, totalBooks: 7 },
      { id: 's2', name: 'Discworld', bookCount: 10, totalBooks: 41 },
      { id: 's3', name: 'Lord of the Rings', bookCount: 3, totalBooks: 3 },
      { id: 's4', name: 'Narnia', bookCount: 7, totalBooks: null }
    ];

    it('should sort by name (default)', () => {
      const sorted = SeriesProgressWidget.sortSeries(series, 'name');
      expect(sorted[0].name).toBe('Discworld');
      expect(sorted[1].name).toBe('Harry Potter');
      expect(sorted[2].name).toBe('Lord of the Rings');
      expect(sorted[3].name).toBe('Narnia');
    });

    it('should sort by bookCount', () => {
      const sorted = SeriesProgressWidget.sortSeries(series, 'bookCount');
      expect(sorted[0].bookCount).toBe(10);
      expect(sorted[1].bookCount).toBe(7);
      expect(sorted[2].bookCount).toBe(5);
      expect(sorted[3].bookCount).toBe(3);
    });

    it('should sort by progress (incomplete first)', () => {
      const sorted = SeriesProgressWidget.sortSeries(series, 'progress');
      // Lord of the Rings is complete (3/3), should be last
      // Narnia has no total, so progress is 0
      expect(sorted[sorted.length - 1].name).toBe('Lord of the Rings');
    });
  });

  describe('renderSeriesRow', () => {
    it('should render series with progress bar when totalBooks is set', () => {
      const series = { id: 's1', name: 'Harry Potter', bookCount: 5, totalBooks: 7 };
      const html = SeriesProgressWidget.renderSeriesRow(series);

      expect(html).toContain('Harry Potter');
      expect(html).toContain('5 of 7 books');
      expect(html).toContain('bg-purple-500'); // Progress bar color
      expect(html).toContain('style="width:'); // Progress width
    });

    it('should render complete series with green color', () => {
      const series = { id: 's1', name: 'LOTR', bookCount: 3, totalBooks: 3 };
      const html = SeriesProgressWidget.renderSeriesRow(series);

      expect(html).toContain('Complete!');
      expect(html).toContain('bg-green-500'); // Complete bar color
      expect(html).toContain('text-green-600'); // Complete text color
    });

    it('should render series without progress bar when totalBooks is not set', () => {
      const series = { id: 's1', name: 'Discworld', bookCount: 10, totalBooks: null };
      const html = SeriesProgressWidget.renderSeriesRow(series);

      expect(html).toContain('Discworld');
      expect(html).toContain('10 books');
      expect(html).not.toContain('bg-purple-500'); // No progress bar
    });

    it('should singularize "book" when count is 1', () => {
      const series = { id: 's1', name: 'Solo Series', bookCount: 1, totalBooks: null };
      const html = SeriesProgressWidget.renderSeriesRow(series);

      expect(html).toContain('1 book');
      expect(html).not.toContain('1 books');
    });

    it('should include link to filter books by series ID', () => {
      const series = { id: 's1', name: 'Harry Potter', bookCount: 5 };
      const html = SeriesProgressWidget.renderSeriesRow(series);

      expect(html).toContain('href="/books/?series=s1"');
    });

    it('should escape special characters in series name', () => {
      const series = { id: 's1', name: '<script>alert("xss")</script>', bookCount: 1 };
      const html = SeriesProgressWidget.renderSeriesRow(series);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('renderWidget', () => {
    const config = { settings: { count: 6, sortBy: 'name' } };
    const books = [];
    const genreLookup = {};

    it('should render empty state when no series', () => {
      const html = SeriesProgressWidget.renderWidget(books, config, genreLookup, null);

      expect(html).toContain('widget-card');
      expect(html).toContain('Series Progress');
      expect(html).toContain('(0)');
      expect(html).toContain('No series yet');
    });

    it('should render empty state when seriesLookup is empty', () => {
      const seriesLookup = new Map();
      const html = SeriesProgressWidget.renderWidget(books, config, genreLookup, seriesLookup);

      expect(html).toContain('No series yet');
    });

    it('should render series list when series exist', () => {
      const seriesLookup = new Map([
        ['s1', { id: 's1', name: 'Harry Potter', bookCount: 5, totalBooks: 7 }],
        ['s2', { id: 's2', name: 'Discworld', bookCount: 10, totalBooks: 41 }]
      ]);

      const html = SeriesProgressWidget.renderWidget(books, config, genreLookup, seriesLookup);

      expect(html).toContain('Series Progress');
      expect(html).toContain('(2)'); // Count in header
      expect(html).toContain('Discworld'); // Sorted by name, D comes first
      expect(html).toContain('Harry Potter');
    });

    it('should limit series to count setting', () => {
      const seriesLookup = new Map([
        ['s1', { id: 's1', name: 'Series 1', bookCount: 1 }],
        ['s2', { id: 's2', name: 'Series 2', bookCount: 2 }],
        ['s3', { id: 's3', name: 'Series 3', bookCount: 3 }],
        ['s4', { id: 's4', name: 'Series 4', bookCount: 4 }]
      ]);

      const limitedConfig = { settings: { count: 2, sortBy: 'name' } };
      const html = SeriesProgressWidget.renderWidget(books, limitedConfig, genreLookup, seriesLookup);

      expect(html).toContain('Series 1');
      expect(html).toContain('Series 2');
      expect(html).not.toContain('Series 3');
      expect(html).not.toContain('Series 4');
    });

    it('should show "Manage series" link when more series than count', () => {
      const seriesLookup = new Map([
        ['s1', { id: 's1', name: 'Series 1', bookCount: 1 }],
        ['s2', { id: 's2', name: 'Series 2', bookCount: 2 }],
        ['s3', { id: 's3', name: 'Series 3', bookCount: 3 }]
      ]);

      const limitedConfig = { settings: { count: 2, sortBy: 'name' } };
      const html = SeriesProgressWidget.renderWidget(books, limitedConfig, genreLookup, seriesLookup);

      expect(html).toContain('Manage series');
      expect(html).toContain('href="/settings/"');
    });

    it('should not show "Manage series" link when series fit within count', () => {
      const seriesLookup = new Map([
        ['s1', { id: 's1', name: 'Series 1', bookCount: 1 }]
      ]);

      const html = SeriesProgressWidget.renderWidget(books, config, genreLookup, seriesLookup);

      expect(html).not.toContain('Manage series');
    });

    it('should respect sortBy setting', () => {
      const seriesLookup = new Map([
        ['s1', { id: 's1', name: 'Zebra Series', bookCount: 1 }],
        ['s2', { id: 's2', name: 'Alpha Series', bookCount: 10 }]
      ]);

      const byNameConfig = { settings: { count: 6, sortBy: 'name' } };
      const byCountConfig = { settings: { count: 6, sortBy: 'bookCount' } };

      const byNameHtml = SeriesProgressWidget.renderWidget(books, byNameConfig, genreLookup, seriesLookup);
      const byCountHtml = SeriesProgressWidget.renderWidget(books, byCountConfig, genreLookup, seriesLookup);

      // By name: Alpha comes first
      expect(byNameHtml.indexOf('Alpha Series')).toBeLessThan(byNameHtml.indexOf('Zebra Series'));

      // By count: Alpha (10) comes first
      expect(byCountHtml.indexOf('Alpha Series')).toBeLessThan(byCountHtml.indexOf('Zebra Series'));
    });
  });
});
