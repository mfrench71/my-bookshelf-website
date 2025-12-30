// Breadcrumb Navigation Component
import { initIcons, escapeHtml } from '../utils.js';

/** Breadcrumb item configuration */
export interface BreadcrumbItem {
  /** Display label */
  label: string;
  /** Link href (omit for current page) */
  href?: string;
  /** Whether this is the current page */
  current?: boolean;
  /** Whether to truncate long labels */
  truncate?: boolean;
}

/**
 * Render breadcrumb navigation
 * @param container - The <ol> element to render into
 * @param items - Array of breadcrumb items
 */
export function renderBreadcrumbs(container: HTMLElement | null, items: BreadcrumbItem[]): void {
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
      <a href="${escapeHtml(item.href ?? '')}" class="text-gray-500 hover:text-primary hover:underline ${truncateClass}">${escapeHtml(item.label)}</a>
    </li>`;
    })
    .join('');

  container.innerHTML = html;
  initIcons();
}

/** Preset breadcrumb configurations */
export const Breadcrumbs = {
  bookView: (title: string, _id: string): BreadcrumbItem[] => [
    { label: 'Books', href: '/books/' },
    { label: title || 'Book', current: true, truncate: true },
  ],

  bookEdit: (title: string, id: string): BreadcrumbItem[] => [
    { label: 'Books', href: '/books/' },
    { label: title || 'Book', href: `/books/view/?id=${id}`, truncate: true },
    { label: 'Edit', current: true },
  ],

  bookAdd: (): BreadcrumbItem[] => [
    { label: 'Books', href: '/books/' },
    { label: 'Add Book', current: true },
  ],

  settings: (): BreadcrumbItem[] => [
    { label: 'Home', href: '/' },
    { label: 'Settings', current: true },
  ],
};
