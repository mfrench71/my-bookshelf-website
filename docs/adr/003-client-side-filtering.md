# ADR 003: Client-Side Filtering and Sorting

## Status

Accepted

## Context

The book list page needs filtering by genre, status, series, rating, and author, plus sorting by various fields. Options:

1. **Server-side filtering**: Query Firestore with filters, return only matching books
2. **Client-side filtering**: Fetch all books once, filter/sort in browser
3. **Hybrid**: Server-side for large result sets, client for small libraries

## Decision

Use **client-side filtering and sorting**.

### Reasons

1. **Firestore query limitations**: Complex multi-field filters require composite indexes. Each filter combination needs its own index. AND across multiple optional fields is cumbersome.

2. **Typical library size**: Most personal libraries are <1000 books. Fetching all and filtering client-side is efficient for this scale.

3. **Reduced reads**: With client-side filtering, we fetch books once and cache. Server-side filtering would re-query on every filter change.

4. **Responsiveness**: Filter changes are instant (no network round-trip).

5. **Offline support**: Filtering works offline since all data is local.

### Implementation

```javascript
// Fetch all books once (with caching)
const books = await getCachedBooks(userId);

// Apply filters in JavaScript
const filtered = applyFilters(books, {
  genres: selectedGenres,
  statuses: selectedStatuses,
  rating: minRating,
  author: authorFilter,
});

// Sort locally
const sorted = sortBooks(filtered, sortKey, direction);
```

## Consequences

### Positive
- Instant filter updates
- Works offline
- Reduced Firestore reads (and costs)
- No composite index management
- Flexible multi-field filtering

### Negative
- Higher memory usage (all books in memory)
- Initial load time increases with library size
- Not viable for libraries with 10,000+ books

### Scaling Considerations

If user libraries grow beyond ~2000 books:
1. Implement pagination with infinite scroll
2. Move common filters (status) to server-side
3. Keep full-text search client-side (pre-normalized fields)
4. Consider virtualised list rendering
