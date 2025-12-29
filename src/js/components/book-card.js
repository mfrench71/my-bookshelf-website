// Shared Book Card Component
import { escapeHtml, renderStars, formatDate, getContrastColor, getBookStatus, isValidImageUrl } from '../utils.js';

// Maximum number of genre badges to show
const MAX_GENRE_BADGES = 3;

// Maximum series name length before truncation
const MAX_SERIES_NAME_LENGTH = 20;

// Status badge configuration (status inferred from reads array)
const STATUS_CONFIG = {
  'reading': { icon: 'book-open', label: 'Reading', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  'finished': { icon: 'check-circle', label: 'Finished', bgClass: 'bg-green-100', textClass: 'text-green-700' }
};

/**
 * Render status badge for a book
 * @param {string} status - Book status (want-to-read, reading, finished)
 * @returns {string} HTML string for status badge
 */
function renderStatusBadge(status) {
  if (!status || !STATUS_CONFIG[status]) return '';

  const config = STATUS_CONFIG[status];
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}">
    <i data-lucide="${config.icon}" class="w-3 h-3"></i>
    <span>${config.label}</span>
  </span>`;
}

/**
 * Render series badge for a book
 * @param {Object} series - Series object with name
 * @param {number|null} position - Book's position in series
 * @returns {string} HTML string for series badge
 */
function renderSeriesBadge(series, position) {
  if (!series || !series.name) return '';

  // Truncate long series names
  let displayName = series.name;
  if (displayName.length > MAX_SERIES_NAME_LENGTH) {
    displayName = displayName.substring(0, MAX_SERIES_NAME_LENGTH - 1) + '…';
  }

  const positionStr = position ? ` #${position}` : '';

  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700" title="${escapeHtml(series.name)}${positionStr}">
    <i data-lucide="library" class="w-3 h-3"></i>
    <span>${escapeHtml(displayName)}${positionStr}</span>
  </span>`;
}

/**
 * Render genre badges for a book
 * @param {Array} genreDetails - Array of genre objects with id, name, color
 * @returns {string} HTML string for genre badges
 */
function renderGenreBadges(genreDetails) {
  if (!genreDetails || genreDetails.length === 0) return '';

  const visibleGenres = genreDetails.slice(0, MAX_GENRE_BADGES);
  const remainingCount = genreDetails.length - MAX_GENRE_BADGES;

  let html = '<div class="flex flex-wrap gap-1 mt-1.5">';

  visibleGenres.forEach(genre => {
    const textColor = getContrastColor(genre.color);
    html += `<span class="genre-badge genre-badge-sm" style="background-color: ${genre.color}; color: ${textColor}">${escapeHtml(genre.name)}</span>`;
  });

  if (remainingCount > 0) {
    html += `<span class="genre-badge-count">+${remainingCount}</span>`;
  }

  html += '</div>';
  return html;
}

/**
 * Generate HTML for a book card
 * @param {Object} book - Book object with id, title, author, coverImageUrl, rating, createdAt
 * @param {Object} options - Optional settings
 * @param {boolean} options.showDate - Whether to show the date added (default: false)
 * @param {Map} options.genreLookup - Map of genreId -> genre object for enriching genres
 * @param {Map} options.seriesLookup - Map of seriesId -> series object for enriching series
 * @returns {string} HTML string for the book card
 */
export function bookCard(book, options = {}) {
  const { showDate = false, genreLookup = null, seriesLookup = null } = options;

  const cover = book.coverImageUrl && isValidImageUrl(book.coverImageUrl)
    ? `<div class="book-cover-wrapper">
        <div class="book-cover-placeholder"><i data-lucide="book"></i></div>
        <div class="book-cover-spinner"><i data-lucide="loader-2" class="w-6 h-6 text-gray-400 animate-spin"></i></div>
        <img src="${escapeHtml(book.coverImageUrl)}" alt="" class="book-cover" loading="lazy" onload="this.previousElementSibling.style.display='none'" onerror="this.style.display='none';this.previousElementSibling.style.display='none'">
      </div>`
    : `<div class="book-cover-placeholder"><i data-lucide="book"></i></div>`;

  const rating = book.rating
    ? `<div class="rating-stars">${renderStars(book.rating)}</div>`
    : '';

  // Resolve genre IDs to genre objects (sorted alphabetically)
  let genreBadges = '';
  if (book.genres && book.genres.length > 0 && genreLookup) {
    const genreDetails = book.genres
      .map(gId => genreLookup.get(gId))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
    genreBadges = renderGenreBadges(genreDetails);
  }

  // Resolve series ID to series object
  let seriesBadge = '';
  if (book.seriesId && seriesLookup) {
    const series = seriesLookup.get(book.seriesId);
    seriesBadge = renderSeriesBadge(series, book.seriesPosition);
  }

  let dateStr = '';
  if (showDate) {
    const dateAdded = formatDate(book.createdAt);
    dateStr = dateAdded ? `<p class="text-xs text-gray-400 mt-1">Added ${dateAdded}</p>` : '';
  }

  // Infer status from reads array
  const status = getBookStatus(book);
  const statusBadge = renderStatusBadge(status);

  // Combine status and series badges on same line if both present
  const topBadges = [statusBadge, seriesBadge].filter(Boolean).join(' ');

  return `
    <a href="/books/view/?id=${book.id}" class="book-card card-animate">
      ${cover}
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate">${escapeHtml(book.title)}</h3>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(book.author || 'Unknown author')}</p>
        ${topBadges ? `<div class="flex flex-wrap gap-1 mt-1">${topBadges}</div>` : ''}
        ${rating ? `<div class="mt-1">${rating}</div>` : ''}
        ${genreBadges}
        ${dateStr}
      </div>
    </a>
  `;
}
