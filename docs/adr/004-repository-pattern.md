# ADR 004: Repository Pattern for Data Access

## Status

Accepted

## Context

Firebase/Firestore calls were scattered throughout page scripts, making:
- Testing difficult (requires mocking Firebase globally)
- Code duplication (same queries written multiple times)
- Migration risky (tight coupling to Firestore API)

## Decision

Implement a **Repository Pattern** to abstract data access.

### Structure

```
src/js/repositories/
├── base-repository.ts    # Common CRUD operations
├── book-repository.ts    # Book-specific queries
├── genre-repository.ts   # Genre-specific queries
└── series-repository.ts  # Series-specific queries
```

### BaseRepository

```typescript
class BaseRepository<T> {
  constructor(protected collectionName: string) {}

  async getAll(userId: string): Promise<T[]>
  async getById(userId: string, id: string): Promise<T | null>
  async create(userId: string, data: Partial<T>): Promise<string>
  async update(userId: string, id: string, data: Partial<T>): Promise<void>
  async delete(userId: string, id: string): Promise<void>
  async queryByField(userId: string, field: string, value: any): Promise<T[]>
}
```

### Specialised Repositories

```typescript
class BookRepository extends BaseRepository<Book> {
  async getByIsbn(userId: string, isbn: string): Promise<Book | null>
  async getBySeriesId(userId: string, seriesId: string): Promise<Book[]>
  async softDelete(userId: string, id: string): Promise<void>
  async restore(userId: string, id: string): Promise<void>
}
```

## Consequences

### Positive
- **Testability**: Mock repositories easily without Firebase
- **Single source**: One place for each query type
- **Type safety**: TypeScript generics ensure correct types
- **Abstraction**: Page scripts don't know about Firestore

### Negative
- **Indirection**: Extra layer between pages and data
- **Incomplete migration**: Some direct Firestore calls remain in legacy code

### Migration Path

1. Created base and entity repositories
2. New code uses repositories
3. Refactor existing code incrementally
4. Eventually remove all direct Firestore imports from pages
