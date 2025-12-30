// Breadcrumb Navigation Component
import { initIcons, escapeHtml } from '../utils.js';

/**
 * Render breadcrumb navigation
 * @param {HTMLElement} container - The <ol> element to render into
 * @param {Array<{label: string, href?: string, current?: boolean, truncate?: boolean}>} items
 */
export function renderBreadcrumbs(container, items) {
  if (!container || !items?.length) return;

  const html = items
    .map((item, index) => {
      const isLast = index === items.length - 1;
      const isFirst = index === 0;

      const separator = isFirst
        ? ''
        : `
      <i data-lucide="chevron-right" class="w-4 h-4 text-gray-400 mx-1 flex-shrink-0" aria-hidden="true"></i>
    `;

      const truncateClass = item.truncate ? 'truncate max-w-[150px] sm:max-w-[250px] md:max-w-none' : '';

      if (isLast || item.current) {
        // Current page - non-clickable
        return `<li class="flex items-center min-w-0">${separator}
        <span class="text-gray-900 font-medium ${truncateClass}" aria-current="page">${escapeHtml(item.label)}</span>
      </li>`;
      }

      // Clickable ancestor
      return `<li class="flex items-center min-w-0">${separator}
      <a href="${escapeHtml(item.href)}" class="text-gray-500 hover:text-primary hover:underline ${truncateClass}">${escapeHtml(item.label)}</a>
    </li>`;
    })
    .join('');

  container.innerHTML = html;
  initIcons();
}

/**
 * Preset breadcrumb configurations
 */
export const Breadcrumbs = {
  bookView: (title, _id) => [
    { label: 'Books', href: '/books/' },
    { label: title || 'Book', current: true, truncate: true },
  ],

  bookEdit: (title, id) => [
    { label: 'Books', href: '/books/' },
    { label: title || 'Book', href: `/books/view/?id=${id}`, truncate: true },
    { label: 'Edit', current: true },
  ],

  bookAdd: () => [
    { label: 'Books', href: '/books/' },
    { label: 'Add Book', current: true },
  ],

  settings: () => [
    { label: 'Home', href: '/' },
    { label: 'Settings', current: true },
  ],
};
