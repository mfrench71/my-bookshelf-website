// Genre Picker Component
// A reusable multi-select component for picking genres

import { loadUserGenres, createGenre, GENRE_COLORS } from '../genres.js';
import { getContrastColor, normalizeGenreName, escapeHtml, debounce, showToast } from '../utils.js';

/**
 * GenrePicker - Multi-select genre picker with typeahead and create option
 */
export class GenrePicker {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element to render into
   * @param {string} options.userId - Current user's ID
   * @param {Function} options.onChange - Callback when selection changes
   */
  constructor({ container, userId, onChange = () => {} }) {
    this.container = container;
    this.userId = userId;
    this.onChange = onChange;

    // State
    this.genres = [];           // All available genres
    this.selected = [];         // Selected genre IDs
    this.suggestions = [];      // API-suggested genre names
    this.searchQuery = '';
    this.isOpen = false;
    this.isLoading = false;
    this.focusedIndex = -1;
    this._restoringFocus = false;

    // Bind methods
    this.handleInputChange = debounce(this._handleInputChange.bind(this), 300);
    this.handleKeyDown = this._handleKeyDown.bind(this);
    this.handleClickOutside = this._handleClickOutside.bind(this);
  }

  /**
   * Initialize the picker
   */
  async init() {
    this.isLoading = true;
    this.render();

    try {
      this.genres = await loadUserGenres(this.userId);
    } catch (error) {
      console.error('Error loading genres:', error);
      this.genres = [];
    }

    this.isLoading = false;
    this.render();

    // Add event listeners
    document.addEventListener('click', this.handleClickOutside);
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    document.removeEventListener('click', this.handleClickOutside);
  }

  /**
   * Set the selected genre IDs
   * @param {Array<string>} genreIds - Array of genre IDs
   */
  setSelected(genreIds) {
    this.selected = genreIds || [];
    this.render();
  }

  /**
   * Get the selected genre IDs
   * @returns {Array<string>}
   */
  getSelected() {
    return [...this.selected];
  }

  /**
   * Set API suggestions (genre names, not IDs)
   * @param {Array<string>} names - Genre names from API
   */
  setSuggestions(names) {
    this.suggestions = names || [];
    this.render();
  }

  /**
   * Render the component
   */
  render() {
    // Save cursor position before re-render
    const activeInput = this.container.querySelector('.genre-picker-input');
    const hadFocus = activeInput && document.activeElement === activeInput;
    const cursorPos = hadFocus ? activeInput.selectionStart : 0;

    const selectedGenres = this.selected
      .map(id => this.genres.find(g => g.id === id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    const filteredGenres = this._getFilteredGenres();
    const filteredSuggestions = this._getFilteredSuggestions();
    const showCreateOption = this._shouldShowCreateOption();

    this.container.innerHTML = `
      <div class="genre-picker">
        <label id="genre-picker-label" class="block font-semibold text-gray-700 mb-1">Genres</label>

        <!-- Selected genres -->
        <div class="genre-picker-selected flex flex-wrap gap-1.5 mb-2">
          ${selectedGenres.map(genre => `
            <span class="genre-badge" style="background-color: ${genre.color}; color: ${getContrastColor(genre.color)}">
              ${escapeHtml(genre.name)}
              <button type="button" class="ml-1 p-1 -mr-1 hover:opacity-75" data-remove-genre="${genre.id}" aria-label="Remove ${escapeHtml(genre.name)}">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          `).join('')}
        </div>

        <!-- Input -->
        <div class="relative">
          <input
            type="text"
            class="genre-picker-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="${this.isLoading ? 'Loading genres...' : 'Add genre...'}"
            value="${escapeHtml(this.searchQuery)}"
            ${this.isLoading ? 'disabled' : ''}
            aria-expanded="${this.isOpen}"
            aria-haspopup="listbox"
            aria-labelledby="genre-picker-label"
          >

          <!-- Dropdown -->
          ${this.isOpen ? `
            <div class="genre-picker-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto" role="listbox" aria-label="Genre options">
              <div class="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
                <span class="text-xs text-gray-500">Select genres</span>
                <button type="button" class="genre-picker-close p-2 hover:bg-gray-200 rounded min-w-[44px] min-h-[44px] flex items-center justify-center -m-1" aria-label="Close dropdown">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              ${this._renderDropdownContent(filteredGenres, filteredSuggestions, showCreateOption)}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    this._attachEventListeners();

    // Restore focus and cursor position
    if (hadFocus) {
      const newInput = this.container.querySelector('.genre-picker-input');
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
   */
  _renderDropdownContent(filteredGenres, filteredSuggestions, showCreateOption) {
    const items = [];
    let index = 0;

    // API Suggestions section
    if (filteredSuggestions.length > 0) {
      items.push(`<div class="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">Suggested from book</div>`);
      filteredSuggestions.forEach(name => {
        const isFocused = this.focusedIndex === index;
        items.push(`
          <button type="button" role="option" aria-selected="false" class="genre-picker-item w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${isFocused ? 'bg-gray-100' : ''}" data-suggestion="${escapeHtml(name)}" data-index="${index}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>${escapeHtml(name)}</span>
          </button>
        `);
        index++;
      });
    }

    // Your genres section
    if (filteredGenres.length > 0) {
      if (filteredSuggestions.length > 0) {
        items.push(`<div class="border-t border-gray-100"></div>`);
      }
      items.push(`<div class="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">Your genres</div>`);
      filteredGenres.forEach(genre => {
        const isSelected = this.selected.includes(genre.id);
        const isFocused = this.focusedIndex === index;
        const safeColor = /^#[0-9A-Fa-f]{6}$/.test(genre.color) ? genre.color : '#6b7280';
        items.push(`
          <button type="button" role="option" aria-selected="${isSelected}" class="genre-picker-item w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${isFocused ? 'bg-gray-100' : ''}" data-genre-id="${genre.id}" data-index="${index}">
            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${safeColor}"></span>
            <span class="flex-1">${escapeHtml(genre.name)}</span>
            ${isSelected ? `
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ` : ''}
          </button>
        `);
        index++;
      });
    }

    // Create new option
    if (showCreateOption) {
      if (items.length > 0) {
        items.push(`<div class="border-t border-gray-100"></div>`);
      }
      const isFocused = this.focusedIndex === index;
      items.push(`
        <button type="button" class="genre-picker-item genre-picker-create w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-primary ${isFocused ? 'bg-gray-100' : ''}" data-create="${escapeHtml(this.searchQuery)}" data-index="${index}">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create "${escapeHtml(this.searchQuery)}"</span>
        </button>
      `);
    }

    // Always show hint to create at the bottom if no search query
    if (!this.searchQuery) {
      items.push(`<div class="px-3 py-2 text-xs text-gray-400 border-t border-gray-100">Type a name to create a new genre</div>`);
    }

    if (items.length === 0 && !showCreateOption) {
      items.push(`<div class="px-3 py-4 text-center text-gray-500">Type to search or create a genre</div>`);
    }

    return items.join('');
  }

  /**
   * Get filtered genres based on search query
   */
  _getFilteredGenres() {
    if (!this.searchQuery) return this.genres;

    const query = normalizeGenreName(this.searchQuery);
    return this.genres.filter(g =>
      g.normalizedName.includes(query)
    );
  }

  /**
   * Get filtered suggestions (exclude already selected or existing genres)
   */
  _getFilteredSuggestions() {
    const selectedGenreNames = new Set(
      this.selected
        .map(id => this.genres.find(g => g.id === id))
        .filter(Boolean)
        .map(g => g.normalizedName)
    );

    const existingGenreNames = new Set(this.genres.map(g => g.normalizedName));

    return this.suggestions.filter(name => {
      const normalized = normalizeGenreName(name);
      // Exclude if already selected or already exists as a genre
      if (selectedGenreNames.has(normalized)) return false;
      if (existingGenreNames.has(normalized)) return false;

      // Match search query if present
      if (this.searchQuery) {
        const query = normalizeGenreName(this.searchQuery);
        return normalized.includes(query);
      }
      return true;
    });
  }

  /**
   * Check if we should show create option
   */
  _shouldShowCreateOption() {
    if (!this.searchQuery || this.searchQuery.trim().length < 1) return false;

    const query = normalizeGenreName(this.searchQuery);

    // Check if exact match exists
    const exists = this.genres.some(g => g.normalizedName === query);
    if (exists) return false;

    // Check if it's in suggestions
    const inSuggestions = this.suggestions.some(s => normalizeGenreName(s) === query);
    if (inSuggestions) return false;

    return true;
  }

  /**
   * Attach event listeners to rendered elements
   */
  _attachEventListeners() {
    const input = this.container.querySelector('.genre-picker-input');
    if (input) {
      input.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.isOpen = true;
        this.focusedIndex = -1;
        this.handleInputChange();
      });
      input.addEventListener('focus', () => {
        if (this._restoringFocus) return;
        this.isOpen = true;
        this.render();
      });
      input.addEventListener('keydown', this.handleKeyDown);
    }

    // Remove genre buttons
    this.container.querySelectorAll('[data-remove-genre]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const genreId = btn.dataset.removeGenre;
        this._removeGenre(genreId);
      });
    });

    // Genre selection
    this.container.querySelectorAll('[data-genre-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const genreId = btn.dataset.genreId;
        this._toggleGenre(genreId);
      });
    });

    // Suggestion selection
    this.container.querySelectorAll('[data-suggestion]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = btn.dataset.suggestion;
        await this._addSuggestion(name);
      });
    });

    // Create new genre
    this.container.querySelectorAll('[data-create]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const name = btn.dataset.create;
        await this._createAndSelect(name);
      });
    });

    // Close button
    const closeBtn = this.container.querySelector('.genre-picker-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.isOpen = false;
        this.searchQuery = '';
        this.focusedIndex = -1;
        this.render();
      });
    }
  }

  /**
   * Handle input changes (debounced)
   */
  _handleInputChange() {
    this.render();
  }

  /**
   * Handle keyboard navigation
   */
  _handleKeyDown(e) {
    const items = this.container.querySelectorAll('.genre-picker-item');
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
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.isOpen = false;
        this.searchQuery = '';
        this.focusedIndex = -1;
        this.render();
        break;
    }
  }

  /**
   * Handle clicks outside the picker
   */
  _handleClickOutside(e) {
    if (!this.container.contains(e.target)) {
      this.isOpen = false;
      this.searchQuery = '';
      this.focusedIndex = -1;
      this.render();
    }
  }

  /**
   * Toggle genre selection
   */
  _toggleGenre(genreId) {
    const index = this.selected.indexOf(genreId);
    const isAdding = index === -1;

    if (isAdding) {
      this.selected.push(genreId);
    } else {
      this.selected.splice(index, 1);
    }

    // Update UI incrementally to avoid flash
    this._updateSelectionUI(genreId, isAdding);

    this.searchQuery = '';
    this.focusedIndex = -1;
    this.onChange(this.selected);

    // Refocus input
    setTimeout(() => {
      const input = this.container.querySelector('.genre-picker-input');
      if (input) input.focus();
    }, 0);
  }

  /**
   * Update UI incrementally when toggling a genre (avoids full re-render flash)
   */
  _updateSelectionUI(genreId, isAdding) {
    // Update checkmark in dropdown
    const btn = this.container.querySelector(`[data-genre-id="${genreId}"]`);
    if (btn) {
      const existingCheck = btn.querySelector('svg.text-primary');
      if (isAdding && !existingCheck) {
        const checkmark = document.createElement('span');
        checkmark.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
        btn.appendChild(checkmark.firstChild);
      } else if (!isAdding && existingCheck) {
        existingCheck.remove();
      }
    }

    // Update selected badges
    const badgesContainer = this.container.querySelector('.genre-picker-selected');
    if (badgesContainer) {
      const genre = this.genres.find(g => g.id === genreId);
      if (genre) {
        if (isAdding) {
          // Add badge
          const badge = document.createElement('span');
          badge.className = 'genre-badge';
          badge.style.backgroundColor = genre.color;
          badge.style.color = getContrastColor(genre.color);
          badge.innerHTML = `
            ${escapeHtml(genre.name)}
            <button type="button" class="ml-1 hover:opacity-75" data-remove-genre="${genre.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          `;
          badge.querySelector('[data-remove-genre]').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._removeGenre(genreId);
          });
          badgesContainer.appendChild(badge);
          // Re-sort badges alphabetically
          this._sortBadges(badgesContainer);
        } else {
          // Remove badge
          const badge = badgesContainer.querySelector(`[data-remove-genre="${genreId}"]`)?.closest('.genre-badge');
          if (badge) badge.remove();
        }
      }
    }
  }

  /**
   * Sort badge elements alphabetically
   */
  _sortBadges(container) {
    const badges = Array.from(container.querySelectorAll('.genre-badge'));
    badges.sort((a, b) => a.textContent.trim().localeCompare(b.textContent.trim()));
    badges.forEach(badge => container.appendChild(badge));
  }

  /**
   * Remove genre from selection
   */
  _removeGenre(genreId) {
    const index = this.selected.indexOf(genreId);
    if (index !== -1) {
      this.selected.splice(index, 1);
      this.render();
      this.onChange(this.selected);
    }
  }

  /**
   * Add a suggestion (create genre if needed, then select)
   */
  async _addSuggestion(name) {
    try {
      const genre = await createGenre(this.userId, name);
      this.genres = await loadUserGenres(this.userId, true);
      this.selected.push(genre.id);

      // Remove from suggestions
      const index = this.suggestions.findIndex(s =>
        normalizeGenreName(s) === normalizeGenreName(name)
      );
      if (index !== -1) {
        this.suggestions.splice(index, 1);
      }

      this.searchQuery = '';
      this.focusedIndex = -1;
      this.render();
      this.onChange(this.selected);
    } catch (error) {
      console.error('Error adding suggestion:', error);
      showToast('Failed to add genre. Please try again.', { type: 'error' });
    }
  }

  /**
   * Create a new genre and select it
   */
  async _createAndSelect(name) {
    try {
      const genre = await createGenre(this.userId, name);
      this.genres = await loadUserGenres(this.userId, true);
      this.selected.push(genre.id);
      this.searchQuery = '';
      this.focusedIndex = -1;
      this.render();
      this.onChange(this.selected);
    } catch (error) {
      console.error('Error creating genre:', error);
      showToast('Failed to create genre. Please try again.', { type: 'error' });
    }
  }
}
