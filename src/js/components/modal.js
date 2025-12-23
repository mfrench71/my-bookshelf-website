// Reusable Modal Component
import { lockBodyScroll, unlockBodyScroll, initIcons } from '../utils.js';

/**
 * Modal - Reusable modal dialog component
 *
 * @example
 * const modal = new Modal({
 *   container: document.getElementById('my-modal'),
 *   onClose: () => console.log('Modal closed')
 * });
 * modal.open();
 */
export class Modal {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Existing modal element or container to render into
   * @param {Function} options.onOpen - Callback when modal opens
   * @param {Function} options.onClose - Callback when modal closes
   * @param {boolean} options.closeOnBackdrop - Close when clicking backdrop (default: true)
   * @param {boolean} options.closeOnEscape - Close on Escape key (default: true)
   */
  constructor(options = {}) {
    this.container = options.container;
    this.onOpen = options.onOpen || (() => {});
    this.onClose = options.onClose || (() => {});
    this.closeOnBackdrop = options.closeOnBackdrop !== false;
    this.closeOnEscape = options.closeOnEscape !== false;
    this.isOpen = false;

    if (this.container) {
      this.bindEvents();
    }
  }

  /**
   * Bind event handlers
   */
  bindEvents() {
    // Click on backdrop to close
    if (this.closeOnBackdrop) {
      this.container.addEventListener('click', (e) => {
        if (e.target === this.container) {
          this.close();
        }
      });
    }

    // Escape key to close
    if (this.closeOnEscape) {
      this.escapeHandler = (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);
    }
  }

  /**
   * Open the modal
   */
  open() {
    if (this.isOpen) return;

    this.container.classList.remove('hidden');
    lockBodyScroll();
    this.isOpen = true;
    initIcons();
    this.onOpen();
  }

  /**
   * Close the modal
   */
  close() {
    if (!this.isOpen) return;

    this.container.classList.add('hidden');
    unlockBodyScroll();
    this.isOpen = false;
    this.onClose();
  }

  /**
   * Toggle modal open/closed
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if modal is currently open
   * @returns {boolean}
   */
  getIsOpen() {
    return this.isOpen;
  }

  /**
   * Destroy the modal and remove event listeners
   */
  destroy() {
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }
    if (this.isOpen) {
      this.close();
    }
  }
}

/**
 * ConfirmModal - Confirmation dialog with cancel/confirm buttons
 *
 * @example
 * const confirm = new ConfirmModal({
 *   title: 'Delete Book?',
 *   message: 'This action cannot be undone.',
 *   confirmText: 'Delete',
 *   confirmClass: 'bg-red-600 hover:bg-red-700',
 *   onConfirm: () => deleteBook()
 * });
 * confirm.show();
 */
export class ConfirmModal extends Modal {
  /**
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.message - Confirmation message
   * @param {string} options.confirmText - Confirm button text (default: 'Confirm')
   * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
   * @param {string} options.confirmClass - Confirm button CSS classes
   * @param {Function} options.onConfirm - Callback when confirmed
   * @param {Function} options.onCancel - Callback when cancelled
   */
  constructor(options = {}) {
    // Create modal element if not provided
    const container = options.container || ConfirmModal.createContainer();
    super({ ...options, container });

    this.title = options.title || 'Confirm';
    this.message = options.message || 'Are you sure?';
    this.confirmText = options.confirmText || 'Confirm';
    this.cancelText = options.cancelText || 'Cancel';
    this.confirmClass = options.confirmClass || 'bg-primary hover:bg-primary-dark';
    this.onConfirm = options.onConfirm || (() => {});
    this.onCancel = options.onCancel || (() => {});

    this.render();
    this.bindConfirmEvents();
  }

  /**
   * Create a modal container element
   */
  static createContainer() {
    const container = document.createElement('div');
    container.className = 'hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
    document.body.appendChild(container);
    return container;
  }

  /**
   * Render modal content
   */
  render() {
    this.container.innerHTML = `
      <div class="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h3 class="confirm-title text-lg font-semibold mb-2">${this.title}</h3>
        <p class="confirm-message text-gray-600 mb-6">${this.message}</p>
        <div class="flex gap-3">
          <button class="cancel-btn flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
            ${this.cancelText}
          </button>
          <button class="confirm-btn flex-1 px-4 py-2 text-white rounded-lg transition-colors ${this.confirmClass}">
            ${this.confirmText}
          </button>
        </div>
      </div>
    `;

    this.elements = {
      title: this.container.querySelector('.confirm-title'),
      message: this.container.querySelector('.confirm-message'),
      cancelBtn: this.container.querySelector('.cancel-btn'),
      confirmBtn: this.container.querySelector('.confirm-btn')
    };
  }

  /**
   * Bind confirm/cancel button events
   */
  bindConfirmEvents() {
    this.elements.cancelBtn.addEventListener('click', () => {
      this.onCancel();
      this.close();
    });

    this.elements.confirmBtn.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });
  }

  /**
   * Update modal content
   * @param {Object} options - title, message, confirmText, cancelText
   */
  setContent(options) {
    if (options.title) {
      this.title = options.title;
      this.elements.title.textContent = options.title;
    }
    if (options.message) {
      this.message = options.message;
      this.elements.message.textContent = options.message;
    }
    if (options.confirmText) {
      this.confirmText = options.confirmText;
      this.elements.confirmBtn.textContent = options.confirmText;
    }
    if (options.cancelText) {
      this.cancelText = options.cancelText;
      this.elements.cancelBtn.textContent = options.cancelText;
    }
  }

  /**
   * Show the modal (alias for open)
   */
  show() {
    this.open();
  }

  /**
   * Set loading state on confirm button
   * @param {boolean} loading
   */
  setLoading(loading) {
    this.elements.confirmBtn.disabled = loading;
    this.elements.cancelBtn.disabled = loading;
    if (loading) {
      this.elements.confirmBtn.textContent = 'Loading...';
    } else {
      this.elements.confirmBtn.textContent = this.confirmText;
    }
  }
}
