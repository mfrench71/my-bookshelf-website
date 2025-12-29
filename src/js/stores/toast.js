// Toast Store - Toast notification state management

import { escapeHtml, initIcons } from '../utils.js';

// Track toast timeout to clear it when showing a new toast
let toastTimeout = null;

// Icon names for each toast type
const TOAST_ICONS = {
  success: 'check-circle',
  error: 'x-circle',
  info: 'info'
};

/**
 * Show a toast notification
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

  // Clear any existing timeout to prevent premature hiding
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  // Base classes
  const baseClasses = 'fixed bottom-6 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3';

  // Type-specific colors
  const typeClasses = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-gray-800 text-white'
  };

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

  toast.className = `${baseClasses} ${typeClasses[type] || typeClasses.info}`;
  toast.innerHTML = `
    <i data-lucide="${icon}" class="w-5 h-5 flex-shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  // Initialize the icon
  initIcons(toast);

  toastTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    toastTimeout = null;
  }, duration);
}
