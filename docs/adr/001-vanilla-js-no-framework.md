# ADR 001: Use Vanilla JS Without Framework

## Status

Accepted

## Context

When building this book tracking PWA, we needed to decide on a frontend approach. Options considered:

1. **React/Vue/Svelte**: Popular frameworks with component models and state management
2. **Vanilla JavaScript**: Direct DOM manipulation with native browser APIs
3. **Lightweight alternatives**: Preact, Alpine.js, or similar

Key considerations:
- This is a personal/small-scale app, not enterprise software
- PWA requirements (offline, fast load, installable)
- Learning curve and long-term maintenance
- Bundle size and performance
- Firebase SDK already adds significant weight

## Decision

Use **Vanilla JavaScript** without a framework.

### Reasons

1. **Bundle size**: No framework overhead (React: ~40KB, Vue: ~30KB minified+gzipped). With Firebase SDK already at ~100KB, keeping JS lightweight matters for PWA performance.

2. **Simplicity**: For a book library app, complex state management isn't needed. Most state is straightforward (user's books, filters, form data).

3. **Longevity**: Vanilla JS doesn't go out of date. No migration headaches when frameworks release breaking changes or fall out of fashion.

4. **PWA fit**: Direct control over service worker, caching, and offline behaviour without framework abstractions.

5. **Learning**: Understanding DOM APIs directly before abstracting with frameworks.

### Mitigations for Framework Benefits

- **Components**: Class-based components (GenrePicker, SeriesPicker, FilterPanel) provide reusability
- **Type safety**: TypeScript for utilities and repositories
- **Validation**: Zod schemas for form validation
- **Event handling**: Custom event bus for component communication
- **Templating**: Nunjucks for HTML generation at build time

## Consequences

### Positive
- Fast initial load (~50KB JS before Firebase)
- No build complexity for framework
- Direct browser API access
- No framework-specific knowledge required

### Negative
- Manual DOM updates (no virtual DOM diffing)
- More boilerplate for component state
- No built-in reactivity
- Less ecosystem (no pre-built component libraries)

### Mitigations
- Careful DOM update patterns (update specific elements, not full re-renders)
- Class-based components with render methods
- Event bus for decoupled communication
