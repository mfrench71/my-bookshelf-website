// Toast Store - Toast notification state management with queue support

import { escapeHtml, initIcons } from '../utils.js';

// Toast queue and state management
const MAX_VISIBLE_TOASTS = 3;
const toastQueue = [];
let activeToasts = [];

// Icon names for each toast type
const TOAST_ICONS = {
  success: 'check-circle',
  error: 'x-circle',
  info: 'info'
};

/**
 * Get or create the toast container element
 * @returns {HTMLElement} The toast container
 */
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-50 flex flex-col-reverse gap-2 pointer-events-none';
    container.setAttribute('aria-live', 'polite');
    container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Create a toast element
 * @param {string} message - The message to display
 * @param {string} type - Toast type ('success', 'error', 'info')
 * @returns {HTMLElement} The toast element
 */
function createToastElement(message, type) {
  const toast = document.createElement('div');
  toast.className = 'toast-item px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 cursor-pointer pointer-events-auto opacity-0';

  // Type-specific colours
  const typeClasses = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white'
  };

  toast.classList.add(...(typeClasses[type] || typeClasses.info).split(' '));

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
 * @param {string} message - The message to display
 * @param {Object} options - Optional settings
 * @param {number} options.duration - Duration in ms (default: 3000)
 * @param {string} options.type - 'success', 'error', or 'info' (default: 'info')
 */
export function showToast(message, options = {}) {
  const { duration = 3000, type = 'info' } = typeof options === 'number'
    ? { duration: options }
    : options;

  const toastData = { message, duration, type };

  // If we have room, show immediately; otherwise queue
  if (activeToasts.length < MAX_VISIBLE_TOASTS) {
    displayToast(toastData);
  } else {
    toastQueue.push(toastData);
  }
}

/**
 * Display a toast immediately
 * @param {Object} toastData - Toast configuration
 */
function displayToast(toastData) {
  const { message, duration, type } = toastData;
  const container = getToastContainer();
  const toast = createToastElement(message, type);

  // Track this toast
  const toastState = {
    element: toast,
    timeout: null,
    isPaused: false
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
  const dismiss = () => dismissToast(toastState);

  // Click to dismiss
  toast.addEventListener('click', dismiss);

  // Pause on hover/focus
  toast.addEventListener('mouseenter', () => pauseToast(toastState));
  toast.addEventListener('mouseleave', () => resumeToast(toastState, duration));
  toast.addEventListener('focus', () => pauseToast(toastState));
  toast.addEventListener('blur', () => resumeToast(toastState, duration));

  // Schedule auto-dismiss
  scheduleAutoDismiss(toastState, duration);
}

/**
 * Schedule auto-dismiss for a toast
 * @param {Object} toastState - Toast state object
 * @param {number} duration - Duration in ms
 */
function scheduleAutoDismiss(toastState, duration) {
  toastState.remainingTime = duration;
  toastState.startTime = Date.now();
  toastState.timeout = setTimeout(() => {
    dismissToast(toastState);
  }, duration);
}

/**
 * Pause toast auto-dismiss (on hover/focus)
 * @param {Object} toastState - Toast state object
 */
function pauseToast(toastState) {
  if (toastState.isPaused || !toastState.timeout) return;
  toastState.isPaused = true;
  clearTimeout(toastState.timeout);
  toastState.timeout = null;
  // Calculate remaining time
  toastState.remainingTime -= Date.now() - toastState.startTime;
}

/**
 * Resume toast auto-dismiss (on mouse leave/blur)
 * @param {Object} toastState - Toast state object
 * @param {number} originalDuration - Original duration (fallback)
 */
function resumeToast(toastState, originalDuration) {
  if (!toastState.isPaused) return;
  toastState.isPaused = false;
  const remaining = Math.max(toastState.remainingTime || originalDuration, 500);
  toastState.startTime = Date.now();
  toastState.timeout = setTimeout(() => {
    dismissToast(toastState);
  }, remaining);
}

/**
 * Dismiss a toast with exit animation
 * @param {Object} toastState - Toast state object
 */
function dismissToast(toastState) {
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
      displayToast(next);
    }
  }, 150);
}

/**
 * Clear all toasts immediately
 */
export function clearAllToasts() {
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
export function resetToastState() {
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
