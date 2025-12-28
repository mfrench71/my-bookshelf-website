/**
 * Tests for Modal, ConfirmModal, BottomSheet, ConfirmSheet components
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Modal, ConfirmModal, BottomSheet, ConfirmSheet } from '../src/js/components/modal.js';

// Mock utils
vi.mock('../src/js/utils.js', () => ({
  lockBodyScroll: vi.fn(),
  unlockBodyScroll: vi.fn(),
  initIcons: vi.fn(),
  isMobile: vi.fn(() => false)
}));

describe('Modal', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'hidden';
    container.innerHTML = '<div class="modal-content"><h2>Test Modal</h2></div>';
    document.body.appendChild(container);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const modal = new Modal({ container });

      expect(modal.container).toBe(container);
      expect(modal.isOpen).toBe(false);
      expect(modal.closeOnBackdrop).toBe(true);
      expect(modal.closeOnEscape).toBe(true);
    });

    it('should accept custom options', () => {
      const onOpen = vi.fn();
      const onClose = vi.fn();
      const modal = new Modal({
        container,
        onOpen,
        onClose,
        closeOnBackdrop: false,
        closeOnEscape: false
      });

      expect(modal.onOpen).toBe(onOpen);
      expect(modal.onClose).toBe(onClose);
      expect(modal.closeOnBackdrop).toBe(false);
      expect(modal.closeOnEscape).toBe(false);
    });

    it('should bind events when container provided', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      const modal = new Modal({ container });

      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should not bind events when container is null', () => {
      const modal = new Modal({ container: null });

      expect(modal.container).toBeNull();
    });
  });

  describe('open', () => {
    it('should remove hidden class', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(container.classList.contains('hidden')).toBe(false);
    });

    it('should add modal-backdrop class', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(container.classList.contains('modal-backdrop')).toBe(true);
    });

    it('should set isOpen to true', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(modal.isOpen).toBe(true);
    });

    it('should call onOpen callback', () => {
      const onOpen = vi.fn();
      const modal = new Modal({ container, onOpen });

      modal.open();

      expect(onOpen).toHaveBeenCalled();
    });

    it('should lock body scroll', async () => {
      const { lockBodyScroll } = await import('../src/js/utils.js');
      const modal = new Modal({ container });

      modal.open();

      expect(lockBodyScroll).toHaveBeenCalled();
    });

    it('should set ARIA attributes', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(container.getAttribute('role')).toBe('dialog');
      expect(container.getAttribute('aria-modal')).toBe('true');
    });

    it('should set aria-labelledby if title exists', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(container.getAttribute('aria-labelledby')).toBeTruthy();
    });

    it('should not open if already open', () => {
      const onOpen = vi.fn();
      const modal = new Modal({ container, onOpen });

      modal.open();
      modal.open();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('close', () => {
    it('should set isOpen to false', () => {
      const modal = new Modal({ container });
      modal.open();

      modal.close();

      expect(modal.isOpen).toBe(false);
    });

    it('should call onClose callback', () => {
      const onClose = vi.fn();
      const modal = new Modal({ container, onClose });
      modal.open();

      modal.close();

      expect(onClose).toHaveBeenCalled();
    });

    it('should unlock body scroll', async () => {
      const { unlockBodyScroll } = await import('../src/js/utils.js');
      const modal = new Modal({ container });
      modal.open();

      modal.close();

      expect(unlockBodyScroll).toHaveBeenCalled();
    });

    it('should add modal-exit class', () => {
      const modal = new Modal({ container });
      modal.open();

      modal.close();

      expect(container.classList.contains('modal-exit')).toBe(true);
    });

    it('should hide after animation timeout', () => {
      const modal = new Modal({ container });
      modal.open();

      modal.close();
      vi.advanceTimersByTime(200);

      expect(container.classList.contains('hidden')).toBe(true);
    });

    it('should not close if already closed', () => {
      const onClose = vi.fn();
      const modal = new Modal({ container, onClose });

      modal.close();

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('should open if closed', () => {
      const modal = new Modal({ container });

      modal.toggle();

      expect(modal.isOpen).toBe(true);
    });

    it('should close if open', () => {
      const modal = new Modal({ container });
      modal.open();

      modal.toggle();

      expect(modal.isOpen).toBe(false);
    });
  });

  describe('getIsOpen', () => {
    it('should return current open state', () => {
      const modal = new Modal({ container });

      expect(modal.getIsOpen()).toBe(false);

      modal.open();

      expect(modal.getIsOpen()).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should remove escape handler', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const modal = new Modal({ container });

      modal.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should close if open', () => {
      const modal = new Modal({ container });
      modal.open();

      modal.destroy();

      expect(modal.isOpen).toBe(false);
    });
  });

  describe('backdrop click', () => {
    it('should close on backdrop click when enabled', () => {
      const modal = new Modal({ container, closeOnBackdrop: true });
      modal.open();

      container.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(modal.isOpen).toBe(false);
    });

    it('should not close on content click', () => {
      const modal = new Modal({ container, closeOnBackdrop: true });
      modal.open();

      const content = container.querySelector('.modal-content');
      content.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(modal.isOpen).toBe(true);
    });
  });

  describe('escape key', () => {
    it('should close on Escape when enabled', () => {
      const modal = new Modal({ container, closeOnEscape: true });
      modal.open();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(modal.isOpen).toBe(false);
    });

    it('should not close on Escape when disabled', () => {
      const modal = new Modal({ container, closeOnEscape: false });
      modal.open();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(modal.isOpen).toBe(true);
    });

    it('should not respond when closed', () => {
      const onClose = vi.fn();
      const modal = new Modal({ container, onClose, closeOnEscape: true });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});

describe('ConfirmModal', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'hidden';
    document.body.appendChild(container);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should render with default options', () => {
      const modal = new ConfirmModal({ container });

      expect(container.textContent).toContain('Confirm');
      expect(container.textContent).toContain('Are you sure?');
      expect(container.querySelector('.confirm-btn')).toBeTruthy();
      expect(container.querySelector('.cancel-btn')).toBeTruthy();
    });

    it('should accept custom title and message', () => {
      const modal = new ConfirmModal({
        container,
        title: 'Delete Book?',
        message: 'This cannot be undone.'
      });

      expect(container.textContent).toContain('Delete Book?');
      expect(container.textContent).toContain('This cannot be undone.');
    });

    it('should accept custom button text', () => {
      const modal = new ConfirmModal({
        container,
        confirmText: 'Yes, Delete',
        cancelText: 'No, Keep'
      });

      expect(container.querySelector('.confirm-btn').textContent).toContain('Yes, Delete');
      expect(container.querySelector('.cancel-btn').textContent).toContain('No, Keep');
    });

    it('should create container if not provided', () => {
      const modal = new ConfirmModal({ title: 'Test' });

      expect(modal.container).toBeTruthy();
      expect(document.body.contains(modal.container)).toBe(true);
    });
  });

  describe('confirm button', () => {
    it('should call onConfirm callback', () => {
      const onConfirm = vi.fn();
      const modal = new ConfirmModal({ container, onConfirm });
      modal.open();

      container.querySelector('.confirm-btn').click();

      expect(onConfirm).toHaveBeenCalled();
    });

    it('should close modal after confirm', () => {
      const modal = new ConfirmModal({ container });
      modal.open();

      container.querySelector('.confirm-btn').click();

      expect(modal.isOpen).toBe(false);
    });
  });

  describe('cancel button', () => {
    it('should call onCancel callback', () => {
      const onCancel = vi.fn();
      const modal = new ConfirmModal({ container, onCancel });
      modal.open();

      container.querySelector('.cancel-btn').click();

      expect(onCancel).toHaveBeenCalled();
    });

    it('should close modal after cancel', () => {
      const modal = new ConfirmModal({ container });
      modal.open();

      container.querySelector('.cancel-btn').click();

      expect(modal.isOpen).toBe(false);
    });
  });

  describe('setContent', () => {
    it('should update title', () => {
      const modal = new ConfirmModal({ container });

      modal.setContent({ title: 'New Title' });

      expect(container.querySelector('.confirm-title').textContent).toBe('New Title');
    });

    it('should update message', () => {
      const modal = new ConfirmModal({ container });

      modal.setContent({ message: 'New message' });

      expect(container.querySelector('.confirm-message').textContent).toBe('New message');
    });

    it('should update button text', () => {
      const modal = new ConfirmModal({ container });

      modal.setContent({ confirmText: 'OK', cancelText: 'Back' });

      expect(container.querySelector('.confirm-btn').textContent).toBe('OK');
      expect(container.querySelector('.cancel-btn').textContent).toBe('Back');
    });
  });

  describe('show', () => {
    it('should be alias for open', () => {
      const modal = new ConfirmModal({ container });

      modal.show();

      expect(modal.isOpen).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should disable buttons when loading', () => {
      const modal = new ConfirmModal({ container });

      modal.setLoading(true);

      expect(container.querySelector('.confirm-btn').disabled).toBe(true);
      expect(container.querySelector('.cancel-btn').disabled).toBe(true);
    });

    it('should show loading text', () => {
      const modal = new ConfirmModal({ container });

      modal.setLoading(true);

      expect(container.querySelector('.confirm-btn').textContent).toBe('Loading...');
    });

    it('should restore original text when done', () => {
      const modal = new ConfirmModal({ container, confirmText: 'Delete' });

      modal.setLoading(true);
      modal.setLoading(false);

      expect(container.querySelector('.confirm-btn').textContent).toBe('Delete');
      expect(container.querySelector('.confirm-btn').disabled).toBe(false);
    });
  });
});

describe('BottomSheet', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'hidden';
    container.innerHTML = '<div class="bottom-sheet-content"><div class="bottom-sheet-handle"></div><h3>Sheet Title</h3></div>';
    document.body.appendChild(container);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should extend Modal', () => {
      const sheet = new BottomSheet({ container });

      expect(sheet instanceof Modal).toBe(true);
    });

    it('should accept swipe options', () => {
      const sheet = new BottomSheet({
        container,
        swipeToDismiss: true,
        swipeThreshold: 150
      });

      expect(sheet.swipeToDismiss).toBe(true);
      expect(sheet.swipeThreshold).toBe(150);
    });

    it('should default swipeToDismiss to true', () => {
      const sheet = new BottomSheet({ container });

      expect(sheet.swipeToDismiss).toBe(true);
    });

    it('should default swipeThreshold to 100', () => {
      const sheet = new BottomSheet({ container });

      expect(sheet.swipeThreshold).toBe(100);
    });
  });

  describe('open', () => {
    it('should add bottom-sheet-backdrop class', () => {
      const sheet = new BottomSheet({ container });

      sheet.open();

      expect(container.classList.contains('bottom-sheet-backdrop')).toBe(true);
    });

    it('should find content element', () => {
      const sheet = new BottomSheet({ container });

      sheet.open();

      expect(sheet.contentEl).toBeTruthy();
    });
  });

  describe('close', () => {
    it('should reset content transform', () => {
      const sheet = new BottomSheet({ container });
      sheet.open();
      sheet.contentEl.style.transform = 'translateY(50px)';

      sheet.close();

      expect(sheet.contentEl.style.transform).toBe('');
    });

    it('should remove bottom-sheet-backdrop after animation', () => {
      const sheet = new BottomSheet({ container });
      sheet.open();

      sheet.close();
      vi.advanceTimersByTime(250);

      expect(container.classList.contains('bottom-sheet-backdrop')).toBe(false);
    });
  });
});

describe('ConfirmSheet', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'hidden';
    document.body.appendChild(container);
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should extend BottomSheet', () => {
      const sheet = new ConfirmSheet({ container });

      expect(sheet instanceof BottomSheet).toBe(true);
    });

    it('should render with handle', () => {
      const sheet = new ConfirmSheet({ container });

      expect(container.querySelector('.bottom-sheet-handle')).toBeTruthy();
    });

    it('should render confirm/cancel buttons', () => {
      const sheet = new ConfirmSheet({ container });

      expect(container.querySelector('.confirm-btn')).toBeTruthy();
      expect(container.querySelector('.cancel-btn')).toBeTruthy();
    });

    it('should create container if not provided', () => {
      const sheet = new ConfirmSheet({ title: 'Test' });

      expect(sheet.container).toBeTruthy();
      expect(document.body.contains(sheet.container)).toBe(true);
    });
  });

  describe('confirm button', () => {
    it('should call onConfirm callback', () => {
      const onConfirm = vi.fn();
      const sheet = new ConfirmSheet({ container, onConfirm });
      sheet.open();

      container.querySelector('.confirm-btn').click();

      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe('cancel button', () => {
    it('should call onCancel callback', () => {
      const onCancel = vi.fn();
      const sheet = new ConfirmSheet({ container, onCancel });
      sheet.open();

      container.querySelector('.cancel-btn').click();

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('setContent', () => {
    it('should update content', () => {
      const sheet = new ConfirmSheet({ container });

      sheet.setContent({ title: 'New Title', message: 'New message' });

      expect(container.querySelector('.confirm-title').textContent).toBe('New Title');
      expect(container.querySelector('.confirm-message').textContent).toBe('New message');
    });
  });

  describe('show', () => {
    it('should be alias for open', () => {
      const sheet = new ConfirmSheet({ container });

      sheet.show();

      expect(sheet.isOpen).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should disable buttons when loading', () => {
      const sheet = new ConfirmSheet({ container });

      sheet.setLoading(true);

      expect(container.querySelector('.confirm-btn').disabled).toBe(true);
      expect(container.querySelector('.cancel-btn').disabled).toBe(true);
    });
  });
});
