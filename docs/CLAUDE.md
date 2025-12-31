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

**Build**: 11ty (HTML) + esbuild (TypeScript) + Tailwind v4 (CSS)

**Key directories**:
- `src/js/components/` - Reusable UI components (TypeScript)
- `src/js/repositories/` - Data access layer (TypeScript)
- `src/js/utils/` - Utility modules (TypeScript)
- `src/js/schemas/` - Zod validation schemas
- `src/js/types/` - TypeScript type definitions

**Data flow**:
- Firebase Auth via `header.ts`
- Firestore under `/users/{userId}/` (books, genres, series, bin, wishlist)
- 5-minute TTL caches to reduce reads
- Repository pattern abstracts all Firestore access

**Key patterns**:
- `hideHeader: true` in frontmatter hides header
- Call `lucide.createIcons()` after dynamic icon insertion
- Event bus (`eventBus`) for cache invalidation

## Code Style

### Naming Conventions
- Files: `kebab-case.ts`
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

### File Size Guidelines
- Page scripts: <30KB (<1000 lines)
- Components: <20KB
- Utilities: <10KB

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

## Audit Checklists

**Quick checks** (run before each PR):
- [ ] Touch targets ≥44px?
- [ ] User input escaped? (`escapeHtml`, `escapeAttr`)
- [ ] Forms use Zod schemas?
- [ ] Labels associated with inputs?
- [ ] Loading states (not blank screens)?
- [ ] Errors user-friendly (not raw messages)?

**Comprehensive audits**: See [AUDITS.md](./AUDITS.md) for detailed periodic checklists covering:
- Dependencies & Security
- PWA/Service Worker
- SEO, Mobile UX, Accessibility
- Core Web Vitals, Performance
- Privacy/GDPR, Browser Compatibility
- Form Validation, Test Coverage

## Firebase

- Project: `book-tracker-b786e`
- Collections: `/users/{userId}/books`, `/genres`, `/series`, `/bin`, `/wishlist`

## Competitor Reference

| App | Focus | URL |
|-----|-------|-----|
| Goodreads | Largest community, crowdsourced data | [goodreads.com](https://goodreads.com) |
| StoryGraph | Mood/pacing analysis, detailed stats | [thestorygraph.com](https://thestorygraph.com) |
| BookTrack | iOS native, reading timer, OCR quotes | [booktrack.app](https://booktrack.app) |
| Hardcover | Modern UI, ad-free, per-book privacy | [hardcover.app](https://hardcover.app) |
| Literal | Quote-centric, public API | [literal.club](https://literal.club) |
| Oku | Minimalist, beautiful design | [oku.club](https://oku.club) |

Research links:
- [StoryGraph Roadmap](https://roadmap.thestorygraph.com/) - Feature requests and plans
