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
| Metric | Value | Target |
|--------|-------|--------|
| Test Count | 2,227 | Maintain |
| Coverage | 60%+ | Maintain |
| Largest File | 54KB | <25KB |
| Linting | None | 0 errors |

---

## SOLID Principles Checklist

### Single Responsibility Principle (SRP)

**Status**: Needs Improvement

| File | Current Size | Issues | Target |
|------|-------------|--------|--------|
| `books/index.js` | 54KB | Loading + filtering + sorting + rendering + pagination | <25KB |
| `books/add.js` | 45KB | Form + validation + API lookup + duplicate check | <25KB |
| `filter-panel.js` | 33KB | State + render + events + filtering | <25KB |
| `header.js` | 24KB | Auth + menu + search + offline status | <15KB |

**Refactoring Checklist**:
- [ ] Extract `book-filters.js` from books/index.js
- [ ] Extract `book-sorters.js` from books/index.js
- [ ] Extract `url-state.js` from books/index.js
- [ ] Extract `duplicate-checker.js` from books/add.js
- [ ] Split header.js into auth/search/menu handlers

### Open/Closed Principle (OCP)

**Status**: Partial Compliance

- [x] Widget registry allows new widgets without modifying core
- [ ] Filter types hardcoded in switch statements
- [ ] Sort options hardcoded in switch statements

**Improvement Checklist**:
- [ ] Create filter strategy registry
- [ ] Create sort strategy registry
- [ ] Use configuration objects for page behaviours

### Liskov Substitution Principle (LSP)

**Status**: Good (minimal inheritance)

- [x] BaseWidget subclasses honour contract
- [x] BaseRepository subclasses (when implemented) honour contract

### Interface Segregation Principle (ISP)

**Status**: Good

- [x] Components have focused APIs
- [ ] Consider extracting shared BasePicker interface

**Improvement Checklist**:
- [ ] Create BasePicker base class for GenrePicker/SeriesPicker/AuthorPicker

### Dependency Inversion Principle (DIP)

**Status**: Needs Improvement

- [ ] Page scripts directly import Firebase
- [ ] Hard to test without global mocks
- [ ] Tight coupling throughout

**Improvement Checklist**:
- [ ] Create repository abstraction layer
- [ ] Inject dependencies into page scripts
- [ ] Create factory functions for testability

---

## Sprint Checklists

### Sprint 1: Code Quality Foundation
**Goal**: Consistent code style, automated checks
**Estimated Effort**: 2-3 hours

#### 1.1 ESLint Setup
- [ ] Install ESLint: `npm install -D eslint`
- [ ] Create `.eslintrc.js` with rules:
  ```javascript
  module.exports = {
    env: { browser: true, es2022: true },
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    extends: ['eslint:recommended'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-prototype-builtins': 'error',
    }
  };
  ```
- [ ] Create `.eslintignore` (vendor, build output, node_modules)
- [ ] Run `npx eslint src/js --fix` to auto-fix issues
- [ ] Add `npm run lint` script to package.json
- [ ] Verify: `npm run lint` returns 0 errors

#### 1.2 Prettier Setup
- [ ] Install: `npm install -D prettier eslint-config-prettier`
- [ ] Create `.prettierrc`:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "tabWidth": 2,
    "trailingComma": "es5",
    "printWidth": 100
  }
  ```
- [ ] Create `.prettierignore` (same as eslintignore)
- [ ] Run `npx prettier --write src/` to format all files
- [ ] Add `npm run format` script to package.json
- [ ] Update ESLint extends to include `prettier`

#### 1.3 Pre-Commit Hooks
- [ ] Update lint-staged config in package.json:
  ```json
  "lint-staged": {
    "src/**/*.js": ["eslint --fix", "prettier --write"],
    "src/**/*.njk": ["npm test -- tests/form-html-alignment.test.js"]
  }
  ```
- [ ] Test pre-commit hook blocks bad code
- [ ] Verify existing tests still pass

#### Sprint 1 Completion Criteria
- [ ] `npm run lint` passes with 0 errors
- [ ] `npm run format` makes no changes (all formatted)
- [ ] Pre-commit hook blocks unformatted code
- [ ] CI pipeline includes linting step

---

### Sprint 2: Security Automation
**Goal**: Automated vulnerability detection
**Estimated Effort**: 1-2 hours

#### 2.1 npm audit in CI
- [ ] Add to `.github/workflows/ci.yml`:
  ```yaml
  - name: Security audit
    run: npm audit --audit-level=high
  ```
- [ ] Fix any existing high/critical vulnerabilities
- [ ] Verify CI fails on security issues

#### 2.2 Dependabot Setup
- [ ] Create `.github/dependabot.yml`:
  ```yaml
  version: 2
  updates:
    - package-ecosystem: "npm"
      directory: "/"
      schedule:
        interval: "weekly"
      open-pull-requests-limit: 10
      labels:
        - "dependencies"
  ```
- [ ] Verify Dependabot creates PRs for outdated deps

#### 2.3 CodeQL Analysis
- [ ] Create `.github/workflows/codeql.yml`:
  ```yaml
  name: "CodeQL"
  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]
    schedule:
      - cron: '0 0 * * 0'
  jobs:
    analyze:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: github/codeql-action/init@v2
          with:
            languages: javascript
        - uses: github/codeql-action/analyze@v2
  ```
- [ ] Verify CodeQL runs on push/PR
- [ ] Address any security alerts

#### Sprint 2 Completion Criteria
- [ ] `npm audit` shows no high/critical vulnerabilities
- [ ] Dependabot enabled and creating PRs
- [ ] CodeQL scanning active with no alerts
- [ ] Security checks run in CI

---

### Sprint 3: SRP Refactoring
**Goal**: Split large files, extract reusable utilities
**Estimated Effort**: 4-6 hours

#### 3.1 Extract Book Filtering Logic
- [ ] Create `src/js/utils/book-filters.js`:
  - [ ] `filterByGenres(books, genreIds)`
  - [ ] `filterByStatus(books, statuses)`
  - [ ] `filterBySeries(books, seriesIds)`
  - [ ] `filterByRating(books, minRating)`
  - [ ] `filterBySearch(books, query)`
  - [ ] `filterByAuthor(books, authorName)`
  - [ ] `applyFilters(books, filters)`
- [ ] Add tests in `tests/book-filters.test.js`
- [ ] Update `books/index.js` to use new utilities
- [ ] Verify book list filtering still works

#### 3.2 Extract Book Sorting Logic
- [ ] Create `src/js/utils/book-sorters.js`:
  - [ ] `sortByTitle(books, direction)`
  - [ ] `sortByAuthor(books, direction)`
  - [ ] `sortByDate(books, field, direction)`
  - [ ] `sortByRating(books, direction)`
  - [ ] `sortBySeries(books, seriesLookup, direction)`
  - [ ] `applySort(books, sortKey, lookups)`
- [ ] Add tests in `tests/book-sorters.test.js`
- [ ] Update `books/index.js` to use new utilities
- [ ] Verify book list sorting still works

#### 3.3 Extract URL State Logic
- [ ] Create `src/js/utils/url-state.js`:
  - [ ] `getFiltersFromUrl()`
  - [ ] `setFiltersInUrl(filters)`
  - [ ] `getSortFromUrl()`
  - [ ] `setSortInUrl(sortKey)`
- [ ] Add tests in `tests/url-state.test.js`
- [ ] Update `books/index.js` to use new utilities
- [ ] Verify URL params work correctly

#### 3.4 Extract Duplicate Checker
- [ ] Create `src/js/utils/duplicate-checker.js`:
  - [ ] `checkForDuplicate(userId, book)`
  - [ ] `checkIsbnDuplicate(userId, isbn)`
  - [ ] `checkTitleAuthorDuplicate(userId, title, author)`
- [ ] Add tests in `tests/duplicate-checker.test.js`
- [ ] Update `books/add.js` to use new utilities
- [ ] Verify duplicate detection works

#### 3.5 Split Header Logic
- [ ] Create `src/js/header/auth-handler.js`
- [ ] Create `src/js/header/search-handler.js`
- [ ] Create `src/js/header/menu-handler.js`
- [ ] Update `header.js` to orchestrate handlers
- [ ] Verify header functionality intact

#### Sprint 3 Completion Criteria
- [ ] `books/index.js` < 25KB
- [ ] `books/add.js` < 30KB
- [ ] `header.js` < 15KB
- [ ] All new utilities have tests
- [ ] Test coverage maintained at 60%+
- [ ] All E2E tests pass

---

### Sprint 4: Repository Pattern
**Goal**: Abstract data access, improve testability
**Estimated Effort**: 4-6 hours

#### 4.1 Create Base Repository
- [ ] Create `src/js/repositories/base-repository.js`:
  ```javascript
  export class BaseRepository {
    constructor(collectionPath) { ... }
    async getAll(userId) { ... }
    async getById(userId, id) { ... }
    async create(userId, data) { ... }
    async update(userId, id, data) { ... }
    async delete(userId, id) { ... }
  }
  ```
- [ ] Add JSDoc documentation

#### 4.2 Create Book Repository
- [ ] Create `src/js/repositories/book-repository.js`:
  - [ ] Extend BaseRepository
  - [ ] Add `getByIsbn(userId, isbn)`
  - [ ] Add `getBySeriesId(userId, seriesId)`
  - [ ] Add `updateGenres(userId, bookId, genreIds)`
  - [ ] Add `search(userId, query, options)`
- [ ] Add tests in `tests/repositories/book-repository.test.js`

#### 4.3 Create Genre Repository
- [ ] Create `src/js/repositories/genre-repository.js`:
  - [ ] Migrate logic from `genres.js`
  - [ ] Add `getByName(userId, name)`
  - [ ] Add `updateBookCount(userId, genreId, delta)`
- [ ] Add tests

#### 4.4 Create Series Repository
- [ ] Create `src/js/repositories/series-repository.js`:
  - [ ] Migrate logic from `series.js`
  - [ ] Add `getByName(userId, name)`
  - [ ] Add `updateBookCount(userId, seriesId, delta)`
- [ ] Add tests

#### 4.5 Migrate Page Scripts
- [ ] Update `books/index.js` to use bookRepository
- [ ] Update `books/add.js` to use bookRepository
- [ ] Update `books/edit.js` to use bookRepository
- [ ] Update `books/view.js` to use bookRepository
- [ ] Verify all CRUD operations work

#### Sprint 4 Completion Criteria
- [ ] All repositories created with full CRUD
- [ ] Repository tests cover all operations
- [ ] Page scripts use repositories (not direct Firestore)
- [ ] All existing tests pass
- [ ] E2E tests pass

---

### Sprint 5: TypeScript Migration
**Goal**: Gradual type safety adoption
**Estimated Effort**: 6-8 hours

#### 5.1 Setup TypeScript Environment
- [ ] Install: `npm install -D typescript`
- [ ] Create `jsconfig.json` (for checkJs):
  ```json
  {
    "compilerOptions": {
      "checkJs": true,
      "allowJs": true,
      "strict": false,
      "noEmit": true,
      "target": "ES2022",
      "module": "ES2022",
      "moduleResolution": "node"
    },
    "include": ["src/js/**/*"],
    "exclude": ["src/js/vendor/**/*"]
  }
  ```
- [ ] Verify IDE shows type errors
- [ ] Fix critical type errors

#### 5.2 Create Type Definitions
- [ ] Create `src/js/types/index.d.ts`:
  - [ ] Book interface
  - [ ] Genre interface
  - [ ] Series interface
  - [ ] User interface
  - [ ] WishlistItem interface
- [ ] Verify types available in IDE

#### 5.3 Convert Utilities to TypeScript
- [ ] Convert `utils/format.js` -> `format.ts`
- [ ] Convert `utils/dom.js` -> `dom.ts`
- [ ] Convert `utils/helpers.js` -> `helpers.ts`
- [ ] Convert `utils/cache.js` -> `cache.ts`
- [ ] Update imports in dependent files
- [ ] Verify build works

#### 5.4 Convert Repositories to TypeScript
- [ ] Convert `repositories/base-repository.js` -> `.ts`
- [ ] Convert `repositories/book-repository.js` -> `.ts`
- [ ] Convert `repositories/genre-repository.js` -> `.ts`
- [ ] Convert `repositories/series-repository.js` -> `.ts`
- [ ] Verify full type safety in repositories

#### 5.5 Update Build Pipeline
- [ ] Update `scripts/build-js.js` to handle `.ts` files
- [ ] Verify esbuild handles TypeScript
- [ ] Update Vitest config for TypeScript tests
- [ ] Verify all tests pass

#### Sprint 5 Completion Criteria
- [ ] TypeScript/jsconfig configured
- [ ] Type definitions created for all entities
- [ ] Utilities converted to TypeScript
- [ ] Repositories converted to TypeScript
- [ ] Build pipeline handles .ts files
- [ ] No `any` types in converted code
- [ ] IDE autocomplete working

---

### Sprint 6: Event Bus (Optional)
**Goal**: Decouple component communication
**Estimated Effort**: 4-6 hours

#### 6.1 Create Event Bus
- [ ] Create `src/js/utils/event-bus.js`:
  ```javascript
  class EventBus {
    constructor() { this.listeners = new Map(); }
    on(event, callback) { ... }
    off(event, callback) { ... }
    emit(event, data) { ... }
    once(event, callback) { ... }
  }
  export const eventBus = new EventBus();
  ```
- [ ] Add tests in `tests/event-bus.test.js`
- [ ] Document event naming conventions

#### 6.2 Define Event Contracts
- [ ] Document events:
  - `auth:login` / `auth:logout`
  - `books:created` / `books:updated` / `books:deleted`
  - `genres:changed`
  - `series:changed`
  - `filters:changed`
- [ ] Create TypeScript types for event payloads

#### 6.3 Migrate Component Communication
- [ ] Update GenrePicker to emit events
- [ ] Update SeriesPicker to emit events
- [ ] Update page scripts to listen for events
- [ ] Verify all component interactions work

#### Sprint 6 Completion Criteria
- [ ] Event bus implemented and tested
- [ ] Event contracts documented
- [ ] At least 2 components migrated to events
- [ ] All tests pass

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

### Code Quality
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| ESLint errors | N/A | 0 | [ ] |
| ESLint warnings | N/A | <10 | [ ] |
| Prettier compliance | N/A | 100% | [ ] |
| Pre-commit enforcement | Partial | Full | [ ] |

### Security
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| npm audit (high/critical) | Unknown | 0 | [ ] |
| CodeQL alerts | N/A | 0 | [ ] |
| Dependabot enabled | No | Yes | [ ] |

### Architecture
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Largest file | 54KB | <25KB | [ ] |
| Repository coverage | 0% | 100% | [ ] |
| Test coverage | 60% | 60%+ | [ ] |

### TypeScript
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Type definitions | None | All entities | [ ] |
| Files converted | 0 | Utilities + Repos | [ ] |
| `any` usage | N/A | 0 in new code | [ ] |

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

*Last updated: 2025-12-30*
