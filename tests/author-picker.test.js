/**
 * Unit tests for src/js/components/author-picker.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Firebase before importing AuthorPicker
vi.mock('../src/js/firebase-config.js', () => ({
  db: {}
}));

vi.mock('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { data: () => ({ author: 'Stephen King', deletedAt: null }) },
      { data: () => ({ author: 'Stephen King', deletedAt: null }) },
      { data: () => ({ author: 'J.R.R. Tolkien', deletedAt: null }) },
      { data: () => ({ author: 'Brandon Sanderson', deletedAt: null }) },
      { data: () => ({ author: 'Brandon Sanderson', deletedAt: null }) },
      { data: () => ({ author: 'Brandon Sanderson', deletedAt: null }) }
    ]
  })
}));

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  escapeHtml: (s) => s,
  debounce: (fn) => fn,
  CACHE_KEY: 'test_cache',
  CACHE_TTL: 300000
}));

import { AuthorPicker } from '../src/js/components/author-picker.js';

describe('AuthorPicker', () => {
  let container;
  let mockLocalStorage;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'author-picker';
    document.body.appendChild(container);

    // Mock localStorage
    mockLocalStorage = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => mockLocalStorage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      mockLocalStorage[key] = value;
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should render input field', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      expect(container.querySelector('.author-picker-input')).toBeTruthy();
    });

    it('should show loading state initially', () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      picker.isLoading = true;
      picker.render();

      const input = container.querySelector('.author-picker-input');
      expect(input.placeholder).toBe('Loading...');
      expect(input.disabled).toBe(true);
    });

    it('should load authors from books on init', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      // Should extract unique authors with counts
      expect(picker.authors).toHaveLength(3);
    });

    it('should sort authors by count descending', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      // Brandon Sanderson has 3 books, Stephen King has 2, Tolkien has 1
      expect(picker.authors[0].name).toBe('Brandon Sanderson');
      expect(picker.authors[0].count).toBe(3);
      expect(picker.authors[1].name).toBe('Stephen King');
      expect(picker.authors[1].count).toBe(2);
      expect(picker.authors[2].name).toBe('J.R.R. Tolkien');
      expect(picker.authors[2].count).toBe(1);
    });

    it('should fetch authors from Firestore when no cache', async () => {
      // Clear any cached data
      mockLocalStorage = {};

      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      // Should have loaded authors from the mocked Firestore data
      expect(picker.authors.length).toBeGreaterThan(0);
      expect(picker.authors.some(a => a.name === 'Stephen King')).toBe(true);
    });
  });

  describe('setValue', () => {
    it('should set the author value', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setValue('Test Author');

      expect(picker.getValue()).toBe('Test Author');
    });

    it('should update searchQuery to match value', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setValue('Stephen King');

      expect(picker.searchQuery).toBe('Stephen King');
    });

    it('should update previousValue to prevent false dirty state', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      picker.setValue('Stephen King');

      expect(picker.previousValue).toBe('Stephen King');
    });

    it('should not trigger onChange when setValue is called', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.setValue('Stephen King');

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('getValue', () => {
    it('should return empty string initially', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      expect(picker.getValue()).toBe('');
    });

    it('should return set value', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.setValue('Test Author');

      expect(picker.getValue()).toBe('Test Author');
    });
  });

  describe('clear', () => {
    it('should clear the value', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.setValue('Stephen King');

      picker.clear();

      expect(picker.getValue()).toBe('');
    });

    it('should trigger onChange when clearing a value', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.setValue('Stephen King');

      picker.clear();

      expect(onChange).toHaveBeenCalledWith('');
    });

    it('should not trigger onChange when already empty', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();

      picker.clear();

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('dropdown behavior', () => {
    it('should open dropdown on input focus', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new FocusEvent('focus'));

      expect(container.querySelector('.author-picker-dropdown')).toBeTruthy();
    });

    it('should show close button in dropdown', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      expect(container.querySelector('.author-picker-close')).toBeTruthy();
    });

    it('should close dropdown on close button click', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      const closeBtn = container.querySelector('.author-picker-close');
      closeBtn.click();

      expect(picker.isOpen).toBe(false);
    });

    it('should show author suggestions when dropdown is open', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('Brandon Sanderson');
      expect(container.textContent).toContain('Stephen King');
      expect(container.textContent).toContain('J.R.R. Tolkien');
    });

    it('should show book counts for authors', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      expect(container.textContent).toContain('3 books');
      expect(container.textContent).toContain('2 books');
      expect(container.textContent).toContain('1 book');
    });
  });

  describe('filtering', () => {
    it('should filter authors based on search query', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.searchQuery = 'stephen';
      picker.render();

      const dropdown = container.querySelector('.author-picker-dropdown');
      expect(dropdown.textContent).toContain('Stephen King');
      expect(dropdown.textContent).not.toContain('Brandon Sanderson');
    });

    it('should show "Use typed value" option for new authors', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.searchQuery = 'New Author';
      picker.render();

      expect(container.textContent).toContain('Use "New Author"');
    });

    it('should not show "Use typed value" for exact matches', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.searchQuery = 'Stephen King';
      picker.render();

      expect(container.textContent).not.toContain('Use "Stephen King"');
    });
  });

  describe('author selection', () => {
    it('should select author on click', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      const authorBtn = container.querySelector('[data-author="Stephen King"]');
      authorBtn.click();

      expect(picker.getValue()).toBe('Stephen King');
      expect(onChange).toHaveBeenCalledWith('Stephen King');
    });

    it('should close dropdown after selection', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      const authorBtn = container.querySelector('[data-author="Stephen King"]');
      authorBtn.click();

      expect(picker.isOpen).toBe(false);
    });

    it('should use typed value on "Use" button click', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.isOpen = true;
      picker.searchQuery = 'New Author';
      picker.render();

      const useTypedBtn = container.querySelector('[data-use-typed]');
      useTypedBtn.click();

      expect(picker.getValue()).toBe('New Author');
      expect(onChange).toHaveBeenCalledWith('New Author');
    });
  });

  describe('keyboard navigation', () => {
    it('should move focus down with ArrowDown', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));

      expect(picker.focusedIndex).toBe(0);
    });

    it('should move focus up with ArrowUp', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.focusedIndex = 1;
      picker.render();

      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));

      expect(picker.focusedIndex).toBe(0);
    });

    it('should close dropdown on Escape', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(picker.isOpen).toBe(false);
    });

    it('should select on Enter when item is focused', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.isOpen = true;
      picker.focusedIndex = 0;
      picker.render();

      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(onChange).toHaveBeenCalled();
    });

    it('should use typed value on Enter when no item focused', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.isOpen = true;
      picker.searchQuery = 'New Author';
      picker.focusedIndex = -1;
      picker.render();

      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      expect(picker.getValue()).toBe('New Author');
    });
  });

  describe('change tracking', () => {
    it('should not trigger onChange when value unchanged on blur', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.setValue('Stephen King');

      // Simulate blur without changing value
      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new FocusEvent('blur'));

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should trigger onChange when value changes on blur', async () => {
      const onChange = vi.fn();
      const picker = new AuthorPicker({ container, userId: 'user123', onChange });
      await picker.init();
      picker.previousValue = 'Old Author';
      picker.value = 'New Author';
      picker.searchQuery = 'New Author';
      picker.render();

      const input = container.querySelector('.author-picker-input');
      input.dispatchEvent(new FocusEvent('blur'));

      expect(onChange).toHaveBeenCalledWith('New Author');
    });
  });

  describe('normalization', () => {
    it('should normalize author names for comparison', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      // J.R.R. Tolkien should match "jrr tolkien" search
      picker.searchQuery = 'jrr tolkien';
      const filtered = picker._getFilteredAuthors();

      expect(filtered.some(a => a.name === 'J.R.R. Tolkien')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on destroy', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      picker.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalled();
    });
  });

  describe('picker coordination', () => {
    it('should close when another picker opens', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      // Simulate another picker opening
      const event = new CustomEvent('picker-opened', { detail: { picker: {} } });
      document.dispatchEvent(event);

      expect(picker.isOpen).toBe(false);
    });

    it('should not close when self dispatches picker-opened', async () => {
      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();
      picker.isOpen = true;
      picker.render();

      // Simulate self opening (should not close)
      const event = new CustomEvent('picker-opened', { detail: { picker: picker } });
      document.dispatchEvent(event);

      expect(picker.isOpen).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle author load error gracefully', async () => {
      const { getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      getDocs.mockRejectedValueOnce(new Error('Network error'));

      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      expect(picker.authors).toEqual([]);
      expect(container.querySelector('.author-picker-input')).toBeTruthy();
    });
  });

  describe('deleted books exclusion', () => {
    it('should exclude deleted books from author counts', async () => {
      const { getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      getDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ author: 'Active Author', deletedAt: null }) },
          { data: () => ({ author: 'Deleted Author', deletedAt: new Date() }) }
        ]
      });

      const picker = new AuthorPicker({ container, userId: 'user123' });
      await picker.init();

      expect(picker.authors).toHaveLength(1);
      expect(picker.authors[0].name).toBe('Active Author');
    });
  });
});
