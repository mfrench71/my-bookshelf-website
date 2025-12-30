# ADR 002: Firebase as Backend Platform

## Status

Accepted

## Context

The app needs:
- User authentication (email/password)
- Database for books, genres, series
- File storage for cover images
- Offline support
- No server infrastructure to manage

Options considered:
1. **Firebase**: Auth + Firestore + Storage, serverless
2. **Custom backend**: Node.js/Python API + PostgreSQL
3. **Supabase**: PostgreSQL alternative to Firebase
4. **Local-only**: IndexedDB with optional cloud sync

## Decision

Use **Firebase** (Auth + Firestore + Storage).

### Reasons

1. **Serverless**: No backend code to write, deploy, or maintain
2. **Integrated auth**: Firebase Auth handles signup, login, password reset
3. **Real-time capable**: Firestore supports real-time listeners (though we use on-demand)
4. **Offline persistence**: Firestore caches data in IndexedDB automatically
5. **Security rules**: Declarative rules enforce data isolation per user
6. **Free tier**: Generous limits for personal use (1GB storage, 50K reads/day)

### Trade-offs Accepted

- **Vendor lock-in**: Migrating away from Firestore would be significant work
- **Query limitations**: No joins, limited compound queries, requires denormalisation
- **Cost at scale**: Per-operation pricing can become expensive with growth

## Consequences

### Positive
- Zero backend maintenance
- Built-in offline support
- Automatic scaling
- Secure by default (with proper rules)

### Negative
- Firebase SDK adds ~100KB to bundle
- Query flexibility limited vs SQL
- Pricing unpredictable at scale
- Vendor dependency

### Data Model

User data isolated under `/users/{userId}/`:
```
/users/{userId}/
  /books/{bookId}
  /genres/{genreId}
  /series/{seriesId}
  /bin/{bookId}
  /wishlist/{itemId}
```

Security enforced by Firestore rules:
```javascript
match /users/{userId}/{document=**} {
  allow read, write: if request.auth.uid == userId;
}
```
