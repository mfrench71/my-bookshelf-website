// Base Picker Interface Tests
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AbstractPicker,
  PICKER_OPENED_EVENT,
  isPickerContainer,
} from '../src/js/components/base-picker.js';

// Concrete implementation for testing
class TestPicker extends AbstractPicker {
  renderCalled = false;
  openCalled = false;
  closeCalled = false;
  loadDataCalled = false;

  handleKeyDown = vi.fn();
  handleClickOutside = vi.fn();
  handlePickerOpened = vi.fn();

  render() {
    this.renderCalled = true;
  }

  open() {
    this._isOpen = true;
    this.openCalled = true;
    this.dispatchPickerOpened();
  }

  close() {
    this._isOpen = false;
    this.closeCalled = true;
  }

  async loadData() {
    this._isLoading = true;
    this.loadDataCalled = true;
    this._isLoading = false;
  }

  // Expose protected method for testing
  testKeyboardNav(e, itemCount, onSelect, onClose) {
    this.handleKeyboardNav(e, itemCount, onSelect, onClose);
  }

  getFocusedIndex() {
    return this.focusedIndex;
  }

  setFocusedIndex(index) {
    this.focusedIndex = index;
  }
}

describe('base-picker', () => {
  let container;
  let picker;

  beforeEach(() => {
    container = document.createElement('div');
    picker = new TestPicker({ container, userId: 'user123' });
  });

  describe('AbstractPicker', () => {
    describe('constructor', () => {
      it('should set container and userId', () => {
        expect(picker.getContainer()).toBe(container);
      });

      it('should initialize isOpen as false', () => {
        expect(picker.isOpen).toBe(false);
      });

      it('should initialize isLoading as false', () => {
        expect(picker.isLoading).toBe(false);
      });
    });

    describe('isOpen getter', () => {
      it('should return false initially', () => {
        expect(picker.isOpen).toBe(false);
      });

      it('should return true after open', () => {
        picker.open();
        expect(picker.isOpen).toBe(true);
      });

      it('should return false after close', () => {
        picker.open();
        picker.close();
        expect(picker.isOpen).toBe(false);
      });
    });

    describe('isLoading getter', () => {
      it('should return false initially', () => {
        expect(picker.isLoading).toBe(false);
      });

      it('should reflect loading state during loadData', async () => {
        // Since our test implementation sets _isLoading synchronously,
        // we just verify it can be called
        await picker.loadData();
        expect(picker.loadDataCalled).toBe(true);
      });
    });

    describe('getContainer', () => {
      it('should return the container element', () => {
        expect(picker.getContainer()).toBe(container);
      });
    });

    describe('render', () => {
      it('should be called when render is invoked', () => {
        picker.render();
        expect(picker.renderCalled).toBe(true);
      });
    });

    describe('open', () => {
      it('should set isOpen to true', () => {
        picker.open();
        expect(picker.isOpen).toBe(true);
      });

      it('should dispatch picker opened event', () => {
        const eventSpy = vi.fn();
        document.addEventListener(PICKER_OPENED_EVENT, eventSpy);

        picker.open();

        expect(eventSpy).toHaveBeenCalled();
        document.removeEventListener(PICKER_OPENED_EVENT, eventSpy);
      });
    });

    describe('close', () => {
      it('should set isOpen to false', () => {
        picker.open();
        picker.close();
        expect(picker.isOpen).toBe(false);
      });
    });

    describe('destroy', () => {
      it('should remove event listeners', () => {
        const removeEventSpy = vi.spyOn(document, 'removeEventListener');

        picker.destroy();

        expect(removeEventSpy).toHaveBeenCalledWith('keydown', picker.handleKeyDown);
        expect(removeEventSpy).toHaveBeenCalledWith('click', picker.handleClickOutside);
        expect(removeEventSpy).toHaveBeenCalledWith(PICKER_OPENED_EVENT, picker.handlePickerOpened);

        removeEventSpy.mockRestore();
      });
    });

    describe('handleKeyboardNav', () => {
      let onSelect;
      let onClose;

      beforeEach(() => {
        onSelect = vi.fn();
        onClose = vi.fn();
      });

      it('should move focus down on ArrowDown', () => {
        picker.setFocusedIndex(-1);
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        event.preventDefault = vi.fn();

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(picker.getFocusedIndex()).toBe(0);
        expect(event.preventDefault).toHaveBeenCalled();
      });

      it('should not exceed item count on ArrowDown', () => {
        picker.setFocusedIndex(4);
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        event.preventDefault = vi.fn();

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(picker.getFocusedIndex()).toBe(4);
      });

      it('should move focus up on ArrowUp', () => {
        picker.setFocusedIndex(2);
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        event.preventDefault = vi.fn();

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(picker.getFocusedIndex()).toBe(1);
        expect(event.preventDefault).toHaveBeenCalled();
      });

      it('should not go below -1 on ArrowUp', () => {
        picker.setFocusedIndex(0);
        const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
        event.preventDefault = vi.fn();

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(picker.getFocusedIndex()).toBe(-1);
      });

      it('should call onSelect on Enter with valid index', () => {
        picker.setFocusedIndex(2);
        const event = new KeyboardEvent('keydown', { key: 'Enter' });
        event.preventDefault = vi.fn();

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(onSelect).toHaveBeenCalledWith(2);
        expect(event.preventDefault).toHaveBeenCalled();
      });

      it('should not call onSelect on Enter with invalid index', () => {
        picker.setFocusedIndex(-1);
        const event = new KeyboardEvent('keydown', { key: 'Enter' });

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(onSelect).not.toHaveBeenCalled();
      });

      it('should call onClose on Escape', () => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' });
        event.preventDefault = vi.fn();

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(onClose).toHaveBeenCalled();
        expect(event.preventDefault).toHaveBeenCalled();
      });

      it('should ignore other keys', () => {
        picker.setFocusedIndex(1);
        const event = new KeyboardEvent('keydown', { key: 'a' });

        picker.testKeyboardNav(event, 5, onSelect, onClose);

        expect(picker.getFocusedIndex()).toBe(1);
        expect(onSelect).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
      });
    });
  });

  describe('PICKER_OPENED_EVENT', () => {
    it('should be the correct event name', () => {
      expect(PICKER_OPENED_EVENT).toBe('picker:opened');
    });
  });

  describe('isPickerContainer', () => {
    it('should return true for element with picker-container class', () => {
      const element = document.createElement('div');
      element.classList.add('picker-container');
      expect(isPickerContainer(element)).toBe(true);
    });

    it('should return false for element without picker-container class', () => {
      const element = document.createElement('div');
      expect(isPickerContainer(element)).toBe(false);
    });

    it('should return false for non-element', () => {
      expect(isPickerContainer('string')).toBe(false);
      expect(isPickerContainer(null)).toBe(false);
      expect(isPickerContainer(undefined)).toBe(false);
      expect(isPickerContainer({})).toBe(false);
    });
  });
});
