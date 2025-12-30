// Shared Book Card Component
import {
  escapeHtml,
  renderStars,
  formatDate,
  getContrastColor,
  getBookStatus,
  isValidImageUrl,
  normalizeText,
} from '../utils.js';
import type { Book, Genre, Series } from '../types/index.d.ts';

// Maximum number of genre badges to show
const MAX_GENRE_BADGES = 3;

/**
 * Highlight matching text in a string (case-insensitive)
 * @param text - Original text
 * @param query - Search query to highlight (normalized)
 * @returns HTML string with highlighted matches
 */
function highlightMatch(text: string | null | undefined, query: string): string {
  if (!text || !query) return escapeHtml(text || '');

  // Normalize the text for matching but keep original for display
  const normalizedText = normalizeText(text);
  const escapedText = escapeHtml(text);

  // Find all match positions in normalized text
  const matches: Array<{ start: number; end: number }> = [];
  let pos = 0;
  while ((pos = normalizedText.indexOf(query, pos)) !== -1) {
    matches.push({ start: pos, end: pos + query.length });
    pos += 1;
  }

  if (matches.length === 0) return escapedText;

  // Build result with highlights (working with original text positions)
  let result = '';
  let lastEnd = 0;

  for (const match of matches) {
    // Add text before match
    result += escapeHtml(text.substring(lastEnd, match.start));
    // Add highlighted match
    result += `<mark class="bg-yellow-200 text-yellow-900 rounded px-0.5">${escapeHtml(text.substring(match.start, match.end))}</mark>`;
    lastEnd = match.end;
  }

  // Add remaining text
  result += escapeHtml(text.substring(lastEnd));

  return result;
}

// Maximum series name length before truncation
const MAX_SERIES_NAME_LENGTH = 20;

// Status badge configuration (status inferred from reads array)
interface StatusConfig {
  icon: string;
  label: string;
  bgClass: string;
  textClass: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  reading: { icon: 'book-open', label: 'Reading', bgClass: 'bg-blue-100', textClass: 'text-blue-700' },
  finished: { icon: 'check-circle', label: 'Finished', bgClass: 'bg-green-100', textClass: 'text-green-700' },
};

/**
 * Render status badge for a book
 * @param status - Book status (want-to-read, reading, finished)
 * @returns HTML string for status badge
 */
function renderStatusBadge(status: string | null): string {
  if (!status || !STATUS_CONFIG[status]) return '';

  const config = STATUS_CONFIG[status];
  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.bgClass} ${config.textClass}">
    <i data-lucide="${config.icon}" class="w-3 h-3"></i>
    <span>${config.label}</span>
  </span>`;
}

/**
 * Render series badge for a book
 * @param series - Series object with name
 * @param position - Book's position in series
 * @returns HTML string for series badge
 */
function renderSeriesBadge(series: Series | undefined, position: number | null | undefined): string {
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
 * @param genreDetails - Array of genre objects with id, name, color
 * @returns HTML string for genre badges
 */
function renderGenreBadges(genreDetails: Genre[]): string {
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

/** Options for bookCard function */
export interface BookCardOptions {
  /** Whether to show the date added (default: false) */
  showDate?: boolean;
  /** Map of genreId -> genre object for enriching genres */
  genreLookup?: Map<string, Genre> | null;
  /** Map of seriesId -> series object for enriching series */
  seriesLookup?: Map<string, Series> | null;
  /** Normalized search query to highlight in title/author */
  highlightQuery?: string;
  /** Additional CSS class(es) to add to the card */
  className?: string;
  /** Animation delay in ms for stagger effect */
  animationDelay?: number;
}

/**
 * Generate HTML for a book card
 * @param book - Book object with id, title, author, coverImageUrl, rating, createdAt
 * @param options - Optional settings
 * @returns HTML string for the book card
 */
export function bookCard(book: Book, options: BookCardOptions = {}): string {
  const {
    showDate = false,
    genreLookup = null,
    seriesLookup = null,
    highlightQuery = '',
    className = '',
    animationDelay = 0,
  } = options;

  const cover =
    book.coverImageUrl && isValidImageUrl(book.coverImageUrl)
      ? `<div class="book-cover-wrapper">
        <div class="book-cover-placeholder"><i data-lucide="book"></i></div>
        <div class="book-cover-spinner"><i data-lucide="loader-2" class="w-6 h-6 text-gray-400 animate-spin"></i></div>
        <img src="${escapeHtml(book.coverImageUrl)}" alt="" class="book-cover" loading="lazy" onload="this.previousElementSibling.style.display='none'" onerror="this.style.display='none';this.previousElementSibling.style.display='none'">
      </div>`
      : `<div class="book-cover-placeholder"><i data-lucide="book"></i></div>`;

  const rating = book.rating ? `<div class="rating-stars">${renderStars(book.rating)}</div>` : '';

  // Resolve genre IDs to genre objects (sorted alphabetically)
  let genreBadges = '';
  if (book.genres && book.genres.length > 0 && genreLookup) {
    const genreDetails = book.genres
      .map(gId => genreLookup.get(gId))
      .filter((g): g is Genre => Boolean(g))
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

  // Highlight title and author if search query provided
  const titleHtml = highlightQuery ? highlightMatch(book.title, highlightQuery) : escapeHtml(book.title);
  const authorHtml = highlightQuery
    ? highlightMatch(book.author || 'Unknown author', highlightQuery)
    : escapeHtml(book.author || 'Unknown author');

  // Build class list
  const classes = ['book-card', className].filter(Boolean).join(' ');

  // Build style for animation delay
  const style = animationDelay > 0 ? ` style="animation-delay: ${animationDelay}ms"` : '';

  return `
    <a href="/books/view/?id=${book.id}" class="${classes}"${style}>
      ${cover}
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-900 truncate">${titleHtml}</h3>
        <p class="text-sm text-gray-500 truncate">${authorHtml}</p>
        ${topBadges ? `<div class="flex flex-wrap gap-1 mt-1">${topBadges}</div>` : ''}
        ${rating ? `<div class="mt-1">${rating}</div>` : ''}
        ${genreBadges}
        ${dateStr}
      </div>
    </a>
  `;
}
