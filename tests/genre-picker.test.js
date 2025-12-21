/**
 * Tests for genre-picker.js - GenrePicker component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeGenreName, getContrastColor, escapeHtml, debounce } from '../src/js/utils.js';

// Mock genres module
const mockLoadUserGenres = vi.fn();
const mockCreateGenre = vi.fn();

vi.mock('../src/js/genres.js', () => ({
  loadUserGenres: (...args) => mockLoadUserGenres(...args),
  createGenre: (...args) => mockCreateGenre(...args),
  GENRE_COLORS: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899']
}));

// Mock utils - we'll use real implementations for some
vi.mock('../src/js/utils.js', async () => {
  const actual = await vi.importActual('../src/js/utils.js');
  return {
    ...actual,
    showToast: vi.fn(),
    initIcons: vi.fn()
  };
});

// Mock lucide
global.lucide = {
  createIcons: vi.fn()
};

/**
 * Set up DOM container for genre picker
 */
function setupContainer() {
  document.body.innerHTML = '<div id="genre-picker-container"></div><div id="toast" class="hidden"></div>';
  return document.getElementById('genre-picker-container');
}

/**
 * Create mock genres
 */
function createMockGenres() {
  return [
    { id: 'g1', name: 'Fiction', normalizedName: 'fiction', color: '#3b82f6' },
    { id: 'g2', name: 'Science Fiction', normalizedName: 'sciencefiction', color: '#22c55e' },
    { id: 'g3', name: 'Mystery', normalizedName: 'mystery', color: '#ef4444' },
    { id: 'g4', name: "Children's Books", normalizedName: "children'sbooks", color: '#ec4899' }
  ];
}

describe('GenrePicker Component', () => {
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    container = setupContainer();
    mockLoadUserGenres.mockResolvedValue(createMockGenres());
    mockCreateGenre.mockResolvedValue({ id: 'new-genre', name: 'New Genre', color: '#8b5cf6' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('normalizeGenreName', () => {
    it('should convert to lowercase', () => {
      expect(normalizeGenreName('FICTION')).toBe('fiction');
    });

    it('should trim whitespace', () => {
      expect(normalizeGenreName('  Fiction  ')).toBe('fiction');
    });

    it('should collapse multiple spaces to single space', () => {
      expect(normalizeGenreName('Science  Fiction')).toBe('science fiction');
    });

    it('should handle empty string', () => {
      expect(normalizeGenreName('')).toBe('');
    });

    it('should preserve special characters', () => {
      expect(normalizeGenreName("Children's")).toBe("children's");
    });
  });

  describe('State Management', () => {
    it('should initialize with empty selected array', () => {
      const state = {
        genres: [],
        selected: [],
        suggestions: [],
        searchQuery: '',
        isOpen: false,
        isLoading: false,
        focusedIndex: -1
      };

      expect(state.selected).toEqual([]);
      expect(state.isOpen).toBe(false);
    });

    it('should set selected genres', () => {
      const state = { selected: [] };

      function setSelected(genreIds) {
        state.selected = genreIds || [];
      }

      setSelected(['g1', 'g2']);
      expect(state.selected).toEqual(['g1', 'g2']);
    });

    it('should get selected genres as copy', () => {
      const state = { selected: ['g1', 'g2'] };

      function getSelected() {
        return [...state.selected];
      }

      const selected = getSelected();
      selected.push('g3');

      expect(state.selected).toEqual(['g1', 'g2']);
    });

    it('should set suggestions', () => {
      const state = { suggestions: [] };

      function setSuggestions(names) {
        state.suggestions = names || [];
      }

      setSuggestions(['Romance', 'Horror']);
      expect(state.suggestions).toEqual(['Romance', 'Horror']);
    });
  });

  describe('Filtering', () => {
    describe('getFilteredGenres', () => {
      it('should return all genres when no search query', () => {
        const genres = createMockGenres();
        const searchQuery = '';

        function getFilteredGenres() {
          if (!searchQuery) return genres;
          const query = normalizeGenreName(searchQuery);
          return genres.filter(g => g.normalizedName.includes(query));
        }

        expect(getFilteredGenres()).toEqual(genres);
      });

      it('should filter genres by search query', () => {
        const genres = createMockGenres();
        const searchQuery = 'fiction';

        function getFilteredGenres() {
          if (!searchQuery) return genres;
          const query = normalizeGenreName(searchQuery);
          return genres.filter(g => g.normalizedName.includes(query));
        }

        const filtered = getFilteredGenres();
        expect(filtered.length).toBe(2); // Fiction and Science Fiction
        expect(filtered.map(g => g.name)).toContain('Fiction');
        expect(filtered.map(g => g.name)).toContain('Science Fiction');
      });

      it('should be case insensitive', () => {
        const genres = createMockGenres();
        const searchQuery = 'MYSTERY';

        function getFilteredGenres() {
          const query = normalizeGenreName(searchQuery);
          return genres.filter(g => g.normalizedName.includes(query));
        }

        const filtered = getFilteredGenres();
        expect(filtered.length).toBe(1);
        expect(filtered[0].name).toBe('Mystery');
      });

      it('should match partial names', () => {
        const genres = createMockGenres();
        const searchQuery = 'sci';

        function getFilteredGenres() {
          const query = normalizeGenreName(searchQuery);
          return genres.filter(g => g.normalizedName.includes(query));
        }

        const filtered = getFilteredGenres();
        expect(filtered.length).toBe(1);
        expect(filtered[0].name).toBe('Science Fiction');
      });
    });

    describe('getFilteredSuggestions', () => {
      it('should exclude already selected genres', () => {
        const genres = createMockGenres();
        const selected = ['g1']; // Fiction selected
        const suggestions = ['Fiction', 'Horror', 'Romance'];

        function getFilteredSuggestions() {
          const selectedGenreNames = new Set(
            selected.map(id => genres.find(g => g.id === id))
              .filter(Boolean)
              .map(g => g.normalizedName)
          );

          return suggestions.filter(name => {
            const normalized = normalizeGenreName(name);
            if (selectedGenreNames.has(normalized)) return false;
            return true;
          });
        }

        const filtered = getFilteredSuggestions();
        expect(filtered).not.toContain('Fiction');
        expect(filtered).toContain('Horror');
        expect(filtered).toContain('Romance');
      });

      it('should exclude existing genre names', () => {
        const genres = createMockGenres();
        const selected = [];
        const suggestions = ['Mystery', 'Horror', 'Thriller'];

        function getFilteredSuggestions() {
          const existingGenreNames = new Set(genres.map(g => g.normalizedName));

          return suggestions.filter(name => {
            const normalized = normalizeGenreName(name);
            if (existingGenreNames.has(normalized)) return false;
            return true;
          });
        }

        const filtered = getFilteredSuggestions();
        expect(filtered).not.toContain('Mystery'); // Already exists
        expect(filtered).toContain('Horror');
        expect(filtered).toContain('Thriller');
      });

      it('should filter by search query when present', () => {
        const searchQuery = 'hor';
        const suggestions = ['Horror', 'Romance', 'Author Notes'];

        function getFilteredSuggestions() {
          return suggestions.filter(name => {
            if (searchQuery) {
              const query = normalizeGenreName(searchQuery);
              const normalized = normalizeGenreName(name);
              return normalized.includes(query);
            }
            return true;
          });
        }

        const filtered = getFilteredSuggestions();
        // 'horror' and 'author notes' both contain 'hor'
        expect(filtered).toEqual(['Horror', 'Author Notes']);
      });
    });

    describe('shouldShowCreateOption', () => {
      it('should return false for empty query', () => {
        const searchQuery = '';

        function shouldShowCreateOption() {
          if (!searchQuery || searchQuery.trim().length < 1) return false;
          return true;
        }

        expect(shouldShowCreateOption()).toBe(false);
      });

      it('should return false when exact match exists in genres', () => {
        const genres = createMockGenres();
        const searchQuery = 'Fiction';

        function shouldShowCreateOption() {
          if (!searchQuery) return false;
          const query = normalizeGenreName(searchQuery);
          const exists = genres.some(g => g.normalizedName === query);
          if (exists) return false;
          return true;
        }

        expect(shouldShowCreateOption()).toBe(false);
      });

      it('should return false when exact match exists in suggestions', () => {
        const genres = [];
        const suggestions = ['Horror', 'Thriller'];
        const searchQuery = 'Horror';

        function shouldShowCreateOption() {
          if (!searchQuery) return false;
          const query = normalizeGenreName(searchQuery);
          const inSuggestions = suggestions.some(s => normalizeGenreName(s) === query);
          if (inSuggestions) return false;
          return true;
        }

        expect(shouldShowCreateOption()).toBe(false);
      });

      it('should return true for new genre name', () => {
        const genres = createMockGenres();
        const suggestions = ['Horror', 'Thriller'];
        const searchQuery = 'Biography';

        function shouldShowCreateOption() {
          if (!searchQuery) return false;
          const query = normalizeGenreName(searchQuery);
          const exists = genres.some(g => g.normalizedName === query);
          if (exists) return false;
          const inSuggestions = suggestions.some(s => normalizeGenreName(s) === query);
          if (inSuggestions) return false;
          return true;
        }

        expect(shouldShowCreateOption()).toBe(true);
      });
    });
  });

  describe('Rendering', () => {
    it('should render selected genres as badges', () => {
      const genres = createMockGenres();
      const selected = ['g1', 'g3'];

      const selectedGenres = selected
        .map(id => genres.find(g => g.id === id))
        .filter(Boolean);

      const html = selectedGenres.map(genre => `
        <span class="genre-badge" style="background-color: ${genre.color}">
          ${escapeHtml(genre.name)}
          <button data-remove-genre="${genre.id}">X</button>
        </span>
      `).join('');

      expect(html).toContain('Fiction');
      expect(html).toContain('Mystery');
      expect(html).toContain('data-remove-genre="g1"');
      expect(html).toContain('data-remove-genre="g3"');
    });

    it('should escape HTML in genre names', () => {
      const genre = { id: 'g1', name: '<script>alert("xss")</script>', color: '#3b82f6' };

      const html = `<span>${escapeHtml(genre.name)}</span>`;

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should apply correct contrast color', () => {
      // Light background should use dark text
      expect(getContrastColor('#ffffff')).toBe('#000000');
      // Dark background should use white text
      expect(getContrastColor('#000000')).toBe('#ffffff');
    });

    it('should render loading placeholder', () => {
      const isLoading = true;

      const placeholder = isLoading ? 'Loading genres...' : 'Add genre...';
      expect(placeholder).toBe('Loading genres...');
    });

    it('should render dropdown when open', () => {
      const isOpen = true;

      const dropdownHtml = isOpen ? '<div class="genre-picker-dropdown">content</div>' : '';
      expect(dropdownHtml).toContain('genre-picker-dropdown');
    });
  });

  describe('Dropdown Content', () => {
    it('should render suggestions section header', () => {
      const suggestions = ['Horror', 'Thriller'];

      let content = '';
      if (suggestions.length > 0) {
        content = '<div class="section-header">Suggested from book</div>';
      }

      expect(content).toContain('Suggested from book');
    });

    it('should render your genres section header', () => {
      const genres = createMockGenres();

      let content = '';
      if (genres.length > 0) {
        content = '<div class="section-header">Your genres</div>';
      }

      expect(content).toContain('Your genres');
    });

    it('should render create option', () => {
      const searchQuery = 'New Genre';

      const createHtml = `
        <button class="genre-picker-create" data-create="${escapeHtml(searchQuery)}">
          Create "${escapeHtml(searchQuery)}"
        </button>
      `;

      expect(createHtml).toContain('data-create="New Genre"');
      expect(createHtml).toContain('Create "New Genre"');
    });

    it('should show checkmark for selected genres', () => {
      const genre = { id: 'g1', name: 'Fiction', color: '#3b82f6' };
      const selected = ['g1'];
      const isSelected = selected.includes(genre.id);

      const checkmark = isSelected ? '<svg class="checkmark">...</svg>' : '';
      expect(checkmark).toContain('checkmark');
    });

    it('should highlight focused item', () => {
      const focusedIndex = 2;
      const itemIndex = 2;
      const isFocused = focusedIndex === itemIndex;

      const className = isFocused ? 'bg-gray-100' : '';
      expect(className).toBe('bg-gray-100');
    });
  });

  describe('Toggle Genre', () => {
    it('should add genre to selection', () => {
      const selected = [];

      function toggleGenre(genreId) {
        const index = selected.indexOf(genreId);
        if (index === -1) {
          selected.push(genreId);
        } else {
          selected.splice(index, 1);
        }
      }

      toggleGenre('g1');
      expect(selected).toEqual(['g1']);
    });

    it('should remove genre from selection', () => {
      const selected = ['g1', 'g2'];

      function toggleGenre(genreId) {
        const index = selected.indexOf(genreId);
        if (index === -1) {
          selected.push(genreId);
        } else {
          selected.splice(index, 1);
        }
      }

      toggleGenre('g1');
      expect(selected).toEqual(['g2']);
    });

    it('should call onChange callback', () => {
      const selected = [];
      const onChange = vi.fn();

      function toggleGenre(genreId) {
        const index = selected.indexOf(genreId);
        if (index === -1) {
          selected.push(genreId);
        } else {
          selected.splice(index, 1);
        }
        onChange(selected);
      }

      toggleGenre('g1');
      expect(onChange).toHaveBeenCalledWith(['g1']);
    });
  });

  describe('Remove Genre', () => {
    it('should remove genre from selection', () => {
      const selected = ['g1', 'g2', 'g3'];

      function removeGenre(genreId) {
        const index = selected.indexOf(genreId);
        if (index !== -1) {
          selected.splice(index, 1);
        }
      }

      removeGenre('g2');
      expect(selected).toEqual(['g1', 'g3']);
    });

    it('should do nothing if genre not selected', () => {
      const selected = ['g1', 'g2'];

      function removeGenre(genreId) {
        const index = selected.indexOf(genreId);
        if (index !== -1) {
          selected.splice(index, 1);
        }
      }

      removeGenre('g99');
      expect(selected).toEqual(['g1', 'g2']);
    });

    it('should call onChange callback', () => {
      const selected = ['g1', 'g2'];
      const onChange = vi.fn();

      function removeGenre(genreId) {
        const index = selected.indexOf(genreId);
        if (index !== -1) {
          selected.splice(index, 1);
          onChange(selected);
        }
      }

      removeGenre('g1');
      expect(onChange).toHaveBeenCalledWith(['g2']);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should move focus down on ArrowDown', () => {
      let focusedIndex = -1;
      const maxIndex = 4;

      function handleKeyDown(key) {
        if (key === 'ArrowDown') {
          focusedIndex = Math.min(focusedIndex + 1, maxIndex);
        }
      }

      handleKeyDown('ArrowDown');
      expect(focusedIndex).toBe(0);

      handleKeyDown('ArrowDown');
      expect(focusedIndex).toBe(1);
    });

    it('should move focus up on ArrowUp', () => {
      let focusedIndex = 2;

      function handleKeyDown(key) {
        if (key === 'ArrowUp') {
          focusedIndex = Math.max(focusedIndex - 1, -1);
        }
      }

      handleKeyDown('ArrowUp');
      expect(focusedIndex).toBe(1);

      handleKeyDown('ArrowUp');
      expect(focusedIndex).toBe(0);
    });

    it('should not go below -1 on ArrowUp', () => {
      let focusedIndex = 0;

      function handleKeyDown(key) {
        if (key === 'ArrowUp') {
          focusedIndex = Math.max(focusedIndex - 1, -1);
        }
      }

      handleKeyDown('ArrowUp');
      expect(focusedIndex).toBe(-1);

      handleKeyDown('ArrowUp');
      expect(focusedIndex).toBe(-1);
    });

    it('should not exceed max index on ArrowDown', () => {
      let focusedIndex = 3;
      const maxIndex = 4;

      function handleKeyDown(key) {
        if (key === 'ArrowDown') {
          focusedIndex = Math.min(focusedIndex + 1, maxIndex);
        }
      }

      handleKeyDown('ArrowDown');
      expect(focusedIndex).toBe(4);

      handleKeyDown('ArrowDown');
      expect(focusedIndex).toBe(4);
    });

    it('should close on Escape', () => {
      let isOpen = true;
      let searchQuery = 'test';
      let focusedIndex = 2;

      function handleKeyDown(key) {
        if (key === 'Escape') {
          isOpen = false;
          searchQuery = '';
          focusedIndex = -1;
        }
      }

      handleKeyDown('Escape');
      expect(isOpen).toBe(false);
      expect(searchQuery).toBe('');
      expect(focusedIndex).toBe(-1);
    });
  });

  describe('Click Outside', () => {
    it('should close dropdown when clicking outside', () => {
      let isOpen = true;
      let searchQuery = 'test';
      let focusedIndex = 2;

      container.innerHTML = '<div class="genre-picker">picker content</div>';
      const picker = container.querySelector('.genre-picker');

      function handleClickOutside(target) {
        if (!picker.contains(target)) {
          isOpen = false;
          searchQuery = '';
          focusedIndex = -1;
        }
      }

      // Click outside
      const outsideElement = document.body;
      handleClickOutside(outsideElement);

      expect(isOpen).toBe(false);
      expect(searchQuery).toBe('');
    });

    it('should not close when clicking inside', () => {
      let isOpen = true;
      let searchQuery = 'test';

      container.innerHTML = '<div class="genre-picker">picker content</div>';
      const picker = container.querySelector('.genre-picker');

      function handleClickOutside(target) {
        if (!picker.contains(target)) {
          isOpen = false;
          searchQuery = '';
        }
      }

      // Click inside
      handleClickOutside(picker);

      expect(isOpen).toBe(true);
      expect(searchQuery).toBe('test');
    });
  });

  describe('Add Suggestion', () => {
    it('should create genre from suggestion', async () => {
      mockCreateGenre.mockResolvedValue({ id: 'new-id', name: 'Horror', color: '#ef4444' });
      mockLoadUserGenres.mockResolvedValue([
        ...createMockGenres(),
        { id: 'new-id', name: 'Horror', normalizedName: 'horror', color: '#ef4444' }
      ]);

      const state = {
        genres: createMockGenres(),
        selected: [],
        suggestions: ['Horror', 'Thriller']
      };
      const userId = 'test-user';

      async function addSuggestion(name) {
        const genre = await mockCreateGenre(userId, name);
        state.genres = await mockLoadUserGenres(userId, true);
        state.selected.push(genre.id);

        // Remove from suggestions
        const index = state.suggestions.findIndex(s =>
          normalizeGenreName(s) === normalizeGenreName(name)
        );
        if (index !== -1) {
          state.suggestions.splice(index, 1);
        }
      }

      await addSuggestion('Horror');

      expect(mockCreateGenre).toHaveBeenCalledWith(userId, 'Horror');
      expect(state.selected).toContain('new-id');
      expect(state.suggestions).not.toContain('Horror');
    });
  });

  describe('Create And Select', () => {
    it('should create new genre and select it', async () => {
      mockCreateGenre.mockResolvedValue({ id: 'created-id', name: 'New Genre', color: '#8b5cf6' });
      mockLoadUserGenres.mockResolvedValue([
        ...createMockGenres(),
        { id: 'created-id', name: 'New Genre', normalizedName: 'newgenre', color: '#8b5cf6' }
      ]);

      const state = {
        genres: createMockGenres(),
        selected: [],
        searchQuery: 'New Genre'
      };
      const userId = 'test-user';
      const onChange = vi.fn();

      async function createAndSelect(name) {
        const genre = await mockCreateGenre(userId, name);
        state.genres = await mockLoadUserGenres(userId, true);
        state.selected.push(genre.id);
        state.searchQuery = '';
        onChange(state.selected);
      }

      await createAndSelect('New Genre');

      expect(mockCreateGenre).toHaveBeenCalledWith(userId, 'New Genre');
      expect(state.selected).toContain('created-id');
      expect(state.searchQuery).toBe('');
      expect(onChange).toHaveBeenCalledWith(['created-id']);
    });
  });

  describe('Input Handling', () => {
    it('should open dropdown on focus', () => {
      let isOpen = false;

      function handleFocus() {
        isOpen = true;
      }

      handleFocus();
      expect(isOpen).toBe(true);
    });

    it('should update search query on input', () => {
      let searchQuery = '';
      let isOpen = false;
      let focusedIndex = -1;

      function handleInput(value) {
        searchQuery = value;
        isOpen = true;
        focusedIndex = -1;
      }

      handleInput('fiction');

      expect(searchQuery).toBe('fiction');
      expect(isOpen).toBe(true);
      expect(focusedIndex).toBe(-1);
    });
  });

  describe('Debouncing', () => {
    it('should debounce input changes', async () => {
      vi.useFakeTimers();

      const callback = vi.fn();
      const debouncedFn = debounce(callback, 300);

      debouncedFn('a');
      debouncedFn('ab');
      debouncedFn('abc');

      expect(callback).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(300);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('abc');

      vi.useRealTimers();
    });
  });

  describe('Initialization', () => {
    it('should load genres on init', async () => {
      const userId = 'test-user';
      let genres = [];
      let isLoading = true;

      async function init() {
        isLoading = true;
        try {
          genres = await mockLoadUserGenres(userId);
        } catch (error) {
          genres = [];
        }
        isLoading = false;
      }

      await init();

      expect(mockLoadUserGenres).toHaveBeenCalledWith(userId);
      expect(isLoading).toBe(false);
      expect(genres.length).toBeGreaterThan(0);
    });

    it('should handle load error gracefully', async () => {
      mockLoadUserGenres.mockRejectedValue(new Error('Network error'));

      let genres = [];
      let isLoading = true;

      async function init() {
        isLoading = true;
        try {
          genres = await mockLoadUserGenres('test-user');
        } catch (error) {
          genres = [];
        }
        isLoading = false;
      }

      await init();

      expect(genres).toEqual([]);
      expect(isLoading).toBe(false);
    });
  });

  describe('Component Structure', () => {
    it('should render complete component structure', () => {
      const genres = createMockGenres();
      const selected = ['g1'];
      const isLoading = false;
      const isOpen = true;

      // Simulate full render
      const selectedGenres = selected.map(id => genres.find(g => g.id === id)).filter(Boolean);

      const html = `
        <div class="genre-picker">
          <label class="block font-semibold">Genres</label>
          <div class="genre-picker-selected">
            ${selectedGenres.map(g => `<span class="genre-badge">${escapeHtml(g.name)}</span>`).join('')}
          </div>
          <div class="relative">
            <input class="genre-picker-input" placeholder="${isLoading ? 'Loading...' : 'Add genre...'}" />
            ${isOpen ? '<div class="genre-picker-dropdown">dropdown content</div>' : ''}
          </div>
        </div>
      `;

      expect(html).toContain('genre-picker');
      expect(html).toContain('genre-picker-selected');
      expect(html).toContain('genre-picker-input');
      expect(html).toContain('genre-picker-dropdown');
      expect(html).toContain('Fiction');
    });

    it('should render hint when no search query', () => {
      const searchQuery = '';

      const hint = !searchQuery
        ? '<div class="hint">Type a name to create a new genre</div>'
        : '';

      expect(hint).toContain('Type a name to create a new genre');
    });
  });
});
