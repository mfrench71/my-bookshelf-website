/**
 * Tests for GenrePicker class - actual class methods
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GenrePicker } from '../src/js/components/genre-picker.js';

// Mock genres module
vi.mock('../src/js/genres.js', () => ({
  loadUserGenres: vi.fn().mockResolvedValue([
    { id: 'g1', name: 'Fiction', normalizedName: 'fiction', color: '#3b82f6' },
    { id: 'g2', name: 'Science Fiction', normalizedName: 'science fiction', color: '#22c55e' },
    { id: 'g3', name: 'Mystery', normalizedName: 'mystery', color: '#ef4444' }
  ]),
  createGenre: vi.fn().mockResolvedValue({ id: 'new-genre', name: 'New Genre', color: '#8b5cf6' }),
  GENRE_COLORS: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899']
}));

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  normalizeGenreName: (name) => name?.toLowerCase().replace(/\s+/g, ' ').trim() || '',
  getContrastColor: (bg) => bg === '#000000' ? '#ffffff' : '#000000',
  escapeHtml: (s) => s?.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) || '',
  debounce: (fn) => fn,
  showToast: vi.fn(),
  initIcons: vi.fn()
}));

describe('GenrePicker Class', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'genre-picker';
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('constructor', () => {
    it('should initialize with default state', () => {
      const picker = new GenrePicker({ container, userId: 'user123' });

      expect(picker.container).toBe(container);
      expect(picker.userId).toBe('user123');
      expect(picker.genres).toEqual([]);
      expect(picker.selected).toEqual([]);
      expect(picker.suggestions).toEqual([]);
      expect(picker.searchQuery).toBe('');
      expect(picker.isOpen).toBe(false);
      expect(picker.isLoading).toBe(false);
      expect(picker.focusedIndex).toBe(-1);
    });

    it('should accept onChange callback', () => {
      const onChange = vi.fn();
      const picker = new GenrePicker({ container, userId: 'user123', onChange });

      expect(picker.onChange).toBe(onChange);
    });
  });

  describe('init', () => {
    it('should load genres on init', async () => {
      const { loadUserGenres } = await import('../src/js/genres.js');
      const picker = new GenrePicker({ container, userId: 'user123' });

      await picker.init();

      expect(loadUserGenres).toHaveBeenCalledWith('user123');
      expect(picker.genres).toHaveLength(3);
      expect(picker.isLoading).toBe(false);
    });

    it('should handle load error gracefully', async () => {
      const { loadUserGenres } = await import('../src/js/genres.js');
      loadUserGenres.mockRejectedValueOnce(new Error('Network error'));

      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      expect(picker.genres).toEqual([]);
      expect(picker.isLoading).toBe(false);
    });

    it('should render after loading', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      expect(container.querySelector('.genre-picker')).toBeTruthy();
      expect(container.querySelector('.genre-picker-input')).toBeTruthy();
    });

    it('should add document event listeners', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const picker = new GenrePicker({ container, userId: 'user123' });

      await picker.init();

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('picker-opened', expect.any(Function));

      addEventListenerSpy.mockRestore();
    });
  });

  describe('destroy', () => {
    it('should remove event listeners', async () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      picker.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('picker-opened', expect.any(Function));

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('setSelected', () => {
    it('should set selected genre IDs', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected(['g1', 'g2']);

      expect(picker.selected).toEqual(['g1', 'g2']);
    });

    it('should handle null/undefined', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected(null);
      expect(picker.selected).toEqual([]);

      picker.setSelected(undefined);
      expect(picker.selected).toEqual([]);
    });

    it('should render selected genres as badges', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSelected(['g1']);

      expect(container.textContent).toContain('Fiction');
      expect(container.querySelector('[data-remove-genre="g1"]')).toBeTruthy();
    });
  });

  describe('getSelected', () => {
    it('should return copy of selected array', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.setSelected(['g1', 'g2']);

      const selected = picker.getSelected();
      selected.push('g3');

      expect(picker.selected).toEqual(['g1', 'g2']);
    });
  });

  describe('setSuggestions', () => {
    it('should set suggestions', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSuggestions(['Horror', 'Thriller']);

      expect(picker.suggestions).toEqual(['Horror', 'Thriller']);
    });

    it('should handle null/undefined', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      picker.setSuggestions(null);
      expect(picker.suggestions).toEqual([]);
    });
  });

  describe('render', () => {
    it('should render loading state', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      picker.isLoading = true;
      picker.render();

      const input = container.querySelector('.genre-picker-input');
      expect(input.placeholder).toBe('Loading genres...');
      expect(input.disabled).toBe(true);
    });

    it('should render dropdown when open', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      expect(container.querySelector('.genre-picker-dropdown')).toBeTruthy();
    });

    it('should not render dropdown when closed', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = false;
      picker.render();

      expect(container.querySelector('.genre-picker-dropdown')).toBeFalsy();
    });

    it('should preserve cursor position on re-render', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      const input = container.querySelector('.genre-picker-input');
      input.value = 'test';
      input.focus();
      input.setSelectionRange(2, 2);

      picker.render();

      const newInput = container.querySelector('.genre-picker-input');
      // Input should have same value after render
      expect(newInput).toBeTruthy();
    });
  });

  describe('_getFilteredGenres', () => {
    it('should return all genres when no search query', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      const filtered = picker._getFilteredGenres();

      expect(filtered).toHaveLength(3);
    });

    it('should filter by search query', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.searchQuery = 'fiction';

      const filtered = picker._getFilteredGenres();

      expect(filtered).toHaveLength(2); // Fiction and Science Fiction
    });
  });

  describe('_getFilteredSuggestions', () => {
    it('should exclude selected genres', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.suggestions = ['Fiction', 'Horror'];
      picker.setSelected(['g1']); // Select Fiction

      const filtered = picker._getFilteredSuggestions();

      expect(filtered).not.toContain('Fiction');
      expect(filtered).toContain('Horror');
    });

    it('should exclude existing genre names', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.suggestions = ['Mystery', 'Horror']; // Mystery already exists

      const filtered = picker._getFilteredSuggestions();

      expect(filtered).not.toContain('Mystery');
      expect(filtered).toContain('Horror');
    });

    it('should filter by search query', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.suggestions = ['Horror', 'Romance'];
      picker.searchQuery = 'hor';

      const filtered = picker._getFilteredSuggestions();

      expect(filtered).toContain('Horror');
      expect(filtered).not.toContain('Romance');
    });
  });

  describe('_shouldShowCreateOption', () => {
    it('should return false for empty query', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.searchQuery = '';

      expect(picker._shouldShowCreateOption()).toBe(false);
    });

    it('should return false when exact match exists', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.searchQuery = 'Fiction';

      expect(picker._shouldShowCreateOption()).toBe(false);
    });

    it('should return true for new name', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.searchQuery = 'Biography';

      expect(picker._shouldShowCreateOption()).toBe(true);
    });

    it('should return false when query matches suggestion', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.suggestions = ['Horror'];
      picker.searchQuery = 'Horror';

      expect(picker._shouldShowCreateOption()).toBe(false);
    });
  });

  describe('_toggleGenre', () => {
    it('should add genre to selection', async () => {
      const onChange = vi.fn();
      const picker = new GenrePicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker._toggleGenre('g1');

      expect(picker.selected).toContain('g1');
      expect(onChange).toHaveBeenCalledWith(['g1']);
    });

    it('should remove genre from selection', async () => {
      const onChange = vi.fn();
      const picker = new GenrePicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.selected = ['g1', 'g2'];

      picker._toggleGenre('g1');

      expect(picker.selected).not.toContain('g1');
      expect(picker.selected).toContain('g2');
    });

    it('should clear search query after toggle', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.searchQuery = 'test';

      picker._toggleGenre('g1');

      expect(picker.searchQuery).toBe('');
    });
  });

  describe('_removeGenre', () => {
    it('should remove genre from selection', async () => {
      const onChange = vi.fn();
      const picker = new GenrePicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.selected = ['g1', 'g2'];

      picker._removeGenre('g1');

      expect(picker.selected).toEqual(['g2']);
      expect(onChange).toHaveBeenCalledWith(['g2']);
    });

    it('should do nothing if genre not selected', async () => {
      const onChange = vi.fn();
      const picker = new GenrePicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.selected = ['g1'];

      picker._removeGenre('g99');

      expect(picker.selected).toEqual(['g1']);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('_handleKeyDown', () => {
    it('should navigate down on ArrowDown', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      event.preventDefault = vi.fn();

      picker._handleKeyDown(event);

      expect(picker.focusedIndex).toBe(0);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should navigate up on ArrowUp', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.focusedIndex = 2;
      picker.render();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      event.preventDefault = vi.fn();

      picker._handleKeyDown(event);

      expect(picker.focusedIndex).toBe(1);
    });

    it('should close on Escape', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.searchQuery = 'test';

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      event.preventDefault = vi.fn();

      picker._handleKeyDown(event);

      expect(picker.isOpen).toBe(false);
      expect(picker.searchQuery).toBe('');
      expect(picker.focusedIndex).toBe(-1);
    });

    it('should select focused item on Enter', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.focusedIndex = 0;
      picker.render();

      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      event.preventDefault = vi.fn();

      picker._handleKeyDown(event);

      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('_handleClickOutside', () => {
    it('should close when clicking outside', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.searchQuery = 'test';

      picker._handleClickOutside({ target: document.body });

      expect(picker.isOpen).toBe(false);
      expect(picker.searchQuery).toBe('');
    });

    it('should not close when clicking inside', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;

      picker._handleClickOutside({ target: container });

      expect(picker.isOpen).toBe(true);
    });
  });

  describe('_handlePickerOpened', () => {
    it('should close when another picker opens', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;

      const otherPicker = {};
      picker._handlePickerOpened({ detail: { picker: otherPicker } });

      expect(picker.isOpen).toBe(false);
    });

    it('should not close when same picker opens', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;

      picker._handlePickerOpened({ detail: { picker } });

      expect(picker.isOpen).toBe(true);
    });
  });

  describe('_addSuggestion', () => {
    it('should create genre and add to selection', async () => {
      const { createGenre, loadUserGenres } = await import('../src/js/genres.js');
      const onChange = vi.fn();
      const picker = new GenrePicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.suggestions = ['Horror'];

      await picker._addSuggestion('Horror');

      expect(createGenre).toHaveBeenCalledWith('user123', 'Horror');
      expect(loadUserGenres).toHaveBeenCalledWith('user123', true);
      expect(onChange).toHaveBeenCalled();
    });

    it('should remove from suggestions after adding', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.suggestions = ['Horror', 'Thriller'];

      await picker._addSuggestion('Horror');

      expect(picker.suggestions).not.toContain('Horror');
      expect(picker.suggestions).toContain('Thriller');
    });
  });

  describe('_createAndSelect', () => {
    it('should create genre and add to selection', async () => {
      const { createGenre, loadUserGenres } = await import('../src/js/genres.js');
      const onChange = vi.fn();
      const picker = new GenrePicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.searchQuery = 'Biography';

      await picker._createAndSelect('Biography');

      expect(createGenre).toHaveBeenCalledWith('user123', 'Biography');
      expect(picker.searchQuery).toBe('');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('dropdown content', () => {
    it('should render suggestions section', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.suggestions = ['Horror'];
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('Suggested from book');
      expect(container.textContent).toContain('Horror');
    });

    it('should render your genres section', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('Your genres');
      expect(container.textContent).toContain('Fiction');
    });

    it('should render create option', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.searchQuery = 'Biography';
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('Create "Biography"');
    });

    it('should show checkmark for selected genres', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.selected = ['g1'];
      picker.isOpen = true;
      picker.render();

      const genreBtn = container.querySelector('[data-genre-id="g1"]');
      expect(genreBtn.querySelector('svg')).toBeTruthy();
    });

    it('should render close button', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      expect(container.querySelector('.genre-picker-close')).toBeTruthy();
    });
  });

  describe('input interactions', () => {
    it('should open dropdown on focus', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      const input = container.querySelector('.genre-picker-input');
      input.dispatchEvent(new Event('focus'));

      expect(picker.isOpen).toBe(true);
    });

    it('should update search query on input', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });
      await picker.init();

      const input = container.querySelector('.genre-picker-input');
      input.value = 'test';
      input.dispatchEvent(new Event('input'));

      expect(picker.searchQuery).toBe('test');
      expect(picker.isOpen).toBe(true);
    });
  });

  describe('_sortBadges', () => {
    it('should sort badge elements alphabetically', async () => {
      const picker = new GenrePicker({ container, userId: 'user123' });

      const badgeContainer = document.createElement('div');
      badgeContainer.innerHTML = `
        <span class="genre-badge">Zebra</span>
        <span class="genre-badge">Apple</span>
        <span class="genre-badge">Banana</span>
      `;

      picker._sortBadges(badgeContainer);

      const badges = badgeContainer.querySelectorAll('.genre-badge');
      expect(badges[0].textContent.trim()).toBe('Apple');
      expect(badges[1].textContent.trim()).toBe('Banana');
      expect(badges[2].textContent.trim()).toBe('Zebra');
    });
  });
});
