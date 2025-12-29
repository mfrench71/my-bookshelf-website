// Toast Store - Toast notification state management

import { escapeHtml, initIcons } from '../utils.js';

// Track toast timeout to clear it when showing a new toast
let toastTimeout = null;
let exitTimeout = null;
// Track click handler to prevent duplicate listeners
let toastClickHandler = null;

// Icon names for each toast type
const TOAST_ICONS = {
  success: 'check-circle',
  error: 'x-circle',
  info: 'info'
};

/**
 * Show a toast notification with slide-in animation
 * @param {string} message - The message to display
 * @param {Object} options - Optional settings
 * @param {number} options.duration - Duration in ms (default: 3000)
 * @param {string} options.type - 'success', 'error', or 'info' (default: 'info')
 */
export function showToast(message, options = {}) {
  const { duration = 3000, type = 'info' } = typeof options === 'number'
    ? { duration: options }
    : options;

  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  // Clear any existing timeouts
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (exitTimeout) {
    clearTimeout(exitTimeout);
    exitTimeout = null;
  }

  // Base classes (animation class added separately, cursor-pointer for tap-to-dismiss)
  const baseClasses = 'fixed bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 cursor-pointer';

  // Type-specific colours
  const typeClasses = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white'
  };

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

  // Set classes with enter animation
  toast.className = `${baseClasses} ${typeClasses[type] || typeClasses.info} toast-enter`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  // Initialise the icon
  initIcons(toast);

  // Remove existing click handler if any
  if (toastClickHandler) {
    toast.removeEventListener('click', toastClickHandler);
  }

  // Add tap-to-dismiss handler
  toastClickHandler = () => dismissToast(toast);
  toast.addEventListener('click', toastClickHandler);

  // Schedule exit animation after duration
  toastTimeout = setTimeout(() => {
    dismissToast(toast);
  }, duration);
}

/**
 * Dismiss the toast with exit animation
 * @param {HTMLElement} toast - The toast element to dismiss
 */
function dismissToast(toast) {
  // Clear any pending timeouts
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  if (exitTimeout) {
    clearTimeout(exitTimeout);
    exitTimeout = null;
  }

  // Apply exit animation
  toast.classList.remove('toast-enter');
  toast.classList.add('toast-exit');

  // Hide completely after exit animation (150ms)
  exitTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    exitTimeout = null;
  }, 150);
}
