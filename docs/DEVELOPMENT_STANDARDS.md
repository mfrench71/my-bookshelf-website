# Development Standards & Implementation Roadmap

A comprehensive guide to coding standards, design patterns, and implementation sprints for the My Bookshelf project.

---

## Table of Contents

1. [Current Architecture](#current-architecture)
2. [SOLID Principles Checklist](#solid-principles-checklist)
3. [Sprint Checklists](#sprint-checklists)
4. [Design Patterns Reference](#design-patterns-reference)
5. [Success Metrics](#success-metrics)

---

## Current Architecture

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS + Nunjucks templates |
| Styling | Tailwind CSS v4 |
| Data | Firebase Firestore + Auth |
| Build | 11ty + esbuild |
| Testing | Vitest + Playwright |

### Code Organisation
```
src/js/
├── components/     # Reusable UI components (class-based)
├── utils/          # Utility functions (module pattern)
├── schemas/        # Zod validation schemas
├── books/          # Book page scripts
├── settings/       # Settings page scripts
├── widgets/        # Dashboard widgets
└── repositories/   # Data access (to be created)
```

### Current Patterns
- **Module Pattern**: Utilities export functions directly
- **Class Components**: UI components use ES6 classes with lifecycle methods
- **Callback Communication**: Components emit changes via `onChange` callbacks
- **In-Memory Caching**: 5-minute TTL for genres, series, books
- **Zod Validation**: All forms validated with schema definitions

### Current Metrics
| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Test Count | 2,438 | Maintain | ✅ |
| Coverage | 60%+ | Maintain | ✅ |
| Largest File | 1,688 lines | <1000 lines | ⚠️ |
| Linting | ESLint + Prettier | 0 errors | ✅ |
| TypeScript | 100% | 100% | ✅ |
| Repositories | 100% | 100% | ✅ |

---

## SOLID Principles Checklist

### Single Responsibility Principle (SRP)

**Status**: Partially Addressed ✅

Extracted utilities completed:
- [x] `book-filters.ts` - Filtering logic extracted
- [x] `book-sorters.ts` - Sorting logic extracted
- [x] `url-state.ts` - URL parameter handling extracted
- [x] `menu-handler.ts` - Header menu logic extracted
- [x] `recent-searches.ts` - Search history extracted

**Remaining large files** (future refactoring):
| File | Lines | Target |
|------|-------|--------|
| `books/index.ts` | 1,688 | <1000 |
| `settings/library.ts` | 1,118 | <800 |
| `books/add.ts` | 1,011 | <800 |

### Open/Closed Principle (OCP)

**Status**: Good ✅

- [x] Widget registry allows new widgets without modifying core
- [x] Filter strategies use composition (book-filters.ts)
- [x] Sort strategies use composition (book-sorters.ts)

### Liskov Substitution Principle (LSP)

**Status**: Good ✅

- [x] BaseWidget subclasses honour contract
- [x] BaseRepository subclasses honour contract
- [x] BasePicker subclasses honour contract

### Interface Segregation Principle (ISP)

**Status**: Complete ✅

- [x] Components have focused APIs
- [x] BasePicker base class for GenrePicker/SeriesPicker/AuthorPicker

### Dependency Inversion Principle (DIP)

**Status**: Complete ✅

- [x] Repository abstraction layer (BaseRepository, BookRepository, etc.)
- [x] All page scripts use repositories for data access
- [x] Event bus for decoupled communication
- [x] Easy to mock for testing

---

## Sprint Checklists

> **All sprints completed December 2025** ✅

### Sprint 1: Code Quality Foundation ✅
**Status**: Complete

- [x] ESLint configured with recommended rules
- [x] Prettier configured for code formatting
- [x] Husky pre-commit hooks running lint-staged
- [x] CI pipeline includes linting step
- [x] `npm run lint` passes with 0 errors

### Sprint 2: Security Automation ✅
**Status**: Complete

- [x] npm audit in CI (fails on high/critical)
- [x] Dependabot enabled for weekly updates
- [x] CodeQL analysis on push/PR and weekly schedule
- [x] No high/critical vulnerabilities

### Sprint 3: SRP Refactoring ✅
**Status**: Complete

Extracted utilities:
- [x] `book-filters.ts` - Filter logic with tests
- [x] `book-sorters.ts` - Sort logic with tests
- [x] `url-state.ts` - URL parameter handling with tests
- [x] `menu-handler.ts` - Header menu logic
- [x] `recent-searches.ts` - Search history

### Sprint 4: Repository Pattern ✅
**Status**: Complete

Repositories created:
- [x] `base-repository.ts` - Generic CRUD with pagination
- [x] `book-repository.ts` - ISBN lookup, series queries
- [x] `genre-repository.ts` - Colour management, book counts
- [x] `series-repository.ts` - Book counts, soft delete
- [x] `wishlist-repository.ts` - Duplicate checking, move to library
- [x] `bin-repository.ts` - Soft delete, restore, auto-purge

All page scripts migrated to use repositories.

### Sprint 5: TypeScript Migration ✅
**Status**: Complete (100%)

- [x] tsconfig.json configured
- [x] Type definitions in `src/js/types/`
- [x] All 73 files converted to TypeScript:
  - Utilities: 22 files
  - Repositories: 5 files
  - Components: 11 files
  - Page scripts: 21 files
  - Schemas: 8 files
  - Widgets: 5 files
  - Stores: 1 file

### Sprint 6: Event Bus ✅
**Status**: Complete

- [x] `event-bus.ts` with typed events
- [x] `events.ts` with event constants
- [x] `cache-invalidation.ts` for automatic cache clearing
- [x] 29 event bus tests
- [x] Used for: cache invalidation, picker changes, CRUD operations

---

## Design Patterns Reference

### Repository Pattern
**Use for**: Data access abstraction
```javascript
// Instead of:
const snapshot = await getDocs(collection(db, 'users', userId, 'books'));

// Use:
const books = await bookRepository.getAll(userId);
```

### Strategy Pattern
**Use for**: Extensible filtering/sorting
```javascript
const filterStrategies = {
  genre: (books, value) => books.filter(b => b.genres.includes(value)),
  status: (books, value) => books.filter(b => b.status === value),
};

function applyFilter(books, type, value) {
  return filterStrategies[type]?.(books, value) ?? books;
}
```

### Observer/Event Bus Pattern
**Use for**: Decoupled component communication
```javascript
// Publisher
eventBus.emit('genres:changed', { selected: ['fiction', 'sci-fi'] });

// Subscriber
eventBus.on('genres:changed', ({ selected }) => {
  updateFormState(selected);
});
```

### Registry Pattern
**Already used for**: Widgets
```javascript
widgetRegistry.register('currently-reading', CurrentlyReadingWidget);
widgetRegistry.get('currently-reading');
```

---

## Success Metrics

### Code Quality ✅
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| ESLint errors | 0 | 0 | ✅ |
| ESLint warnings | <10 | <10 | ✅ |
| Prettier compliance | 100% | 100% | ✅ |
| Pre-commit enforcement | Full | Full | ✅ |

### Security ✅
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| npm audit (high/critical) | 0 | 0 | ✅ |
| CodeQL alerts | 0 | 0 | ✅ |
| Dependabot enabled | Yes | Yes | ✅ |

### Architecture
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Largest file | 1,688 lines | <1000 lines | ⚠️ |
| Repository coverage | 100% | 100% | ✅ |
| Test coverage | 60%+ | 60%+ | ✅ |
| Test count | 2,438 | Maintain | ✅ |

### TypeScript ✅
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Type definitions | All entities | All entities | ✅ |
| Files converted | 73 (100%) | 100% | ✅ |
| `any` usage | Minimal | 0 in new code | ✅ |

---

## Quick Reference

### File Size Limits
- Page scripts: <30KB
- Components: <20KB
- Utilities: <10KB

### Naming Conventions
- Files: `kebab-case.js`
- Classes: `PascalCase`
- Functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Events: `namespace:action` (e.g., `books:created`)

### Import Order
1. External packages
2. Firebase imports
3. Repositories
4. Utilities
5. Components
6. Schemas
7. Relative imports

### Documentation Requirements
- All files: Header comment explaining purpose
- All functions: JSDoc with @param, @returns, @throws
- Complex logic: Inline comments explaining "why"
- Classes: Document constructor options

---

*Last updated: 2025-12-31*
