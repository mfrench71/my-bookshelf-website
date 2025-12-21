# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Guidelines

- Do not automatically push commits to remote. Always wait for explicit user approval before pushing.
- When adding or updating features, always write or update corresponding tests. Run `npm test` to verify all tests pass before committing.
- Keep PROJECT.md up to date as features are added or changed. Mark completed items, add new ideas, update architecture notes.
- Keep README.md up to date with current features, tech stack, and setup instructions.
- For all changes, think about how we can minimise Firebase DB usage (reads, writes, listeners).

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
├── index.njk             # Login page (hideHeader: true)
├── books.njk             # Book list with sort/filter controls
├── add.njk               # Add book form with barcode scanner
├── book.njk              # Book detail/edit page
├── settings.njk          # Settings page (genres, export)
├── js/
│   ├── firebase-config.js  # Firebase initialization (exported: app, auth, db)
│   ├── header.js           # Common header logic (auth, menu, search)
│   ├── auth.js             # Login/register page logic
│   ├── books.js            # Book list rendering, sorting, filtering
│   ├── add.js              # Add book form, ISBN lookup, barcode scanner
│   ├── book-detail.js      # Book detail view and edit
│   ├── genres.js           # Genre CRUD operations and utilities
│   ├── genre-picker.js     # Reusable genre picker component
│   └── settings.js         # Settings page logic (genres, export)
├── css/tailwind.css      # Tailwind v4 with custom theme
└── sw.js                 # Service worker for PWA
```

### Data Flow
- **Firebase Auth**: `header.js` is the primary auth handler and redirects unauthenticated users
- **Firestore**: Books stored at `/users/{userId}/books` with real-time listeners
- **Book APIs**: Google Books API (primary) with Open Library fallback for ISBN lookup

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
- `utils.js` - escapeHtml, escapeAttr, normalizeText, debounce, parseTimestamp, formatDate, renderStars, showToast, initIcons, getContrastColor, isOnline, fetchWithTimeout, checkPasswordStrength, getCachedUserProfile, clearUserProfileCache
- `book-card.js` - bookCard component for rendering book list items with genre badges
- `genres.js` - loadUserGenres, createGenre, updateGenre, deleteGenre, GENRE_COLORS, getUsedColors, getAvailableColors
- `genre-picker.js` - GenrePicker class for multi-select genre input with typeahead and suggestions

Toast notifications support types: `showToast('message', { type: 'success' | 'error' | 'info' })`

## Testing

### Test Framework
- **Vitest** with jsdom environment for DOM testing
- Tests located in `tests/` directory
- Setup file with mocks in `tests/setup.js`

### Test Files
- `utils.test.js` - Unit tests for shared utilities
- `book-card.test.js` - Tests for book card component
- `books.test.js` - Tests for sorting and filtering logic
- `add.test.js` - Integration tests for book search and API interactions
- `book-detail.test.js` - Tests for book detail page and API refresh
- `genres.test.js` - Tests for genre CRUD operations and utilities
- `header.test.js` - Tests for header menu and search functionality
- `auth.test.js` - Tests for authentication page (login, register, password strength)
- `settings.test.js` - Tests for settings page (profile, genres, export, cleanup)
- `genre-picker.test.js` - Tests for genre picker component (filtering, selection, keyboard nav)

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
- Firestore collection: `/users/{userId}/books`
