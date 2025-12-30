// Menu Handler
// Handles opening/closing menu panels (mobile bottom sheet + desktop slide-out)

import { initIcons } from '../utils.js';

export interface MenuElements {
  overlay: HTMLElement | null;
  panelMobile: HTMLElement | null;
  panelDesktop: HTMLElement | null;
  menuBtn: HTMLElement | null;
  closeBtn: HTMLElement | null;
}

/**
 * Check if viewport is mobile width
 */
export function isMobileViewport(): boolean {
  return window.matchMedia('(max-width: 767px)').matches;
}

/**
 * MenuHandler class
 * Manages menu open/close state and animations
 */
export class MenuHandler {
  private elements: MenuElements;
  private isOpen: boolean = false;

  constructor(elements: MenuElements) {
    this.elements = elements;
    this.setupEventListeners();
    this.setupSwipeToClose();
  }

  /**
   * Set up event listeners for menu buttons
   */
  private setupEventListeners(): void {
    const { menuBtn, closeBtn, overlay } = this.elements;

    if (menuBtn) {
      menuBtn.addEventListener('click', () => this.open());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this.close();
      });
    }
  }

  /**
   * Set up swipe-to-close gesture for mobile bottom sheet
   */
  private setupSwipeToClose(): void {
    const { panelMobile } = this.elements;
    if (!panelMobile) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    panelMobile.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        startY = e.touches[0].clientY;
        currentY = startY;
        isDragging = true;
        panelMobile.style.transition = 'none';
      },
      { passive: true }
    );

    panelMobile.addEventListener(
      'touchmove',
      (e: TouchEvent) => {
        if (!isDragging) return;
        currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;

        // Only allow dragging downward
        if (deltaY > 0) {
          panelMobile.style.transform = `translateY(${deltaY}px)`;
        }
      },
      { passive: true }
    );

    panelMobile.addEventListener(
      'touchend',
      () => {
        if (!isDragging) return;
        isDragging = false;

        const deltaY = currentY - startY;
        panelMobile.style.transition = '';
        panelMobile.style.transform = '';

        // Close if dragged more than threshold
        const threshold = Math.min(100, panelMobile.offsetHeight * 0.3);
        if (deltaY > threshold) {
          this.close();
        }
      },
      { passive: true }
    );
  }

  /**
   * Open the menu
   */
  open(): void {
    const { overlay, panelMobile, panelDesktop } = this.elements;

    // Show overlay with fade animation
    overlay?.classList.remove('opacity-0', 'invisible', 'pointer-events-none');
    overlay?.classList.add('opacity-100', 'visible', 'pointer-events-auto');
    document.body.style.overflow = 'hidden';

    if (isMobileViewport()) {
      // Mobile: show bottom sheet
      panelDesktop?.classList.add('hidden');
      requestAnimationFrame(() => {
        panelMobile?.classList.remove('translate-y-full');
        panelMobile?.classList.add('translate-y-0');
      });
    } else {
      // Desktop: show slide-out panel
      panelMobile?.classList.add('translate-y-full');
      panelDesktop?.classList.remove('hidden');
      requestAnimationFrame(() => {
        panelDesktop?.classList.remove('translate-x-full');
        panelDesktop?.classList.add('translate-x-0');
      });
    }

    this.isOpen = true;
    initIcons();
  }

  /**
   * Close the menu
   */
  close(): void {
    const { overlay, panelMobile, panelDesktop } = this.elements;

    if (isMobileViewport()) {
      // Mobile: slide bottom sheet down
      panelMobile?.classList.remove('translate-y-0');
      panelMobile?.classList.add('translate-y-full');
      if (panelMobile) panelMobile.style.transform = '';
      document.body.style.overflow = '';

      setTimeout(() => {
        overlay?.classList.remove('opacity-100', 'visible', 'pointer-events-auto');
        overlay?.classList.add('opacity-0', 'invisible', 'pointer-events-none');
      }, 200);
    } else {
      // Desktop: slide out panel to right
      panelDesktop?.classList.remove('translate-x-0');
      panelDesktop?.classList.add('translate-x-full');
      document.body.style.overflow = '';

      setTimeout(() => {
        panelDesktop?.classList.add('hidden');
        overlay?.classList.remove('opacity-100', 'visible', 'pointer-events-auto');
        overlay?.classList.add('opacity-0', 'invisible', 'pointer-events-none');
      }, 200);
    }

    this.isOpen = false;
  }

  /**
   * Check if menu is currently open
   */
  isMenuOpen(): boolean {
    return this.isOpen;
  }

  /**
   * Toggle menu open/close
   */
  toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

/**
 * Create and initialize a MenuHandler instance
 * @param elements - DOM elements for menu
 * @returns MenuHandler instance
 */
export function createMenuHandler(elements: MenuElements): MenuHandler {
  return new MenuHandler(elements);
}
