// Toast Store - Toast notification state management with queue support

import { escapeHtml, initIcons } from '../utils.js';

/** Toast type */
type ToastType = 'success' | 'error' | 'info';

/** Toast data for display/queue */
interface ToastData {
  message: string;
  duration: number;
  type: ToastType;
}

/** Toast state for tracking active toasts */
interface ToastState {
  element: HTMLElement;
  timeout: ReturnType<typeof setTimeout> | null;
  isPaused: boolean;
  isSwiping?: boolean;
  remainingTime?: number;
  startTime?: number;
}

/** Toast options */
interface ToastOptions {
  duration?: number;
  type?: ToastType;
}

// Toast queue and state management
const MAX_VISIBLE_TOASTS = 3;
const toastQueue: ToastData[] = [];
let activeToasts: ToastState[] = [];

// Icon names for each toast type
const TOAST_ICONS: Record<ToastType, string> = {
  success: 'check-circle',
  error: 'x-circle',
  info: 'info',
};

/**
 * Get or create the toast container element
 * @returns The toast container
 */
function getToastContainer(): HTMLElement {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className =
      'fixed bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 flex flex-col-reverse gap-2 pointer-events-none';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Create a toast element
 * @param message - The message to display
 * @param type - Toast type ('success', 'error', 'info')
 * @returns The toast element
 */
function createToastElement(message: string, type: ToastType): HTMLElement {
  const toast = document.createElement('div');
  toast.className =
    'toast-item px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 cursor-pointer pointer-events-auto opacity-0';

  // Type-specific colours
  const typeClasses: Record<ToastType, string> = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white',
  };

  toast.classList.add(...(typeClasses[type] || typeClasses.info).split(' '));

  // Error toasts use role="alert" for immediate screen reader announcement
  if (type === 'error') {
    toast.setAttribute('role', 'alert');
  }

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
    <span class="flex-1">${escapeHtml(message)}</span>
  `;

  initIcons(toast);
  return toast;
}

/**
 * Show a toast notification with queue support
 * @param message - The message to display
 * @param options - Optional settings
 */
export function showToast(message: string, options: ToastOptions | number = {}): void {
  const { duration = 3000, type = 'info' } = typeof options === 'number' ? { duration: options } : options;

  const toastData: ToastData = { message, duration, type };

  // If we have room, show immediately; otherwise queue
  if (activeToasts.length < MAX_VISIBLE_TOASTS) {
    displayToast(toastData);
  } else {
    toastQueue.push(toastData);
  }
}

/**
 * Display a toast immediately
 * @param toastData - Toast configuration
 */
function displayToast(toastData: ToastData): void {
  const { message, duration, type } = toastData;
  const container = getToastContainer();
  const toast = createToastElement(message, type);

  // Track this toast
  const toastState: ToastState = {
    element: toast,
    timeout: null,
    isPaused: false,
  };
  activeToasts.push(toastState);

  // Add to container
  container.appendChild(toast);

  // Trigger enter animation after a frame
  requestAnimationFrame(() => {
    toast.classList.remove('opacity-0');
    toast.classList.add('toast-queue-enter');
  });

  // Dismiss handlers
  const dismiss = (): void => dismissToast(toastState);

  // Click to dismiss (only if not swiping)
  toast.addEventListener('click', _e => {
    if (!toastState.isSwiping) dismiss();
  });

  // Pause on hover/focus
  toast.addEventListener('mouseenter', () => pauseToast(toastState));
  toast.addEventListener('mouseleave', () => resumeToast(toastState, duration));
  toast.addEventListener('focus', () => pauseToast(toastState));
  toast.addEventListener('blur', () => resumeToast(toastState, duration));

  // Swipe-to-dismiss (touch devices)
  setupSwipeToDismiss(toast, toastState, duration);

  // Schedule auto-dismiss
  scheduleAutoDismiss(toastState, duration);
}

/**
 * Schedule auto-dismiss for a toast
 * @param toastState - Toast state object
 * @param duration - Duration in ms
 */
function scheduleAutoDismiss(toastState: ToastState, duration: number): void {
  toastState.remainingTime = duration;
  toastState.startTime = Date.now();
  toastState.timeout = setTimeout(() => {
    dismissToast(toastState);
  }, duration);
}

/**
 * Pause toast auto-dismiss (on hover/focus)
 * @param toastState - Toast state object
 */
function pauseToast(toastState: ToastState): void {
  if (toastState.isPaused || !toastState.timeout) return;
  toastState.isPaused = true;
  clearTimeout(toastState.timeout);
  toastState.timeout = null;
  // Calculate remaining time
  toastState.remainingTime! -= Date.now() - toastState.startTime!;
}

/**
 * Resume toast auto-dismiss (on mouse leave/blur)
 * @param toastState - Toast state object
 * @param originalDuration - Original duration (fallback)
 */
function resumeToast(toastState: ToastState, originalDuration: number): void {
  if (!toastState.isPaused) return;
  toastState.isPaused = false;
  const remaining = Math.max(toastState.remainingTime || originalDuration, 500);
  toastState.startTime = Date.now();
  toastState.timeout = setTimeout(() => {
    dismissToast(toastState);
  }, remaining);
}

/**
 * Set up swipe-to-dismiss gesture for touch devices
 * @param toast - Toast element
 * @param toastState - Toast state object
 * @param duration - Original duration
 */
function setupSwipeToDismiss(toast: HTMLElement, toastState: ToastState, duration: number): void {
  let startX = 0;
  let currentX = 0;
  const SWIPE_THRESHOLD = 80; // pixels to trigger dismiss

  toast.addEventListener(
    'touchstart',
    e => {
      startX = e.touches[0].clientX;
      currentX = startX;
      toastState.isSwiping = false;
      toast.style.transition = 'none';
      pauseToast(toastState);
    },
    { passive: true }
  );

  toast.addEventListener(
    'touchmove',
    e => {
      currentX = e.touches[0].clientX;
      const diffX = currentX - startX;

      // Only allow swiping right (positive direction)
      if (diffX > 10) {
        toastState.isSwiping = true;
        toast.style.transform = `translateX(${diffX}px)`;
        toast.style.opacity = String(Math.max(0.3, 1 - diffX / 150));
      }
    },
    { passive: true }
  );

  toast.addEventListener(
    'touchend',
    () => {
      const diffX = currentX - startX;
      toast.style.transition = '';

      if (diffX > SWIPE_THRESHOLD) {
        // Swipe complete - dismiss with slide out animation
        toast.style.transform = `translateX(100%)`;
        toast.style.opacity = '0';
        setTimeout(() => dismissToast(toastState), 150);
      } else {
        // Reset position
        toast.style.transform = '';
        toast.style.opacity = '';
        resumeToast(toastState, duration);
      }

      // Reset swiping state after a short delay (to prevent click firing)
      setTimeout(() => {
        toastState.isSwiping = false;
      }, 50);
    },
    { passive: true }
  );
}

/**
 * Dismiss a toast with exit animation
 * @param toastState - Toast state object
 */
function dismissToast(toastState: ToastState): void {
  const { element, timeout } = toastState;

  // Clear timeout if still pending
  if (timeout) {
    clearTimeout(timeout);
    toastState.timeout = null;
  }

  // Remove from active list
  activeToasts = activeToasts.filter(t => t !== toastState);

  // Exit animation
  element.classList.remove('toast-queue-enter');
  element.classList.add('toast-queue-exit');

  // Remove after animation
  setTimeout(() => {
    element.remove();

    // Process queue if there are waiting toasts
    if (toastQueue.length > 0 && activeToasts.length < MAX_VISIBLE_TOASTS) {
      const next = toastQueue.shift();
      if (next) displayToast(next);
    }
  }, 150);
}

/**
 * Clear all toasts immediately
 */
export function clearAllToasts(): void {
  // Clear queue
  toastQueue.length = 0;

  // Dismiss all active toasts
  [...activeToasts].forEach(toastState => {
    dismissToast(toastState);
  });
}

/**
 * Reset toast state (for testing purposes)
 * Clears all toasts and removes the container
 */
export function resetToastState(): void {
  // Clear all timeouts
  activeToasts.forEach(toastState => {
    if (toastState.timeout) {
      clearTimeout(toastState.timeout);
    }
  });

  // Clear arrays
  toastQueue.length = 0;
  activeToasts = [];

  // Remove container if it exists
  const container = document.getElementById('toast-container');
  if (container) {
    container.remove();
  }
}
