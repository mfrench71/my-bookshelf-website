# ADR 006: Event Bus for Component Communication

## Status

Implemented (December 2025)

## Context

Components needed to communicate:
- GenrePicker selection changes → form dirty state
- Book saved → update book list
- Filter changed → trigger re-render

Original approach: Callback props
```javascript
new GenrePicker({
  onChange: (genres) => {
    updateDirtyState(true);
    updatePreview();
    validateGenres();
  }
});
```

Problems:
- Callback chains become unwieldy
- Parent must know about all listeners
- Difficult to add new listeners without modifying parent

## Decision

Implement an **Event Bus** for decoupled component communication.

### Implementation

```typescript
// src/js/utils/event-bus.ts
class EventBus {
  private listeners = new Map<string, Set<Function>>();

  on(event: string, callback: Function): () => void
  off(event: string, callback: Function): void
  emit(event: string, data?: any): void
  once(event: string, callback: Function): () => void
}

export const eventBus = new EventBus();
```

### Event Constants

```typescript
// src/js/utils/events.ts
export const Events = {
  BOOK_SAVED: 'book:saved',
  BOOK_DELETED: 'book:deleted',
  GENRES_CHANGED: 'genres:changed',
  FILTER_CHANGED: 'filter:changed',
  THEME_CHANGED: 'theme:changed',
} as const;
```

### Usage

```javascript
// Publisher (GenrePicker)
eventBus.emit(Events.GENRES_CHANGED, { genres: selectedGenres });

// Subscriber (form validation)
eventBus.on(Events.GENRES_CHANGED, ({ genres }) => {
  validateGenres(genres);
});

// Subscriber (dirty state)
eventBus.on(Events.GENRES_CHANGED, () => {
  setFormDirty(true);
});
```

## Consequences

### Positive
- **Decoupling**: Components don't know about each other
- **Extensibility**: Add listeners without modifying publishers
- **Testing**: Easy to test event emission and handling
- **Type safety**: Event constants prevent typos

### Negative
- **Indirection**: Harder to trace event flow
- **Memory leaks**: Must remember to unsubscribe
- **Debugging**: Events are less explicit than callbacks

### Best Practices

1. Use typed event constants, not string literals
2. Unsubscribe in component cleanup/destroy methods
3. Keep event payloads simple and serialisable
4. Document event flow in comments for complex interactions

### Current Usage

Components emitting events:
- **GenrePicker**: Emits `GENRES_CHANGED` on selection change
- **SeriesPicker**: Emits `SERIES_SELECTION_CHANGED` on selection change
- **WishlistRepository**: Emits `WISHLIST_UPDATED` after CRUD operations
- **BinRepository**: Emits `BOOK_DELETED`, `BOOK_RESTORED` on bin operations

Cache invalidation listeners (in `cache-invalidation.ts`):
- `BOOK_SAVED` → clears books cache
- `BOOK_DELETED` → clears books cache
- `BOOK_RESTORED` → clears books cache
- `GENRE_CREATED/UPDATED/DELETED` → clears genres cache
- `SERIES_CREATED/UPDATED/DELETED` → clears series cache

Picker components still call `onChange` callback for direct parent notification.
