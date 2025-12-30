// DOM Utilities - DOM manipulation and UI helpers

declare const lucide: {
  createIcons: (options?: { root?: HTMLElement }) => void;
};

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape attribute values for safe HTML insertion
 */
export function escapeAttr(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Track scroll lock state
let scrollLockCount = 0;
let savedScrollY = 0;

/**
 * Lock body scroll (for modals/bottom sheets)
 * Uses position: fixed technique for iOS Safari compatibility
 */
export function lockBodyScroll(): void {
  scrollLockCount++;

  // Only apply styles on first lock
  if (scrollLockCount === 1) {
    savedScrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Unlock body scroll (when modal/bottom sheet closes)
 * Restores scroll position
 */
export function unlockBodyScroll(): void {
  if (scrollLockCount > 0) {
    scrollLockCount--;
  }

  // Only remove styles when all locks are released
  if (scrollLockCount === 0) {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.overflow = '';
    window.scrollTo(0, savedScrollY);
  }
}

/**
 * Initialize Lucide icons (call sparingly)
 * @param container - Optional container to scope icon initialization
 */
export function initIcons(container?: HTMLElement | unknown): void {
  if (typeof lucide !== 'undefined') {
    // Only use container if it's a valid HTMLElement (not an Event or other object)
    if (container instanceof HTMLElement) {
      lucide.createIcons({ root: container });
    } else {
      lucide.createIcons();
    }
  }
}

/** Star button element with data-rating attribute */
interface StarButton extends HTMLElement {
  dataset: {
    rating: string;
  };
}

/**
 * Update rating star buttons to reflect current rating
 * @param starBtns - Star button elements with data-rating attribute
 * @param currentRating - Current rating value (1-5)
 */
export function updateRatingStars(starBtns: NodeListOf<StarButton> | StarButton[], currentRating: number): void {
  starBtns.forEach(btn => {
    const rating = parseInt(btn.dataset.rating);
    btn.classList.toggle('active', rating <= currentRating);
  });
  initIcons();
}

/**
 * Check if viewport is mobile-sized (matches Tailwind's md breakpoint)
 * @returns True if mobile
 */
export function isMobile(): boolean {
  return window.innerWidth < 768;
}

/**
 * Get contrasting text color (black or white) for a given background hex color
 * Uses relative luminance formula for accessibility
 */
export function getContrastColor(hex: string | null | undefined): string {
  if (!hex || typeof hex !== 'string') return '#000000';

  // Remove # if present
  const cleanHex = hex.replace('#', '');

  // Parse RGB values
  const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
  const b = parseInt(cleanHex.substr(4, 2), 16) / 255;

  // Calculate relative luminance using sRGB formula
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Return white for dark backgrounds, black for light
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/** Options for interceptNavigation */
export interface InterceptNavigationOptions {
  /** Function that returns true if form has unsaved changes */
  isDirty: () => boolean;
  /** Async function that shows confirmation, returns true if confirmed */
  showConfirmation: () => Promise<boolean>;
  /** Optional cleanup before navigation */
  onBeforeNavigate?: () => void | Promise<void>;
}

/**
 * Intercept in-app navigation links when form has unsaved changes.
 * Shows a confirmation dialog instead of allowing immediate navigation.
 * Note: This only works for in-app links. Browser back/refresh/close
 * still requires beforeunload (browser limitation).
 */
export function interceptNavigation({ isDirty, showConfirmation, onBeforeNavigate }: InterceptNavigationOptions): void {
  // Intercept header nav links and breadcrumbs
  document.querySelectorAll<HTMLAnchorElement>('header a[href], nav a[href]').forEach(link => {
    link.addEventListener('click', async (e: Event) => {
      if (!isDirty()) return; // No unsaved changes, allow navigation

      e.preventDefault();
      const confirmed = await showConfirmation();

      if (confirmed) {
        if (onBeforeNavigate) await onBeforeNavigate();
        window.location.href = link.href;
      }
    });
  });
}
