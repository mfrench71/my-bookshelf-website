// Author Picker Component
// A reusable single-select component for picking an author with library suggestions

import { db } from '/js/firebase-config.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { escapeHtml, debounce, CACHE_KEY, CACHE_TTL } from '../utils.js';

/**
 * AuthorPicker - Single-select author picker with typeahead and library suggestions
 */
export class AuthorPicker {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element to render into
   * @param {string} options.userId - Current user's ID
   * @param {Function} options.onChange - Callback when value changes (author string)
   */
  constructor({ container, userId, onChange = () => {} }) {
    this.container = container;
    this.userId = userId;
    this.onChange = onChange;

    // State
    this.authors = []; // { name, normalizedName, count }[]
    this.value = ''; // Current author value
    this.previousValue = ''; // Track previous value for change detection
    this.searchQuery = '';
    this.isOpen = false;
    this.isLoading = false;
    this.focusedIndex = -1;
    this._restoringFocus = false;

    // Bind methods
    this.handleInputChange = debounce(this._handleInputChange.bind(this), 150);
    this.handleKeyDown = this._handleKeyDown.bind(this);
    this.handleClickOutside = this._handleClickOutside.bind(this);
    this.handlePickerOpened = this._handlePickerOpened.bind(this);
  }

  /**
   * Initialize the picker
   */
  async init() {
    this.isLoading = true;
    this.render();

    try {
      this.authors = await this._getAuthorsFromBooks();
    } catch (error) {
      console.error('Error loading authors:', error);
      this.authors = [];
    }

    this.isLoading = false;
    this.render();

    // Add event listeners
    document.addEventListener('click', this.handleClickOutside);
    document.addEventListener('picker-opened', this.handlePickerOpened);
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener('picker-opened', this.handlePickerOpened);
  }

  /**
   * Get the current author value
   * @returns {string}
   */
  getValue() {
    return this.value;
  }

  /**
   * Set the author value (e.g., from API lookup)
   * @param {string} author
   */
  setValue(author) {
    this.value = author || '';
    this.previousValue = author || ''; // Don't trigger dirty state for initial set
    this.searchQuery = author || '';
    this.render();
  }

  /**
   * Clear the value
   */
  clear() {
    const changed = this.value !== '';
    this.value = '';
    this.previousValue = '';
    this.searchQuery = '';
    this.isOpen = false;
    this.focusedIndex = -1;
    this.render();
    if (changed) {
      this.onChange(this.value);
    }
  }

  /**
   * Extract unique authors with counts from user's books
   * @returns {Promise<Array<{name: string, normalizedName: string, count: number}>>}
   */
  async _getAuthorsFromBooks() {
    // Try cache first
    const cached = localStorage.getItem(CACHE_KEY);
    let books = [];

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const cachedBooks = parsed.books || parsed || [];
        const age = Date.now() - (parsed.timestamp || 0);

        if (cachedBooks.length > 0 && age < CACHE_TTL) {
          books = cachedBooks;
        }
      } catch (_e) {
        // Ignore parse errors
      }
    }

    // Fetch from Firestore if no valid cache
    if (books.length === 0) {
      const booksRef = collection(db, 'users', this.userId, 'books');
      const snapshot = await getDocs(booksRef);
      books = snapshot.docs.map(doc => doc.data());
    }

    // Extract unique authors with counts (exclude deleted books)
    const authorCounts = {};
    books.forEach(book => {
      if (book.author && !book.deletedAt) {
        const normalized = this._normalizeAuthor(book.author);
        if (!authorCounts[normalized]) {
          authorCounts[normalized] = { name: book.author, normalizedName: normalized, count: 0 };
        }
        authorCounts[normalized].count++;
      }
    });

    // Sort by count descending, then alphabetically
    return Object.values(authorCounts).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Normalize author name for comparison
   * @param {string} name
   * @returns {string}
   */
  _normalizeAuthor(name) {
    return name
      .toLowerCase()
      .replace(/[.,\-']/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Render the component
   */
  render() {
    // Save cursor position before re-render
    const activeInput = this.container.querySelector('.author-picker-input');
    const hadFocus = activeInput && document.activeElement === activeInput;
    const cursorPos = hadFocus ? activeInput.selectionStart : 0;

    const filteredAuthors = this._getFilteredAuthors();
    const showUseTyped = this._shouldShowUseTyped(filteredAuthors);

    this.container.innerHTML = `
      <div class="author-picker">
        <label id="author-picker-label" class="block font-semibold text-gray-700 mb-1">Author <span class="text-red-500">*</span></label>
        <div class="relative">
          <input
            type="text"
            class="author-picker-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none"
            placeholder="${this.isLoading ? 'Loading...' : 'Search or enter author...'}"
            value="${escapeHtml(this.searchQuery)}"
            ${this.isLoading ? 'disabled' : ''}
            aria-labelledby="author-picker-label"
            aria-expanded="${this.isOpen}"
            aria-haspopup="listbox"
          >

          ${
            this.isOpen
              ? `
            <div class="author-picker-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              <div class="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                <span class="text-xs text-gray-500">Select author</span>
                <button type="button" class="author-picker-close p-2 hover:bg-gray-200 rounded min-w-[44px] min-h-[44px] flex items-center justify-center -m-1" aria-label="Close dropdown">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              ${this._renderDropdownContent(filteredAuthors, showUseTyped)}
            </div>
          `
              : ''
          }
        </div>
      </div>
    `;

    this._attachEventListeners();

    // Restore focus and cursor position
    if (hadFocus) {
      const newInput = this.container.querySelector('.author-picker-input');
      if (newInput) {
        this._restoringFocus = true;
        newInput.focus();
        newInput.setSelectionRange(cursorPos, cursorPos);
        this._restoringFocus = false;
      }
    }
  }

  /**
   * Render dropdown content
   * @param {Array} filteredAuthors
   * @param {boolean} showUseTyped
   * @returns {string}
   */
  _renderDropdownContent(filteredAuthors, showUseTyped) {
    const items = [];
    let index = 0;

    // "Use typed value" option
    if (showUseTyped) {
      const isFocused = this.focusedIndex === index;
      items.push(`
        <button type="button" class="author-picker-item w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${isFocused ? 'bg-gray-100' : ''}" data-use-typed data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span>Use "${escapeHtml(this.searchQuery)}"</span>
        </button>
      `);
      index++;
    }

    // Your authors section
    if (filteredAuthors.length > 0) {
      if (items.length > 0) {
        items.push(`<div class="border-t border-gray-100"></div>`);
      }
      items.push(`<div class="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">Your authors</div>`);

      filteredAuthors.forEach(author => {
        const isFocused = this.focusedIndex === index;
        items.push(`
          <button type="button" class="author-picker-item w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${isFocused ? 'bg-gray-100' : ''}" data-author="${escapeHtml(author.name)}" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span class="flex-1">${escapeHtml(author.name)}</span>
            <span class="text-xs text-gray-400">${author.count} ${author.count === 1 ? 'book' : 'books'}</span>
          </button>
        `);
        index++;
      });
    }

    // Empty state
    if (items.length === 0) {
      if (this.authors.length === 0) {
        items.push(`<div class="px-3 py-4 text-center text-gray-500">No authors in your library yet</div>`);
      } else {
        items.push(`<div class="px-3 py-4 text-center text-gray-500">No matches found</div>`);
      }
    }

    return items.join('');
  }

  /**
   * Get filtered authors based on search query
   * @returns {Array}
   */
  _getFilteredAuthors() {
    if (!this.searchQuery) return this.authors.slice(0, 20); // Show top 20 when empty

    const query = this._normalizeAuthor(this.searchQuery);
    return this.authors.filter(a => a.normalizedName.includes(query)).slice(0, 20);
  }

  /**
   * Check if we should show "Use typed value" option
   * @param {Array} filteredAuthors
   * @returns {boolean}
   */
  _shouldShowUseTyped(_filteredAuthors) {
    if (!this.searchQuery || this.searchQuery.trim().length < 1) return false;

    // Check if exact match exists
    const query = this._normalizeAuthor(this.searchQuery);
    const exactMatch = this.authors.some(a => a.normalizedName === query);
    return !exactMatch;
  }

  /**
   * Attach event listeners
   */
  _attachEventListeners() {
    const input = this.container.querySelector('.author-picker-input');
    if (input) {
      input.addEventListener('input', e => {
        this.searchQuery = e.target.value;
        this.value = e.target.value;
        this.isOpen = true;
        this.focusedIndex = -1;
        this.handleInputChange();
      });
      input.addEventListener('mousedown', () => {
        // Notify other pickers to close before this one opens
        document.dispatchEvent(new CustomEvent('picker-opened', { detail: { picker: this } }));
      });
      input.addEventListener('focus', () => {
        if (this._restoringFocus) return;
        this.isOpen = true;
        this.render();
      });
      input.addEventListener('keydown', this.handleKeyDown);
      input.addEventListener('blur', () => {
        // Commit value on blur, only trigger onChange if changed
        this.value = this.searchQuery;
        if (this.value !== this.previousValue) {
          this.previousValue = this.value;
          this.onChange(this.value);
        }
      });
    }

    // Close button
    const closeBtn = this.container.querySelector('.author-picker-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        this.isOpen = false;
        this.focusedIndex = -1;
        this.render();
      });
    }

    // Author selection
    this.container.querySelectorAll('[data-author]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const author = btn.dataset.author;
        this._selectAuthor(author);
      });
    });

    // Use typed value
    const useTypedBtn = this.container.querySelector('[data-use-typed]');
    if (useTypedBtn) {
      useTypedBtn.addEventListener('click', e => {
        e.preventDefault();
        this._selectAuthor(this.searchQuery);
      });
    }
  }

  /**
   * Handle input changes (debounced)
   */
  _handleInputChange() {
    // Only trigger onChange if value changed
    if (this.value !== this.previousValue) {
      this.previousValue = this.value;
      this.onChange(this.value);
    }
    this.render();
  }

  /**
   * Handle keyboard navigation
   * @param {KeyboardEvent} e
   */
  _handleKeyDown(e) {
    const items = this.container.querySelectorAll('.author-picker-item');
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusedIndex = Math.min(this.focusedIndex + 1, maxIndex);
        this.render();
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.focusedIndex = Math.max(this.focusedIndex - 1, -1);
        this.render();
        break;

      case 'Enter':
        e.preventDefault();
        if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
          items[this.focusedIndex].click();
        } else if (this.searchQuery) {
          // Use typed value on Enter
          this._selectAuthor(this.searchQuery);
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.isOpen = false;
        this.focusedIndex = -1;
        this.render();
        break;

      case 'Tab':
        // Commit value and close on Tab
        this.value = this.searchQuery;
        this.isOpen = false;
        if (this.value !== this.previousValue) {
          this.previousValue = this.value;
          this.onChange(this.value);
        }
        break;
    }
  }

  /**
   * Handle clicks outside the picker
   * @param {MouseEvent} e
   */
  _handleClickOutside(e) {
    if (!this.container.contains(e.target)) {
      this.isOpen = false;
      this.focusedIndex = -1;
      this.render();
    }
  }

  /**
   * Handle another picker opening (close this one)
   * @param {CustomEvent} e
   */
  _handlePickerOpened(e) {
    if (e.detail.picker !== this && this.isOpen) {
      this.isOpen = false;
      this.focusedIndex = -1;
      this.render();
    }
  }

  /**
   * Select an author
   * @param {string} author
   */
  _selectAuthor(author) {
    const changed = author !== this.previousValue;
    this.value = author;
    this.previousValue = author;
    this.searchQuery = author;
    this.isOpen = false;
    this.focusedIndex = -1;
    this.render();
    if (changed) {
      this.onChange(this.value);
    }
  }
}
