// Shared Book Card Component
import { escapeHtml, renderStars, formatDate, getContrastColor } from './utils.js';

// Maximum number of genre badges to show
const MAX_GENRE_BADGES = 3;

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
 * @returns {string} HTML string for the book card
 */
export function bookCard(book, options = {}) {
  const { showDate = false, genreLookup = null } = options;

  const cover = book.coverImageUrl
    ? `<img src="${book.coverImageUrl}" alt="" class="book-cover" loading="lazy">`
    : `<div class="book-cover-placeholder"><i data-lucide="book"></i></div>`;

  const rating = book.rating
    ? `<div class="rating-stars">${renderStars(book.rating)}</div>`
    : '';

  // Resolve genre IDs to genre objects
  let genreBadges = '';
  if (book.genres && book.genres.length > 0 && genreLookup) {
    const genreDetails = book.genres
      .map(gId => genreLookup.get(gId))
      .filter(Boolean);
    genreBadges = renderGenreBadges(genreDetails);
  }

  let dateStr = '';
  if (showDate) {
    const dateAdded = formatDate(book.createdAt);
    dateStr = dateAdded ? `<p class="text-xs text-gray-400 mt-1">Added ${dateAdded}</p>` : '';
  }

  return `
    <a href="/book/?id=${book.id}" class="book-card">
      ${cover}
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate">${escapeHtml(book.title)}</h3>
        <p class="text-sm text-gray-500 truncate">${escapeHtml(book.author || 'Unknown author')}</p>
        ${rating ? `<div class="mt-1">${rating}</div>` : ''}
        ${genreBadges}
        ${dateStr}
      </div>
    </a>
  `;
}
