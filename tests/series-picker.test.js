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
});
