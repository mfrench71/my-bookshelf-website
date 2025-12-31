// Series Picker Component
// A reusable single-select component for picking a series with position

import { db } from '/js/firebase-config.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { loadUserSeries, createSeries, clearSeriesCache } from '../series.js';
import { normalizeSeriesName } from '../utils/series-parser.js';
import { escapeHtml, debounce, showToast, initIcons } from '../utils.js';
import { eventBus, Events } from '../utils/event-bus.js';
import { getSyncSettings } from '../utils/sync-settings.js';
import type { Series } from '../types/index.d.ts';

/** Options for SeriesPicker constructor */
export interface SeriesPickerOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Current user's ID */
  userId: string;
  /** Current book ID (for edit mode, to exclude from conflict check) */
  currentBookId?: string | null;
  /** Callback when selection changes */
  onChange?: (selected: SeriesSelection) => void;
}

/** Selected series data */
export interface SeriesSelection {
  seriesId: string | null;
  seriesName: string;
  position: number | null;
}

/** Custom event for picker coordination */
interface PickerOpenedEvent extends CustomEvent {
  detail: { picker: SeriesPicker };
}

/**
 * SeriesPicker - Single-select series picker with typeahead, position input, and create option
 */
export class SeriesPicker {
  private container: HTMLElement;
  private userId: string;
  private currentBookId: string | null;
  private onChange: (selected: SeriesSelection) => void;

  // State
  private series: Series[];
  private selectedId: string | null;
  private selectedName: string;
  private position: number | null;
  private suggestedName: string;
  private suggestedPosition: number | null;
  private searchQuery: string;
  private isOpen: boolean;
  private isLoading: boolean;
  private focusedIndex: number;
  private _restoringFocus: boolean;
  private positionConflict: string | null;

  // Bound methods
  private handleInputChange: () => void;
  private handleKeyDown: (e: KeyboardEvent) => void;
  private handleClickOutside: (e: MouseEvent) => void;
  private handlePickerOpened: (e: Event) => void;
  private _checkPositionConflictDebounced: () => void;

  constructor(options: SeriesPickerOptions) {
    this.container = options.container;
    this.userId = options.userId;
    this.currentBookId = options.currentBookId ?? null;
    this.onChange = options.onChange ?? (() => {});

    // State
    this.series = [];
    this.selectedId = null;
    this.selectedName = '';
    this.position = null;
    this.suggestedName = '';
    this.suggestedPosition = null;
    this.searchQuery = '';
    this.isOpen = false;
    this.isLoading = false;
    this.focusedIndex = -1;
    this._restoringFocus = false;
    this.positionConflict = null;

    // Bind methods
    this.handleInputChange = debounce(this._handleInputChange.bind(this), 300);
    this.handleKeyDown = this._handleKeyDown.bind(this);
    this.handleClickOutside = this._handleClickOutside.bind(this);
    this.handlePickerOpened = this._handlePickerOpened.bind(this);
    this._checkPositionConflictDebounced = debounce(this._checkPositionConflict.bind(this), 150);
  }

  /**
   * Initialize the picker
   */
  async init(): Promise<void> {
    this.isLoading = true;
    this.render();

    try {
      this.series = await loadUserSeries(this.userId);
    } catch (error) {
      console.error('Error loading series:', error);
      this.series = [];
    }

    this.isLoading = false;
    this.render();

    // Add event listeners
    document.addEventListener('click', this.handleClickOutside as EventListener);
    document.addEventListener('picker-opened', this.handlePickerOpened);
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    document.removeEventListener('click', this.handleClickOutside as EventListener);
    document.removeEventListener('picker-opened', this.handlePickerOpened);
  }

  /**
   * Set the selected series
   * @param seriesId - Series ID
   * @param position - Position in series
   */
  setSelected(seriesId: string | null, position: number | null = null): void {
    this.selectedId = seriesId || null;
    this.position = position;

    if (seriesId) {
      const s = this.series.find(x => x.id === seriesId);
      this.selectedName = s ? s.name : '';
    } else {
      this.selectedName = '';
    }

    this.render();
  }

  /**
   * Get the selected series
   * @returns Selected series data
   */
  getSelected(): SeriesSelection {
    return {
      seriesId: this.selectedId,
      seriesName: this.selectedName,
      position: this.position,
    };
  }

  /**
   * Notify listeners of selection change (callback + event bus)
   */
  private _notifyChange(): void {
    const selected = this.getSelected();
    this.onChange(selected);
    eventBus.emit(Events.SERIES_SELECTION_CHANGED, { selected, picker: this });
  }

  /**
   * Set API suggestion (series name and position from book lookup)
   * @param name - Series name from API
   * @param position - Position from API
   */
  setSuggestion(name: string | null, position: number | null = null): void {
    this.suggestedName = name || '';
    this.suggestedPosition = position;

    // If no selection yet, auto-match to existing series
    if (!this.selectedId && this.suggestedName) {
      const normalized = normalizeSeriesName(this.suggestedName);
      const match = this.series.find((s: Series) => s.normalizedName === normalized);
      if (match) {
        this.selectedId = match.id;
        this.selectedName = match.name;
        this.position = this.suggestedPosition;
        this._notifyChange();
      }
    }

    this.render();
  }

  /**
   * Clear the selection
   */
  clear(): void {
    this.selectedId = null;
    this.selectedName = '';
    this.position = null;
    this.suggestedName = '';
    this.suggestedPosition = null;
    this.searchQuery = '';
    this.positionConflict = null;
    this.render();
    this._notifyChange();
  }

  /**
   * Render the component
   */
  render(): void {
    // Save cursor position before re-render
    const activeInput = this.container.querySelector('.series-picker-input') as HTMLInputElement | null;
    const hadFocus = activeInput && document.activeElement === activeInput;
    const cursorPos = hadFocus ? (activeInput.selectionStart ?? 0) : 0;

    const filteredSeries = this._getFilteredSeries();
    const showSuggestion = this._shouldShowSuggestion();
    const showCreateOption = this._shouldShowCreateOption();

    this.container.innerHTML = `
      <div class="series-picker">
        <label id="series-picker-label" class="block font-semibold text-gray-700 mb-1">Series</label>

        ${this.selectedId ? this._renderSelected() : this._renderInput(filteredSeries, showSuggestion, showCreateOption)}

        ${this.selectedId ? this._renderPositionInput() : ''}
      </div>
    `;

    this._attachEventListeners();
    initIcons();

    // Restore focus and cursor position
    if (hadFocus && !this.selectedId) {
      const newInput = this.container.querySelector('.series-picker-input') as HTMLInputElement | null;
      if (newInput) {
        this._restoringFocus = true;
        newInput.focus();
        newInput.setSelectionRange(cursorPos, cursorPos);
        this._restoringFocus = false;
      }
    }
  }

  /**
   * Render selected series display
   */
  private _renderSelected(): string {
    return `
      <div class="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <i data-lucide="library" class="w-4 h-4 text-primary flex-shrink-0"></i>
        <span class="flex-1 font-medium text-gray-900">${escapeHtml(this.selectedName)}</span>
        <button type="button" class="series-picker-clear p-2 hover:bg-gray-200 rounded text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center -m-1" title="Remove from series" aria-label="Remove from series">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }

  /**
   * Render position input
   */
  private _renderPositionInput(): string {
    return `
      <div class="mt-2">
        <label for="series-position" class="block text-sm text-gray-500 mb-1">Position in series</label>
        <input
          type="number"
          id="series-position"
          class="series-position-input w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="#"
          min="1"
          value="${this.position || ''}"
        >
        ${this._renderPositionWarning()}
      </div>
    `;
  }

  /**
   * Render position conflict warning (if any)
   */
  private _renderPositionWarning(): string {
    if (!this.positionConflict) return '';
    return `
      <p class="series-position-warning text-amber-600 text-xs mt-1 flex items-center gap-1">
        <i data-lucide="alert-triangle" class="w-3 h-3 flex-shrink-0"></i>
        <span>Position #${this.position} is already used by "${escapeHtml(this.positionConflict)}"</span>
      </p>
    `;
  }

  /**
   * Render input and dropdown
   */
  private _renderInput(filteredSeries: Series[], showSuggestion: boolean, showCreateOption: boolean): string {
    return `
      <div class="relative">
        <input
          type="text"
          class="series-picker-input w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="${this.isLoading ? 'Loading...' : 'Search or add series...'}"
          value="${escapeHtml(this.searchQuery)}"
          ${this.isLoading ? 'disabled' : ''}
          aria-labelledby="series-picker-label"
          aria-expanded="${this.isOpen}"
          aria-haspopup="listbox"
        >

        ${
          this.isOpen
            ? `
          <div class="series-picker-dropdown absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            <div class="sticky top-0 bg-gray-50 border-b border-gray-200 px-3 py-2 flex items-center justify-between">
              <span class="text-xs text-gray-500">Select series</span>
              <button type="button" class="series-picker-close p-2 hover:bg-gray-200 rounded min-w-[44px] min-h-[44px] flex items-center justify-center -m-1" aria-label="Close dropdown">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            ${this._renderDropdownContent(filteredSeries, showSuggestion, showCreateOption)}
          </div>
        `
            : ''
        }
      </div>

      ${this.suggestedName && !this.selectedId && !this.isOpen ? this._renderSuggestionHint() : ''}
    `;
  }

  /**
   * Render suggestion hint when dropdown is closed
   */
  private _renderSuggestionHint(): string {
    const normalized = normalizeSeriesName(this.suggestedName);
    const existingMatch = this.series.find((s: Series) => s.normalizedName === normalized);

    if (existingMatch) {
      return `
        <p class="text-xs text-gray-400 mt-1">
          API suggests: ${escapeHtml(this.suggestedName)}${this.suggestedPosition ? ` #${this.suggestedPosition}` : ''}
          (matches "${escapeHtml(existingMatch.name)}")
        </p>
      `;
    }

    return `
      <button type="button" class="series-picker-use-suggestion text-xs text-primary hover:underline mt-1">
        Use API suggestion: ${escapeHtml(this.suggestedName)}${this.suggestedPosition ? ` #${this.suggestedPosition}` : ''}
      </button>
    `;
  }

  /**
   * Render dropdown content
   */
  private _renderDropdownContent(filteredSeries: Series[], showSuggestion: boolean, showCreateOption: boolean): string {
    const items: string[] = [];
    let index = 0;
    const { suggestionsFirst } = getSyncSettings();

    // Check if suggestion exists as user series
    const normalized = normalizeSeriesName(this.suggestedName);
    const existingMatch = this.series.find((s: Series) => s.normalizedName === normalized);
    const canShowSuggestion = showSuggestion && !existingMatch;

    // Helper to render API suggestion
    const renderSuggestion = (): void => {
      if (!canShowSuggestion) return;
      if (items.length > 0) {
        items.push(`<div class="border-t border-gray-100"></div>`);
      }
      items.push(`<div class="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">Suggested from book</div>`);
      const isFocused = this.focusedIndex === index;
      items.push(`
        <button type="button" class="series-picker-item w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${isFocused ? 'bg-gray-100' : ''}" data-suggestion data-index="${index}">
          <i data-lucide="plus" class="w-4 h-4 text-green-500"></i>
          <span>${escapeHtml(this.suggestedName)}${this.suggestedPosition ? ` <span class="text-gray-400">#${this.suggestedPosition}</span>` : ''}</span>
        </button>
      `);
      index++;
    };

    // Helper to render user series
    const renderUserSeries = (): void => {
      if (filteredSeries.length === 0) return;
      if (items.length > 0) {
        items.push(`<div class="border-t border-gray-100"></div>`);
      }
      items.push(`<div class="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-50">Your series</div>`);
      filteredSeries.forEach(s => {
        const isFocused = this.focusedIndex === index;
        const countText = s.totalBooks ? `${s.bookCount || 0}/${s.totalBooks}` : `${s.bookCount || 0}`;
        items.push(`
          <button type="button" class="series-picker-item w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 ${isFocused ? 'bg-gray-100' : ''}" data-series-id="${s.id}" data-index="${index}">
            <i data-lucide="library" class="w-4 h-4 text-gray-400"></i>
            <span class="flex-1">${escapeHtml(s.name)}</span>
            <span class="text-xs text-gray-400">${countText}</span>
          </button>
        `);
        index++;
      });
    };

    // Render sections in order based on preference
    if (suggestionsFirst) {
      renderSuggestion();
      renderUserSeries();
    } else {
      renderUserSeries();
      renderSuggestion();
    }

    // Create new option
    if (showCreateOption) {
      if (items.length > 0) {
        items.push(`<div class="border-t border-gray-100"></div>`);
      }
      const isFocused = this.focusedIndex === index;
      items.push(`
        <button type="button" class="series-picker-item series-picker-create w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center gap-2 text-primary ${isFocused ? 'bg-gray-100' : ''}" data-create="${escapeHtml(this.searchQuery)}" data-index="${index}">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span>Create "${escapeHtml(this.searchQuery)}"</span>
        </button>
      `);
    }

    // Empty state
    if (items.length === 0 && !showCreateOption) {
      if (this.series.length === 0) {
        items.push(`<div class="px-3 py-4 text-center text-gray-500">No series yet. Type to create one.</div>`);
      } else {
        items.push(`<div class="px-3 py-4 text-center text-gray-500">No matches found</div>`);
      }
    }

    return items.join('');
  }

  /**
   * Get filtered series based on search query
   */
  private _getFilteredSeries(): Series[] {
    if (!this.searchQuery) return this.series;

    const queryNorm = normalizeSeriesName(this.searchQuery);
    return this.series.filter((s: Series) => s.normalizedName.includes(queryNorm));
  }

  /**
   * Check if we should show suggestion
   */
  private _shouldShowSuggestion(): boolean {
    if (!this.suggestedName) return false;
    if (this.selectedId) return false;

    // Show if matches search or no search
    if (this.searchQuery) {
      const queryNorm = normalizeSeriesName(this.searchQuery);
      const suggestionNorm = normalizeSeriesName(this.suggestedName);
      return suggestionNorm.includes(queryNorm);
    }
    return true;
  }

  /**
   * Check if we should show create option
   */
  private _shouldShowCreateOption(): boolean {
    if (!this.searchQuery || this.searchQuery.trim().length < 1) return false;

    const queryNorm = normalizeSeriesName(this.searchQuery);

    // Check if exact match exists
    const exists = this.series.some((s: Series) => s.normalizedName === queryNorm);
    if (exists) return false;

    // Check if it matches suggestion
    if (this.suggestedName) {
      const suggestionNorm = normalizeSeriesName(this.suggestedName);
      if (suggestionNorm === queryNorm) return false;
    }

    return true;
  }

  /**
   * Attach event listeners
   */
  private _attachEventListeners(): void {
    const input = this.container.querySelector('.series-picker-input') as HTMLInputElement | null;
    if (input) {
      input.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLInputElement;
        this.searchQuery = target.value;
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
    }

    // Clear button
    const clearBtn = this.container.querySelector('.series-picker-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.clear();
      });
    }

    // Position input
    const positionInput = this.container.querySelector('.series-position-input') as HTMLInputElement | null;
    if (positionInput) {
      positionInput.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLInputElement;
        const val = target.value;
        this.position = val ? parseInt(val, 10) : null;

        // Check for position conflict (debounced)
        this._checkPositionConflictDebounced();

        this._notifyChange();
      });
    }

    // Series selection
    this.container.querySelectorAll('[data-series-id]').forEach(btn => {
      btn.addEventListener('click', (e: Event) => {
        e.preventDefault();
        const seriesId = (btn as HTMLElement).dataset.seriesId;
        if (seriesId) {
          this._selectSeries(seriesId);
        }
      });
    });

    // Suggestion selection
    const suggestionBtn = this.container.querySelector('[data-suggestion]');
    if (suggestionBtn) {
      suggestionBtn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        await this._addSuggestion();
      });
    }

    // Use suggestion hint
    const useSuggestionBtn = this.container.querySelector('.series-picker-use-suggestion');
    if (useSuggestionBtn) {
      useSuggestionBtn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        await this._addSuggestion();
      });
    }

    // Create new series
    this.container.querySelectorAll('[data-create]').forEach(btn => {
      btn.addEventListener('click', async (e: Event) => {
        e.preventDefault();
        const name = (btn as HTMLElement).dataset.create;
        if (name) {
          await this._createAndSelect(name);
        }
      });
    });

    // Close button
    const closeBtn = this.container.querySelector('.series-picker-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e: Event) => {
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
  private _handleInputChange(): void {
    this.render();
  }

  /**
   * Handle keyboard navigation
   */
  private _handleKeyDown(e: KeyboardEvent): void {
    const items = this.container.querySelectorAll('.series-picker-item');
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
          (items[this.focusedIndex] as HTMLElement).click();
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
  private _handleClickOutside(e: MouseEvent): void {
    if (!this.container.contains(e.target as Node)) {
      this.isOpen = false;
      this.searchQuery = '';
      this.focusedIndex = -1;
      this.render();
    }
  }

  /**
   * Handle another picker opening (close this one)
   */
  private _handlePickerOpened(e: Event): void {
    const event = e as PickerOpenedEvent;
    if (event.detail.picker !== this && this.isOpen) {
      this.isOpen = false;
      this.searchQuery = '';
      this.focusedIndex = -1;
      this.render();
    }
  }

  /**
   * Select a series
   */
  private _selectSeries(seriesId: string): void {
    const s = this.series.find(x => x.id === seriesId);
    if (!s) return;

    this.selectedId = seriesId;
    this.selectedName = s.name;
    this.positionConflict = null; // Clear conflict for new series

    // Use suggested position if available and selecting suggested series
    if (this.suggestedName && normalizeSeriesName(this.suggestedName) === s.normalizedName) {
      this.position = this.suggestedPosition;
    }

    this.isOpen = false;
    this.searchQuery = '';
    this.focusedIndex = -1;
    this.render();
    this._notifyChange();

    // Check for conflict with new series/position
    if (this.position) {
      this._checkPositionConflictDebounced();
    }
  }

  /**
   * Add suggestion (create series if needed, then select)
   */
  private async _addSuggestion(): Promise<void> {
    if (!this.suggestedName) return;

    try {
      // Check if it matches existing
      const normalized = normalizeSeriesName(this.suggestedName);
      const existingMatch = this.series.find((s: Series) => s.normalizedName === normalized);

      if (existingMatch) {
        this._selectSeries(existingMatch.id);
        return;
      }

      // Create new series
      const newSeries = await createSeries(this.userId, this.suggestedName);
      clearSeriesCache();
      this.series = await loadUserSeries(this.userId, true);

      this.selectedId = newSeries.id;
      this.selectedName = this.suggestedName;
      this.position = this.suggestedPosition;
      this.isOpen = false;
      this.searchQuery = '';
      this.focusedIndex = -1;
      this.render();
      this._notifyChange();
    } catch (error) {
      console.error('Error adding suggestion:', error);
      showToast('Failed to add series', { type: 'error' });
    }
  }

  /**
   * Create a new series and select it
   */
  private async _createAndSelect(name: string): Promise<void> {
    try {
      const newSeries = await createSeries(this.userId, name);
      clearSeriesCache();
      this.series = await loadUserSeries(this.userId, true);

      this.selectedId = newSeries.id;
      this.selectedName = name;
      this.isOpen = false;
      this.searchQuery = '';
      this.focusedIndex = -1;
      this.render();
      this._notifyChange();
    } catch (error) {
      console.error('Error creating series:', error);
      showToast('Failed to create series. Please try again.', { type: 'error' });
    }
  }

  /**
   * Check if the current position conflicts with another book in the series
   * Updates positionConflict state and re-renders warning
   */
  private async _checkPositionConflict(): Promise<void> {
    // Clear conflict if no series or position
    if (!this.selectedId || !this.position) {
      if (this.positionConflict) {
        this.positionConflict = null;
        this._updatePositionWarning();
      }
      return;
    }

    try {
      // Query books in this series with the same position
      const booksRef = collection(db, 'users', this.userId, 'books');
      const q = query(booksRef, where('seriesId', '==', this.selectedId), where('seriesPosition', '==', this.position));
      const snapshot = await getDocs(q);

      // Find conflicting book (excluding current book and deleted books)
      const conflict = snapshot.docs.find(doc => {
        const data = doc.data();
        return doc.id !== this.currentBookId && !data.deletedAt;
      });

      const newConflict = conflict ? conflict.data().title : null;

      // Only update if changed
      if (newConflict !== this.positionConflict) {
        this.positionConflict = newConflict;
        this._updatePositionWarning();
      }
    } catch (error) {
      console.error('Error checking position conflict:', error);
      // Silently fail - don't block the user
    }
  }

  /**
   * Update the position warning display without full re-render
   */
  private _updatePositionWarning(): void {
    const warningContainer = this.container.querySelector('.series-position-warning');
    const positionInputContainer = this.container.querySelector('.series-position-input')?.parentElement;

    if (this.positionConflict) {
      const warningHtml = `
        <p class="series-position-warning text-amber-600 text-xs mt-1 flex items-center gap-1">
          <i data-lucide="alert-triangle" class="w-3 h-3 flex-shrink-0"></i>
          <span>Position #${this.position} is already used by "${escapeHtml(this.positionConflict)}"</span>
        </p>
      `;

      if (warningContainer) {
        warningContainer.outerHTML = warningHtml;
      } else if (positionInputContainer) {
        const positionInput = positionInputContainer.querySelector('.series-position-input');
        positionInput?.insertAdjacentHTML('afterend', warningHtml);
      }
      initIcons(this.container);
    } else if (warningContainer) {
      warningContainer.remove();
    }
  }
}
