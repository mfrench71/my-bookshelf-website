# ADR 005: Gradual TypeScript Migration

## Status

Accepted

## Context

The codebase was originally pure JavaScript. As it grew, we encountered:
- Type-related bugs (undefined properties, wrong argument types)
- Poor IDE autocomplete in larger files
- Difficulty understanding function signatures

Options:
1. **Full rewrite**: Convert everything to TypeScript at once
2. **Gradual migration**: Convert files incrementally as they're modified
3. **JSDoc types**: Add type annotations in comments, no TypeScript

## Decision

Use **gradual TypeScript migration**, starting with utilities and data layer.

### Migration Order

1. **Utilities** (`src/js/utils/*.ts`): Pure functions, easy to type
2. **Repositories** (`src/js/repositories/*.ts`): Data access layer
3. **Components** (`src/js/components/*.ts`): UI components
4. **Type definitions** (`src/js/types/index.d.ts`): Shared types
5. **Page scripts** (`src/js/books/*.js`): Last, as they have most DOM interaction

### Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "allowJs": true,
    "checkJs": false,
    "moduleResolution": "bundler"
  }
}
```

- `allowJs`: TypeScript coexists with JavaScript
- `checkJs: false`: Don't type-check JavaScript files
- `noEmit`: esbuild handles transpilation, tsc only type-checks

## Consequences

### Positive
- **Incremental**: No big-bang rewrite needed
- **Type safety**: Catch errors in converted files
- **IDE support**: Better autocomplete and refactoring
- **Documentation**: Types serve as documentation

### Negative
- **Inconsistency**: Mixed JS/TS codebase during migration
- **Build complexity**: esbuild handles both .js and .ts
- **Import paths**: Must maintain .js extensions for browser compatibility

### Current State

| Category | TypeScript | JavaScript |
|----------|------------|------------|
| Utilities | ✅ 80% | 20% |
| Repositories | ✅ 100% | 0% |
| Components | ✅ 70% | 30% |
| Page scripts | ❌ 0% | 100% |
| Schemas | ✅ 100% | 0% |
