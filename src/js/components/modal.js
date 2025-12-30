// Reusable Modal and BottomSheet Components
import { lockBodyScroll, unlockBodyScroll, initIcons, isMobile } from '../utils.js';

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
   * Open the modal with animation
   */
  open() {
    if (this.isOpen) return;

    this.container.classList.remove('hidden');
    this.container.classList.remove('modal-exit');
    this.container.classList.add('modal-backdrop');

    // Add ARIA attributes for accessibility
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');

    // Set aria-labelledby if title element exists
    const titleEl = this.container.querySelector('[class*="title"], h2, h3');
    if (titleEl) {
      if (!titleEl.id) {
        titleEl.id = `modal-title-${Date.now()}`;
      }
      this.container.setAttribute('aria-labelledby', titleEl.id);
    }

    lockBodyScroll();
    this.isOpen = true;
    initIcons();
    this.onOpen();
  }

  /**
   * Close the modal with animation
   */
  close() {
    if (!this.isOpen) return;

    // Mark as closing immediately for state consistency
    this.isOpen = false;
    unlockBodyScroll();
    this.onClose();

    // Add exit animation class
    this.container.classList.add('modal-exit');

    // DOM cleanup function (runs after animation)
    const cleanup = () => {
      this.container.classList.add('hidden');
      this.container.classList.remove('modal-exit', 'modal-backdrop');
    };

    // Wait for animation to complete before hiding
    const handleAnimationEnd = (e) => {
      // Only handle animation on the backdrop itself, not children
      if (e.target === this.container) {
        this.container.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    };

    this.container.addEventListener('animationend', handleAnimationEnd);

    // Fallback in case animation doesn't fire (e.g., in tests or reduced motion)
    setTimeout(() => {
      if (!this.container.classList.contains('hidden')) {
        this.container.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    }, 200);
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
      <div class="modal-content bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
        <h3 class="confirm-title text-lg font-semibold mb-2">${this.title}</h3>
        <p class="confirm-message text-gray-600 mb-6">${this.message}</p>
        <div class="flex gap-3">
          <button class="cancel-btn flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors btn-press">
            ${this.cancelText}
          </button>
          <button class="confirm-btn flex-1 px-4 py-2 text-white rounded-lg transition-colors btn-press ${this.confirmClass}">
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

  /**
   * Static helper to show a confirmation dialog and return a Promise
   * @param {Object} options - Same options as constructor (title, message, confirmText, etc.)
   * @returns {Promise<boolean>} Resolves to true if confirmed, false if cancelled
   */
  static show(options) {
    return new Promise((resolve) => {
      let resolved = false;
      const modal = new ConfirmModal({
        ...options,
        onConfirm: () => {
          if (!resolved) {
            resolved = true;
            resolve(true);
          }
        },
        onCancel: () => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        },
        onClose: () => {
          // Handle backdrop click or escape key - treat as cancel
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }
      });
      modal.show();
    });
  }
}

/**
 * BottomSheet - Mobile-friendly bottom sheet that slides up
 * On desktop, falls back to centered modal behavior.
 *
 * @example
 * const sheet = new BottomSheet({
 *   container: document.getElementById('my-sheet'),
 *   onClose: () => console.log('Sheet closed')
 * });
 * sheet.open();
 */
export class BottomSheet extends Modal {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Existing sheet element
   * @param {Function} options.onOpen - Callback when sheet opens
   * @param {Function} options.onClose - Callback when sheet closes
   * @param {boolean} options.closeOnBackdrop - Close when clicking backdrop (default: true)
   * @param {boolean} options.closeOnEscape - Close on Escape key (default: true)
   * @param {boolean} options.swipeToDismiss - Enable swipe down to dismiss (default: true)
   * @param {number} options.swipeThreshold - Pixels to swipe before dismissing (default: 100)
   */
  constructor(options = {}) {
    super(options);
    this.swipeToDismiss = options.swipeToDismiss !== false;
    this.swipeThreshold = options.swipeThreshold || 100;
    this.contentEl = null;
    this.startY = 0;
    this.currentY = 0;
    this.isDragging = false;

    if (this.container && this.swipeToDismiss) {
      this.setupSwipeGesture();
    }
  }

  /**
   * Open the bottom sheet with animation
   */
  open() {
    if (this.isOpen) return;

    this.container.classList.remove('hidden');
    this.container.classList.remove('modal-exit');
    this.container.classList.add('bottom-sheet-backdrop');

    // Add ARIA attributes for accessibility
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-modal', 'true');

    // Set aria-labelledby if title element exists
    const titleEl = this.container.querySelector('[class*="title"], h2, h3');
    if (titleEl) {
      if (!titleEl.id) {
        titleEl.id = `sheet-title-${Date.now()}`;
      }
      this.container.setAttribute('aria-labelledby', titleEl.id);
    }

    lockBodyScroll();
    this.isOpen = true;
    initIcons();
    this.onOpen();

    // Find content element for swipe gesture
    this.contentEl = this.container.querySelector('.bottom-sheet-content');
  }

  /**
   * Close the bottom sheet with animation
   */
  close() {
    if (!this.isOpen) return;

    this.isOpen = false;
    unlockBodyScroll();
    this.onClose();

    // Reset any transform from dragging
    if (this.contentEl) {
      this.contentEl.style.transform = '';
    }

    this.container.classList.add('modal-exit');

    const cleanup = () => {
      this.container.classList.add('hidden');
      this.container.classList.remove('modal-exit', 'bottom-sheet-backdrop');
    };

    const handleAnimationEnd = (e) => {
      if (e.target === this.container || e.target === this.contentEl) {
        this.container.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    };

    this.container.addEventListener('animationend', handleAnimationEnd);

    // Fallback timeout
    setTimeout(() => {
      if (!this.container.classList.contains('hidden')) {
        this.container.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    }, 250);
  }

  /**
   * Setup swipe-to-dismiss gesture for mobile
   */
  setupSwipeGesture() {
    // Only enable on touch devices
    if (!('ontouchstart' in window)) return;

    this.container.addEventListener('touchstart', (e) => {
      if (!this.isOpen) return;

      this.contentEl = this.container.querySelector('.bottom-sheet-content');
      if (!this.contentEl) return;

      // Only start drag from the handle area or top of content
      const handle = this.container.querySelector('.bottom-sheet-handle');
      const target = e.target;

      // Check if touch target is inside a nested scrollable element
      // If so, don't start swipe-to-dismiss (let the inner scroll work)
      const nestedScrollable = this._findScrollableAncestor(target, this.contentEl);
      if (nestedScrollable && nestedScrollable.scrollTop < nestedScrollable.scrollHeight - nestedScrollable.clientHeight) {
        // Inner scrollable can still scroll down, don't start dismiss
        return;
      }

      // Allow drag from handle or if content is scrolled to top
      const isHandle = handle && handle.contains(target);
      const isScrolledToTop = this.contentEl.scrollTop === 0;

      if (isHandle || isScrolledToTop) {
        this.isDragging = true;
        this.startY = e.touches[0].clientY;
        this.currentY = 0;
        this.contentEl.style.transition = 'none';
      }
    }, { passive: true });

    this.container.addEventListener('touchmove', (e) => {
      if (!this.isDragging || !this.contentEl) return;

      const deltaY = e.touches[0].clientY - this.startY;

      // Only allow dragging down (positive deltaY)
      if (deltaY > 0) {
        this.currentY = deltaY;
        this.contentEl.style.transform = `translateY(${deltaY}px)`;
      }
    }, { passive: true });

    this.container.addEventListener('touchend', () => {
      if (!this.isDragging || !this.contentEl) return;

      this.isDragging = false;
      this.contentEl.style.transition = '';

      // If dragged past threshold, close; otherwise snap back
      if (this.currentY > this.swipeThreshold) {
        this.close();
      } else {
        this.contentEl.style.transform = '';
      }
    }, { passive: true });
  }

  /**
   * Find a scrollable ancestor element between target and stopAt (exclusive)
   * @param {HTMLElement} target - Starting element
   * @param {HTMLElement} stopAt - Stop searching at this element (don't include it)
   * @returns {HTMLElement|null} Scrollable ancestor or null
   */
  _findScrollableAncestor(target, stopAt) {
    let el = target;
    while (el && el !== stopAt) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') &&
                           el.scrollHeight > el.clientHeight;
      if (isScrollable) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }
}

/**
 * ConfirmSheet - Confirmation bottom sheet with cancel/confirm buttons
 * Mobile-friendly alternative to ConfirmModal.
 *
 * @example
 * const confirm = new ConfirmSheet({
 *   title: 'Delete Book?',
 *   message: 'This action cannot be undone.',
 *   confirmText: 'Delete',
 *   confirmClass: 'bg-red-600 hover:bg-red-700',
 *   onConfirm: () => deleteBook()
 * });
 * confirm.show();
 */
export class ConfirmSheet extends BottomSheet {
  /**
   * @param {Object} options
   * @param {string} options.title - Sheet title
   * @param {string} options.message - Confirmation message
   * @param {string} options.confirmText - Confirm button text (default: 'Confirm')
   * @param {string} options.cancelText - Cancel button text (default: 'Cancel')
   * @param {string} options.confirmClass - Confirm button CSS classes
   * @param {Function} options.onConfirm - Callback when confirmed
   * @param {Function} options.onCancel - Callback when cancelled
   */
  constructor(options = {}) {
    const container = options.container || ConfirmSheet.createContainer();
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
   * Create a bottom sheet container element
   */
  static createContainer() {
    const container = document.createElement('div');
    // Match template structure - flex positioning comes from bottom-sheet-backdrop CSS class
    container.className = 'hidden fixed inset-0 bg-black/50 z-50 md:p-4';
    document.body.appendChild(container);
    return container;
  }

  /**
   * Render sheet content
   */
  render() {
    this.container.innerHTML = `
      <div class="bottom-sheet-content bg-white w-full md:max-w-sm p-6 md:mx-auto">
        <div class="bottom-sheet-handle md:hidden"></div>
        <h3 class="confirm-title text-lg font-semibold mb-2">${this.title}</h3>
        <p class="confirm-message text-gray-600 mb-6">${this.message}</p>
        <div class="flex gap-3">
          <button class="cancel-btn flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors btn-press min-h-[44px]">
            ${this.cancelText}
          </button>
          <button class="confirm-btn flex-1 px-4 py-2 text-white rounded-lg transition-colors btn-press min-h-[44px] ${this.confirmClass}">
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
   * Update sheet content
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
   * Show the sheet (alias for open)
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
