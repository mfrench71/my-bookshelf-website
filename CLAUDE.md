# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Guidelines

- Do not automatically push commits to remote. Always wait for explicit user approval before pushing.
- Apply logical commits as you work. Group related changes together and commit after completing each logical unit of work (e.g., after creating a new file/component, after fixing a bug, after updating tests).
- When adding or updating features, always write or update corresponding tests. Run `npm test` to verify all tests pass before committing.
- Remove redundant code. When refactoring or replacing functionality, delete the old code entirely. Don't leave commented-out code, unused imports, or dead functions.
- Keep PROJECT.md up to date as features are added or changed. Update roadmap, architecture notes, and current sprint status.
- Keep CHANGELOG.md up to date with notable changes, grouped by date. Include features, bug fixes, and breaking changes. The in-app changelog is auto-generated from this file at build time.
- Keep README.md up to date with current features, tech stack, and setup instructions.
- For all changes, think about how we can minimise Firebase DB usage (reads, writes, listeners).
- Always use British English for user-facing text (e.g., "colour" not "color", "favourite" not "favorite", "organised" not "organized").

## UI/UX Principles (CRITICAL)

This is a **mobile-first PWA** that should feel like a native app. Every feature must prioritise:

### Core Principles
1. **App-like Experience**: Instant feedback, smooth transitions, no page refreshes feeling
2. **Responsive Design**: Mobile-first, works beautifully on all screen sizes
3. **Snappy Interactions**: Immediate visual feedback on every tap/click
4. **Lazy Loading**: Load content progressively, never block the UI
5. **Offline-First**: App remains functional without network

### Performance Requirements
- **Touch targets**: Minimum 44px for all interactive elements
- **Feedback latency**: Visual response within 100ms of user action
- **Loading states**: Show skeletons/spinners, never blank screens
- **Animations**: Use CSS transitions (not JS), keep under 300ms
- **Images**: Lazy load with `loading="lazy"`, show placeholders
- **Minimise CLS**: Reserve space for async content (icons, images) to prevent layout shift:
  - Icons: Ensure `[data-lucide]` elements have explicit dimensions before Lucide loads
  - Images: Use fixed aspect ratios or explicit width/height
  - Dynamic content: Use skeleton loaders that match final dimensions

### Consistency Checklist
- [ ] Does this match the visual style of similar components?
- [ ] Are button/icon colours semantically correct? (see Colour Scheme below)
- [ ] Are error messages consistent with other forms?
- [ ] Are empty states consistent with other empty states?
- [ ] Are loading states consistent with other loading states?
- [ ] Do buttons/inputs follow the same sizing and styling?
- [ ] Are toast messages using the correct type (success/error/info)?
- [ ] Is the spacing and layout consistent with other pages?
- [ ] Does it feel responsive and snappy on mobile?
- [ ] Is there immediate visual feedback on interaction?

### Security Checklist
- [ ] User input escaped before rendering? Use `escapeHtml()` for text, `escapeAttr()` for attributes
- [ ] No innerHTML with unsanitised user data? Prefer `textContent` or escape first
- [ ] Form inputs validated? Use Zod schemas from `src/js/schemas/`
- [ ] Firestore rules enforced? Users can only access their own data (`/users/{userId}/`)
- [ ] No sensitive data in localStorage? (tokens, passwords, API keys)
- [ ] External URLs validated? Don't fetch arbitrary user-provided URLs
- [ ] File uploads validated? Check type, size, and sanitise filenames

### Accessibility Checklist
- [ ] Interactive elements have accessible names? (`aria-label` for icon-only buttons)
- [ ] Form inputs have associated labels? (`<label for="">` or `aria-label`)
- [ ] Images have alt text? (decorative images use `alt=""`)
- [ ] Colour contrast sufficient? (4.5:1 for text, 3:1 for large text)
- [ ] Focus visible on all interactive elements? (don't remove outline without replacement)
- [ ] Keyboard navigable? (all functionality reachable without mouse)
- [ ] Skip link present? (`#main-content` target on all pages)
- [ ] ARIA roles used correctly? (don't override semantic HTML)
- [ ] Dynamic content announced? (`aria-live` regions for async updates)
- [ ] Touch targets 44px minimum? (mobile tap areas)

### Design Tokens
Use the design tokens defined in `src/css/tailwind.css`:
- Colours: `primary`, `primary-dark`, `primary-light`, `success`, `error`, `warning`, `info`
- Shadows: `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`
- Border radius: `radius-sm`, `radius-md`, `radius-lg`, `radius-xl`, `radius-full`
- Transitions: `transition-fast`, `transition-normal`, `transition-slow`

### Semantic Colour Scheme
Follow the colour scheme documented in PROJECT.md. Key rules:
- **Primary (blue)**: Default actions, links, navigation
- **Green**: Success, completion, "Finished" status, create/add actions
- **Red**: Destructive actions (delete), errors, logout
- **Blue (light)**: "Reading" status badges, informational
- **Purple**: Series-related (badges, progress, icons)
- **Amber**: Maintenance/cleanup/utility tasks
- **Gray**: Neutral, secondary actions, cancel buttons

### Component Patterns
- Forms: Use validation schemas from `src/js/schemas/` and helpers from `src/js/utils/validation.js`
- Toasts: Use `showToast(message, { type: 'success' | 'error' | 'info' })`
- Icons: Use Lucide icons and call `initIcons()` after dynamic insertion
- Empty states: Show helpful message with icon and action button where appropriate
- Error states: Red border, error message below input, clear on valid input

## Build & Development Commands

```bash
# Full build (11ty + Tailwind CSS)
npm run build

# Development with live reload (builds CSS first, then serves with 11ty)
npm run start

# Individual build steps
npm run build:11ty      # Build HTML from Nunjucks templates
npm run build:css       # Compile and minify Tailwind CSS

# Watch modes (for development)
npm run watch:11ty      # 11ty with --serve
npm run watch:css       # Tailwind with --watch

# Local testing (after build)
npx serve _site

# Run tests
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
npm run test:coverage # Run with coverage report
```

## Architecture

### Build System
- **11ty (Eleventy)** generates HTML from Nunjucks templates in `src/` to `_site/`
- **Tailwind CSS v4** compiles `src/css/tailwind.css` to `_site/css/styles.css`
- Static files (JS, icons, manifest, service worker) are passed through unchanged

### Directory Structure
```
src/
├── _layouts/base.njk     # Base HTML template (conditionally includes header)
├── _includes/header.njk  # Common header partial (menu, search overlay)
├── index.njk             # Home page (/)
├── login.njk             # Login/register page (/login/)
├── books/
│   ├── index.njk         # Book list (/books/)
│   ├── add.njk           # Add book form (/books/add/)
│   ├── view.njk          # Book view page (/books/view/?id=X)
│   └── edit.njk          # Book edit page (/books/edit/?id=X)
├── settings.njk          # Settings page (/settings/)
├── js/
│   ├── firebase-config.js  # Firebase initialization
│   ├── index.js            # Home page logic
│   ├── login.js            # Login/register page logic
│   ├── header.js           # Common header logic (auth, menu, search)
│   ├── books/              # Book-related page logic
│   │   ├── index.js        # Book list rendering, sorting, filtering
│   │   ├── add.js          # Add book form, ISBN lookup, barcode scanner
│   │   ├── view.js         # Book view page (read-only display)
│   │   └── edit.js         # Book edit page (form-based editing)
│   ├── components/         # Reusable UI components
│   │   ├── book-card.js    # Book card for list display
│   │   ├── cover-picker.js # Cover image source picker
│   │   ├── genre-picker.js # Multi-select genre input
│   │   ├── modal.js        # Modal and ConfirmModal components
│   │   └── rating-input.js # Star rating input
│   ├── genres.js           # Genre CRUD operations and utilities
│   ├── series.js           # Series CRUD operations and utilities
│   ├── widgets/            # Dashboard widget system
│   └── settings.js         # Settings page logic
├── css/tailwind.css      # Tailwind v4 with custom theme
└── sw.js                 # Service worker for PWA
```

### Data Flow
- **Firebase Auth**: `header.js` is the primary auth handler and redirects unauthenticated users
- **Firestore**: Books, genres, and series stored under `/users/{userId}/` with on-demand fetching (no real-time listeners)
- **Book APIs**: Google Books API (primary) with Open Library fallback for ISBN lookup
- **Caching**: 5-minute TTL caches for books, genres, and series to reduce Firestore reads

### Key Patterns
- Pages set `hideHeader: true` in frontmatter to hide the common header (e.g., login page)
- Sub-navigation with back buttons appears below the header on detail pages
- `lucide.createIcons()` must be called after dynamically inserting icon markup

## Tailwind CSS v4 Syntax

This project uses Tailwind v4 which has different syntax:
```css
@import "tailwindcss";
@source "../../src/**/*.{njk,html,js}";

@theme {
  --color-primary: #3b82f6;
  --color-primary-dark: #2563eb;
}
```

## Shared Modules

Common utilities are consolidated in shared modules:
- `utils.js` - escapeHtml, escapeAttr, normalizeText, normalizeGenreName, normalizeTitle, normalizeAuthor, normalizePublisher, normalizePublishedDate, debounce, throttle, parseTimestamp, formatDate, renderStars, showToast, initIcons, getContrastColor, isOnline, isMobile, isValidImageUrl, fetchWithTimeout, checkPasswordStrength, getCachedUserProfile, clearUserProfileCache, lockBodyScroll, unlockBodyScroll, getHomeSettings, saveHomeSettings, getCachedISBNData, setCachedISBNData, lookupISBN
- `genres.js` - loadUserGenres, createGenre, updateGenre, deleteGenre, createGenreLookup, GENRE_COLORS, getUsedColors, getAvailableColors
- `series.js` - loadUserSeries, createSeries, updateSeries, deleteSeries, createSeriesLookup, updateSeriesBookCounts, clearSeriesCache

Reusable UI components in `src/js/components/`:
- `book-card.js` - BookCard component for rendering book list items with genre/series badges
- `cover-picker.js` - CoverPicker for selecting from Google Books or Open Library covers
- `genre-picker.js` - GenrePicker class for multi-select genre input with typeahead
- `series-picker.js` - SeriesPicker class for single-select series input with position
- `modal.js` - Modal and ConfirmModal components with escape/backdrop handling
- `rating-input.js` - RatingInput for star rating selection

Toast notifications support types: `showToast('message', { type: 'success' | 'error' | 'info' })`

## Testing

### Test Framework
- **Vitest** with jsdom environment for DOM testing
- Tests located in `tests/` directory
- Setup file with mocks in `tests/setup.js`

### Test Files
- `utils.test.js` - Unit tests for shared utilities
- `book-card.test.js` - Tests for book card component
- `books-index.test.js` - Tests for sorting and filtering logic
- `books-add.test.js` - Integration tests for book search and API interactions
- `genres.test.js` - Tests for genre CRUD operations and utilities
- `header.test.js` - Tests for header menu and search functionality
- `index.test.js` - Tests for home page dashboard
- `login.test.js` - Tests for authentication page (login, register, password strength)
- `settings.test.js` - Tests for settings page (profile, genres, series, export, cleanup)
- `genre-picker.test.js` - Tests for genre picker component (filtering, selection, keyboard nav)
- `series.test.js` - Tests for series CRUD operations
- `series-picker.test.js` - Tests for series picker component
- `series-progress-widget.test.js` - Tests for series progress widget

### Pre-Deployment
All tests must pass before deploying:
```bash
npm test && npm run build
```

### CI/CD
- **GitHub Actions**: Runs on push/PR to main (`.github/workflows/ci.yml`)
- **Netlify**: Build command includes tests (`npm test && npm run build`)
- Deployment will fail if any tests fail

## Firebase Project

- Project ID: `book-tracker-b786e`
- Auth: Email/password
- Firestore collections:
  - `/users/{userId}/books` - User's book library
  - `/users/{userId}/genres` - User's custom genres
  - `/users/{userId}/series` - User's book series

## Periodic Audit Checklists

Run these audits periodically to maintain code quality:

### Dependencies Audit
```bash
npm audit                    # Check for vulnerabilities
npm outdated                 # Check for outdated packages
```
- [ ] No high/critical vulnerabilities?
- [ ] Dependencies reasonably up to date?
- [ ] No unused dependencies in package.json?

### PWA/Service Worker Audit
- [ ] Service worker registered successfully?
- [ ] Offline page works when network unavailable?
- [ ] Cache strategy appropriate? (network-first for API, cache-first for assets)
- [ ] manifest.json valid? (icons, theme colours, display mode)
- [ ] App installable on mobile?

### Error Handling Audit
- [ ] All async operations have try/catch?
- [ ] User-friendly error messages shown (not raw errors)?
- [ ] Errors logged to console for debugging?
- [ ] Network failures handled gracefully?
- [ ] Form submission errors don't lose user input?

### Mobile UX Audit
- [ ] Touch targets minimum 44x44px?
- [ ] No horizontal scroll on mobile?
- [ ] Forms usable with mobile keyboard?
- [ ] Modals scrollable if content overflows?
- [ ] Pull-to-refresh works where expected?
- [ ] Viewport meta tag correct? (`width=device-width, initial-scale=1`)

### Form Validation Audit
- [ ] Required fields clearly marked?
- [ ] Validation errors shown inline near field?
- [ ] Error messages are helpful (not just "Invalid")?
- [ ] Form state preserved on validation failure?
- [ ] Submit button disabled during submission?
- [ ] Success feedback shown after submission?

### Memory/Cleanup Audit
- [ ] Event listeners removed when component unmounts?
- [ ] Intervals/timeouts cleared on cleanup?
- [ ] No listeners on removed DOM elements?
- [ ] Large data structures cleared when no longer needed?

### Bundle Size Audit
- [ ] No duplicate dependencies?
- [ ] Large libraries tree-shaken or lazy loaded?
- [ ] Images optimised and appropriately sized?
- [ ] Vendor files minified?

### Scalability Audit
- [ ] Firestore queries use proper indexes?
- [ ] Pagination implemented for large collections? (don't load all at once)
- [ ] Caching reduces repeated reads? (localStorage, in-memory)
- [ ] Batch writes used where possible? (writeBatch for multiple docs)
- [ ] No N+1 query patterns? (fetching related data in loops)
- [ ] Images use appropriate sizes? (thumbnails vs full-size)
- [ ] Search uses efficient indexing? (pre-normalized fields)
- [ ] Large lists virtualized? (only render visible items)
- [ ] API calls debounced/throttled where appropriate?
- [ ] Real-time listeners minimized? (prefer on-demand fetching)

## Competitor Reference

When researching features, check how these apps handle similar functionality:

| App | Focus | URL |
|-----|-------|-----|
| **Goodreads** | Largest community, crowdsourced data | [goodreads.com](https://goodreads.com) |
| **StoryGraph** | Mood/pacing analysis, stats | [thestorygraph.com](https://thestorygraph.com) |
| **BookTrack.app** | iOS native, reading timer, OCR quotes | [booktrack.app](https://booktrack.app) |
| **Literal** | Quote-centric, public API | [literal.club](https://literal.club) |
| **Hardcover** | Modern UI, ad-free, per-book privacy | [hardcover.app](https://hardcover.app) |
| **Oku** | Minimalist design | [oku.club](https://oku.club) |

Useful research links:
- [StoryGraph Roadmap](https://roadmap.thestorygraph.com/) - See requested features and planned improvements
- [Book Riot Comparison](https://bookriot.com/best-book-tracking-app/) - Reviews of book tracking apps
