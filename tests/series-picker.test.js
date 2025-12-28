/**
 * Unit tests for src/js/components/series-picker.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SeriesPicker } from '../src/js/components/series-picker.js';

// Mock series.js
vi.mock('../src/js/series.js', () => ({
  loadUserSeries: vi.fn().mockResolvedValue([
    { id: 's1', name: 'Harry Potter', normalizedName: 'harrypotter', bookCount: 3, totalBooks: 7 },
    { id: 's2', name: 'Lord of the Rings', normalizedName: 'lordoftherings', bookCount: 2 }
  ]),
  createSeries: vi.fn().mockResolvedValue({ id: 's3', name: 'New Series' }),
  clearSeriesCache: vi.fn()
}));

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (s) => s,
  debounce: (fn) => fn,
  showToast: vi.fn(),
  initIcons: vi.fn()
}));

// Mock series-parser
vi.mock('../src/js/utils/series-parser.js', () => ({
  normalizeSeriesName: (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
}));

describe('SeriesPicker', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'series-picker';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should render input field', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      expect(container.querySelector('.series-picker-input')).toBeTruthy();
    });

    it('should show loading state initially', () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      picker.isLoading = true;
      picker.render();

      const input = container.querySelector('.series-picker-input');
      expect(input.placeholder).toBe('Loading...');
      expect(input.disabled).toBe(true);
    });

    it('should load series on init', async () => {
      const { loadUserSeries } = await import('../src/js/series.js');
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      expect(loadUserSeries).toHaveBeenCalledWith('user123');
      expect(picker.series).toHaveLength(2);
    });
  });

  describe('setSelected', () => {
    it('should display selected series', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('s1', 4);

      expect(container.textContent).toContain('Harry Potter');
      expect(picker.getSelected().seriesId).toBe('s1');
      expect(picker.getSelected().position).toBe(4);
    });

    it('should show clear button when series is selected', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('s1');

      expect(container.querySelector('.series-picker-clear')).toBeTruthy();
    });

    it('should show position input when series is selected', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('s1');

      expect(container.querySelector('.series-position-input')).toBeTruthy();
    });
  });

  describe('getSelected', () => {
    it('should return null values when nothing selected', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      const result = picker.getSelected();

      expect(result.seriesId).toBeNull();
      expect(result.seriesName).toBe('');
      expect(result.position).toBeNull();
    });

    it('should return selected values', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('s1', 3);

      const result = picker.getSelected();
      expect(result.seriesId).toBe('s1');
      expect(result.seriesName).toBe('Harry Potter');
      expect(result.position).toBe(3);
    });
  });

  describe('setSuggestion', () => {
    it('should auto-select matching series', async () => {
      const onChange = vi.fn();
      const picker = new SeriesPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.setSuggestion('Harry Potter', 5);

      expect(picker.getSelected().seriesId).toBe('s1');
      expect(picker.getSelected().position).toBe(5);
      expect(onChange).toHaveBeenCalled();
    });

    it('should show suggestion hint for new series', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSuggestion('Narnia Chronicles', 1);

      expect(container.textContent).toContain('Narnia Chronicles');
    });
  });

  describe('clear', () => {
    it('should clear selection', async () => {
      const onChange = vi.fn();
      const picker = new SeriesPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.setSelected('s1', 3);
      picker.clear();

      expect(picker.getSelected().seriesId).toBeNull();
      expect(picker.getSelected().position).toBeNull();
      expect(onChange).toHaveBeenCalled();
    });

    it('should clear via clear button', async () => {
      const onChange = vi.fn();
      const picker = new SeriesPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.setSelected('s1');
      const clearBtn = container.querySelector('.series-picker-clear');
      clearBtn.click();

      expect(picker.getSelected().seriesId).toBeNull();
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('dropdown', () => {
    it('should open on focus', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      const input = container.querySelector('.series-picker-input');
      input.focus();
      input.dispatchEvent(new Event('focus'));

      expect(container.querySelector('.series-picker-dropdown')).toBeTruthy();
    });

    it('should show existing series in dropdown', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('Harry Potter');
      expect(container.textContent).toContain('Lord of the Rings');
    });

    it('should filter series by search query', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'harry';
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('Harry Potter');
      expect(container.textContent).not.toContain('Lord of the Rings');
    });

    it('should show create option for new name', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'Narnia';
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('Create "Narnia"');
    });

    it('should not show create option for existing name', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'Harry Potter';
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).not.toContain('Create "Harry Potter"');
    });
  });

  describe('selection', () => {
    it('should select series from dropdown', async () => {
      const onChange = vi.fn();
      const picker = new SeriesPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      const seriesBtn = container.querySelector('[data-series-id="s1"]');
      seriesBtn.click();

      expect(picker.getSelected().seriesId).toBe('s1');
      expect(onChange).toHaveBeenCalled();
    });

    it('should close dropdown after selection', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      const seriesBtn = container.querySelector('[data-series-id="s1"]');
      seriesBtn.click();

      expect(picker.isOpen).toBe(false);
    });
  });

  describe('create series', () => {
    it('should create and select new series', async () => {
      const { createSeries, clearSeriesCache } = await import('../src/js/series.js');
      const onChange = vi.fn();
      const picker = new SeriesPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.searchQuery = 'Narnia';
      picker.isOpen = true;
      picker.render();

      const createBtn = container.querySelector('[data-create="Narnia"]');
      createBtn.click();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(createSeries).toHaveBeenCalledWith('user123', 'Narnia');
      expect(clearSeriesCache).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('position input', () => {
    it('should update position when input changes', async () => {
      const onChange = vi.fn();
      const picker = new SeriesPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.setSelected('s1');
      onChange.mockClear();

      const positionInput = container.querySelector('.series-position-input');
      positionInput.value = '5';
      positionInput.dispatchEvent(new Event('input'));

      expect(picker.getSelected().position).toBe(5);
      expect(onChange).toHaveBeenCalled();
    });

    it('should handle empty position', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('s1', 3);
      const positionInput = container.querySelector('.series-position-input');
      positionInput.value = '';
      positionInput.dispatchEvent(new Event('input'));

      expect(picker.getSelected().position).toBeNull();
    });
  });

  describe('keyboard navigation', () => {
    it('should close dropdown on Escape', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      const input = container.querySelector('.series-picker-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(picker.isOpen).toBe(false);
    });

    it('should navigate with arrow keys', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      const input = container.querySelector('.series-picker-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

      expect(picker.focusedIndex).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should remove event listeners', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      expect(() => picker.destroy()).not.toThrow();
    });
  });

  describe('_getFilteredSeries', () => {
    it('should return all series when no search query', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = '';
      const filtered = picker._getFilteredSeries();

      expect(filtered).toHaveLength(2);
    });

    it('should filter by normalized search query', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'HARRY';
      const filtered = picker._getFilteredSeries();

      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('Harry Potter');
    });

    it('should return empty array when no matches', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'xyz123';
      const filtered = picker._getFilteredSeries();

      expect(filtered).toHaveLength(0);
    });
  });

  describe('_shouldShowCreateOption', () => {
    it('should return false for empty query', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = '';
      expect(picker._shouldShowCreateOption()).toBe(false);
    });

    it('should return false when exact match exists', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'Harry Potter';
      expect(picker._shouldShowCreateOption()).toBe(false);
    });

    it('should return true for new series name', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'Narnia Chronicles';
      expect(picker._shouldShowCreateOption()).toBe(true);
    });

    it('should be case insensitive', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'harry potter';
      expect(picker._shouldShowCreateOption()).toBe(false);
    });
  });

  describe('_handleClickOutside', () => {
    it('should close dropdown when clicking outside', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker._handleClickOutside({ target: document.body });

      expect(picker.isOpen).toBe(false);
    });

    it('should not close when clicking inside', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker._handleClickOutside({ target: container });

      expect(picker.isOpen).toBe(true);
    });

    it('should clear search query when closing', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.searchQuery = 'test';
      picker._handleClickOutside({ target: document.body });

      expect(picker.searchQuery).toBe('');
    });
  });

  describe('_handleKeyDown', () => {
    it('should navigate on ArrowDown when open', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      event.preventDefault = vi.fn();
      picker._handleKeyDown(event);

      // Should call preventDefault for ArrowDown when open
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should navigate on ArrowUp when open', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      event.preventDefault = vi.fn();
      picker._handleKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should handle Enter when open', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.focusedIndex = 0;
      picker.render();

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      event.preventDefault = vi.fn();
      picker._handleKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should clear state on Escape', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.searchQuery = 'test';
      picker.focusedIndex = 1;

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      event.preventDefault = vi.fn();
      picker._handleKeyDown(event);

      expect(picker.isOpen).toBe(false);
      expect(picker.searchQuery).toBe('');
      expect(picker.focusedIndex).toBe(-1);
    });
  });

  describe('error handling', () => {
    it('should handle series load error', async () => {
      const { loadUserSeries } = await import('../src/js/series.js');
      loadUserSeries.mockRejectedValueOnce(new Error('Network error'));

      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      expect(picker.series).toEqual([]);
      expect(picker.isLoading).toBe(false);
    });

    it('should handle create series error', async () => {
      const { createSeries } = await import('../src/js/series.js');
      const { showToast } = await import('../src/js/utils.js');
      createSeries.mockRejectedValueOnce(new Error('Create failed'));

      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.searchQuery = 'New Series';
      picker.isOpen = true;
      picker.render();

      const createBtn = container.querySelector('[data-create="New Series"]');
      createBtn.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(showToast).toHaveBeenCalled();
    });
  });

  describe('series with book count', () => {
    it('should display book count in dropdown', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('3');
    });

    it('should display totalBooks when available', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('7');
    });
  });

  describe('setSelected edge cases', () => {
    it('should handle non-existent series ID', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('non-existent-id', 1);

      expect(picker.getSelected().seriesId).toBe('non-existent-id');
      expect(picker.getSelected().seriesName).toBe('');
    });

    it('should handle null position', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('s1', null);

      expect(picker.getSelected().position).toBeNull();
    });

    it('should handle undefined position', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected('s1');

      expect(picker.getSelected().position).toBeNull();
    });
  });

  describe('suggestion with position', () => {
    it('should accept suggestion with position', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSuggestion('Harry Potter', 3);

      expect(picker.getSelected().position).toBe(3);
    });

    it('should show suggestion hint for unmatched series', async () => {
      const picker = new SeriesPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSuggestion('New Series', 5);

      // Should render hint showing the suggestion
      expect(container.textContent).toContain('New Series');
    });
  });
});
