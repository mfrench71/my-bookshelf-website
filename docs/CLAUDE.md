# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Guidelines

- Do not automatically push commits to remote. Always wait for explicit user approval before pushing.
- Apply logical commits as you work. Group related changes together and commit after completing each logical unit of work (e.g., after creating a new file/component, after fixing a bug, after updating tests).
- When adding or updating features, always write or update corresponding tests. Run `npm test` to verify all tests pass before committing.
- Remove redundant code. When refactoring or replacing functionality, delete the old code entirely. Don't leave commented-out code, unused imports, or dead functions.
- Keep PROJECT.md up to date as features are added or changed. Update roadmap, architecture notes, and current sprint status.
- Keep CHANGELOG.md up to date with notable changes, grouped by date. Include features, bug fixes, and breaking changes. The in-app changelog is auto-generated from this file at build time.
- **Changelog rules**:
  - Never reference CLAUDE.md or other internal documentation files in the changelog (it's user-facing)
  - Version numbers are sourced from the Version History table at the bottom of CHANGELOG.md (not package.json)
  - Use SemVer: bump minor version for each date section (feature sets), patch for bug fixes within a release
- Keep README.md up to date with current features, tech stack, and setup instructions.
- Keep `src/privacy.njk` up to date when data collection or storage practices change. Update the "Last updated" date and relevant sections (e.g., if adding analytics, new APIs, or changing data retention).
- For all changes, think about how we can minimise Firebase DB usage (reads, writes, listeners).
- **No orphaned data**: When deleting records, ensure all related data is also cleaned up (e.g., deleting a book must also delete its images from Storage, deleting a series should handle orphaned book references). Always consider: "What other data depends on this record?"
- Always use British English for user-facing text (e.g., "colour" not "color", "favourite" not "favorite", "organised" not "organized").
- Always show user-friendly error messages, never expose raw `error.message` to users. Log technical details to console for debugging, but display helpful messages like "Failed to save. Please try again." instead of technical errors.
- **Always read before reusing**: Before applying an existing CSS class or reusing a component, read its implementation first to understand what it does. Classes may have fixed dimensions, colours, or behaviours that don't apply to your use case. Create new utility classes when needed rather than misusing existing ones.

## Code Documentation (MANDATORY)

All JavaScript and TypeScript code must include proper documentation:

### File Headers
Every `.js` or `.ts` file should start with a brief comment explaining its purpose:
```javascript
// Genre Picker Component
// A reusable multi-select component for picking genres
```

### Function Docblocks
All functions (except trivial one-liners) must have JSDoc-style docblocks:
```javascript
/**
 * Create a new genre for the user
 * @param {string} userId - The user's Firebase UID
 * @param {string} name - The genre name
 * @param {string} [color] - Optional hex colour code (defaults to next available)
 * @returns {Promise<Object>} The created genre object with id, name, color
 * @throws {Error} If genre with same name already exists
 */
async function createGenre(userId, name, color) { ... }
```

### Required Docblock Elements
- **Description**: Brief explanation of what the function does
- **@param**: Each parameter with type and description
- **@returns**: Return type and description (if not void)
- **@throws**: Document thrown errors where relevant

### Inline Comments
- Use inline comments for complex logic that isn't self-evident
- Explain *why*, not *what* (the code shows what, comments explain why)
- Don't over-comment obvious code

```javascript
// BAD: Incrementing counter
counter++;

// GOOD: Reset counter after 5 retries to prevent infinite loops
if (counter >= 5) counter = 0;
```

### Class Documentation
Classes should document their purpose and key methods:
```javascript
/**
 * SeriesPicker - Single-select series picker with typeahead, position input, and create option
 */
export class SeriesPicker {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Container element to render into
   * @param {string} options.userId - Current user's ID
   * @param {Function} options.onChange - Callback when selection changes
   */
  constructor({ container, userId, onChange = () => {} }) { ... }
}
```

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
- [ ] Form inputs have associated labels? (`<label for="input-id">` or `aria-labelledby`)
- [ ] Images have alt text? (decorative images use `alt=""`)
- [ ] Colour contrast sufficient? (4.5:1 for text, 3:1 for large text)
- [ ] Focus visible on all interactive elements? (don't remove outline without replacement)
- [ ] Keyboard navigable? (all functionality reachable without mouse)
- [ ] Skip link present? (`#main-content` target on all pages)
- [ ] ARIA roles used correctly? (don't override semantic HTML)
- [ ] Dynamic content announced? (`aria-live` regions for async updates)
- [ ] Touch targets 44px minimum? (mobile tap areas)

### Semantic HTML (MANDATORY)

**Use semantic HTML elements correctly** to ensure proper document structure and accessibility.

**Base Layout Structure:**
- `base.njk` provides the `<main id="main-content">` wrapper for all pages
- Page templates should NOT include their own `<main>` element (it's provided by the layout)
- Use `<div>` or `<section>` for content sections within pages
- Never create duplicate element IDs (e.g., two elements with `id="main-content"`)

**Landmark Elements:**
- `<header>` - site header (provided by `header.njk`)
- `<nav>` - navigation menus, breadcrumbs
- `<main>` - primary page content (ONE per page, provided by base.njk)
- `<section>` - thematic groupings with headings
- `<aside>` - sidebar content (e.g., filter panel)
- `<footer>` - site footer (provided by `footer.njk`)

**Common Mistakes to Avoid:**
```html
<!-- ❌ WRONG: Nested main elements (base.njk already provides <main>) -->
<main id="main-content">
  <main id="content">...</main>
</main>

<!-- ✅ CORRECT: Use div/section within the page template -->
<div id="book-content" class="max-w-2xl mx-auto px-4 py-6">
  ...
</div>

<!-- ❌ WRONG: Duplicate IDs -->
<div id="loading">...</div>
<div id="loading">...</div>

<!-- ✅ CORRECT: Unique IDs -->
<div id="loading-skeleton">...</div>
<div id="book-content">...</div>
```

### Form Label Association (MANDATORY)

**Every form input must have an associated label.** Screen readers need this to announce what each field is for.

```html
<!-- CORRECT: Use 'for' attribute matching input 'id' -->
<label for="email" class="...">Email</label>
<input id="email" type="email" ...>

<!-- CORRECT: For dynamically generated inputs, use unique IDs -->
<label for="widget-count-${id}" class="...">Items:</label>
<select id="widget-count-${id}" ...>

<!-- CORRECT: Use aria-labelledby for inputs with visible labels elsewhere -->
<label id="genre-picker-label" class="...">Genres</label>
<input aria-labelledby="genre-picker-label" ...>

<!-- WRONG: Label exists but not associated -->
<label class="...">Email</label>
<input id="email" type="email" ...>  <!-- Label has no 'for' -->

<!-- WRONG: No label at all -->
<input type="text" placeholder="Enter name...">  <!-- Placeholder is NOT a label -->
```

**For dynamically generated forms in JS:**
- Use instance counters for unique IDs when multiple components exist
- Prefer `aria-labelledby` for complex label structures
- Add `aria-label` directly to inputs when labels are not visible

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
- **Bottom Sheets (not modals)**: Use `BottomSheet` class for confirmations, quick forms, pickers. Mobile (<768px): slides up from bottom with swipe-to-dismiss handle. Tablet+ (768px+): centered modal with full border-radius. Use `md:hidden` to hide handle on larger screens.
- **No native dialogs**: Never use `alert()`, `confirm()`, or `prompt()`. Always use BottomSheet for confirmations and custom UI for user input. Native dialogs break the app-like experience and can't be styled.
- **Form navigation protection**: Use `interceptNavigation()` to show ConfirmSheet when user clicks in-app links (header, breadcrumbs) with unsaved form changes. Keep `beforeunload` as fallback for browser navigation (back, refresh, close) which can't be customised. See `add.js` and `edit.js` for examples.
- **Toasts**: Use `showToast(message, { type: 'success' | 'error' | 'info' })`
- **Icons**: Use Lucide icons and call `initIcons()` after dynamic insertion
- **Empty states**: Consistent styling throughout the app:
  ```html
  <!-- Standard empty state pattern -->
  <div class="text-center py-12">  <!-- py-8 for compact/inline sections -->
    <i data-lucide="icon-name" class="w-12 h-12 text-gray-300 mx-auto" aria-hidden="true"></i>
    <p class="text-gray-500 mt-3">Primary message</p>
    <p class="text-gray-400 text-sm mt-1">Secondary explanation text.</p>
    <!-- Optional action button -->
    <a href="/action/" class="inline-flex items-center gap-2 px-4 py-2 mt-4 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors min-h-[44px]">
      <i data-lucide="action-icon" class="w-4 h-4" aria-hidden="true"></i>
      <span>Action Text</span>
    </a>
  </div>
  ```
  - **Icon**: Plain Lucide icon, `w-12 h-12 text-gray-300 mx-auto` (no colored circles)
  - **Title**: `text-gray-500 mt-3`
  - **Description**: `text-gray-400 text-sm mt-1`
  - **Padding**: `py-12` for page-level, `py-8` for inline/compact sections
- **Error states**: Red border, error message below input, clear on valid input

### App-Like UI Patterns

This PWA should feel like a native mobile app. Follow these patterns consistently:

**Navigation:**
- Use breadcrumbs for hierarchy (not browser back button reliance)
- Avoid full page refreshes where possible
- Maintain scroll position when returning to lists
- Use slide transitions for navigation (left/right for hierarchy, up/down for modals)

**Loading & Feedback:**
- Show skeleton loaders immediately (never blank screens)
- Use optimistic UI updates (update UI before server confirms)
- Disable buttons during async operations with loading spinner
- Haptic feedback on significant actions (Android only via `navigator.vibrate()`)

**Touch Interactions:**
- All touch targets minimum 44×44px
- Active states on touch (`active:scale-95`, `active:bg-*`)
- Swipe gestures for bottom sheets (dismiss by dragging down)
- Pull-to-refresh on list pages (trigger data reload)
- Long-press for context menus (future enhancement)

**Transitions & Animations:**
- Page content: fade in on load (`animation: pageIn 300ms ease-out`)
- Modals/sheets: slide up from bottom with backdrop fade
- List items: stagger animation on initial render
- State changes: crossfade (skeleton → content)
- Keep all animations under 300ms
- Respect `prefers-reduced-motion` (disable animations)

**Offline Behaviour:**
- Show offline indicator banner when disconnected
- Cache critical data for offline access
- Queue actions when offline, sync when online
- Graceful degradation (read-only mode if needed)

**Visual Consistency:**
- Consistent spacing scale (Tailwind: 2, 3, 4, 6, 8)
- Consistent border radius (rounded-lg for cards, rounded-full for avatars)
- Consistent shadows (shadow-sm for cards, shadow-lg for modals)
- Consistent icon sizes (w-5 h-5 for inline, w-6 h-6 for buttons)

**Anti-Patterns to Avoid:**
- ❌ Browser alert/confirm/prompt dialogs
- ❌ Hover-only interactions (must work on touch)
- ❌ Tiny touch targets (< 44px)
- ❌ Jarring instant transitions (no animation)
- ❌ Blocking the UI during data fetch
- ❌ Losing scroll position on navigation
- ❌ Form data loss on navigation (warn user)
- ❌ Desktop-style dropdowns on mobile (use bottom sheets)

### Form Validation (MANDATORY)

**ALL forms must use the validation system** - including modal forms. Never bypass validation for "simple" forms.

```javascript
// Required imports
import { validateForm, showFieldError, clearFormErrors } from '/js/utils/validation.js';
import { SomeSchema } from '/js/schemas/your-schema.js';

// On form submit
clearFormErrors(form);
const result = validateForm(SomeSchema, formData);
if (!result.success) {
  showFormErrors(form, result.errors);
  return;
}

// On modal open - clear previous errors
clearFormErrors(form);

// On form switch (e.g., login ↔ register) - clear AND reset
clearFormErrors(previousForm);
newForm.reset();
// Reset any dynamic UI (password strength, etc.)
```

**Validation state must be cleared when:**
1. Opening a modal form (fresh start)
2. Switching between alternate forms (login ↔ register)
3. Closing and reopening a form
4. Navigating away and back

**Never do this:**
```javascript
// ❌ WRONG - Manual validation with toast
if (!name) {
  showToast('Name is required', { type: 'error' });
  return;
}

// ❌ WRONG - Inline checks without field-level errors
if (password.length < 8) {
  showToast('Password too short', { type: 'error' });
  return;
}
```

**Error display hierarchy:**
1. **Field-level errors**: Red border + error text below input (primary)
2. **Toast notifications**: For server errors, network failures, success messages (secondary)
3. **Never**: Toast-only for validation errors

**Scroll to first invalid field:**
When validation fails, scroll the first invalid field into view so users can see what needs fixing. This is especially important for long forms or forms that extend below the viewport.

```javascript
// After showing form errors, scroll to first invalid field
if (!result.success) {
  showFormErrors(form, result.errors);
  scrollToFirstError(form);  // Scroll first error into view
  return;
}
```

The `scrollToFirstError()` utility:
- Finds the first field with `.border-red-500` class (error styling)
- Scrolls it into view with `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- Accounts for sticky headers using `scroll-margin-top` CSS on inputs
- Focus behavior: disabled on mobile (avoids virtual keyboard popup), enabled on desktop

```css
/* Ensure inputs account for sticky header when scrolled into view */
input, textarea, select {
  scroll-margin-top: 80px; /* Height of sticky header + padding */
}
```

## Build & Development Commands

```bash
# Full build (11ty + JS/TS + Tailwind CSS)
npm run build

# Development with live reload (builds CSS first, then serves with 11ty)
npm run start

# Individual build steps
npm run build:11ty      # Build HTML from Nunjucks templates
npm run build:js        # Bundle and minify JavaScript/TypeScript
npm run build:css       # Compile and minify Tailwind CSS

# Watch modes (for development)
npm run watch:11ty      # 11ty with --serve
npm run watch:css       # Tailwind with --watch

# TypeScript
npm run typecheck       # Run TypeScript type checking
npm run typecheck:watch # Type check in watch mode

# Local testing (after build)
npx serve _site

# Run tests
npm test              # Run all tests once
npm run test:watch    # Watch mode for development
npm run test:coverage # Run with coverage report

# Code quality
npm run lint          # Run ESLint
npm run lint:fix      # Run ESLint with auto-fix
npm run format        # Format code with Prettier

# Lighthouse audit (requires server running on port 8080)
npm run audit         # Run Lighthouse on key pages, outputs to reports/
```

## Architecture

### Build System
- **11ty (Eleventy)** generates HTML from Nunjucks templates in `src/` to `_site/`
- **esbuild** bundles and minifies JavaScript/TypeScript entry points to `_site/js/`
- **TypeScript** is used for utilities and repositories (gradual migration from JS)
- **Tailwind CSS v4** compiles `src/css/tailwind.css` to `_site/css/styles.css`

### Directory Structure
```
src/
├── _layouts/base.njk     # Base HTML template (header, footer, flex layout)
├── _includes/
│   ├── header.njk        # Common header partial (menu, search overlay)
│   └── footer.njk        # Site-wide footer (copyright, privacy link, version)
├── _data/
│   ├── changelog.js      # Parses CHANGELOG.md for in-app display
│   └── package.js        # Exposes package.json version to templates
├── index.njk             # Home page (/)
├── login.njk             # Login/register page (/login/)
├── privacy.njk           # Privacy policy page (/privacy/)
├── books/
│   ├── index.njk         # Book list (/books/)
│   ├── add.njk           # Add book form (/books/add/)
│   ├── view.njk          # Book view page (/books/view/?id=X)
│   └── edit.njk          # Book edit page (/books/edit/?id=X)
├── settings/
│   ├── index.njk         # Profile settings (/settings/)
│   ├── library.njk       # Library settings (/settings/library/)
│   ├── preferences.njk   # Preferences (/settings/preferences/)
│   ├── maintenance.njk   # Maintenance tools (/settings/maintenance/)
│   └── about.njk         # About & changelog (/settings/about/)
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
│   ├── settings/           # Settings page logic (split by section)
│   │   ├── profile.js      # Profile, password, account deletion
│   │   ├── library.js      # Genres, series, backup/restore
│   │   ├── preferences.js  # Sync settings, widgets
│   │   ├── maintenance.js  # Data cleanup, cover fetch
│   │   └── about.js        # Changelog accordion
│   ├── components/         # Reusable UI components (TypeScript)
│   │   ├── author-picker.ts  # Single-select author input with library suggestions
│   │   ├── book-card.ts      # Book card for list display
│   │   ├── breadcrumb.ts     # Breadcrumb navigation
│   │   ├── cover-picker.ts   # Cover image source picker
│   │   ├── filter-panel.ts   # Sort/filter sidebar and bottom sheet
│   │   ├── genre-picker.ts   # Multi-select genre input
│   │   ├── modal.ts          # Modal and ConfirmModal components
│   │   ├── rating-input.ts   # Star rating input
│   │   └── series-picker.ts  # Series selection with position input
│   ├── repositories/       # Data access layer (TypeScript)
│   │   ├── base-repository.ts  # Common CRUD operations
│   │   ├── book-repository.ts  # Book-specific queries
│   │   ├── genre-repository.ts # Genre-specific queries
│   │   └── series-repository.ts # Series-specific queries
│   ├── types/              # TypeScript type definitions
│   │   └── index.d.ts      # Shared types for the app
│   ├── utils/              # Utility functions (JS and TS)
│   │   ├── format.ts       # Date and text formatting
│   │   ├── helpers.ts      # Misc helper functions
│   │   ├── dom.ts          # DOM utilities
│   │   ├── cache.ts        # Local storage caching
│   │   ├── sync-settings.ts # Sync preferences
│   │   ├── visibility-refresh.ts # Auto-refresh on tab focus
│   │   └── event-bus.ts     # Pub/sub event bus
│   ├── genres.ts           # Genre CRUD operations and utilities
│   ├── series.ts           # Series CRUD operations and utilities
│   └── widgets/            # Dashboard widget system
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
- `utils.js` - escapeHtml, escapeAttr, normalizeText, normalizeGenreName, normalizeTitle, normalizeAuthor, normalizePublisher, normalizePublishedDate, debounce, throttle, parseTimestamp, formatDate, renderStars, showToast, initIcons, getContrastColor, isOnline, isMobile, isValidImageUrl, fetchWithTimeout, checkPasswordStrength, getCachedUserProfile, clearUserProfileCache, lockBodyScroll, unlockBodyScroll, getHomeSettings, saveHomeSettings, getCachedISBNData, setCachedISBNData, lookupISBN, getSyncSettings, saveSyncSettings, resetSyncSettings, getDefaultSyncSettings, setupVisibilityRefresh, getLastRefreshTime, setLastRefreshTime, interceptNavigation
- `genres.ts` - loadUserGenres, createGenre, updateGenre, deleteGenre, createGenreLookup, GENRE_COLORS, getUsedColors, getAvailableColors
- `series.ts` - loadUserSeries, createSeries, updateSeries, deleteSeries, createSeriesLookup, updateSeriesBookCounts, clearSeriesCache
- `utils/library-health.js` - analyzeLibraryHealth, calculateLibraryCompleteness, getCompletenessRating, fixBookFromAPI, fixBooksFromAPI, HEALTH_FIELDS
- `utils/book-filters.js` - filterByRating, filterByGenres, filterByStatuses, filterBySeriesIds, filterByAuthor, applyFilters
- `utils/book-sorters.js` - sortBooks, getAuthorSurname, SORT_OPTIONS, DEFAULT_SORT
- `utils/reading.js` - getBookStatus (reading status calculation)
- `utils/duplicate-checker.js` - isISBN, cleanISBN, checkForDuplicate, DUPLICATE_CHECK_LIMIT
- `utils/event-bus.ts` - EventBus class, eventBus singleton, Events constants (pub/sub for decoupled component communication)

Data access layer in `src/js/repositories/` (TypeScript):
- `base-repository.ts` - BaseRepository class with common CRUD operations (getAll, getById, create, update, delete, queryByField, getWithOptions)
- `book-repository.ts` - BookRepository extending base with getByIsbn, getBySeriesId, isSeriesPositionTaken, getActive, getDeleted, getByGenreId, getRecent, softDelete, restore
- `genre-repository.ts` - GenreRepository extending base with getByNormalizedName, getAllSorted, nameExists, getByIds, incrementBookCount
- `series-repository.ts` - SeriesRepository extending base with findByName, getAllSorted, getActive, getDeleted, nameExists, softDelete, restore, incrementBookCount, getByIds

Reusable UI components in `src/js/components/` (TypeScript):
- `author-picker.ts` - AuthorPicker class for single-select author input with library suggestions and book counts
- `book-card.ts` - BookCard component for rendering book list items with genre/series badges
- `breadcrumb.ts` - Breadcrumb navigation with presets for each page type
- `cover-picker.ts` - CoverPicker for selecting from Google Books or Open Library covers
- `filter-panel.ts` - FilterPanel for sort/rating/genre/status/series filters (sidebar + bottom sheet)
- `genre-picker.ts` - GenrePicker class for multi-select genre input with typeahead
- `modal.ts` - Modal and ConfirmModal components with escape/backdrop handling
- `rating-input.ts` - RatingInput for star rating selection
- `series-picker.ts` - SeriesPicker class for single-select series input with position

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
- `filter-panel.test.js` - Tests for FilterPanel component (render, filters, onChange, reset)
- `genre-picker.test.js` - Tests for genre picker component (filtering, selection, keyboard nav)
- `series.test.js` - Tests for series CRUD operations
- `series-picker.test.js` - Tests for series picker component
- `series-progress-widget.test.js` - Tests for series progress widget
- `sync-settings.test.js` - Tests for sync settings storage
- `visibility-refresh.test.js` - Tests for visibility-based auto-refresh
- `library-health.test.js` - Tests for library health analysis and fix functions
- `form-html-alignment.test.js` - Tests that HTML form elements match Zod schema field names
- `base-repository.test.js` - Tests for BaseRepository CRUD operations
- `book-repository.test.js` - Tests for BookRepository specific methods
- `event-bus.test.js` - Tests for EventBus pub/sub pattern

### E2E Tests (Playwright)
- `e2e/auth.spec.js` - Login/register form interactions
- `e2e/navigation.spec.js` - Page navigation and accessibility
- `e2e/validation.spec.js` - Form validation flows (empty submit, error display, error clearing)
- `e2e/accessibility.spec.js` - Automated a11y testing with axe-core (WCAG 2.1 AA)

### Pre-Commit Hooks
Husky runs on every commit:
1. **lint-staged**: Runs relevant tests for changed files
   - `.njk` changes → form-html-alignment tests
   - `schemas/*.js` changes → schema tests
2. **Critical tests**: Always runs alignment + schema tests

### Coverage Thresholds
CI fails if coverage drops below:
- Lines: 60%
- Functions: 60%
- Branches: 50%
- Statements: 60%

Run `npm run test:coverage` to check locally.

### Testing Limitations (Important!)

Unit tests with mocked DOM **do not catch**:
- HTML element `name` attributes not matching schema field names
- Validation errors not displaying due to CSS/DOM structure issues
- Modal open/close clearing form state incorrectly
- Real user interaction flows (blur, focus, submit)

**When validation changes are made**, manually test in browser:
1. Submit empty required fields → verify field-level errors appear
2. Enter invalid data → verify specific error messages
3. Fix errors → verify error styling clears
4. Modal forms: open, submit empty, close, reopen → verify clean state

For comprehensive coverage, add Playwright E2E tests (see `e2e/` directory).

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

### SEO Audit

**Meta Tags & Open Graph**
- [ ] Every page has unique `<title>` tag (50-60 chars)?
- [ ] Every page has `<meta name="description">` (150-160 chars)?
- [ ] Open Graph tags present? (`og:title`, `og:description`, `og:image`, `og:url`)
- [ ] Twitter Card meta tags present?
- [ ] Canonical URL set on all pages?
- [ ] Language attribute on `<html>` tag?

**Semantic HTML & Structure**
- [ ] Single `<h1>` per page matching page purpose?
- [ ] Heading hierarchy correct? (h1 → h2 → h3, no skips)
- [ ] Semantic elements used? (`<main>`, `<nav>`, `<article>`, `<section>`)
- [ ] Images have descriptive `alt` text?
- [ ] Links have descriptive text (not "click here")?

**Technical SEO**
- [ ] sitemap.xml exists and lists all public pages?
- [ ] robots.txt exists and allows crawling of public pages?
- [ ] No broken internal links (404s)?
- [ ] Page load time acceptable? (< 3 seconds)
- [ ] Mobile-friendly? (responsive, readable text, tap targets)

**Content & URLs**
- [ ] URLs are clean and descriptive? (no query strings for content pages)
- [ ] No duplicate content across pages?
- [ ] Important content visible without JavaScript? (for crawlers)

**Structured Data (Optional)**
- [ ] JSON-LD schema for relevant content? (Book, WebSite, etc.)
- [ ] Schema validates at schema.org validator?

**Crawlability**
- [ ] Auth-required pages excluded from sitemap?
- [ ] Login/register pages have `noindex` if not needed in search?
- [ ] Internal linking between related pages?

### Mobile UX Audit

**Touch Targets**
- [ ] All interactive elements (buttons, links, inputs) minimum 44x44px?
- [ ] Icon-only buttons use `min-w-[44px] min-h-[44px]` with centered content?
- [ ] Small buttons inside badges/chips have `p-1` padding minimum?
- [ ] Adequate spacing between adjacent touch targets (8px+ gap)?

**Viewport & Safe Areas**
- [ ] Viewport meta includes `viewport-fit=cover` for notch handling?
- [ ] Fixed elements (FAB, toast) use `env(safe-area-inset-*)` padding?
- [ ] Bottom sheets account for home indicator on iOS?

**Scrolling & Overflow**
- [ ] No horizontal scroll on any page?
- [ ] Long text uses `break-words` or `truncate` where appropriate?
- [ ] Images constrained with `max-w-full`?
- [ ] Modals/sheets scrollable if content overflows (`max-h-[90vh] overflow-y-auto`)?
- [ ] No nested scroll conflicts (inner scroll blocks outer gesture)?

**Forms & Input**
- [ ] Input font size 16px+ to prevent iOS zoom on focus?
- [ ] Appropriate `inputmode` for keyboard type (`numeric`, `email`, `tel`)?
- [ ] `autocomplete` attributes for autofill support?
- [ ] Submit buttons accessible when keyboard is open?
- [ ] Form errors visible without scrolling?

**Gestures & Feedback**
- [ ] Touch feedback on interactive elements (`active:` states)?
- [ ] Swipe gestures work correctly (bottom sheets, carousels)?
- [ ] No 300ms tap delay (`touch-action: manipulation`)?
- [ ] Pull-to-refresh works where expected (book list)?
- [ ] Tap highlight disabled (`-webkit-tap-highlight-color: transparent`)?

**Performance**
- [ ] No layout shift during loading (skeleton loaders match final size)?
- [ ] Images lazy loaded with `loading="lazy"`?
- [ ] Heavy operations don't block UI (use async/debounce)?

**Common Mobile Patterns**
```html
<!-- Touch target for icon button -->
<button class="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
  <i data-lucide="x" class="w-5 h-5"></i>
</button>

<!-- Safe area padding for fixed bottom element -->
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .fixed-bottom {
    bottom: calc(1rem + env(safe-area-inset-bottom));
  }
}

<!-- Prevent iOS zoom on input focus -->
<input class="text-base" ...>  <!-- 16px minimum -->
```

### Form Validation Audit
- [ ] All forms use Zod schemas (no manual `if (!value)` checks)?
- [ ] Input `name` attributes match schema field names exactly?
- [ ] Required fields marked with asterisk (`<span class="text-red-500">*</span>`)?
- [ ] Validation errors shown inline near field (not toast-only)?
- [ ] Error messages are helpful (not just "Invalid")?
- [ ] Form state preserved on validation failure?
- [ ] Submit button disabled during submission?
- [ ] Modal forms clear errors when opening (`clearFormErrors()`)?
- [ ] Form switching clears errors AND resets form (`clearFormErrors()` + `form.reset()`)?
- [ ] Dynamic UI (password strength, etc.) reset when switching forms?
- [ ] Success feedback shown after submission?
- [ ] Scroll to first invalid field on validation failure (`scrollToFirstError()`)?
- [ ] Inputs have `scroll-margin-top` to account for sticky headers?

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

### Core Web Vitals Audit

Core Web Vitals are Google's key metrics for user experience. Test with Lighthouse or PageSpeed Insights.

**LCP (Largest Contentful Paint) - Target: < 2.5s**
- [ ] Hero images optimised and served in modern formats (WebP/AVIF)?
- [ ] Critical CSS inlined or loaded early?
- [ ] Web fonts preloaded with `<link rel="preload">`?
- [ ] Server response time (TTFB) acceptable?
- [ ] Largest element (usually hero image or heading) loads quickly?
- [ ] No render-blocking resources in `<head>`?

**CLS (Cumulative Layout Shift) - Target: < 0.1**
- [ ] Images have explicit `width`/`height` or aspect-ratio?
- [ ] Fonts use `font-display: swap` with fallback sizing?
- [ ] Dynamic content has reserved space (skeleton loaders)?
- [ ] Ads/embeds have reserved dimensions?
- [ ] Icons have explicit dimensions before Lucide loads?
- [ ] No content inserted above existing content after load?

**INP (Interaction to Next Paint) - Target: < 200ms**
- [ ] Event handlers complete quickly (< 50ms)?
- [ ] Long tasks broken up with `requestAnimationFrame` or `setTimeout`?
- [ ] Heavy computations moved to Web Workers?
- [ ] Input handlers debounced/throttled appropriately?
- [ ] No synchronous operations blocking main thread?
- [ ] DOM updates batched to minimise reflows?

**Other Performance Metrics**
- [ ] FCP (First Contentful Paint) < 1.8s?
- [ ] TTI (Time to Interactive) acceptable?
- [ ] Total Blocking Time < 200ms?
- [ ] JavaScript execution time reasonable?

**Testing Commands**
```bash
# Run Lighthouse audit locally
npx lighthouse http://localhost:8080 --view

# Or use Chrome DevTools
# 1. Open DevTools (F12)
# 2. Go to "Lighthouse" tab
# 3. Select "Performance" and run audit
```

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

### Privacy/GDPR Audit

**Data Collection & Consent**
- [ ] Privacy policy exists and is up to date (`/privacy/`)?
- [ ] Privacy policy accurately describes all data collected?
- [ ] No data collected beyond what's necessary for functionality?
- [ ] Third-party services disclosed? (Firebase, book APIs)
- [ ] Analytics/tracking disclosed if present?

**User Rights (GDPR Article 15-22)**
- [ ] Users can view their data? (profile, book list)
- [ ] Users can export their data? (Export My Data feature)
- [ ] Users can delete their account and all data?
- [ ] Data deletion is complete? (Firestore subcollections, bin, wishlist)
- [ ] No data retained after deletion request?

**Data Security**
- [ ] Sensitive data encrypted in transit? (HTTPS)
- [ ] No sensitive data in localStorage? (tokens, passwords)
- [ ] Firestore rules restrict access to own data only?
- [ ] No PII logged to console in production?
- [ ] Session tokens expire appropriately?

**Data Minimisation**
- [ ] Only necessary fields stored?
- [ ] No tracking cookies without consent?
- [ ] Book cover URLs fetched on-demand (not stored if unnecessary)?
- [ ] Deleted items purged after retention period? (30-day bin)

**Third-Party Data Sharing**
- [ ] No user data shared with third parties without consent?
- [ ] API requests don't leak user identity? (book lookups are anonymous)
- [ ] Firebase Analytics configured appropriately (or disabled)?

### Browser Compatibility Audit

**Core Functionality**
- [ ] Works in Chrome (latest 2 versions)?
- [ ] Works in Safari (latest 2 versions)?
- [ ] Works in Firefox (latest 2 versions)?
- [ ] Works in Edge (latest 2 versions)?
- [ ] Works in Safari iOS?
- [ ] Works in Chrome Android?

**PWA Features**
- [ ] Service worker registers in all browsers?
- [ ] App installable on iOS Safari? (Add to Home Screen)
- [ ] App installable on Android Chrome?
- [ ] Offline mode works across browsers?
- [ ] Push notifications work (if implemented)?

**iOS Safari Quirks**
- [ ] No 300ms tap delay? (`touch-action: manipulation`)
- [ ] Viewport height correct? (100vh issues with address bar)
- [ ] Input zoom prevented? (font-size >= 16px)
- [ ] Safe area insets handled? (`env(safe-area-inset-*)`)
- [ ] Momentum scrolling works? (`-webkit-overflow-scrolling: touch`)
- [ ] Date inputs work correctly?

**CSS Compatibility**
- [ ] Flexbox/Grid works in all browsers?
- [ ] CSS custom properties (variables) supported?
- [ ] Backdrop blur has fallback? (`backdrop-filter`)
- [ ] No `-webkit-` prefixes missing where needed?

**JavaScript Compatibility**
- [ ] No ES2022+ features without transpilation?
- [ ] Optional chaining (`?.`) supported in target browsers?
- [ ] Nullish coalescing (`??`) supported?
- [ ] `fetch` API available? (or polyfilled)
- [ ] `IntersectionObserver` available for lazy loading?

**Testing Commands**
```bash
# Test with BrowserStack or similar
# Or use browser dev tools device emulation

# Check for compatibility issues
npx browserslist  # See target browsers from package.json
```

### Accessibility Audit
Run automated and manual accessibility checks.

**Automated Testing**
```bash
# Run E2E accessibility tests (axe-core)
npm run test:e2e
```
- [ ] All axe-core tests pass?
- [ ] No critical or serious violations?

**Manual Checks**
- [ ] Keyboard navigation works for all interactive elements?
- [ ] Focus order is logical (left-to-right, top-to-bottom)?
- [ ] Focus indicator visible on all focusable elements?
- [ ] Screen reader announces content correctly? (test with VoiceOver/NVDA)
- [ ] Colour contrast meets WCAG AA (4.5:1 text, 3:1 large text)?
- [ ] All images have appropriate alt text?
- [ ] Form inputs have associated labels?
- [ ] Error messages are announced to screen readers?
- [ ] Skip link works and is visible on focus?
- [ ] No content relies solely on colour to convey meaning?

### Security Audit
Review code for common vulnerabilities.

**XSS Prevention**
- [ ] All user input escaped before rendering? (`escapeHtml()`, `escapeAttr()`)
- [ ] No `innerHTML` with unsanitised user data?
- [ ] Template literals don't include raw user input?
- [ ] URL parameters validated before use?

**Input Validation**
- [ ] All forms use Zod schemas?
- [ ] Server-side validation via Firestore rules?
- [ ] File uploads validated (type, size)?
- [ ] No SQL/NoSQL injection vectors?

**Authentication & Authorisation**
- [ ] Firestore rules restrict access to own data only?
- [ ] No sensitive data in localStorage?
- [ ] Session handling secure?
- [ ] Password requirements enforced?

**API Security**
- [ ] API keys not exposed in client code? (Firebase config is OK)
- [ ] External API calls validated?
- [ ] No arbitrary URL fetching from user input?

**Testing Commands**
```bash
# Check innerHTML usage vs escapeHtml usage
grep -rn "innerHTML\s*=" src/js --include="*.js" | wc -l
grep -rn "escapeHtml\|escapeAttr" src/js --include="*.js" | wc -l
```

### Test Coverage Audit
Verify test coverage meets project thresholds.

**Coverage Thresholds**
- [ ] Lines: ≥60%
- [ ] Functions: ≥60%
- [ ] Branches: ≥50%
- [ ] Statements: ≥60%

**Testing Commands**
```bash
# Run coverage report
npm run test:coverage

# Check for untested files
# Look for files with 0% coverage in report
```

**Coverage Gaps to Address**
- [ ] New features have corresponding tests?
- [ ] Edge cases covered (empty states, errors, boundaries)?
- [ ] Integration points tested (API calls, Firebase)?
- [ ] UI components have render tests?

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
