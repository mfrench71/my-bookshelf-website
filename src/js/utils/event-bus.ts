// Event Bus - Decoupled component communication
// Provides pub/sub pattern for loose coupling between components

/** Event callback function type */
export type EventCallback<T = unknown> = (data: T) => void;

/** Event listener entry */
interface ListenerEntry<T = unknown> {
  callback: EventCallback<T>;
  once: boolean;
}

/**
 * Simple event bus for decoupled component communication
 * Allows components to communicate without direct dependencies
 *
 * @example
 * // Subscribe to an event
 * eventBus.on('book:saved', (book) => {
 *   console.log('Book saved:', book.title);
 * });
 *
 * // Emit an event
 * eventBus.emit('book:saved', { id: '123', title: 'My Book' });
 *
 * // Subscribe once (auto-unsubscribe after first call)
 * eventBus.once('modal:closed', () => {
 *   console.log('Modal was closed');
 * });
 */
class EventBus {
  private listeners: Map<string, ListenerEntry[]>;

  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to an event
   * @param event - Event name (e.g., 'book:saved', 'genres:changed')
   * @param callback - Function to call when event is emitted
   * @returns Unsubscribe function
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const entry: ListenerEntry<T> = { callback: callback as EventCallback, once: false };
    this.listeners.get(event)!.push(entry as ListenerEntry);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   * @param event - Event name
   * @param callback - Function to call when event is emitted
   * @returns Unsubscribe function
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    const entry: ListenerEntry<T> = { callback: callback as EventCallback, once: true };
    this.listeners.get(event)!.push(entry as ListenerEntry);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param callback - The callback to remove
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    const index = eventListeners.findIndex(entry => entry.callback === callback);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }

    // Clean up empty event arrays
    if (eventListeners.length === 0) {
      this.listeners.delete(event);
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event - Event name
   * @param data - Data to pass to callbacks
   */
  emit<T = unknown>(event: string, data?: T): void {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;

    // Create a copy to avoid issues if callbacks modify the array
    const listenersCopy = [...eventListeners];

    for (const entry of listenersCopy) {
      try {
        entry.callback(data);
      } catch (error) {
        console.error(`Error in event handler for "${event}":`, error);
      }

      // Remove once listeners after calling
      if (entry.once) {
        this.off(event, entry.callback);
      }
    }
  }

  /**
   * Check if an event has any listeners
   * @param event - Event name
   * @returns True if event has listeners
   */
  hasListeners(event: string): boolean {
    return (this.listeners.get(event)?.length ?? 0) > 0;
  }

  /**
   * Get the number of listeners for an event
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /**
   * Remove all listeners for an event (or all events if no event specified)
   * @param event - Optional event name
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get all registered event names
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }
}

// Export singleton instance
export const eventBus = new EventBus();

// Also export class for testing or creating isolated instances
export { EventBus };

/**
 * Common event names used in the app
 * Use these constants to avoid typos in event names
 */
export const Events = {
  // Book events
  BOOK_SAVED: 'book:saved',
  BOOK_DELETED: 'book:deleted',
  BOOK_RESTORED: 'book:restored',
  BOOKS_REFRESHED: 'books:refreshed',

  // Genre events
  GENRE_CREATED: 'genre:created',
  GENRE_UPDATED: 'genre:updated',
  GENRE_DELETED: 'genre:deleted',
  GENRES_CHANGED: 'genres:changed',

  // Series events
  SERIES_CREATED: 'series:created',
  SERIES_UPDATED: 'series:updated',
  SERIES_DELETED: 'series:deleted',
  SERIES_SELECTION_CHANGED: 'series:selectionChanged',

  // Form events
  FORM_DIRTY: 'form:dirty',
  FORM_CLEAN: 'form:clean',
  FORM_SUBMITTED: 'form:submitted',

  // UI events
  MODAL_OPENED: 'modal:opened',
  MODAL_CLOSED: 'modal:closed',
  TOAST_SHOWN: 'toast:shown',

  // Auth events
  AUTH_STATE_CHANGED: 'auth:stateChanged',
  USER_LOGGED_IN: 'auth:loggedIn',
  USER_LOGGED_OUT: 'auth:loggedOut',

  // Sync events
  SYNC_STARTED: 'sync:started',
  SYNC_COMPLETED: 'sync:completed',
  SYNC_FAILED: 'sync:failed',
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
