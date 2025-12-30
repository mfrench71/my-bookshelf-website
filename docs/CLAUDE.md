# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Core Guidelines

- **No auto-push**: Wait for explicit user approval before pushing
- **Logical commits**: Group related changes, commit after each logical unit
- **Tests required**: Write/update tests for all changes; run `npm test` before committing
- **Remove dead code**: Delete old code entirely when refactoring - no commented code, unused imports
- **Update docs**: Keep PROJECT.md, CHANGELOG.md, README.md current
- **British English**: Use colour, favourite, organised (not American spellings)
- **User-friendly errors**: Never expose raw `error.message` - show helpful messages like "Failed to save. Please try again."
- **Minimise Firebase**: Consider read/write impact for all changes
- **No orphaned data**: Clean up related data when deleting records
- **Read before reuse**: Check existing CSS/components before using them

### Changelog Rules
- Never reference CLAUDE.md in changelog (it's user-facing)
- Use SemVer: minor for features, patch for fixes
- Version numbers from CHANGELOG.md Version History table

## Code Documentation

**File headers**: Brief comment explaining purpose
```javascript
// Genre Picker Component - Multi-select for picking genres
```

**Function docblocks** (except trivial one-liners):
```javascript
/**
 * Create a new genre
 * @param {string} userId - Firebase UID
 * @param {string} name - Genre name
 * @returns {Promise<Object>} Created genre
 * @throws {Error} If name already exists
 */
```

**Inline comments**: Explain *why*, not *what*

## UI/UX Principles

**Mobile-first PWA** - must feel like native app:
- Touch targets: minimum 44px
- Visual response: within 100ms
- Loading states: skeletons/spinners, never blank screens
- Animations: CSS only, under 300ms
- Images: `loading="lazy"`, show placeholders

### Colour Scheme
- **Primary (blue)**: Default actions, links
- **Green**: Success, completion, create/add
- **Red**: Destructive, errors, logout
- **Purple**: Series-related
- **Amber**: Maintenance/utility tasks
- **Gray**: Neutral, cancel

### Component Patterns
- **Bottom Sheets**: Use `BottomSheet` class (not modals) for confirmations
- **No native dialogs**: Never use `alert()`, `confirm()`, `prompt()`
- **Toasts**: `showToast('message', { type: 'success' | 'error' | 'info' })`
- **Icons**: Lucide + `initIcons()` after dynamic insertion
- **Empty states**: `w-12 h-12 text-gray-300` icon, `text-gray-500` message

### Form Validation (MANDATORY)

All forms use Zod schemas:
```javascript
import { validateForm, showFieldError, clearFormErrors } from '/js/utils/validation.js';
clearFormErrors(form);
const result = validateForm(Schema, formData);
if (!result.success) { showFormErrors(form, result.errors); scrollToFirstError(form); return; }
```

- Clear errors on modal open, form switch, close/reopen
- Field-level errors (red border + message) are primary; toasts are secondary
- Never toast-only for validation errors

### Semantic HTML
- `base.njk` provides `<main id="main-content">` - don't add another
- Every input needs associated label (`for` attribute or `aria-labelledby`)
- Unique IDs only - no duplicates

## Build Commands

```bash
npm run build        # Full build (11ty + JS + CSS)
npm run start        # Dev with live reload
npm test             # Run all tests
npm run test:e2e     # Run Playwright E2E tests
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

## Architecture

**Build**: 11ty (HTML) + esbuild (JS/TS) + Tailwind v4 (CSS)

**Key directories**:
- `src/js/components/` - Reusable UI (TypeScript)
- `src/js/repositories/` - Data access layer (TypeScript)
- `src/js/utils/` - Utilities (mixed JS/TS)
- `src/js/schemas/` - Zod validation schemas

**Data flow**:
- Firebase Auth via `header.js`
- Firestore under `/users/{userId}/` (books, genres, series, bin, wishlist)
- 5-minute TTL caches to reduce reads

**Key patterns**:
- `hideHeader: true` in frontmatter hides header
- Call `lucide.createIcons()` after dynamic icon insertion

## Tailwind v4 Syntax

```css
@import "tailwindcss";
@theme { --color-primary: #3b82f6; }
```

## Testing

- **Vitest**: Unit tests in `tests/`
- **Playwright**: E2E tests in `e2e/`
- **Coverage thresholds**: 60% lines/functions, 50% branches
- **Pre-commit hooks**: lint-staged runs on commit

Manual testing required for validation changes - unit tests don't catch HTML/schema mismatches.

## Audit Checklists (Periodic)

Run `npm audit` and `npm outdated` regularly.

### Quick Checks
- [ ] Touch targets ≥44px?
- [ ] User input escaped? (`escapeHtml`, `escapeAttr`)
- [ ] Forms use Zod schemas?
- [ ] Labels associated with inputs?
- [ ] Loading states (not blank screens)?
- [ ] Errors user-friendly (not raw messages)?
- [ ] No sensitive data in localStorage?
- [ ] Firestore rules restrict to own data?

### Performance
- [ ] LCP < 2.5s, CLS < 0.1, INP < 200ms?
- [ ] Images lazy loaded?
- [ ] Skeletons match final dimensions?

### Mobile
- [ ] No horizontal scroll?
- [ ] Input font ≥16px (prevents iOS zoom)?
- [ ] Safe area insets handled?
- [ ] Swipe gestures work?

### Accessibility
- [ ] Keyboard navigable?
- [ ] Focus visible?
- [ ] Colour contrast WCAG AA?
- [ ] Skip link present?

## Firebase

- Project: `book-tracker-b786e`
- Collections: `/users/{userId}/books`, `/genres`, `/series`, `/bin`, `/wishlist`

## Competitor Reference

| App | Focus |
|-----|-------|
| Goodreads | Community, crowdsourced data |
| StoryGraph | Mood/pacing analysis, stats |
| Hardcover | Modern UI, per-book privacy |
