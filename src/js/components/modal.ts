// Reusable Modal and BottomSheet Components
import { lockBodyScroll, unlockBodyScroll, initIcons } from '../utils.js';

/** Options for Modal constructor */
export interface ModalOptions {
  /** Existing modal element or container to render into */
  container?: HTMLElement | null;
  /** Callback when modal opens */
  onOpen?: () => void;
  /** Callback when modal closes */
  onClose?: () => void;
  /** Close when clicking backdrop (default: true) */
  closeOnBackdrop?: boolean;
  /** Close on Escape key (default: true) */
  closeOnEscape?: boolean;
}

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
  protected container: HTMLElement | null;
  protected onOpen: () => void;
  protected onClose: () => void;
  protected closeOnBackdrop: boolean;
  protected closeOnEscape: boolean;
  protected isOpen: boolean;
  protected escapeHandler?: (e: KeyboardEvent) => void;

  constructor(options: ModalOptions = {}) {
    this.container = options.container ?? null;
    this.onOpen = options.onOpen ?? (() => {});
    this.onClose = options.onClose ?? (() => {});
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
  protected bindEvents(): void {
    if (!this.container) return;

    // Click on backdrop to close
    if (this.closeOnBackdrop) {
      this.container.addEventListener('click', e => {
        if (e.target === this.container) {
          this.close();
        }
      });
    }

    // Escape key to close
    if (this.closeOnEscape) {
      this.escapeHandler = (e: KeyboardEvent) => {
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
  open(): void {
    if (this.isOpen || !this.container) return;

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
  close(): void {
    if (!this.isOpen || !this.container) return;

    // Mark as closing immediately for state consistency
    this.isOpen = false;
    unlockBodyScroll();
    this.onClose();

    // Add exit animation class
    this.container.classList.add('modal-exit');

    const containerRef = this.container;

    // DOM cleanup function (runs after animation)
    const cleanup = () => {
      containerRef.classList.add('hidden');
      containerRef.classList.remove('modal-exit', 'modal-backdrop');
    };

    // Wait for animation to complete before hiding
    const handleAnimationEnd = (e: AnimationEvent) => {
      // Only handle animation on the backdrop itself, not children
      if (e.target === containerRef) {
        containerRef.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    };

    this.container.addEventListener('animationend', handleAnimationEnd);

    // Fallback in case animation doesn't fire (e.g., in tests or reduced motion)
    setTimeout(() => {
      if (!containerRef.classList.contains('hidden')) {
        containerRef.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    }, 200);
  }

  /**
   * Toggle modal open/closed
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  /**
   * Check if modal is currently open
   */
  getIsOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Destroy the modal and remove event listeners
   */
  destroy(): void {
    if (this.escapeHandler) {
      document.removeEventListener('keydown', this.escapeHandler);
    }
    if (this.isOpen) {
      this.close();
    }
  }
}

/** Options for ConfirmModal constructor */
export interface ConfirmModalOptions extends ModalOptions {
  /** Modal title */
  title?: string;
  /** Confirmation message */
  message?: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button CSS classes */
  confirmClass?: string;
  /** Callback when confirmed */
  onConfirm?: () => void;
  /** Callback when cancelled */
  onCancel?: () => void;
}

/** Elements in the confirm modal */
interface ConfirmModalElements {
  title: HTMLElement | null;
  message: HTMLElement | null;
  cancelBtn: HTMLButtonElement | null;
  confirmBtn: HTMLButtonElement | null;
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
  protected title: string;
  protected message: string;
  protected confirmText: string;
  protected cancelText: string;
  protected confirmClass: string;
  protected onConfirmCallback: () => void;
  protected onCancelCallback: () => void;
  protected elements!: ConfirmModalElements;

  constructor(options: ConfirmModalOptions = {}) {
    // Create modal element if not provided
    const container = options.container ?? ConfirmModal.createContainer();
    super({ ...options, container });

    this.title = options.title ?? 'Confirm';
    this.message = options.message ?? 'Are you sure?';
    this.confirmText = options.confirmText ?? 'Confirm';
    this.cancelText = options.cancelText ?? 'Cancel';
    this.confirmClass = options.confirmClass ?? 'bg-primary hover:bg-primary-dark';
    this.onConfirmCallback = options.onConfirm ?? (() => {});
    this.onCancelCallback = options.onCancel ?? (() => {});

    this.render();
    this.bindConfirmEvents();
  }

  /**
   * Create a modal container element
   */
  static createContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4';
    document.body.appendChild(container);
    return container;
  }

  /**
   * Render modal content
   */
  protected render(): void {
    if (!this.container) return;

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
      confirmBtn: this.container.querySelector('.confirm-btn'),
    };
  }

  /**
   * Bind confirm/cancel button events
   */
  protected bindConfirmEvents(): void {
    this.elements.cancelBtn?.addEventListener('click', () => {
      this.onCancelCallback();
      this.close();
    });

    this.elements.confirmBtn?.addEventListener('click', () => {
      this.onConfirmCallback();
      this.close();
    });
  }

  /**
   * Update modal content
   */
  setContent(options: Partial<Pick<ConfirmModalOptions, 'title' | 'message' | 'confirmText' | 'cancelText'>>): void {
    if (options.title && this.elements.title) {
      this.title = options.title;
      this.elements.title.textContent = options.title;
    }
    if (options.message && this.elements.message) {
      this.message = options.message;
      this.elements.message.textContent = options.message;
    }
    if (options.confirmText && this.elements.confirmBtn) {
      this.confirmText = options.confirmText;
      this.elements.confirmBtn.textContent = options.confirmText;
    }
    if (options.cancelText && this.elements.cancelBtn) {
      this.cancelText = options.cancelText;
      this.elements.cancelBtn.textContent = options.cancelText;
    }
  }

  /**
   * Show the modal (alias for open)
   */
  show(): void {
    this.open();
  }

  /**
   * Set loading state on confirm button
   */
  setLoading(loading: boolean): void {
    if (this.elements.confirmBtn) {
      this.elements.confirmBtn.disabled = loading;
    }
    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.disabled = loading;
    }
    if (this.elements.confirmBtn) {
      this.elements.confirmBtn.textContent = loading ? 'Loading...' : this.confirmText;
    }
  }

  /**
   * Static helper to show a confirmation dialog and return a Promise
   * @returns Resolves to true if confirmed, false if cancelled
   */
  static show(options: ConfirmModalOptions): Promise<boolean> {
    return new Promise(resolve => {
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
        },
      });
      modal.show();
    });
  }
}

/** Options for BottomSheet constructor */
export interface BottomSheetOptions extends ModalOptions {
  /** Enable swipe down to dismiss (default: true) */
  swipeToDismiss?: boolean;
  /** Pixels to swipe before dismissing (default: 100) */
  swipeThreshold?: number;
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
  protected swipeToDismiss: boolean;
  protected swipeThreshold: number;
  protected contentEl: HTMLElement | null;
  protected startY: number;
  protected currentY: number;
  protected isDragging: boolean;

  constructor(options: BottomSheetOptions = {}) {
    super(options);
    this.swipeToDismiss = options.swipeToDismiss !== false;
    this.swipeThreshold = options.swipeThreshold ?? 100;
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
  open(): void {
    if (this.isOpen || !this.container) return;

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
  close(): void {
    if (!this.isOpen || !this.container) return;

    this.isOpen = false;
    unlockBodyScroll();
    this.onClose();

    // Reset any transform from dragging
    if (this.contentEl) {
      this.contentEl.style.transform = '';
    }

    this.container.classList.add('modal-exit');

    const containerRef = this.container;
    const contentRef = this.contentEl;

    const cleanup = () => {
      containerRef.classList.add('hidden');
      containerRef.classList.remove('modal-exit', 'bottom-sheet-backdrop');
    };

    const handleAnimationEnd = (e: AnimationEvent) => {
      if (e.target === containerRef || e.target === contentRef) {
        containerRef.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    };

    this.container.addEventListener('animationend', handleAnimationEnd);

    // Fallback timeout
    setTimeout(() => {
      if (!containerRef.classList.contains('hidden')) {
        containerRef.removeEventListener('animationend', handleAnimationEnd);
        cleanup();
      }
    }, 250);
  }

  /**
   * Setup swipe-to-dismiss gesture for mobile
   */
  protected setupSwipeGesture(): void {
    if (!this.container) return;

    // Only enable on touch devices
    if (!('ontouchstart' in window)) return;

    this.container.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        if (!this.isOpen || !this.container) return;

        this.contentEl = this.container.querySelector('.bottom-sheet-content');
        if (!this.contentEl) return;

        // Only start drag from the handle area or top of content
        const handle = this.container.querySelector('.bottom-sheet-handle');
        const target = e.target as HTMLElement;

        // Check if touch target is inside a nested scrollable element
        // If so, don't start swipe-to-dismiss (let the inner scroll work)
        const nestedScrollable = this.findScrollableAncestor(target, this.contentEl);
        if (
          nestedScrollable &&
          nestedScrollable.scrollTop < nestedScrollable.scrollHeight - nestedScrollable.clientHeight
        ) {
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
      },
      { passive: true }
    );

    this.container.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (!this.isDragging || !this.contentEl) return;

        const deltaY = e.touches[0].clientY - this.startY;

        // Only allow dragging down (positive deltaY)
        if (deltaY > 0) {
          this.currentY = deltaY;
          this.contentEl.style.transform = `translateY(${deltaY}px)`;
        }
      },
      { passive: true }
    );

    this.container.addEventListener(
      'touchend',
      () => {
        if (!this.isDragging || !this.contentEl) return;

        this.isDragging = false;
        this.contentEl.style.transition = '';

        // If dragged past threshold, close; otherwise snap back
        if (this.currentY > this.swipeThreshold) {
          this.close();
        } else {
          this.contentEl.style.transform = '';
        }
      },
      { passive: true }
    );
  }

  /**
   * Find a scrollable ancestor element between target and stopAt (exclusive)
   * @param target - Starting element
   * @param stopAt - Stop searching at this element (don't include it)
   * @returns Scrollable ancestor or null
   */
  protected findScrollableAncestor(target: HTMLElement, stopAt: HTMLElement): HTMLElement | null {
    let el: HTMLElement | null = target;
    while (el && el !== stopAt) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
      if (isScrollable) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }
}

/** Options for ConfirmSheet constructor */
export interface ConfirmSheetOptions extends BottomSheetOptions {
  /** Sheet title */
  title?: string;
  /** Confirmation message */
  message?: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button CSS classes */
  confirmClass?: string;
  /** Callback when confirmed */
  onConfirm?: () => void;
  /** Callback when cancelled */
  onCancel?: () => void;
}

/** Elements in the confirm sheet */
interface ConfirmSheetElements {
  title: HTMLElement | null;
  message: HTMLElement | null;
  cancelBtn: HTMLButtonElement | null;
  confirmBtn: HTMLButtonElement | null;
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
  protected title: string;
  protected message: string;
  protected confirmText: string;
  protected cancelText: string;
  protected confirmClass: string;
  protected onConfirmCallback: () => void;
  protected onCancelCallback: () => void;
  protected elements!: ConfirmSheetElements;

  constructor(options: ConfirmSheetOptions = {}) {
    const container = options.container ?? ConfirmSheet.createContainer();
    super({ ...options, container });

    this.title = options.title ?? 'Confirm';
    this.message = options.message ?? 'Are you sure?';
    this.confirmText = options.confirmText ?? 'Confirm';
    this.cancelText = options.cancelText ?? 'Cancel';
    this.confirmClass = options.confirmClass ?? 'bg-primary hover:bg-primary-dark';
    this.onConfirmCallback = options.onConfirm ?? (() => {});
    this.onCancelCallback = options.onCancel ?? (() => {});

    this.render();
    this.bindConfirmEvents();
  }

  /**
   * Create a bottom sheet container element
   */
  static createContainer(): HTMLElement {
    const container = document.createElement('div');
    // Match template structure - flex positioning comes from bottom-sheet-backdrop CSS class
    container.className = 'hidden fixed inset-0 bg-black/50 z-50 md:p-4';
    document.body.appendChild(container);
    return container;
  }

  /**
   * Render sheet content
   */
  protected render(): void {
    if (!this.container) return;

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
      confirmBtn: this.container.querySelector('.confirm-btn'),
    };
  }

  /**
   * Bind confirm/cancel button events
   */
  protected bindConfirmEvents(): void {
    this.elements.cancelBtn?.addEventListener('click', () => {
      this.onCancelCallback();
      this.close();
    });

    this.elements.confirmBtn?.addEventListener('click', () => {
      this.onConfirmCallback();
      this.close();
    });
  }

  /**
   * Update sheet content
   */
  setContent(options: Partial<Pick<ConfirmSheetOptions, 'title' | 'message' | 'confirmText' | 'cancelText'>>): void {
    if (options.title && this.elements.title) {
      this.title = options.title;
      this.elements.title.textContent = options.title;
    }
    if (options.message && this.elements.message) {
      this.message = options.message;
      this.elements.message.textContent = options.message;
    }
    if (options.confirmText && this.elements.confirmBtn) {
      this.confirmText = options.confirmText;
      this.elements.confirmBtn.textContent = options.confirmText;
    }
    if (options.cancelText && this.elements.cancelBtn) {
      this.cancelText = options.cancelText;
      this.elements.cancelBtn.textContent = options.cancelText;
    }
  }

  /**
   * Show the sheet (alias for open)
   */
  show(): void {
    this.open();
  }

  /**
   * Set loading state on confirm button
   */
  setLoading(loading: boolean): void {
    if (this.elements.confirmBtn) {
      this.elements.confirmBtn.disabled = loading;
    }
    if (this.elements.cancelBtn) {
      this.elements.cancelBtn.disabled = loading;
    }
    if (this.elements.confirmBtn) {
      this.elements.confirmBtn.textContent = loading ? 'Loading...' : this.confirmText;
    }
  }

  /**
   * Static method to show a confirm sheet and await the result
   * @returns Resolves to true if confirmed, false if cancelled
   */
  static show(options: ConfirmSheetOptions): Promise<boolean> {
    return new Promise(resolve => {
      let resolved = false;
      const sheet = new ConfirmSheet({
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
        },
      });
      sheet.show();
    });
  }
}
