/**
 * Event Bus Tests
 * Tests for the pub/sub event bus utility
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, eventBus, Events } from '/js/utils/event-bus.ts';

describe('EventBus', () => {
  let bus;

  beforeEach(() => {
    // Create a fresh instance for each test
    bus = new EventBus();
  });

  describe('on()', () => {
    it('should register a listener', () => {
      const callback = vi.fn();
      bus.on('test', callback);

      expect(bus.hasListeners('test')).toBe(true);
      expect(bus.listenerCount('test')).toBe(1);
    });

    it('should allow multiple listeners for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.on('test', callback1);
      bus.on('test', callback2);

      expect(bus.listenerCount('test')).toBe(2);
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = bus.on('test', callback);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      expect(bus.hasListeners('test')).toBe(false);
    });
  });

  describe('emit()', () => {
    it('should call registered listeners', () => {
      const callback = vi.fn();
      bus.on('test', callback);

      bus.emit('test');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should pass data to listeners', () => {
      const callback = vi.fn();
      bus.on('test', callback);

      const data = { id: '123', name: 'Test' };
      bus.emit('test', data);

      expect(callback).toHaveBeenCalledWith(data);
    });

    it('should call all listeners for an event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      bus.on('test', callback1);
      bus.on('test', callback2);
      bus.on('test', callback3);

      bus.emit('test', 'data');

      expect(callback1).toHaveBeenCalledWith('data');
      expect(callback2).toHaveBeenCalledWith('data');
      expect(callback3).toHaveBeenCalledWith('data');
    });

    it('should not throw for events with no listeners', () => {
      expect(() => bus.emit('nonexistent')).not.toThrow();
    });

    it('should catch and log errors in listeners', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });
      const normalCallback = vi.fn();

      bus.on('test', errorCallback);
      bus.on('test', normalCallback);

      bus.emit('test');

      expect(consoleError).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled(); // Other listeners still run

      consoleError.mockRestore();
    });
  });

  describe('once()', () => {
    it('should only call listener once', () => {
      const callback = vi.fn();
      bus.once('test', callback);

      bus.emit('test');
      bus.emit('test');
      bus.emit('test');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should auto-remove listener after call', () => {
      const callback = vi.fn();
      bus.once('test', callback);

      expect(bus.listenerCount('test')).toBe(1);

      bus.emit('test');

      expect(bus.listenerCount('test')).toBe(0);
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = bus.once('test', callback);

      unsubscribe();
      bus.emit('test');

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('off()', () => {
    it('should remove a specific listener', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.on('test', callback1);
      bus.on('test', callback2);

      bus.off('test', callback1);

      bus.emit('test');

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should not throw for nonexistent events', () => {
      const callback = vi.fn();
      expect(() => bus.off('nonexistent', callback)).not.toThrow();
    });

    it('should clean up empty event arrays', () => {
      const callback = vi.fn();
      bus.on('test', callback);

      expect(bus.eventNames()).toContain('test');

      bus.off('test', callback);

      expect(bus.eventNames()).not.toContain('test');
    });
  });

  describe('clear()', () => {
    it('should remove all listeners for a specific event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.on('test1', callback1);
      bus.on('test2', callback2);

      bus.clear('test1');

      expect(bus.hasListeners('test1')).toBe(false);
      expect(bus.hasListeners('test2')).toBe(true);
    });

    it('should remove all listeners for all events', () => {
      bus.on('test1', vi.fn());
      bus.on('test2', vi.fn());
      bus.on('test3', vi.fn());

      bus.clear();

      expect(bus.eventNames()).toHaveLength(0);
    });
  });

  describe('hasListeners()', () => {
    it('should return true when event has listeners', () => {
      bus.on('test', vi.fn());
      expect(bus.hasListeners('test')).toBe(true);
    });

    it('should return false when event has no listeners', () => {
      expect(bus.hasListeners('nonexistent')).toBe(false);
    });
  });

  describe('listenerCount()', () => {
    it('should return correct count', () => {
      expect(bus.listenerCount('test')).toBe(0);

      bus.on('test', vi.fn());
      expect(bus.listenerCount('test')).toBe(1);

      bus.on('test', vi.fn());
      expect(bus.listenerCount('test')).toBe(2);
    });
  });

  describe('eventNames()', () => {
    it('should return all registered event names', () => {
      bus.on('event1', vi.fn());
      bus.on('event2', vi.fn());
      bus.on('event3', vi.fn());

      const names = bus.eventNames();

      expect(names).toContain('event1');
      expect(names).toContain('event2');
      expect(names).toContain('event3');
      expect(names).toHaveLength(3);
    });

    it('should return empty array when no events registered', () => {
      expect(bus.eventNames()).toHaveLength(0);
    });
  });
});

describe('Singleton eventBus', () => {
  beforeEach(() => {
    // Clear the singleton between tests
    eventBus.clear();
  });

  it('should be a shared instance', () => {
    const callback = vi.fn();
    eventBus.on('test', callback);

    eventBus.emit('test');

    expect(callback).toHaveBeenCalled();
  });
});

describe('Events constants', () => {
  it('should have book events', () => {
    expect(Events.BOOK_SAVED).toBe('book:saved');
    expect(Events.BOOK_DELETED).toBe('book:deleted');
    expect(Events.BOOKS_REFRESHED).toBe('books:refreshed');
  });

  it('should have genre events', () => {
    expect(Events.GENRE_CREATED).toBe('genre:created');
    expect(Events.GENRES_CHANGED).toBe('genres:changed');
  });

  it('should have UI events', () => {
    expect(Events.MODAL_OPENED).toBe('modal:opened');
    expect(Events.MODAL_CLOSED).toBe('modal:closed');
    expect(Events.TOAST_SHOWN).toBe('toast:shown');
  });

  it('should have auth events', () => {
    expect(Events.AUTH_STATE_CHANGED).toBe('auth:stateChanged');
    expect(Events.USER_LOGGED_IN).toBe('auth:loggedIn');
  });
});

describe('Real-world usage patterns', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should support component communication pattern', () => {
    // Simulate GenrePicker emitting change
    const formHandler = vi.fn();
    const previewHandler = vi.fn();
    const validationHandler = vi.fn();

    bus.on('genres:changed', formHandler);
    bus.on('genres:changed', previewHandler);
    bus.on('genres:changed', validationHandler);

    // GenrePicker emits
    bus.emit('genres:changed', { selected: ['genre-1', 'genre-2'] });

    expect(formHandler).toHaveBeenCalledWith({ selected: ['genre-1', 'genre-2'] });
    expect(previewHandler).toHaveBeenCalledWith({ selected: ['genre-1', 'genre-2'] });
    expect(validationHandler).toHaveBeenCalledWith({ selected: ['genre-1', 'genre-2'] });
  });

  it('should support cleanup on component unmount', () => {
    const callback = vi.fn();

    // Component mounts and subscribes
    const unsubscribe = bus.on('data:updated', callback);

    bus.emit('data:updated', { value: 1 });
    expect(callback).toHaveBeenCalledTimes(1);

    // Component unmounts
    unsubscribe();

    bus.emit('data:updated', { value: 2 });
    expect(callback).toHaveBeenCalledTimes(1); // Not called again
  });

  it('should support one-time notifications', () => {
    const successHandler = vi.fn();

    // Wait for next save to complete
    bus.once('book:saved', successHandler);

    // First save triggers handler
    bus.emit('book:saved', { id: '123' });
    expect(successHandler).toHaveBeenCalledWith({ id: '123' });

    // Second save does not trigger (already unsubscribed)
    bus.emit('book:saved', { id: '456' });
    expect(successHandler).toHaveBeenCalledTimes(1);
  });
});
