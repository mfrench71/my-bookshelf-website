// Shared Book Card Component
import { escapeHtml, renderStars, formatDate } from './utils.js';

/**
 * Generate HTML for a book card
 * @param {Object} book - Book object with id, title, author, coverImageUrl, rating, createdAt
 * @param {Object} options - Optional settings
 * @param {boolean} options.showDate - Whether to show the date added (default: false)
 * @returns {string} HTML string for the book card
 */
export function bookCard(book, options = {}) {
  const { showDate = false } = options;

  const cover = book.coverImageUrl
    ? `<img src="${book.coverImageUrl}" alt="" class="book-cover" loading="lazy">`
    : `<div class="book-cover-placeholder"><i data-lucide="book"></i></div>`;

  const rating = book.rating
    ? `<div class="rating-stars">${renderStars(book.rating)}</div>`
    : '';

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
        ${dateStr}
      </div>
    </a>
  `;
}
