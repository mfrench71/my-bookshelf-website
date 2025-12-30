// Menu Handler Tests
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MenuHandler, isMobileViewport, createMenuHandler } from '../src/js/header/menu-handler.js';

// Mock matchMedia for all tests
const mockMatchMedia = (matches) => {
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe('menu-handler', () => {
  let elements;
  let menuHandler;

  beforeEach(() => {
    // Create mock DOM elements
    elements = {
      overlay: document.createElement('div'),
      panelMobile: document.createElement('div'),
      panelDesktop: document.createElement('div'),
      menuBtn: document.createElement('button'),
      closeBtn: document.createElement('button'),
    };

    // Set up initial classes
    elements.overlay.classList.add('opacity-0', 'invisible', 'pointer-events-none');
    elements.panelMobile.classList.add('translate-y-full');
    elements.panelDesktop.classList.add('translate-x-full', 'hidden');

    // Default to mobile viewport
    mockMatchMedia(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.style.overflow = '';
  });

  describe('isMobileViewport', () => {
    it('should return true for mobile width', () => {
      mockMatchMedia(true);
      expect(isMobileViewport()).toBe(true);
    });

    it('should return false for desktop width', () => {
      mockMatchMedia(false);
      expect(isMobileViewport()).toBe(false);
    });
  });

  describe('MenuHandler', () => {
    describe('constructor', () => {
      it('should create instance with elements', () => {
        menuHandler = new MenuHandler(elements);
        expect(menuHandler).toBeInstanceOf(MenuHandler);
      });

      it('should set up click listener on menu button', () => {
        const clickSpy = vi.spyOn(elements.menuBtn, 'addEventListener');
        menuHandler = new MenuHandler(elements);
        expect(clickSpy).toHaveBeenCalledWith('click', expect.any(Function));
      });

      it('should set up click listener on close button', () => {
        const clickSpy = vi.spyOn(elements.closeBtn, 'addEventListener');
        menuHandler = new MenuHandler(elements);
        expect(clickSpy).toHaveBeenCalledWith('click', expect.any(Function));
      });

      it('should handle null elements gracefully', () => {
        expect(() => new MenuHandler({
          overlay: null,
          panelMobile: null,
          panelDesktop: null,
          menuBtn: null,
          closeBtn: null,
        })).not.toThrow();
      });
    });

    describe('open (mobile)', () => {
      beforeEach(() => {
        mockMatchMedia(true);
        menuHandler = new MenuHandler(elements);
      });

      it('should show overlay', () => {
        menuHandler.open();
        expect(elements.overlay.classList.contains('opacity-100')).toBe(true);
        expect(elements.overlay.classList.contains('visible')).toBe(true);
      });

      it('should prevent body scroll', () => {
        menuHandler.open();
        expect(document.body.style.overflow).toBe('hidden');
      });

      it('should hide desktop panel', () => {
        menuHandler.open();
        expect(elements.panelDesktop.classList.contains('hidden')).toBe(true);
      });

      it('should set isOpen to true', () => {
        menuHandler.open();
        expect(menuHandler.isMenuOpen()).toBe(true);
      });
    });

    describe('open (desktop)', () => {
      beforeEach(() => {
        mockMatchMedia(false);
        menuHandler = new MenuHandler(elements);
      });

      it('should show overlay', () => {
        menuHandler.open();
        expect(elements.overlay.classList.contains('opacity-100')).toBe(true);
      });

      it('should show desktop panel', () => {
        menuHandler.open();
        expect(elements.panelDesktop.classList.contains('hidden')).toBe(false);
      });

      it('should hide mobile panel', () => {
        menuHandler.open();
        expect(elements.panelMobile.classList.contains('translate-y-full')).toBe(true);
      });
    });

    describe('close (mobile)', () => {
      beforeEach(() => {
        mockMatchMedia(true);
        vi.useFakeTimers();
        menuHandler = new MenuHandler(elements);
        menuHandler.open();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should slide mobile panel down', () => {
        menuHandler.close();
        expect(elements.panelMobile.classList.contains('translate-y-full')).toBe(true);
      });

      it('should restore body scroll', () => {
        menuHandler.close();
        expect(document.body.style.overflow).toBe('');
      });

      it('should hide overlay after delay', () => {
        menuHandler.close();
        vi.advanceTimersByTime(200);
        expect(elements.overlay.classList.contains('opacity-0')).toBe(true);
      });

      it('should set isOpen to false', () => {
        menuHandler.close();
        expect(menuHandler.isMenuOpen()).toBe(false);
      });
    });

    describe('close (desktop)', () => {
      beforeEach(() => {
        mockMatchMedia(false);
        vi.useFakeTimers();
        menuHandler = new MenuHandler(elements);
        menuHandler.open();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should slide desktop panel out', () => {
        menuHandler.close();
        expect(elements.panelDesktop.classList.contains('translate-x-full')).toBe(true);
      });

      it('should hide desktop panel after delay', () => {
        menuHandler.close();
        vi.advanceTimersByTime(200);
        expect(elements.panelDesktop.classList.contains('hidden')).toBe(true);
      });
    });

    describe('toggle', () => {
      beforeEach(() => {
        mockMatchMedia(true);
        menuHandler = new MenuHandler(elements);
      });

      it('should open when closed', () => {
        menuHandler.toggle();
        expect(menuHandler.isMenuOpen()).toBe(true);
      });

      it('should close when open', () => {
        menuHandler.open();
        menuHandler.toggle();
        expect(menuHandler.isMenuOpen()).toBe(false);
      });
    });

    describe('isMenuOpen', () => {
      beforeEach(() => {
        mockMatchMedia(true);
        menuHandler = new MenuHandler(elements);
      });

      it('should return false initially', () => {
        expect(menuHandler.isMenuOpen()).toBe(false);
      });

      it('should return true after open', () => {
        menuHandler.open();
        expect(menuHandler.isMenuOpen()).toBe(true);
      });
    });

    describe('backdrop click', () => {
      beforeEach(() => {
        mockMatchMedia(true);
        menuHandler = new MenuHandler(elements);
        menuHandler.open();
      });

      it('should close menu when clicking overlay', () => {
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: elements.overlay });
        elements.overlay.dispatchEvent(event);
        expect(menuHandler.isMenuOpen()).toBe(false);
      });

      it('should not close when clicking inside panel', () => {
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: elements.panelMobile });
        elements.overlay.dispatchEvent(event);
        expect(menuHandler.isMenuOpen()).toBe(true);
      });
    });
  });

  describe('createMenuHandler', () => {
    it('should create and return MenuHandler instance', () => {
      const handler = createMenuHandler(elements);
      expect(handler).toBeInstanceOf(MenuHandler);
    });
  });
});
