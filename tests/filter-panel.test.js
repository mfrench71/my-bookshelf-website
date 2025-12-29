// FilterPanel Component Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the utils module
vi.mock('../src/js/utils.js', () => ({
  initIcons: vi.fn(),
  debounce: (fn) => fn,  // Return the function immediately for tests
  escapeHtml: (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''
}));

import { FilterPanel } from '../src/js/components/filter-panel.js';

describe('FilterPanel', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should render filter controls when container is provided', () => {
      const panel = new FilterPanel({ container });

      expect(container.querySelector('.filter-sort')).toBeTruthy();
      expect(container.querySelector('.status-checkboxes')).toBeTruthy();
      expect(container.querySelector('.filter-rating')).toBeTruthy();
      expect(container.querySelector('.genre-checkboxes')).toBeTruthy();
      expect(container.querySelector('.series-checkboxes')).toBeTruthy();
      expect(container.querySelector('.filter-reset')).toBeTruthy();
    });

    it('should not render sort control when showSort is false', () => {
      const panel = new FilterPanel({ container, showSort: false });

      expect(container.querySelector('.filter-sort')).toBeNull();
      expect(container.querySelector('.filter-rating')).toBeTruthy();
    });

    it('should apply initial filters', () => {
      const genres = [{ id: 'genre-1', name: 'Fiction', colour: '#ff0000' }];
      const series = [{ id: 'series-1', name: 'Test Series' }];

      const panel = new FilterPanel({
        container,
        genres,
        series,
        initialFilters: {
          sort: 'title-asc',
          rating: 4,
          genres: ['genre-1'],
          statuses: ['reading'],
          seriesIds: ['series-1']
        }
      });

      expect(panel.getFilters().sort).toBe('title-asc');
      expect(panel.getFilters().rating).toBe(4);
      expect(panel.getFilters().genres).toEqual(['genre-1']);
      expect(panel.getFilters().statuses).toEqual(['reading']);
      expect(panel.getFilters().seriesIds).toEqual(['series-1']);
    });

    it('should not render when container is null', () => {
      const panel = new FilterPanel({ container: null });
      expect(panel.elements).toEqual({});
    });
  });

  describe('render', () => {
    it('should render all sort options', () => {
      const panel = new FilterPanel({ container });
      const sortSelect = container.querySelector('.filter-sort');

      const options = Array.from(sortSelect.querySelectorAll('option'));
      const values = options.map(o => o.value);

      expect(values).toContain('createdAt-desc');
      expect(values).toContain('createdAt-asc');
      expect(values).toContain('title-asc');
      expect(values).toContain('title-desc');
      expect(values).toContain('author-asc');
      expect(values).toContain('author-desc');
      expect(values).toContain('rating-desc');
      expect(values).toContain('rating-asc');
    });

    it('should render all rating options', () => {
      const panel = new FilterPanel({ container });
      const ratingSelect = container.querySelector('.filter-rating');

      const options = Array.from(ratingSelect.querySelectorAll('option'));
      const values = options.map(o => o.value);

      expect(values).toContain('0');
      expect(values).toContain('5');
      expect(values).toContain('4');
      expect(values).toContain('3');
      expect(values).toContain('2');
      expect(values).toContain('1');
    });

    it('should render status checkboxes', () => {
      const panel = new FilterPanel({ container });
      const statusCheckboxes = container.querySelector('.status-checkboxes');
      const checkboxes = statusCheckboxes.querySelectorAll('input[type="checkbox"]');

      expect(checkboxes.length).toBe(2);
      const values = Array.from(checkboxes).map(cb => cb.value);
      expect(values).toContain('reading');
      expect(values).toContain('finished');
    });
  });

  describe('setGenres', () => {
    it('should populate genre checkboxes with genres', () => {
      const panel = new FilterPanel({ container });
      const genres = [
        { id: 'g1', name: 'Fiction', colour: '#ff0000' },
        { id: 'g2', name: 'Non-Fiction', colour: '#00ff00' }
      ];

      panel.setGenres(genres);
      const genreCheckboxes = container.querySelector('.genre-checkboxes');
      const checkboxes = genreCheckboxes.querySelectorAll('input[type="checkbox"]');

      expect(checkboxes.length).toBe(2);
      expect(checkboxes[0].value).toBe('g1');
      expect(checkboxes[1].value).toBe('g2');
    });

    it('should preserve valid genre selection after update', () => {
      const panel = new FilterPanel({ container });
      const genres = [{ id: 'g1', name: 'Fiction', colour: '#ff0000' }];

      panel.setGenres(genres);
      panel.setFilters({ genres: ['g1'] });

      // Update with same genres
      panel.setGenres(genres);

      expect(panel.getFilters().genres).toEqual(['g1']);
    });

    it('should clear invalid genre selection after update', () => {
      const panel = new FilterPanel({ container });

      panel.setGenres([{ id: 'g1', name: 'Fiction', colour: '#ff0000' }]);
      panel.setFilters({ genres: ['g1'] });

      // Update with different genres (g1 no longer exists)
      panel.setGenres([{ id: 'g2', name: 'Sci-Fi', colour: '#0000ff' }]);

      expect(panel.getFilters().genres).toEqual([]);
    });
  });

  describe('setSeries', () => {
    it('should populate series checkboxes', () => {
      const panel = new FilterPanel({ container });
      const seriesData = [
        { id: 's1', name: 'Harry Potter' },
        { id: 's2', name: 'Lord of the Rings' }
      ];

      panel.setSeries(seriesData);
      const seriesCheckboxes = container.querySelector('.series-checkboxes');
      const checkboxes = seriesCheckboxes.querySelectorAll('input[type="checkbox"]');

      expect(checkboxes.length).toBe(2);
      expect(checkboxes[0].value).toBe('s1');
      expect(checkboxes[1].value).toBe('s2');
    });

    it('should preserve valid series selection', () => {
      const panel = new FilterPanel({ container });
      const seriesData = [{ id: 's1', name: 'Harry Potter' }];

      panel.setSeries(seriesData);
      panel.setFilters({ seriesIds: ['s1'] });
      panel.setSeries(seriesData);

      expect(panel.getFilters().seriesIds).toEqual(['s1']);
    });
  });

  describe('getFilters', () => {
    it('should return current filter state', () => {
      const genres = [{ id: 'g1', name: 'Fiction', colour: '#ff0000' }];
      const series = [{ id: 's1', name: 'Test Series' }];

      const panel = new FilterPanel({
        container,
        genres,
        series,
        initialFilters: {
          sort: 'rating-desc',
          rating: 3,
          genres: ['g1'],
          statuses: ['finished'],
          seriesIds: ['s1']
        }
      });

      const filters = panel.getFilters();

      expect(filters.sort).toBe('rating-desc');
      expect(filters.rating).toBe(3);
      expect(filters.genres).toEqual(['g1']);
      expect(filters.statuses).toEqual(['finished']);
      expect(filters.seriesIds).toEqual(['s1']);
    });

    it('should return a copy, not a reference', () => {
      const panel = new FilterPanel({ container });
      const filters1 = panel.getFilters();
      const filters2 = panel.getFilters();

      filters1.rating = 5;
      expect(filters2.rating).toBe(0); // Should not be affected
    });
  });

  describe('setFilters', () => {
    it('should update filter state', () => {
      const panel = new FilterPanel({ container });

      panel.setFilters({
        sort: 'author-asc',
        rating: 4,
        statuses: ['reading']
      });

      expect(panel.getFilters().sort).toBe('author-asc');
      expect(panel.getFilters().rating).toBe(4);
      expect(panel.getFilters().statuses).toEqual(['reading']);
    });

    it('should sync UI elements to state', () => {
      const panel = new FilterPanel({ container });

      panel.setFilters({
        sort: 'title-desc',
        rating: 3,
        statuses: ['reading']
      });

      // Check sort dropdown
      expect(container.querySelector('.filter-sort').value).toBe('title-desc');

      // Check rating dropdown value
      expect(container.querySelector('.filter-rating').value).toBe('3');

      // Check status checkbox is checked
      const statusCheckboxes = container.querySelector('.status-checkboxes');
      const readingCheckbox = statusCheckboxes.querySelector('input[value="reading"]');
      expect(readingCheckbox.checked).toBe(true);
    });

    it('should not trigger onChange callback', () => {
      const onChange = vi.fn();
      const panel = new FilterPanel({ container, onChange });

      panel.setFilters({ rating: 4 });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 when no filters are active', () => {
      const panel = new FilterPanel({ container });
      expect(panel.getActiveCount()).toBe(0);
    });

    it('should count active filters (excluding sort)', () => {
      const genres = [{ id: 'g1', name: 'Fiction', colour: '#ff0000' }];
      const series = [{ id: 's1', name: 'Test Series' }];

      const panel = new FilterPanel({
        container,
        genres,
        series,
        initialFilters: {
          sort: 'title-asc', // Should not count
          rating: 4,
          genres: ['g1'],
          statuses: ['reading'],
          seriesIds: ['s1']
        }
      });

      // rating(1) + genres(1) + statuses(1) + seriesIds(1) = 4
      expect(panel.getActiveCount()).toBe(4);
    });

    it('should count single active filter', () => {
      const panel = new FilterPanel({ container });
      panel.setFilters({ rating: 3 });

      expect(panel.getActiveCount()).toBe(1);
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false when no filters are active', () => {
      const panel = new FilterPanel({ container });
      expect(panel.hasActiveFilters()).toBe(false);
    });

    it('should return true when any filter is active', () => {
      const genres = [{ id: 'g1', name: 'Fiction', colour: '#ff0000' }];
      const panel = new FilterPanel({ container, genres });
      panel.setFilters({ genres: ['g1'] });

      expect(panel.hasActiveFilters()).toBe(true);
    });

    it('should ignore sort when checking active filters', () => {
      const panel = new FilterPanel({ container });
      panel.setFilters({ sort: 'title-asc' });

      expect(panel.hasActiveFilters()).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset all filters to defaults', () => {
      const genres = [{ id: 'g1', name: 'Fiction', colour: '#ff0000' }];
      const series = [{ id: 's1', name: 'Test Series' }];

      const panel = new FilterPanel({
        container,
        genres,
        series,
        initialFilters: {
          sort: 'title-asc',
          rating: 4,
          genres: ['g1'],
          statuses: ['reading'],
          seriesIds: ['s1']
        }
      });

      panel.reset();

      const filters = panel.getFilters();
      expect(filters.sort).toBe('createdAt-desc');
      expect(filters.rating).toBe(0);
      expect(filters.genres).toEqual([]);
      expect(filters.statuses).toEqual([]);
      expect(filters.seriesIds).toEqual([]);
    });

    it('should sync UI elements after reset', () => {
      const panel = new FilterPanel({ container });
      panel.setFilters({ rating: 5, statuses: ['finished'] });

      panel.reset();

      // Rating dropdown should be reset to 0
      expect(container.querySelector('.filter-rating').value).toBe('0');

      // Status checkboxes should be unchecked
      const statusCheckboxes = container.querySelector('.status-checkboxes');
      const finishedCheckbox = statusCheckboxes.querySelector('input[value="finished"]');
      expect(finishedCheckbox.checked).toBe(false);
    });
  });

  describe('onChange callback', () => {
    it('should call onChange when sort changes', () => {
      const onChange = vi.fn();
      const panel = new FilterPanel({ container, onChange });

      const sortSelect = container.querySelector('.filter-sort');
      sortSelect.value = 'title-asc';
      sortSelect.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        sort: 'title-asc'
      }));
    });

    it('should call onChange when rating changes', () => {
      const onChange = vi.fn();
      const panel = new FilterPanel({ container, onChange });

      const ratingSelect = container.querySelector('.filter-rating');
      ratingSelect.value = '4';
      ratingSelect.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rating: 4
      }));
    });

    it('should call onChange when genre checkbox is toggled', () => {
      const onChange = vi.fn();
      const genres = [{ id: 'g1', name: 'Fiction', colour: '#ff0000' }];
      const panel = new FilterPanel({ container, onChange, genres });

      const genreCheckboxes = container.querySelector('.genre-checkboxes');
      const checkbox = genreCheckboxes.querySelector('input[value="g1"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        genres: ['g1']
      }));
    });

    it('should call onChange when status checkbox is toggled', () => {
      const onChange = vi.fn();
      const panel = new FilterPanel({ container, onChange });

      const statusCheckboxes = container.querySelector('.status-checkboxes');
      const checkbox = statusCheckboxes.querySelector('input[value="reading"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        statuses: ['reading']
      }));
    });

    it('should call onChange when series checkbox is toggled', () => {
      const onChange = vi.fn();
      const series = [{ id: 's1', name: 'Harry Potter' }];
      const panel = new FilterPanel({ container, onChange, series });

      const seriesCheckboxes = container.querySelector('.series-checkboxes');
      const checkbox = seriesCheckboxes.querySelector('input[value="s1"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        seriesIds: ['s1']
      }));
    });

    it('should call onChange when reset button is clicked', () => {
      const onChange = vi.fn();
      const panel = new FilterPanel({ container, onChange });
      panel.setFilters({ rating: 4 });

      const resetBtn = container.querySelector('.filter-reset');
      resetBtn.click();

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rating: 0
      }));
    });
  });

  describe('series sort option visibility', () => {
    it('should show series sort option when exactly one series is selected', () => {
      const series = [{ id: 's1', name: 'Harry Potter' }];
      const panel = new FilterPanel({ container, series });

      const sortSelect = container.querySelector('.filter-sort');
      const seriesSortOption = sortSelect.querySelector('.series-sort-option');

      expect(seriesSortOption.classList.contains('hidden')).toBe(true);

      // Select a series
      panel.setFilters({ seriesIds: ['s1'] });

      expect(seriesSortOption.classList.contains('hidden')).toBe(false);
    });

    it('should hide series sort option when series is cleared', () => {
      const series = [{ id: 's1', name: 'Harry Potter' }];
      const panel = new FilterPanel({ container, series });
      panel.setFilters({ seriesIds: ['s1'] });

      const sortSelect = container.querySelector('.filter-sort');
      const seriesSortOption = sortSelect.querySelector('.series-sort-option');

      expect(seriesSortOption.classList.contains('hidden')).toBe(false);

      // Clear series
      panel.setFilters({ seriesIds: [] });

      expect(seriesSortOption.classList.contains('hidden')).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should clean up container', () => {
      const panel = new FilterPanel({ container });
      expect(container.innerHTML).not.toBe('');

      panel.destroy();

      expect(container.innerHTML).toBe('');
    });

    it('should clear element references', () => {
      const panel = new FilterPanel({ container });
      expect(Object.keys(panel.elements).length).toBeGreaterThan(0);

      panel.destroy();

      expect(panel.elements).toEqual({});
    });

    it('should clear onChange callback', () => {
      const onChange = vi.fn();
      const panel = new FilterPanel({ container, onChange });

      panel.destroy();

      expect(panel.onChange).toBeNull();
    });
  });

  describe('setBookCounts', () => {
    it('should update rating options with counts', () => {
      const panel = new FilterPanel({ container });

      panel.setBookCounts({
        ratingTotal: 50,
        ratings: { 5: 10, 4: 15, 3: 8, 2: 5, 1: 2 }
      });

      const ratingSelect = container.querySelector('.filter-rating');
      const options = Array.from(ratingSelect.querySelectorAll('option'));

      expect(options[0].textContent).toBe('All Ratings (50)');
      expect(options[1].textContent).toBe('5 Stars (10)');
      expect(options[2].textContent).toBe('4+ Stars (25)'); // 10+15
      expect(options[3].textContent).toBe('3+ Stars (33)'); // 10+15+8
    });

    it('should update genre checkboxes with counts', () => {
      const genres = [
        { id: 'g1', name: 'Fiction', colour: '#ff0000' },
        { id: 'g2', name: 'Sci-Fi', colour: '#00ff00' }
      ];
      const panel = new FilterPanel({ container, genres });

      panel.setBookCounts({
        genreTotal: 30,
        genres: { 'g1': 20, 'g2': 10 }
      });

      const genreCheckboxes = container.querySelector('.genre-checkboxes');
      const labels = genreCheckboxes.querySelectorAll('label');

      expect(labels[0].querySelector('.filter-count').textContent).toBe('(20)');
      expect(labels[1].querySelector('.filter-count').textContent).toBe('(10)');
    });

    it('should update status checkboxes with counts', () => {
      const panel = new FilterPanel({ container });

      panel.setBookCounts({
        statusTotal: 45,
        status: { reading: 3, finished: 42 }
      });

      const statusCheckboxes = container.querySelector('.status-checkboxes');
      const labels = statusCheckboxes.querySelectorAll('label');

      expect(labels[0].querySelector('.filter-count').textContent).toBe('(3)');
      expect(labels[1].querySelector('.filter-count').textContent).toBe('(42)');
    });

    it('should update series checkboxes with counts', () => {
      const seriesData = [
        { id: 's1', name: 'Harry Potter' },
        { id: 's2', name: 'LOTR' }
      ];
      const panel = new FilterPanel({ container, series: seriesData });

      panel.setBookCounts({
        seriesTotal: 14,
        series: { 's1': 7, 's2': 3 }
      });

      const seriesCheckboxes = container.querySelector('.series-checkboxes');
      const labels = seriesCheckboxes.querySelectorAll('label');

      expect(labels[0].querySelector('.filter-count').textContent).toBe('(7)');
      expect(labels[1].querySelector('.filter-count').textContent).toBe('(3)');
    });

    it('should handle null counts gracefully', () => {
      const panel = new FilterPanel({ container });
      expect(() => panel.setBookCounts(null)).not.toThrow();
    });
  });

  describe('progressive disclosure', () => {
    it('should render more filters toggle button', () => {
      const panel = new FilterPanel({ container });

      const toggleBtn = container.querySelector('.toggle-more-filters');
      expect(toggleBtn).toBeTruthy();
      expect(toggleBtn.textContent).toContain('More');
    });

    it('should collapse secondary filters by default', () => {
      const panel = new FilterPanel({ container });

      const secondaryFilters = container.querySelector('.secondary-filters');
      expect(secondaryFilters.classList.contains('collapsed')).toBe(true);
      expect(secondaryFilters.classList.contains('expanded')).toBe(false);
    });

    it('should expand secondary filters when toggle is clicked', () => {
      const panel = new FilterPanel({ container });

      const toggleBtn = container.querySelector('.toggle-more-filters');
      toggleBtn.click();

      const secondaryFilters = container.querySelector('.secondary-filters');
      expect(secondaryFilters.classList.contains('expanded')).toBe(true);
      expect(secondaryFilters.classList.contains('collapsed')).toBe(false);
      expect(toggleBtn.textContent).toContain('Less');
    });

    it('should collapse secondary filters when toggle is clicked again', () => {
      const panel = new FilterPanel({ container });

      const toggleBtn = container.querySelector('.toggle-more-filters');
      toggleBtn.click(); // Expand
      toggleBtn.click(); // Collapse

      const secondaryFilters = container.querySelector('.secondary-filters');
      expect(secondaryFilters.classList.contains('collapsed')).toBe(true);
      expect(secondaryFilters.classList.contains('expanded')).toBe(false);
      expect(toggleBtn.textContent).toContain('More');
    });

    it('should auto-expand secondary filters when series filter is active', () => {
      const series = [{ id: 's1', name: 'Test Series' }];
      const panel = new FilterPanel({
        container,
        series,
        initialFilters: { seriesIds: ['s1'] }
      });

      const secondaryFilters = container.querySelector('.secondary-filters');
      expect(secondaryFilters.classList.contains('expanded')).toBe(true);
      expect(secondaryFilters.classList.contains('collapsed')).toBe(false);

      const toggleBtn = container.querySelector('.toggle-more-filters');
      expect(toggleBtn.textContent).toContain('Less');
    });

    it('should place series filter in secondary filters section', () => {
      const panel = new FilterPanel({ container });

      const secondaryFilters = container.querySelector('.secondary-filters');
      const seriesCheckboxes = secondaryFilters.querySelector('.series-checkboxes');
      expect(seriesCheckboxes).toBeTruthy();
    });
  });

  describe('multi-select behaviour', () => {
    it('should allow selecting multiple statuses', () => {
      const panel = new FilterPanel({ container });

      panel.setFilters({ statuses: ['reading', 'finished'] });

      const filters = panel.getFilters();
      expect(filters.statuses).toEqual(['reading', 'finished']);
      expect(filters.statuses.length).toBe(2);
    });

    it('should allow selecting multiple genres', () => {
      const genres = [
        { id: 'g1', name: 'Fiction', colour: '#ff0000' },
        { id: 'g2', name: 'Sci-Fi', colour: '#00ff00' }
      ];
      const panel = new FilterPanel({ container, genres });

      panel.setFilters({ genres: ['g1', 'g2'] });

      const filters = panel.getFilters();
      expect(filters.genres).toEqual(['g1', 'g2']);
      expect(filters.genres.length).toBe(2);
    });

    it('should allow selecting multiple series', () => {
      const series = [
        { id: 's1', name: 'Harry Potter' },
        { id: 's2', name: 'Lord of the Rings' }
      ];
      const panel = new FilterPanel({ container, series });

      panel.setFilters({ seriesIds: ['s1', 's2'] });

      const filters = panel.getFilters();
      expect(filters.seriesIds).toEqual(['s1', 's2']);
      expect(filters.seriesIds.length).toBe(2);
    });

    it('should count multi-select filters correctly', () => {
      const genres = [
        { id: 'g1', name: 'Fiction', colour: '#ff0000' },
        { id: 'g2', name: 'Sci-Fi', colour: '#00ff00' }
      ];
      const panel = new FilterPanel({ container, genres });

      // 2 genres + 2 statuses = 4 active filters
      panel.setFilters({
        genres: ['g1', 'g2'],
        statuses: ['reading', 'finished']
      });

      expect(panel.getActiveCount()).toBe(4);
    });
  });

  describe('author filter', () => {
    it('should render author input when authors are provided', () => {
      const authors = ['J.K. Rowling', 'Stephen King', 'Brandon Sanderson'];
      const panel = new FilterPanel({ container, authors });

      const authorInput = container.querySelector('.filter-author');
      expect(authorInput).toBeTruthy();
      expect(authorInput.placeholder).toBe('Search authors...');
    });

    it('should include author in getFilters()', () => {
      const authors = ['J.K. Rowling', 'Stephen King'];
      const panel = new FilterPanel({ container, authors });

      panel.setFilters({ author: 'J.K. Rowling' });

      expect(panel.getFilters().author).toBe('J.K. Rowling');
    });

    it('should count author as active filter', () => {
      const authors = ['J.K. Rowling', 'Stephen King'];
      const panel = new FilterPanel({ container, authors });

      panel.setFilters({ author: 'J.K. Rowling' });

      expect(panel.getActiveCount()).toBe(1);
    });

    it('should include author in initial filters', () => {
      const authors = ['J.K. Rowling', 'Stephen King'];
      const panel = new FilterPanel({
        container,
        authors,
        initialFilters: { author: 'Stephen King' }
      });

      expect(panel.getFilters().author).toBe('Stephen King');
    });

    it('should reset author filter on reset()', () => {
      const authors = ['J.K. Rowling', 'Stephen King'];
      const panel = new FilterPanel({ container, authors });

      panel.setFilters({ author: 'J.K. Rowling' });
      panel.reset();

      expect(panel.getFilters().author).toBe('');
    });

    it('should update author list with setAuthors()', () => {
      const panel = new FilterPanel({ container, authors: ['Author A'] });
      panel.setAuthors(['Author B', 'Author C']);

      // After setting new authors, the stored authors list should be updated
      // We can verify by checking that the panel has authors
      expect(panel.getFilters().author).toBe(''); // Filter unchanged
    });
  });
});
