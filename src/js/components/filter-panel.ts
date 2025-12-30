// Reusable Filter Panel Component
import { initIcons, debounce, escapeHtml } from '../utils.js';
import type { Genre, Series } from '../types/index.d.ts';

/** Filter state object */
export interface FilterState {
  sort: string;
  rating: number | 'unrated';
  genres: string[];
  statuses: string[];
  seriesIds: string[];
  author: string;
}

/** Initial filter values (supports both old single-value and new array formats) */
export interface InitialFilters {
  sort?: string;
  rating?: number | 'unrated';
  genres?: string[];
  genre?: string; // Legacy single-value format
  statuses?: string[];
  status?: string; // Legacy single-value format
  seriesIds?: string[];
  series?: string; // Legacy single-value format
  author?: string;
}

/** Options for FilterPanel constructor */
export interface FilterPanelOptions {
  /** Container element to render into */
  container?: HTMLElement | null;
  /** Array of genre objects */
  genres?: Genre[];
  /** Array of series objects */
  series?: Series[];
  /** Array of author name strings */
  authors?: string[];
  /** Callback when any filter changes */
  onChange?: ((filters: FilterState) => void) | null;
  /** Whether to show sort control (default: true) */
  showSort?: boolean;
  /** Initial filter values */
  initialFilters?: InitialFilters;
}

/** Book counts for filter options */
export interface BookCounts {
  genres?: Record<string, number>;
  ratings?: Record<string, number>;
  ratingTotal?: number;
  status?: { reading?: number; finished?: number };
  series?: Record<string, number>;
  authors?: Record<string, number>;
}

/** Internal element references */
interface FilterPanelElements {
  sort?: HTMLSelectElement | null;
  statusCheckboxes?: HTMLElement | null;
  rating?: HTMLSelectElement | null;
  authorContainer?: HTMLElement | null;
  authorInput?: HTMLInputElement | null;
  authorDropdown?: HTMLElement | null;
  authorClear?: HTMLElement | null;
  genreCheckboxes?: HTMLElement | null;
  seriesCheckboxes?: HTMLElement | null;
  reset?: HTMLElement | null;
  moreFiltersToggle?: HTMLElement | null;
  secondaryFilters?: HTMLElement | null;
}

// Instance counter for unique IDs
let instanceCounter = 0;

/**
 * FilterPanel - Renders filter controls for books list
 * Used in both desktop sidebar and mobile bottom sheet
 *
 * @example
 * const panel = new FilterPanel({
 *   container: document.getElementById('filter-container'),
 *   genres: [...],
 *   series: [...],
 *   authors: [...],
 *   onChange: (filters) => console.log('Filters changed:', filters)
 * });
 */
export class FilterPanel {
  private instanceId: number;
  private container: HTMLElement | null;
  private genres: Genre[];
  private series: Series[];
  private authors: string[];
  private onChange: ((filters: FilterState) => void) | null;
  private showSort: boolean;

  // Author typeahead state
  private authorSearchQuery: string;
  private authorFocusedIndex: number;
  private isAuthorDropdownOpen: boolean;
  private authorCounts: Record<string, number>;

  // Filter state
  private filters: FilterState;

  // Element references
  private elements: FilterPanelElements;

  // Book counts for display
  private bookCounts: BookCounts | null;

  constructor(options: FilterPanelOptions = {}) {
    this.instanceId = ++instanceCounter;
    this.container = options.container ?? null;
    this.genres = options.genres || [];
    this.series = options.series || [];
    this.authors = options.authors || [];
    this.onChange = options.onChange ?? null;
    this.showSort = options.showSort !== false;

    // Author typeahead state
    this.authorSearchQuery = '';
    this.authorFocusedIndex = -1;
    this.isAuthorDropdownOpen = false;
    this.authorCounts = {};

    // Filter state (arrays for multi-select, single value for rating/author)
    this.filters = {
      sort: 'createdAt-desc',
      rating: 0,
      genres: [],
      statuses: [],
      seriesIds: [],
      author: '',
    };

    // Apply initial filters if provided
    if (options.initialFilters) {
      const initial = options.initialFilters;
      if (initial.sort) this.filters.sort = initial.sort;
      if (initial.rating !== undefined) this.filters.rating = initial.rating;
      if (initial.author) this.filters.author = initial.author;
      // Convert old single values to arrays if needed
      if (initial.genres) {
        this.filters.genres = Array.isArray(initial.genres) ? initial.genres : [];
      } else if (initial.genre) {
        this.filters.genres = initial.genre ? [initial.genre] : [];
      }
      if (initial.statuses) {
        this.filters.statuses = Array.isArray(initial.statuses) ? initial.statuses : [];
      } else if (initial.status) {
        this.filters.statuses = initial.status ? [initial.status] : [];
      }
      if (initial.seriesIds) {
        this.filters.seriesIds = Array.isArray(initial.seriesIds) ? initial.seriesIds : [];
      } else if (initial.series) {
        this.filters.seriesIds = initial.series ? [initial.series] : [];
      }
    }

    // Element references
    this.elements = {};
    this.bookCounts = null;

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  /**
   * Render the filter panel UI
   */
  render(): void {
    if (!this.container) return;

    const sortSection = this.showSort
      ? `
      <div class="filter-group">
        <label for="filter-sort-${this.instanceId}" class="block text-sm font-semibold text-gray-900 mb-2">Sort By</label>
        <select id="filter-sort-${this.instanceId}" class="filter-sort filter-select">
          <option value="createdAt-desc">Date Added (Newest)</option>
          <option value="createdAt-asc">Date Added (Oldest)</option>
          <option value="title-asc">Title (A-Z)</option>
          <option value="title-desc">Title (Z-A)</option>
          <option value="author-asc">Author (A-Z)</option>
          <option value="author-desc">Author (Z-A)</option>
          <option value="rating-desc">Rating (High-Low)</option>
          <option value="rating-asc">Rating (Low-High)</option>
          <option value="seriesPosition-asc" class="series-sort-option hidden">Series Order</option>
        </select>
      </div>
    `
      : '';

    // Check if any secondary filter is active (auto-expand)
    const hasActiveSecondaryFilter = this.filters.seriesIds.length > 0;

    this.container.innerHTML = `
      <div class="filter-panel space-y-4">
        ${sortSection}

        <!-- Status: Checkboxes -->
        <div class="filter-group">
          <span class="block text-sm font-semibold text-gray-900 mb-2">Status</span>
          <div class="space-y-3 pr-3 status-checkboxes">
            <label for="filter-status-reading-${this.instanceId}" class="flex items-center justify-between cursor-pointer">
              <span class="filter-label text-sm text-gray-900">Reading</span>
              <span class="flex items-center gap-3">
                <span class="filter-count text-sm text-gray-500"></span>
                <input type="checkbox" id="filter-status-reading-${this.instanceId}" name="status" value="reading" class="filter-checkbox w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
              </span>
            </label>
            <label for="filter-status-finished-${this.instanceId}" class="flex items-center justify-between cursor-pointer">
              <span class="filter-label text-sm text-gray-900">Finished</span>
              <span class="flex items-center gap-3">
                <span class="filter-count text-sm text-gray-500"></span>
                <input type="checkbox" id="filter-status-finished-${this.instanceId}" name="status" value="finished" class="filter-checkbox w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
              </span>
            </label>
          </div>
        </div>

        <!-- Rating: Dropdown (single-select, minimum threshold) -->
        <div class="filter-group">
          <label for="filter-rating-${this.instanceId}" class="block text-sm font-semibold text-gray-900 mb-2">Rating</label>
          <select id="filter-rating-${this.instanceId}" class="filter-rating filter-select">
            <option value="0">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4+ Stars</option>
            <option value="3">3+ Stars</option>
            <option value="2">2+ Stars</option>
            <option value="1">1+ Stars</option>
            <option value="unrated">Unrated</option>
          </select>
        </div>

        <!-- Author: Typeahead input (single-select) -->
        <div class="filter-group">
          <label for="filter-author-${this.instanceId}" class="block text-sm font-semibold text-gray-900 mb-2">Author</label>
          <div class="relative author-container">
            <input type="text" id="filter-author-${this.instanceId}" class="filter-author w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm" placeholder="Search authors..." autocomplete="off">
            <button type="button" class="clear-author hidden absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 w-11 h-full flex items-center justify-center" aria-label="Clear author filter">
              <i data-lucide="x" class="w-4 h-4" aria-hidden="true"></i>
            </button>
            <div class="author-dropdown hidden absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10" role="listbox" aria-label="Author suggestions"></div>
          </div>
        </div>

        <!-- Genre: Checkboxes (scrollable if many) -->
        <div class="filter-group">
          <label class="block text-sm font-semibold text-gray-900 mb-2">Genre</label>
          <div class="space-y-3 max-h-48 overflow-y-auto pr-3 genre-checkboxes">
            <!-- Dynamically populated -->
          </div>
        </div>

        <!-- More Filters Toggle -->
        <button class="toggle-more-filters flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors py-1 mt-3 min-h-[44px]">
          <i data-lucide="chevron-down" class="w-4 h-4 transition-transform ${hasActiveSecondaryFilter ? 'rotate-180' : ''}" aria-hidden="true"></i>
          <span>${hasActiveSecondaryFilter ? 'Less' : 'More'}</span>
        </button>

        <!-- Secondary Filters (collapsible) -->
        <div class="secondary-filters ${hasActiveSecondaryFilter ? 'expanded' : 'collapsed'} space-y-4">
          <div class="filter-group">
            <label class="block text-sm font-semibold text-gray-900 mb-2">Series</label>
            <div class="space-y-3 max-h-48 overflow-y-auto pr-3 series-checkboxes">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>

        <button class="filter-reset w-full py-2 px-4 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">
          Reset Filters
        </button>
      </div>
    `;

    // Store element references
    if (this.showSort) {
      this.elements.sort = this.container.querySelector('.filter-sort') as HTMLSelectElement | null;
    }
    this.elements.statusCheckboxes = this.container.querySelector('.status-checkboxes');
    this.elements.rating = this.container.querySelector('.filter-rating') as HTMLSelectElement | null;
    this.elements.authorContainer = this.container.querySelector('.author-container');
    this.elements.authorInput = this.container.querySelector('.filter-author') as HTMLInputElement | null;
    this.elements.authorDropdown = this.container.querySelector('.author-dropdown');
    this.elements.authorClear = this.container.querySelector('.clear-author');
    this.elements.genreCheckboxes = this.container.querySelector('.genre-checkboxes');
    this.elements.seriesCheckboxes = this.container.querySelector('.series-checkboxes');
    this.elements.reset = this.container.querySelector('.filter-reset');
    this.elements.moreFiltersToggle = this.container.querySelector('.toggle-more-filters');
    this.elements.secondaryFilters = this.container.querySelector('.secondary-filters');

    // Populate dynamic options
    this.populateGenres();
    this.populateSeries();

    // Apply current filter values
    this.syncUIFromState();
    initIcons();
  }

  /**
   * Bind event listeners to filter controls
   */
  bindEvents(): void {
    if (this.elements.sort) {
      this.elements.sort.addEventListener('change', () => {
        if (this.elements.sort) {
          this.filters.sort = this.elements.sort.value;
          this.emitChange();
        }
      });
    }

    // Status: checkbox changes
    if (this.elements.statusCheckboxes) {
      this.elements.statusCheckboxes.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'checkbox' && this.elements.statusCheckboxes) {
          this.syncArrayFromCheckboxes('statuses', this.elements.statusCheckboxes);
          this.emitChange();
        }
      });
    }

    // Rating: dropdown change (single-select)
    if (this.elements.rating) {
      this.elements.rating.addEventListener('change', () => {
        if (this.elements.rating) {
          const val = this.elements.rating.value;
          this.filters.rating = val === 'unrated' ? 'unrated' : parseInt(val, 10);
          this.emitChange();
        }
      });
    }

    // Author: typeahead input
    if (this.elements.authorInput) {
      // Debounced input handler
      const debouncedInput = debounce(() => {
        if (this.elements.authorInput) {
          this.authorSearchQuery = this.elements.authorInput.value;
          this.renderAuthorDropdown();
        }
      }, 150);

      this.elements.authorInput.addEventListener('input', debouncedInput);

      // Focus opens dropdown
      this.elements.authorInput.addEventListener('focus', () => {
        this.isAuthorDropdownOpen = true;
        this.renderAuthorDropdown();
      });

      // Keyboard navigation
      this.elements.authorInput.addEventListener('keydown', (e: KeyboardEvent) => {
        this.handleAuthorKeydown(e);
      });

      // Clear button
      if (this.elements.authorClear) {
        this.elements.authorClear.addEventListener('click', () => {
          this.clearAuthor();
        });
      }

      // Click outside to close dropdown
      document.addEventListener('click', (e: MouseEvent) => {
        if (this.elements.authorContainer && !this.elements.authorContainer.contains(e.target as Node)) {
          this.closeAuthorDropdown();
        }
      });
    }

    // Genre: checkbox changes
    if (this.elements.genreCheckboxes) {
      this.elements.genreCheckboxes.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'checkbox' && this.elements.genreCheckboxes) {
          this.syncArrayFromCheckboxes('genres', this.elements.genreCheckboxes);
          this.emitChange();
        }
      });
    }

    // Series: checkbox changes
    if (this.elements.seriesCheckboxes) {
      this.elements.seriesCheckboxes.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.type === 'checkbox' && this.elements.seriesCheckboxes) {
          this.syncArrayFromCheckboxes('seriesIds', this.elements.seriesCheckboxes);
          this.updateSeriesSortVisibility();
          this.emitChange();
        }
      });
    }

    if (this.elements.reset) {
      this.elements.reset.addEventListener('click', () => {
        this.reset();
        this.emitChange();
      });
    }

    // Toggle more/less filters
    if (this.elements.moreFiltersToggle && this.elements.secondaryFilters) {
      this.elements.moreFiltersToggle.addEventListener('click', () => {
        this.toggleSecondaryFilters();
      });
    }
  }

  /**
   * Sync filter array from checkbox container
   * @param filterKey - Key in this.filters (e.g., 'statuses', 'genres')
   * @param container - Container with checkboxes
   */
  private syncArrayFromCheckboxes(filterKey: 'statuses' | 'genres' | 'seriesIds', container: HTMLElement): void {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>;
    this.filters[filterKey] = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }

  /**
   * Toggle secondary filters visibility with smooth height transition
   */
  private toggleSecondaryFilters(): void {
    if (!this.elements.secondaryFilters || !this.elements.moreFiltersToggle) return;

    const isCollapsed = this.elements.secondaryFilters.classList.contains('collapsed');

    // Toggle between collapsed and expanded states
    this.elements.secondaryFilters.classList.toggle('collapsed', !isCollapsed);
    this.elements.secondaryFilters.classList.toggle('expanded', isCollapsed);

    // Update toggle button text
    const text = this.elements.moreFiltersToggle.querySelector('span');
    if (text) {
      text.textContent = isCollapsed ? 'Less' : 'More';
    }

    // Update icon rotation (find svg or i element)
    const icon = this.elements.moreFiltersToggle.querySelector('svg, i');
    if (icon) {
      icon.classList.toggle('rotate-180', isCollapsed);
    }
  }

  /**
   * Populate genre checkboxes
   */
  private populateGenres(): void {
    if (!this.elements.genreCheckboxes) return;

    this.elements.genreCheckboxes.innerHTML = '';

    if (this.genres.length === 0) {
      this.elements.genreCheckboxes.innerHTML = '<p class="text-sm text-gray-400 italic">No genres defined</p>';
      return;
    }

    for (const genre of this.genres) {
      const checkboxId = `filter-genre-${genre.id}-${this.instanceId}`;
      const label = document.createElement('label');
      label.className = 'flex items-center justify-between cursor-pointer';
      label.setAttribute('for', checkboxId);
      label.innerHTML = `
        <span class="filter-label text-sm text-gray-900">${escapeHtml(genre.name)}</span>
        <span class="flex items-center gap-3">
          <span class="filter-count text-sm text-gray-500"></span>
          <input type="checkbox" id="${checkboxId}" name="genre" value="${genre.id}" class="filter-checkbox w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
        </span>
      `;
      this.elements.genreCheckboxes.appendChild(label);
    }
  }

  /**
   * Populate series checkboxes
   */
  private populateSeries(): void {
    if (!this.elements.seriesCheckboxes) return;

    this.elements.seriesCheckboxes.innerHTML = '';

    if (this.series.length === 0) {
      this.elements.seriesCheckboxes.innerHTML = '<p class="text-sm text-gray-400 italic">No series defined</p>';
      return;
    }

    for (const s of this.series) {
      const checkboxId = `filter-series-${s.id}-${this.instanceId}`;
      const label = document.createElement('label');
      label.className = 'flex items-center justify-between cursor-pointer';
      label.setAttribute('for', checkboxId);
      label.innerHTML = `
        <span class="filter-label text-sm text-gray-900">${s.name}</span>
        <span class="flex items-center gap-3">
          <span class="filter-count text-sm text-gray-500"></span>
          <input type="checkbox" id="${checkboxId}" name="series" value="${s.id}" class="filter-checkbox w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
        </span>
      `;
      this.elements.seriesCheckboxes.appendChild(label);
    }
  }

  /**
   * Update genres list and re-populate checkboxes
   * @param genres - New genres array
   */
  setGenres(genres: Genre[]): void {
    this.genres = genres || [];
    this.populateGenres();
    // Filter out any selected genres that no longer exist
    const validGenreIds = new Set(this.genres.map(g => g.id));
    this.filters.genres = this.filters.genres.filter(id => validGenreIds.has(id));
    this.syncUIFromState();
  }

  /**
   * Update series list and re-populate checkboxes
   * @param series - New series array
   */
  setSeries(series: Series[]): void {
    this.series = series || [];
    this.populateSeries();
    // Filter out any selected series that no longer exist
    const validSeriesIds = new Set(this.series.map(s => s.id));
    this.filters.seriesIds = this.filters.seriesIds.filter(id => validSeriesIds.has(id));
    this.syncUIFromState();
    this.updateSeriesSortVisibility();
  }

  /**
   * Show/hide series sort option based on series filter
   */
  private updateSeriesSortVisibility(): void {
    if (!this.elements.sort) return;

    const seriesSortOption = this.elements.sort.querySelector('.series-sort-option');
    if (seriesSortOption) {
      // Show series sort when exactly one series is selected
      seriesSortOption.classList.toggle('hidden', this.filters.seriesIds.length !== 1);
    }
  }

  /**
   * Update UI elements with book counts
   * @param counts - Book counts for each filter option
   */
  setBookCounts(counts: BookCounts | null): void {
    if (!counts) return;

    // Track if we need to emit change due to auto-deselection of 0-count filters
    let filtersChanged = false;

    // Update status checkboxes with counts
    if (this.elements.statusCheckboxes && counts.status) {
      const labels = this.elements.statusCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input') as HTMLInputElement;
        const countSpan = label.querySelector('.filter-count');
        const val = checkbox.value;
        let count = 0;

        if (val === 'reading') {
          count = counts.status?.reading || 0;
        } else if (val === 'finished') {
          count = counts.status?.finished || 0;
        }

        if (countSpan) {
          countSpan.textContent = `(${count})`;
        }

        // Auto-deselect if count is 0 and currently selected
        if (count === 0 && checkbox.checked) {
          checkbox.checked = false;
          this.filters.statuses = this.filters.statuses.filter(s => s !== val);
          filtersChanged = true;
        }

        checkbox.disabled = count === 0;
        label.classList.toggle('opacity-50', count === 0);
        label.classList.toggle('cursor-not-allowed', count === 0);
        label.classList.toggle('cursor-pointer', count > 0);
      });
    }

    // Update rating dropdown options with counts
    if (this.elements.rating && counts.ratings) {
      const options = this.elements.rating.querySelectorAll('option');
      // Calculate cumulative counts for 4+, 3+, etc.
      const r5 = counts.ratings['5'] || 0;
      const r4 = (counts.ratings['4'] || 0) + r5;
      const r3 = (counts.ratings['3'] || 0) + r4;
      const r2 = (counts.ratings['2'] || 0) + r3;
      const r1 = (counts.ratings['1'] || 0) + r2;
      const unrated = counts.ratings['unrated'] || 0;
      const cumulative: Record<string, number> = {
        '0': counts.ratingTotal || 0,
        '5': r5,
        '4': r4,
        '3': r3,
        '2': r2,
        '1': r1,
        unrated: unrated,
      };

      options.forEach(opt => {
        const val = opt.value;
        const count = cumulative[val] || 0;
        if (val === '0') {
          opt.textContent = `All Ratings (${count})`;
          opt.disabled = false; // "All" always enabled
        } else if (val === '5') {
          opt.textContent = `5 Stars (${count})`;
          opt.disabled = count === 0;
        } else if (val === 'unrated') {
          opt.textContent = `Unrated (${count})`;
          opt.disabled = count === 0;
        } else {
          opt.textContent = `${val}+ Stars (${count})`;
          opt.disabled = count === 0;
        }
      });
    }

    // Update author counts (store for dropdown rendering)
    if (counts.authors) {
      this.authorCounts = counts.authors;
      // Auto-deselect if currently selected author has 0 count
      if (this.filters.author && (this.authorCounts[this.filters.author] || 0) === 0) {
        this.filters.author = '';
        this.authorSearchQuery = '';
        this.syncUIFromState();
        filtersChanged = true;
      }
    }

    // Update genre checkboxes with counts
    if (this.elements.genreCheckboxes && counts.genres) {
      const labels = this.elements.genreCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input') as HTMLInputElement;
        const countSpan = label.querySelector('.filter-count');
        const genreId = checkbox.value;
        const count = counts.genres?.[genreId] || 0;

        if (countSpan) {
          countSpan.textContent = `(${count})`;
        }

        // Auto-deselect if count is 0 and currently selected
        if (count === 0 && checkbox.checked) {
          checkbox.checked = false;
          this.filters.genres = this.filters.genres.filter(id => id !== genreId);
          filtersChanged = true;
        }

        checkbox.disabled = count === 0;
        label.classList.toggle('opacity-50', count === 0);
        label.classList.toggle('cursor-not-allowed', count === 0);
        label.classList.toggle('cursor-pointer', count > 0);
      });
    }

    // Update series checkboxes with counts
    if (this.elements.seriesCheckboxes && counts.series) {
      const labels = this.elements.seriesCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input') as HTMLInputElement;
        const countSpan = label.querySelector('.filter-count');
        const seriesId = checkbox.value;
        const count = counts.series?.[seriesId] || 0;

        if (countSpan) {
          countSpan.textContent = `(${count})`;
        }

        // Auto-deselect if count is 0 and currently selected
        if (count === 0 && checkbox.checked) {
          checkbox.checked = false;
          this.filters.seriesIds = this.filters.seriesIds.filter(id => id !== seriesId);
          filtersChanged = true;
        }

        checkbox.disabled = count === 0;
        label.classList.toggle('opacity-50', count === 0);
        label.classList.toggle('cursor-not-allowed', count === 0);
        label.classList.toggle('cursor-pointer', count > 0);
      });
    }

    // Store counts
    this.bookCounts = counts;

    // Emit change if filters were auto-deselected
    if (filtersChanged) {
      this.emitChange();
    }
  }

  /**
   * Sync UI elements to match current filter state
   */
  syncUIFromState(): void {
    if (this.elements.sort) {
      this.elements.sort.value = this.filters.sort;
    }

    // Status checkboxes
    if (this.elements.statusCheckboxes) {
      const checkboxes = this.elements.statusCheckboxes.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = this.filters.statuses.includes(cb.value);
      });
    }

    // Rating dropdown
    if (this.elements.rating) {
      this.elements.rating.value = this.filters.rating.toString();
    }

    // Genre checkboxes
    if (this.elements.genreCheckboxes) {
      const checkboxes = this.elements.genreCheckboxes.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = this.filters.genres.includes(cb.value);
      });
    }

    // Series checkboxes
    if (this.elements.seriesCheckboxes) {
      const checkboxes = this.elements.seriesCheckboxes.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => {
        cb.checked = this.filters.seriesIds.includes(cb.value);
      });
    }

    // Author input
    if (this.elements.authorInput) {
      this.elements.authorInput.value = this.filters.author || '';
      this.updateAuthorClearButton();
    }

    this.updateSeriesSortVisibility();
  }

  /**
   * Get current filter state
   * @returns Current filters
   */
  getFilters(): FilterState {
    return {
      sort: this.filters.sort,
      rating: this.filters.rating,
      genres: [...this.filters.genres],
      statuses: [...this.filters.statuses],
      seriesIds: [...this.filters.seriesIds],
      author: this.filters.author,
    };
  }

  /**
   * Set filter state (does not trigger onChange)
   * @param filters - Filter values to set
   */
  setFilters(filters: Partial<FilterState>): void {
    if (filters.sort !== undefined) this.filters.sort = filters.sort;
    if (filters.rating !== undefined) this.filters.rating = filters.rating;
    if (filters.genres !== undefined) this.filters.genres = [...filters.genres];
    if (filters.statuses !== undefined) this.filters.statuses = [...filters.statuses];
    if (filters.seriesIds !== undefined) this.filters.seriesIds = [...filters.seriesIds];
    if (filters.author !== undefined) this.filters.author = filters.author;
    this.syncUIFromState();
  }

  /**
   * Get number of active filters (excluding sort)
   * @returns Count of non-default filters
   */
  getActiveCount(): number {
    let count = 0;
    if (this.filters.rating !== 0) count++;
    if (this.filters.author) count++;
    count += this.filters.genres.length;
    count += this.filters.statuses.length;
    count += this.filters.seriesIds.length;
    return count;
  }

  /**
   * Check if any filters are active (excluding sort)
   * @returns True if any filter is active
   */
  hasActiveFilters(): boolean {
    return this.getActiveCount() > 0;
  }

  /**
   * Reset all filters to defaults
   */
  reset(): void {
    this.filters = {
      sort: 'createdAt-desc',
      rating: 0,
      genres: [],
      statuses: [],
      seriesIds: [],
      author: '',
    };
    this.authorSearchQuery = '';
    this.syncUIFromState();
    this.clearDisabledStates();
  }

  /**
   * Clear all disabled states from checkboxes (re-enable all options)
   * Called during reset to allow re-selection before counts are recalculated
   */
  private clearDisabledStates(): void {
    // Status checkboxes
    if (this.elements.statusCheckboxes) {
      const labels = this.elements.statusCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input') as HTMLInputElement;
        checkbox.disabled = false;
        label.classList.remove('opacity-50', 'cursor-not-allowed');
        label.classList.add('cursor-pointer');
      });
    }

    // Genre checkboxes
    if (this.elements.genreCheckboxes) {
      const labels = this.elements.genreCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input') as HTMLInputElement;
        checkbox.disabled = false;
        label.classList.remove('opacity-50', 'cursor-not-allowed');
        label.classList.add('cursor-pointer');
      });
    }

    // Series checkboxes
    if (this.elements.seriesCheckboxes) {
      const labels = this.elements.seriesCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input') as HTMLInputElement;
        checkbox.disabled = false;
        label.classList.remove('opacity-50', 'cursor-not-allowed');
        label.classList.add('cursor-pointer');
      });
    }

    // Rating dropdown options
    if (this.elements.rating) {
      const options = this.elements.rating.querySelectorAll('option');
      options.forEach(opt => {
        opt.disabled = false;
      });
    }
  }

  /**
   * Emit change event if callback is set
   */
  private emitChange(): void {
    if (this.onChange) {
      this.onChange(this.getFilters());
    }
  }

  // ==================== Author Typeahead Methods ====================

  /**
   * Get filtered authors based on search query
   * @returns Filtered author names
   */
  private getFilteredAuthors(): string[] {
    if (!this.authorSearchQuery) return this.authors;
    const query = this.authorSearchQuery.toLowerCase().trim();
    return this.authors.filter(author => author.toLowerCase().includes(query));
  }

  /**
   * Render the author dropdown with filtered results
   */
  private renderAuthorDropdown(): void {
    if (!this.elements.authorDropdown || !this.isAuthorDropdownOpen) return;

    const filtered = this.getFilteredAuthors();

    if (filtered.length === 0) {
      this.elements.authorDropdown.innerHTML = `
        <div class="px-3 py-2 text-sm text-gray-500 italic">No authors found</div>
      `;
      this.elements.authorDropdown.classList.remove('hidden');
      return;
    }

    this.elements.authorDropdown.innerHTML = filtered
      .map((author, index) => {
        const count = this.authorCounts[author] || 0;
        const isDisabled = count === 0;
        const isSelected = this.filters.author === author;
        const isFocused = index === this.authorFocusedIndex;

        return `
        <button type="button"
                class="author-option w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-gray-100 min-h-[44px] ${isFocused ? 'bg-gray-100' : ''} ${isSelected ? 'text-primary font-medium' : 'text-gray-900'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
                data-author="${escapeHtml(author)}"
                ${isDisabled ? 'disabled' : ''}
                role="option"
                aria-selected="${isSelected}">
          <span class="truncate">${escapeHtml(author)}</span>
          <span class="text-gray-400 text-xs ml-2">(${count})</span>
        </button>
      `;
      })
      .join('');

    this.elements.authorDropdown.classList.remove('hidden');

    // Attach click handlers
    this.elements.authorDropdown.querySelectorAll('.author-option:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const author = (btn as HTMLElement).dataset.author;
        if (author) {
          this.selectAuthor(author);
        }
      });
    });
  }

  /**
   * Handle keyboard navigation in author dropdown
   * @param e - Keyboard event
   */
  private handleAuthorKeydown(e: KeyboardEvent): void {
    const filtered = this.getFilteredAuthors();

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.authorFocusedIndex = Math.min(this.authorFocusedIndex + 1, filtered.length - 1);
        this.renderAuthorDropdown();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.authorFocusedIndex = Math.max(this.authorFocusedIndex - 1, 0);
        this.renderAuthorDropdown();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.authorFocusedIndex >= 0 && this.authorFocusedIndex < filtered.length) {
          const author = filtered[this.authorFocusedIndex];
          const count = this.authorCounts[author] || 0;
          if (count > 0) {
            this.selectAuthor(author);
          }
        }
        break;
      case 'Escape':
        e.preventDefault();
        this.closeAuthorDropdown();
        break;
    }
  }

  /**
   * Select an author and apply the filter
   * @param author - Author name to select
   */
  private selectAuthor(author: string): void {
    this.filters.author = author;
    this.authorSearchQuery = '';
    if (this.elements.authorInput) {
      this.elements.authorInput.value = author;
    }
    this.closeAuthorDropdown();
    this.updateAuthorClearButton();
    this.emitChange();
  }

  /**
   * Clear the author filter
   */
  private clearAuthor(): void {
    this.filters.author = '';
    this.authorSearchQuery = '';
    if (this.elements.authorInput) {
      this.elements.authorInput.value = '';
    }
    this.updateAuthorClearButton();
    this.emitChange();
  }

  /**
   * Close the author dropdown
   */
  private closeAuthorDropdown(): void {
    this.isAuthorDropdownOpen = false;
    this.authorFocusedIndex = -1;
    if (this.elements.authorDropdown) {
      this.elements.authorDropdown.classList.add('hidden');
    }
  }

  /**
   * Update visibility of the clear button based on selection
   */
  private updateAuthorClearButton(): void {
    if (this.elements.authorClear) {
      if (this.filters.author) {
        this.elements.authorClear.classList.remove('hidden');
      } else {
        this.elements.authorClear.classList.add('hidden');
      }
    }
  }

  /**
   * Update authors list
   * @param authors - Array of author name strings
   */
  setAuthors(authors: string[]): void {
    this.authors = authors || [];
    // If currently selected author no longer exists, clear it
    if (this.filters.author && !this.authors.includes(this.filters.author)) {
      this.filters.author = '';
      this.syncUIFromState();
    }
  }

  /**
   * Destroy the component and clean up
   */
  destroy(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.elements = {};
    this.onChange = null;
    this.container = null;
  }
}
