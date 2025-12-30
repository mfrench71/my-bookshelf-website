// Base Picker Interface
// Common interface for picker components (GenrePicker, AuthorPicker, SeriesPicker)

/**
 * Base options shared by all picker components
 */
export interface BasePickerOptions {
  /** Container element to render into */
  container: HTMLElement;
  /** Current user's ID for data fetching */
  userId: string;
}

/**
 * Custom event dispatched when a picker opens
 * Used for coordination between pickers (closing others when one opens)
 */
export interface PickerOpenedEvent extends CustomEvent {
  detail: { picker: BasePicker };
}

/**
 * Event name for picker coordination
 */
export const PICKER_OPENED_EVENT = 'picker:opened';

/**
 * Base interface for picker components
 * Defines the common contract that all pickers should implement
 */
export interface BasePicker {
  /**
   * Whether the picker dropdown is currently open
   */
  readonly isOpen: boolean;

  /**
   * Whether the picker is loading data
   */
  readonly isLoading: boolean;

  /**
   * Render the picker into the container
   */
  render(): void;

  /**
   * Open the picker dropdown
   */
  open(): void;

  /**
   * Close the picker dropdown
   */
  close(): void;

  /**
   * Load data for the picker (e.g., genres, authors, series)
   */
  loadData(): Promise<void>;

  /**
   * Clean up event listeners and resources
   */
  destroy(): void;

  /**
   * Get the container element
   */
  getContainer(): HTMLElement;
}

/**
 * Abstract helper class with common picker functionality
 * Can be extended by picker implementations
 */
export abstract class AbstractPicker implements BasePicker {
  protected container: HTMLElement;
  protected userId: string;
  protected _isOpen: boolean = false;
  protected _isLoading: boolean = false;
  protected focusedIndex: number = -1;

  // Bound methods for event listeners
  protected abstract handleKeyDown: (e: KeyboardEvent) => void;
  protected abstract handleClickOutside: (e: MouseEvent) => void;
  protected abstract handlePickerOpened: (e: Event) => void;

  constructor(options: BasePickerOptions) {
    this.container = options.container;
    this.userId = options.userId;
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  abstract render(): void;
  abstract open(): void;
  abstract close(): void;
  abstract loadData(): Promise<void>;

  /**
   * Clean up event listeners
   */
  destroy(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener(PICKER_OPENED_EVENT, this.handlePickerOpened);
  }

  /**
   * Dispatch picker opened event for coordination
   */
  protected dispatchPickerOpened(): void {
    document.dispatchEvent(
      new CustomEvent(PICKER_OPENED_EVENT, {
        detail: { picker: this },
      })
    );
  }

  /**
   * Handle keyboard navigation in dropdown
   * @param e - Keyboard event
   * @param itemCount - Number of items in dropdown
   * @param onSelect - Callback when item is selected
   * @param onClose - Callback when dropdown should close
   */
  protected handleKeyboardNav(
    e: KeyboardEvent,
    itemCount: number,
    onSelect: (index: number) => void,
    onClose: () => void
  ): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusedIndex = Math.min(this.focusedIndex + 1, itemCount - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusedIndex = Math.max(this.focusedIndex - 1, -1);
        break;
      case 'Enter':
        if (this.focusedIndex >= 0 && this.focusedIndex < itemCount) {
          e.preventDefault();
          onSelect(this.focusedIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }

  /**
   * Update focused item styling in dropdown
   * @param items - List of dropdown item elements
   */
  protected updateFocusedItem(items: NodeListOf<Element> | Element[]): void {
    items.forEach((item, index) => {
      if (index === this.focusedIndex) {
        item.classList.add('bg-gray-100');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('bg-gray-100');
      }
    });
  }
}

/**
 * Helper to close all other pickers when one opens
 * Add this listener to coordinate pickers on a page
 */
export function setupPickerCoordination(): void {
  // This is handled by individual pickers listening to PICKER_OPENED_EVENT
  // and closing themselves when another picker opens
}

/**
 * Type guard to check if an element is a picker container
 */
export function isPickerContainer(element: unknown): element is HTMLElement {
  return element instanceof HTMLElement && element.classList.contains('picker-container');
}
