// Reusable Filter Panel Component
import { initIcons } from '../utils.js';

/**
 * FilterPanel - Renders filter controls for books list
 * Used in both desktop sidebar and mobile bottom sheet
 *
 * @example
 * const panel = new FilterPanel({
 *   container: document.getElementById('filter-container'),
 *   genres: [...],
 *   series: [...],
 *   onChange: (filters) => console.log('Filters changed:', filters)
 * });
 */
export class FilterPanel {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element to render into
   * @param {Array} options.genres - Array of genre objects { id, name, colour }
   * @param {Array} options.series - Array of series objects { id, name }
   * @param {Function} options.onChange - Callback when any filter changes (receives filters object)
   * @param {boolean} options.showSort - Whether to show sort control (default: true)
   * @param {Object} options.initialFilters - Initial filter values
   */
  constructor(options = {}) {
    this.container = options.container;
    this.genres = options.genres || [];
    this.series = options.series || [];
    this.onChange = options.onChange || null;
    this.showSort = options.showSort !== false;

    // Filter state (arrays for multi-select, single value for rating)
    this.filters = {
      sort: 'createdAt-desc',
      rating: 0,
      genres: [],      // array of genreIds
      statuses: [],    // ['reading'] and/or ['finished']
      seriesIds: []    // array of seriesIds
    };

    // Apply initial filters if provided
    if (options.initialFilters) {
      // Handle both old single-value and new array formats for backwards compatibility
      const initial = options.initialFilters;
      if (initial.sort) this.filters.sort = initial.sort;
      if (initial.rating !== undefined) this.filters.rating = initial.rating;
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

    if (this.container) {
      this.render();
      this.bindEvents();
    }
  }

  /**
   * Render the filter panel UI
   */
  render() {
    const sortSection = this.showSort ? `
      <div class="filter-group">
        <label class="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
        <select id="filter-sort" class="filter-select">
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
    ` : '';

    // Check if any secondary filter is active (auto-expand)
    const hasActiveSecondaryFilter = this.filters.seriesIds.length > 0;

    this.container.innerHTML = `
      <div class="filter-panel space-y-4">
        ${sortSection}

        <!-- Status: Checkboxes -->
        <div class="filter-group">
          <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <div class="space-y-2" id="status-checkboxes">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value="reading" class="filter-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
              <span class="filter-label">Reading</span>
              <span class="filter-count text-xs text-gray-400"></span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" value="finished" class="filter-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
              <span class="filter-label">Finished</span>
              <span class="filter-count text-xs text-gray-400"></span>
            </label>
          </div>
        </div>

        <!-- Rating: Dropdown (single-select, minimum threshold) -->
        <div class="filter-group">
          <label class="block text-sm font-medium text-gray-700 mb-2">Rating</label>
          <select id="filter-rating" class="filter-select">
            <option value="0">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4+ Stars</option>
            <option value="3">3+ Stars</option>
            <option value="2">2+ Stars</option>
            <option value="1">1+ Stars</option>
          </select>
        </div>

        <!-- Genre: Checkboxes (scrollable if many) -->
        <div class="filter-group">
          <label class="block text-sm font-medium text-gray-700 mb-2">Genre</label>
          <div class="space-y-2 max-h-40 overflow-y-auto" id="genre-checkboxes">
            <!-- Dynamically populated -->
          </div>
        </div>

        <!-- More Filters Toggle -->
        <button id="toggle-more-filters" class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors py-1">
          <i data-lucide="chevron-down" class="w-4 h-4 transition-transform ${hasActiveSecondaryFilter ? 'rotate-180' : ''}" aria-hidden="true"></i>
          <span>${hasActiveSecondaryFilter ? 'Less filters' : 'More filters'}</span>
        </button>

        <!-- Secondary Filters (collapsible) -->
        <div id="secondary-filters" class="${hasActiveSecondaryFilter ? '' : 'hidden'} space-y-4">
          <div class="filter-group">
            <label class="block text-sm font-medium text-gray-700 mb-2">Series</label>
            <div class="space-y-2 max-h-40 overflow-y-auto" id="series-checkboxes">
              <!-- Dynamically populated -->
            </div>
          </div>
        </div>

        <button id="filter-reset" class="w-full py-2 px-4 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
          Reset Filters
        </button>
      </div>
    `;

    // Store element references
    if (this.showSort) {
      this.elements.sort = this.container.querySelector('#filter-sort');
    }
    this.elements.statusCheckboxes = this.container.querySelector('#status-checkboxes');
    this.elements.rating = this.container.querySelector('#filter-rating');
    this.elements.genreCheckboxes = this.container.querySelector('#genre-checkboxes');
    this.elements.seriesCheckboxes = this.container.querySelector('#series-checkboxes');
    this.elements.reset = this.container.querySelector('#filter-reset');
    this.elements.moreFiltersToggle = this.container.querySelector('#toggle-more-filters');
    this.elements.secondaryFilters = this.container.querySelector('#secondary-filters');

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
  bindEvents() {
    if (this.elements.sort) {
      this.elements.sort.addEventListener('change', () => {
        this.filters.sort = this.elements.sort.value;
        this.emitChange();
      });
    }

    // Status: checkbox changes
    if (this.elements.statusCheckboxes) {
      this.elements.statusCheckboxes.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          this.syncArrayFromCheckboxes('statuses', this.elements.statusCheckboxes);
          this.emitChange();
        }
      });
    }

    // Rating: dropdown change (single-select)
    if (this.elements.rating) {
      this.elements.rating.addEventListener('change', () => {
        this.filters.rating = parseInt(this.elements.rating.value, 10);
        this.emitChange();
      });
    }

    // Genre: checkbox changes
    if (this.elements.genreCheckboxes) {
      this.elements.genreCheckboxes.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          this.syncArrayFromCheckboxes('genres', this.elements.genreCheckboxes);
          this.emitChange();
        }
      });
    }

    // Series: checkbox changes
    if (this.elements.seriesCheckboxes) {
      this.elements.seriesCheckboxes.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox') {
          this.syncArrayFromCheckboxes('seriesIds', this.elements.seriesCheckboxes);
          this.updateSeriesSortVisibility();
          this.emitChange();
        }
      });
    }

    this.elements.reset.addEventListener('click', () => {
      this.reset();
      this.emitChange();
    });

    // Toggle more/less filters
    if (this.elements.moreFiltersToggle && this.elements.secondaryFilters) {
      this.elements.moreFiltersToggle.addEventListener('click', () => {
        this.toggleSecondaryFilters();
      });
    }
  }

  /**
   * Sync filter array from checkbox container
   * @param {string} filterKey - Key in this.filters (e.g., 'statuses', 'genres')
   * @param {HTMLElement} container - Container with checkboxes
   */
  syncArrayFromCheckboxes(filterKey, container) {
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    this.filters[filterKey] = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }

  /**
   * Toggle secondary filters visibility
   */
  toggleSecondaryFilters() {
    const isHidden = this.elements.secondaryFilters.classList.contains('hidden');
    this.elements.secondaryFilters.classList.toggle('hidden');

    // Update toggle button text and icon
    const icon = this.elements.moreFiltersToggle.querySelector('i');
    const text = this.elements.moreFiltersToggle.querySelector('span');
    if (icon) {
      icon.classList.toggle('rotate-180', isHidden);
    }
    if (text) {
      text.textContent = isHidden ? 'Less filters' : 'More filters';
    }
    initIcons();
  }

  /**
   * Populate genre checkboxes
   */
  populateGenres() {
    if (!this.elements.genreCheckboxes) return;

    this.elements.genreCheckboxes.innerHTML = '';

    if (this.genres.length === 0) {
      this.elements.genreCheckboxes.innerHTML = '<p class="text-sm text-gray-400 italic">No genres defined</p>';
      return;
    }

    for (const genre of this.genres) {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 cursor-pointer';
      label.innerHTML = `
        <input type="checkbox" value="${genre.id}" class="filter-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
        <span class="filter-label">${genre.name}</span>
        <span class="filter-count text-xs text-gray-400"></span>
      `;
      this.elements.genreCheckboxes.appendChild(label);
    }
  }

  /**
   * Populate series checkboxes
   */
  populateSeries() {
    if (!this.elements.seriesCheckboxes) return;

    this.elements.seriesCheckboxes.innerHTML = '';

    if (this.series.length === 0) {
      this.elements.seriesCheckboxes.innerHTML = '<p class="text-sm text-gray-400 italic">No series defined</p>';
      return;
    }

    for (const s of this.series) {
      const label = document.createElement('label');
      label.className = 'flex items-center gap-2 cursor-pointer';
      label.innerHTML = `
        <input type="checkbox" value="${s.id}" class="filter-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0" />
        <span class="filter-label">${s.name}</span>
        <span class="filter-count text-xs text-gray-400"></span>
      `;
      this.elements.seriesCheckboxes.appendChild(label);
    }
  }

  /**
   * Update genres list and re-populate checkboxes
   * @param {Array} genres - New genres array
   */
  setGenres(genres) {
    this.genres = genres || [];
    this.populateGenres();
    // Filter out any selected genres that no longer exist
    const validGenreIds = new Set(this.genres.map(g => g.id));
    this.filters.genres = this.filters.genres.filter(id => validGenreIds.has(id));
    this.syncUIFromState();
  }

  /**
   * Update series list and re-populate checkboxes
   * @param {Array} series - New series array
   */
  setSeries(series) {
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
  updateSeriesSortVisibility() {
    if (!this.elements.sort) return;

    const seriesSortOption = this.elements.sort.querySelector('.series-sort-option');
    if (seriesSortOption) {
      // Show series sort when exactly one series is selected
      seriesSortOption.classList.toggle('hidden', this.filters.seriesIds.length !== 1);
    }
  }

  /**
   * Update UI elements with book counts
   * @param {Object} counts - { genres: { id: count }, ratings: { 5: n, 4: n }, status: { reading: n }, series: { id: count } }
   */
  setBookCounts(counts) {
    if (!counts) return;

    // Update status checkboxes with counts
    if (this.elements.statusCheckboxes && counts.status) {
      const labels = this.elements.statusCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input');
        const countSpan = label.querySelector('.filter-count');
        const val = checkbox.value;
        let count = 0;

        if (val === 'reading') {
          count = counts.status.reading || 0;
        } else if (val === 'finished') {
          count = counts.status.finished || 0;
        }

        if (countSpan) {
          countSpan.textContent = `(${count})`;
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
      const cumulative = { '0': counts.ratingTotal || 0, '5': r5, '4': r4, '3': r3, '2': r2, '1': r1 };

      options.forEach(opt => {
        const val = opt.value;
        const count = cumulative[val] || 0;
        if (val === '0') {
          opt.textContent = `All Ratings (${count})`;
          opt.disabled = false; // "All" always enabled
        } else if (val === '5') {
          opt.textContent = `5 Stars (${count})`;
          opt.disabled = count === 0;
        } else {
          opt.textContent = `${val}+ Stars (${count})`;
          opt.disabled = count === 0;
        }
      });
    }

    // Update genre checkboxes with counts
    if (this.elements.genreCheckboxes && counts.genres) {
      const labels = this.elements.genreCheckboxes.querySelectorAll('label');
      labels.forEach(label => {
        const checkbox = label.querySelector('input');
        const countSpan = label.querySelector('.filter-count');
        const genreId = checkbox.value;
        const count = counts.genres[genreId] || 0;

        if (countSpan) {
          countSpan.textContent = `(${count})`;
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
        const checkbox = label.querySelector('input');
        const countSpan = label.querySelector('.filter-count');
        const seriesId = checkbox.value;
        const count = counts.series[seriesId] || 0;

        if (countSpan) {
          countSpan.textContent = `(${count})`;
        }
        checkbox.disabled = count === 0;
        label.classList.toggle('opacity-50', count === 0);
        label.classList.toggle('cursor-not-allowed', count === 0);
        label.classList.toggle('cursor-pointer', count > 0);
      });
    }

    // Store counts
    this.bookCounts = counts;
  }

  /**
   * Sync UI elements to match current filter state
   */
  syncUIFromState() {
    if (this.elements.sort) {
      this.elements.sort.value = this.filters.sort;
    }

    // Status checkboxes
    if (this.elements.statusCheckboxes) {
      const checkboxes = this.elements.statusCheckboxes.querySelectorAll('input');
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
      const checkboxes = this.elements.genreCheckboxes.querySelectorAll('input');
      checkboxes.forEach(cb => {
        cb.checked = this.filters.genres.includes(cb.value);
      });
    }

    // Series checkboxes
    if (this.elements.seriesCheckboxes) {
      const checkboxes = this.elements.seriesCheckboxes.querySelectorAll('input');
      checkboxes.forEach(cb => {
        cb.checked = this.filters.seriesIds.includes(cb.value);
      });
    }

    this.updateSeriesSortVisibility();
  }

  /**
   * Get current filter state
   * @returns {Object} Current filters
   */
  getFilters() {
    return {
      sort: this.filters.sort,
      rating: this.filters.rating,
      genres: [...this.filters.genres],
      statuses: [...this.filters.statuses],
      seriesIds: [...this.filters.seriesIds]
    };
  }

  /**
   * Set filter state (does not trigger onChange)
   * @param {Object} filters - Filter values to set
   */
  setFilters(filters) {
    if (filters.sort !== undefined) this.filters.sort = filters.sort;
    if (filters.rating !== undefined) this.filters.rating = filters.rating;
    if (filters.genres !== undefined) this.filters.genres = [...filters.genres];
    if (filters.statuses !== undefined) this.filters.statuses = [...filters.statuses];
    if (filters.seriesIds !== undefined) this.filters.seriesIds = [...filters.seriesIds];
    this.syncUIFromState();
  }

  /**
   * Get number of active filters (excluding sort)
   * @returns {number} Count of non-default filters
   */
  getActiveCount() {
    let count = 0;
    if (this.filters.rating > 0) count++;
    count += this.filters.genres.length;
    count += this.filters.statuses.length;
    count += this.filters.seriesIds.length;
    return count;
  }

  /**
   * Check if any filters are active (excluding sort)
   * @returns {boolean} True if any filter is active
   */
  hasActiveFilters() {
    return this.getActiveCount() > 0;
  }

  /**
   * Reset all filters to defaults
   */
  reset() {
    this.filters = {
      sort: 'createdAt-desc',
      rating: 0,
      genres: [],
      statuses: [],
      seriesIds: []
    };
    this.syncUIFromState();
  }

  /**
   * Emit change event if callback is set
   */
  emitChange() {
    if (this.onChange) {
      this.onChange(this.getFilters());
    }
  }

  /**
   * Destroy the component and clean up
   */
  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.elements = {};
    this.onChange = null;
    this.container = null;
  }
}
