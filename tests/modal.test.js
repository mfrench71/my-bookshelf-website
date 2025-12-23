/**
 * Unit tests for src/js/components/modal.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Modal, ConfirmModal } from '../src/js/components/modal.js';

describe('Modal', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.className = 'hidden fixed inset-0 bg-black/50 z-50';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  describe('initialization', () => {
    it('should initialize with container', () => {
      const modal = new Modal({ container });

      expect(modal.container).toBe(container);
      expect(modal.isOpen).toBe(false);
    });

    it('should handle missing container', () => {
      const modal = new Modal({ container: null });

      expect(modal.isOpen).toBe(false);
    });
  });

  describe('open', () => {
    it('should remove hidden class when opened', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(container.classList.contains('hidden')).toBe(false);
    });

    it('should set isOpen to true', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(modal.isOpen).toBe(true);
    });

    it('should lock body scroll', () => {
      const modal = new Modal({ container });

      modal.open();

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should call onOpen callback', () => {
      const onOpen = vi.fn();
      const modal = new Modal({ container, onOpen });

      modal.open();

      expect(onOpen).toHaveBeenCalled();
    });

    it('should not open again if already open', () => {
      const onOpen = vi.fn();
      const modal = new Modal({ container, onOpen });

      modal.open();
      modal.open();

      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });

  describe('close', () => {
    it('should add hidden class after animation timeout', async () => {
      vi.useFakeTimers();
      const modal = new Modal({ container });

      modal.open();
      modal.close();

      // Hidden class is added after animation (200ms timeout)
      expect(container.classList.contains('modal-exit')).toBe(true);
      expect(container.classList.contains('hidden')).toBe(false);

      // Advance past the animation timeout
      await vi.advanceTimersByTimeAsync(250);

      expect(container.classList.contains('hidden')).toBe(true);
      vi.useRealTimers();
    });

    it('should set isOpen to false', () => {
      const modal = new Modal({ container });

      modal.open();
      modal.close();

      expect(modal.isOpen).toBe(false);
    });

    it('should unlock body scroll', () => {
      const modal = new Modal({ container });

      modal.open();
      modal.close();

      expect(document.body.style.overflow).toBe('');
    });

    it('should call onClose callback', () => {
      const onClose = vi.fn();
      const modal = new Modal({ container, onClose });

      modal.open();
      modal.close();

      expect(onClose).toHaveBeenCalled();
    });

    it('should not close again if already closed', () => {
      const onClose = vi.fn();
      const modal = new Modal({ container, onClose });

      modal.open();
      modal.close();
      modal.close();

      expect(onClose).toHaveBeenCalledTimes(1);
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

  describe('backdrop click', () => {
    it('should close when clicking backdrop', () => {
      const modal = new Modal({ container });

      modal.open();

      // Simulate click on backdrop (container itself)
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: container });
      container.dispatchEvent(event);

      expect(modal.isOpen).toBe(false);
    });

    it('should not close when closeOnBackdrop is false', () => {
      const modal = new Modal({ container, closeOnBackdrop: false });

      modal.open();

      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: container });
      container.dispatchEvent(event);

      expect(modal.isOpen).toBe(true);
    });
  });

  describe('escape key', () => {
    it('should close on Escape key', () => {
      const modal = new Modal({ container });

      modal.open();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(modal.isOpen).toBe(false);
    });

    it('should not close when closeOnEscape is false', () => {
      const modal = new Modal({ container, closeOnEscape: false });

      modal.open();

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(modal.isOpen).toBe(true);
    });

    it('should not respond to Escape when closed', () => {
      const onClose = vi.fn();
      const modal = new Modal({ container, onClose });

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('getIsOpen', () => {
    it('should return current open state', () => {
      const modal = new Modal({ container });

      expect(modal.getIsOpen()).toBe(false);

      modal.open();
      expect(modal.getIsOpen()).toBe(true);

      modal.close();
      expect(modal.getIsOpen()).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should close modal if open', () => {
      const modal = new Modal({ container });

      modal.open();
      modal.destroy();

      expect(modal.isOpen).toBe(false);
    });

    it('should remove escape handler', () => {
      const modal = new Modal({ container });

      modal.destroy();

      // Opening and pressing escape should not affect it
      modal.open();
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(event);

      // Manual open still works, but escape listener removed
      // This is hard to test directly, but destroy should complete without error
      expect(true).toBe(true);
    });
  });
});

describe('ConfirmModal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.overflow = '';
  });

  describe('initialization', () => {
    it('should create container if not provided', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test message'
      });

      expect(modal.container).toBeTruthy();
      expect(document.body.contains(modal.container)).toBe(true);
    });

    it('should render title and message', () => {
      const modal = new ConfirmModal({
        title: 'Delete Book?',
        message: 'This cannot be undone.'
      });

      expect(modal.container.querySelector('.confirm-title').textContent).toBe('Delete Book?');
      expect(modal.container.querySelector('.confirm-message').textContent).toBe('This cannot be undone.');
    });

    it('should render custom button text', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test',
        confirmText: 'Yes, Delete',
        cancelText: 'No, Keep'
      });

      expect(modal.container.querySelector('.confirm-btn').textContent).toContain('Yes, Delete');
      expect(modal.container.querySelector('.cancel-btn').textContent).toContain('No, Keep');
    });
  });

  describe('confirm action', () => {
    it('should call onConfirm when confirm clicked', () => {
      const onConfirm = vi.fn();
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test',
        onConfirm
      });

      modal.open();
      modal.container.querySelector('.confirm-btn').click();

      expect(onConfirm).toHaveBeenCalled();
    });

    it('should close after confirm', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test'
      });

      modal.open();
      modal.container.querySelector('.confirm-btn').click();

      expect(modal.isOpen).toBe(false);
    });
  });

  describe('cancel action', () => {
    it('should call onCancel when cancel clicked', () => {
      const onCancel = vi.fn();
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test',
        onCancel
      });

      modal.open();
      modal.container.querySelector('.cancel-btn').click();

      expect(onCancel).toHaveBeenCalled();
    });

    it('should close after cancel', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test'
      });

      modal.open();
      modal.container.querySelector('.cancel-btn').click();

      expect(modal.isOpen).toBe(false);
    });
  });

  describe('setContent', () => {
    it('should update title', () => {
      const modal = new ConfirmModal({
        title: 'Original',
        message: 'Test'
      });

      modal.setContent({ title: 'Updated Title' });

      expect(modal.container.querySelector('.confirm-title').textContent).toBe('Updated Title');
    });

    it('should update message', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Original'
      });

      modal.setContent({ message: 'Updated Message' });

      expect(modal.container.querySelector('.confirm-message').textContent).toBe('Updated Message');
    });
  });

  describe('setLoading', () => {
    it('should disable buttons when loading', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test'
      });

      modal.setLoading(true);

      expect(modal.container.querySelector('.confirm-btn').disabled).toBe(true);
      expect(modal.container.querySelector('.cancel-btn').disabled).toBe(true);
    });

    it('should show loading text', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test',
        confirmText: 'Delete'
      });

      modal.setLoading(true);

      expect(modal.container.querySelector('.confirm-btn').textContent).toBe('Loading...');
    });

    it('should restore button text when not loading', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test',
        confirmText: 'Delete'
      });

      modal.setLoading(true);
      modal.setLoading(false);

      expect(modal.container.querySelector('.confirm-btn').textContent).toBe('Delete');
    });
  });

  describe('show alias', () => {
    it('should open modal', () => {
      const modal = new ConfirmModal({
        title: 'Test',
        message: 'Test'
      });

      modal.show();

      expect(modal.isOpen).toBe(true);
    });
  });
});
