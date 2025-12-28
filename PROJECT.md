# MyBookShelf - Project Documentation

## Overview
A mobile-friendly book tracking PWA with barcode scanning. Built with vanilla HTML/CSS/JS and Firebase.

## Tech Stack
| Category | Technology |
|----------|------------|
| Build | 11ty (Eleventy) + Tailwind CSS v4 |
| Frontend | HTML (Nunjucks), CSS (Tailwind), vanilla JS (ES6 modules) |
| Database | Firebase Firestore (offline persistence) |
| Auth | Firebase Authentication (email/password) |
| Barcode | Quagga2 library |
| Book Data | Google Books API + Open Library API (fallback) |
| Hosting | Netlify (CI/CD via GitHub Actions) |
| PWA | Service worker (v4) + web manifest |
| Testing | Vitest (unit) + Playwright (E2E) |

---

## Project Structure

```
MyBookShelf/
├── src/
│   ├── _layouts/base.njk       # Base HTML template
│   ├── _includes/
│   │   ├── header.njk          # Common header partial
│   │   └── settings-nav.njk    # Settings tab navigation
│   ├── index.njk               # Home dashboard (/)
│   ├── login.njk               # Login/register (/login/)
│   ├── settings/               # Settings pages
│   │   ├── index.njk           # Profile settings (/settings/)
│   │   ├── library.njk         # Library settings (/settings/library/)
│   │   ├── preferences.njk     # Preferences (/settings/preferences/)
│   │   ├── maintenance.njk     # Maintenance tools (/settings/maintenance/)
│   │   └── about.njk           # About page (/settings/about/)
│   ├── books/
│   │   ├── index.njk           # Book list (/books/)
│   │   ├── add.njk             # Add book (/books/add/)
│   │   ├── view.njk            # Book view (/books/view/?id=X)
│   │   └── edit.njk            # Book edit (/books/edit/?id=X)
│   ├── css/tailwind.css        # Tailwind v4 config
│   ├── js/
│   │   ├── firebase-config.js  # Firebase init
│   │   ├── index.js            # Home page logic
│   │   ├── login.js            # Auth logic
│   │   ├── header.js           # Header (auth, menu, search)
│   │   ├── settings/           # Settings page modules
│   │   │   ├── profile.js      # Profile & account settings
│   │   │   ├── library.js      # Genres, series, backup
│   │   │   ├── preferences.js  # Sync, widgets, privacy
│   │   │   ├── maintenance.js  # Data cleanup, cover fetch
│   │   │   └── about.js        # Changelog accordions
│   │   ├── genres.js           # Genre CRUD
│   │   ├── series.js           # Series CRUD
│   │   ├── wishlist.js         # Wishlist CRUD
│   │   ├── books/              # Book page modules
│   │   ├── wishlist/           # Wishlist page modules
│   │   ├── components/         # Reusable UI components
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── widgets/            # Dashboard widget system
│   │   └── utils/              # Utility modules
│   └── sw.js                   # Service worker
├── tests/                      # Test files
├── e2e/                        # Playwright E2E tests
├── _site/                      # Built output
├── CHANGELOG.md                # Version history
└── PROJECT.md                  # This file
```

---

## Development

### Commands
```bash
npm run start        # Dev server with live reload
npm run build        # Production build
npm test             # Run unit tests
npm run test:e2e     # Run E2E tests
```

### Pre-Deployment
```bash
npm test && npm run build
```

### Firebase
- **Project**: book-tracker-b786e
- **Firestore**: `/users/{userId}/books`, `/users/{userId}/genres`, `/users/{userId}/series`, `/users/{userId}/wishlist`

---

## Completed: Widget Dashboard (Sprint 4) ✅

### Delivered
- ✅ Extensible widget system with registry pattern
- ✅ User-configurable widget order, size, visibility
- ✅ 12-column responsive grid (3/6/9/12 column options)
- ✅ Firestore persistence (syncs across devices)
- ✅ Settings page configuration with arrow reordering
- ✅ Auto-merge new widgets for existing users
- ✅ 49+ widget system tests

### Widget Types (Shipped)
| Widget | Description | Default Size |
|--------|-------------|--------------|
| Welcome | Greeting with library stats | 12 (full) |
| Currently Reading | Books in progress | 6 (half) |
| Recently Added | Latest additions | 12 (full) |
| Top Rated | Highest rated books (4+ stars) | 12 (full) |
| Recently Finished | Completed books | 12 (full) |
| Series Progress | Series with completion tracking | 6 (half) |

### Future Widget Ideas
| Widget | Description | Default Size |
|--------|-------------|--------------|
| Reading Stats | Books/pages this year, streak | 6 (half) |
| Reading Goals | Annual target progress | 6 (half) |
| Genre Distribution | Pie chart of genres | 6 (half) |
| Quick Add | Shortcut to add book | 3 (quarter) |
| TBR Stack | To-be-read with random pick | 6 (half) |
| Author Spotlight | Featured author's books | 12 (full) |
| Reading Calendar | Activity heatmap | 12 (full) |

---

## Completed: Wishlist Feature ✅

### Delivered
- ✅ Separate wishlist collection for books user wants to buy (not owned)
- ✅ Wishlist page with card list, sorting, and item management
- ✅ Add to wishlist button on book search results (heart icon with filled state for existing)
- ✅ Edit priority (high/medium/low) and notes on wishlist items
- ✅ "I bought this" action to move item to library (with ISBN data enrichment)
- ✅ Delete wishlist items with confirmation
- ✅ Wishlist link in offcanvas menu with dynamic count badge
- ✅ Duplicate detection (by ISBN or title+author)
- ✅ Compact card layout with inline action buttons
- ✅ Author sort by surname (consistent with book list)
- ✅ Backup/restore includes wishlist with cross-checks:
  - Skip importing wishlist items that match owned books
  - Auto-remove wishlist items when matching book imported
  - Detailed on-page import summary
- ✅ 23 wishlist unit tests

### Data Model
```
/users/{userId}/wishlist/{itemId}
  - title, author, isbn, coverImageUrl, covers
  - publisher, publishedDate, pageCount
  - priority: 'high' | 'medium' | 'low' | null
  - notes, addedFrom: 'search' | 'isbn' | 'manual'
  - createdAt, updatedAt
```

---

## Roadmap

### High Priority
- [x] Widget dashboard system (Sprint 4) ✅
- [ ] View mode setting (Card/Compact/List)
- [ ] Dark mode
- [ ] Book quick view modal
- [x] Books list filters: Sidebar on desktop/tablet, bottom sheet on mobile

### Medium Priority
- [ ] Custom cover image upload
- [ ] Export to CSV
- [ ] Import from Goodreads
- [ ] Configurable display constants
- [ ] Reading statistics charts
- [ ] Scheduled automatic backups

### Future Features
- [ ] Reading timer with sessions
- [ ] Multiple shelves/lists
- [ ] Social features (follow, share)
- [ ] Reading goals/challenges
- [x] Show modified date (updatedAt) on book view page
- [ ] Quick edit on book card (link direct to book edit page)
- [ ] Settings tab indicators: Maintenance (attention dot if issues), Bin (count badge if items)
- [x] Bin for deleted books (soft-delete with 30-day restore) - unique feature, no competitors offer this
- [ ] Book change history (activity log showing edits) - no competitors offer this, could be differentiator

### Bulk Tools
- [ ] Bulk select mode (checkbox on each book card)
- [ ] Select all / deselect all
- [ ] Bulk delete selected books
- [ ] Bulk update fields (rating, genres)
- [ ] Bulk export selected books (JSON/CSV)
- [ ] Bulk add from ISBN list (paste multiple ISBNs)

### Genre Enhancements
- [ ] Merge duplicate genres
- [ ] Improved genre suggestions (parse hierarchical categories, normalise variations)
- [ ] Match API suggestions to existing user genres

### User Lists / Shelves
- [ ] Custom user lists (beyond built-in statuses)
- [ ] Assign books to multiple lists
- [ ] List CRUD (create, read, update, delete)
- [ ] Drag and drop reordering within lists

### Book Series System ✅
- [x] Auto-detect series from Open Library API
- [x] Store seriesId and seriesPosition on books (linked to series collection)
- [x] Display series on book detail page with links to other books
- [x] Filter books by series (dropdown filter and URL param)
- [x] User-created series with CRUD (Firestore collection)
- [x] Add/remove books from series via series picker component
- [x] Override API-detected series in book forms
- [x] Series management page (settings)
- [x] Series completion progress (totalBooks tracking)
- [x] Series progress dashboard widget
- [x] Series badges on book cards (purple badge with position)

#### Current Series Management
- **Settings page**: Create, edit, delete series; set totalBooks for completion tracking
- **Book forms**: Add/remove book from series via series picker; set position
- **Series widget**: View series progress on home dashboard
- **Books list**: Filter by series via dropdown

#### Future Series Enhancements
- [ ] Auto-create series when accepting API suggestion (create series if not exists, link book automatically)
- [ ] Limit series position to totalBooks max (if series has totalBooks=7, position dropdown shows 1-7 only)
- [ ] Series widget: Show reading progress (X of Y finished) alongside owned count
- [ ] Series widget: List which books are owned with read/unread status
- [ ] External series lookup API (Wikidata SPARQL or similar)
- [ ] Auto-populate totalBooks from external source
- [ ] Series detail page with drag-drop reordering and bulk actions
- [ ] Book detail page: Display series books as cover thumbnails (like home widgets) with "viewing" highlight

### Reading Timer & Sessions
- [ ] Built-in reading timer with start/pause/stop
- [ ] Log reading sessions with duration and pages read
- [ ] Calculate reading speed (pages per minute/hour)
- [ ] Estimate time to finish book based on pace

### Advanced Statistics
- [ ] Visual reading stats dashboard
- [ ] Books read per month/year charts
- [ ] Reading streaks and daily goals
- [ ] Genre distribution pie chart
- [ ] Rating distribution histogram

### Mood & Emotion Tracking
- [ ] Tag books by mood (adventurous, funny, dark, emotional)
- [ ] Tag books by pacing (fast, medium, slow)
- [ ] Content warnings/triggers
- [ ] Discover books by mood filters

### Gamification
- [ ] Reading streaks (days in a row)
- [ ] Achievement badges (first book, 10 books, etc.)
- [ ] Annual reading challenge/goals
- [ ] Shareable reading stats cards

### Social Features
- [ ] Follow other readers
- [ ] Book clubs/groups
- [ ] Activity feed
- [ ] Share reviews publicly

### Quote Capture & Reading Journal
- [ ] Save favourite quotes manually
- [ ] OCR quote capture (photograph text, transcribe)
- [ ] Reading journal with progress update notes

### Library Health Dashboard ✅
- [x] Books missing cover image
- [x] Books missing genre
- [x] Books missing publisher/date/format/page count
- [x] Quick-fix actions (refresh from API - individual or bulk)
- [x] Expandable inline sections showing affected books
- [x] Completeness score with progress bar (weighted by field importance)
- [x] Merged old "Fetch Book Covers" tool into Health Dashboard
- [ ] "Mark as fixed" option for books where data will never be available (e.g., pre-ISBN editions)

### Privacy Settings
- [ ] Profile visibility (public/private)
- [ ] Per-book privacy controls
- [ ] Download all my data (GDPR-style export)
- [ ] Clear local cache/data

### Technical Debt
- [x] Fix colour inconsistencies in Data Cleanup buttons (all amber) ✅
- [x] Generate in-app changelog from CHANGELOG.md at build time (11ty data file) ✅
- [x] Full Zod validation (remove HTML validation attributes, add novalidate) ✅
- [x] Tree-shake Lucide icons (378KB → 14KB) ✅ (reverted - broke at runtime)
- [x] Minify/bundle JavaScript (797KB → 259KB custom + 265KB vendor) ✅
- [x] **E2E validation tests** - Added `e2e/validation.spec.js` with tests for empty form submit, error display, error clearing. Also added `tests/form-html-alignment.test.js` to verify HTML `name` attributes match schema field names.
- [ ] Server-side search (Algolia/Firestore)
- [ ] Virtualised list for 500+ books
- [x] Event listener cleanup - Added guards to prevent duplicate listeners (header.js online/offline, books/index.js touch), fixed beforeunload stacking (add.js, edit.js), added destroy() methods to CoverPicker and RatingInput
- [ ] Split large files: books/index.js (955 lines), books/add.js (848 lines) - Deferred (risk outweighs benefit)
- [x] Async error handling - Added try/catch to all Firebase operations in genres.js (7 functions) and series.js (10 functions)
- [x] Book edit: API refresh green highlight now persists until save (removed setTimeout fade)

---

## Technical Reference

### Colour Scheme (Semantic)

Consistent colour usage across buttons, badges, icons, and UI elements:

| Colour | Tailwind Classes | Usage |
|--------|------------------|-------|
| **Primary (Blue)** | `bg-primary`, `text-primary` | Default actions, links, navigation, form focus |
| **Green** | `bg-green-*`, `text-green-*` | Success, completion, "Finished" status, create/add |
| **Red** | `bg-red-*`, `text-red-*` | Destructive actions (delete), errors, logout, warnings |
| **Blue (Light)** | `bg-blue-100`, `text-blue-700` | "Reading" status badges, informational |
| **Purple** | `bg-purple-*`, `text-purple-*` | Series-related (badges, progress bars, icons) |
| **Amber** | `bg-amber-*`, `text-amber-*` | Maintenance/cleanup tasks, caution |
| **Gray** | `bg-gray-*`, `text-gray-*` | Neutral, secondary actions, cancel, disabled |

#### Button Patterns

| Type | Classes | Example |
|------|---------|---------|
| Primary action | `bg-primary hover:bg-primary-dark text-white` | Save, Submit |
| Secondary action | `border border-gray-300 hover:bg-gray-50 text-gray-700` | Cancel, Back |
| Destructive | `bg-red-600 hover:bg-red-700 text-white` | Delete, Remove |
| Utility/Maintenance | `bg-amber-500 hover:bg-amber-600 text-white` | Cleanup, Recalculate |
| Icon button (neutral) | `p-2 hover:bg-gray-100 rounded-lg text-gray-500` | Edit, Settings |
| Icon button (danger) | `p-2 hover:bg-red-50 rounded-lg text-red-500` | Delete |
| Icon button (info) | `p-2 hover:bg-blue-50 rounded-lg text-blue-500` | Merge, Info |

#### Status Badges

| Status | Background | Text | Icon |
|--------|------------|------|------|
| Reading | `bg-blue-100` | `text-blue-700` | `book-open` |
| Finished | `bg-green-100` | `text-green-700` | `check-circle` |
| Series | `bg-purple-100` | `text-purple-700` | `library` |

#### Icon Colours

| Context | Colour | Example |
|---------|--------|---------|
| Navigation/neutral | `text-gray-500` | Menu icons, back arrows |
| Primary/active | `text-primary` | Section headers, important icons |
| Destructive | `text-red-500` | Delete buttons |
| Success/create | `text-green-500` | Add new, checkmarks |
| Series | `text-purple-600` | Series widget, badges |
| Warning/caution | `text-amber-500` | Alerts, cleanup |

### Breadcrumb Navigation

Pages use breadcrumbs instead of back buttons to prevent confusing navigation loops.

| Page | Breadcrumb | Notes |
|------|------------|-------|
| `/` | None | Home page - top level |
| `/books/` | None | Top-level destination |
| `/books/add/` | Books > Add Book | Static (rendered in template) |
| `/books/view/?id=X` | Books > {Book Title} | Dynamic (rendered by JS) |
| `/books/edit/?id=X` | Books > {Book Title} > Edit | Dynamic, title links to view |
| `/settings/` | Home > Settings | Static (rendered in template) |

Component: `src/js/components/breadcrumb.js`
Tests: `tests/breadcrumb.test.js`

### Data Enrichment Sources

| Source | API | Notes |
|--------|-----|-------|
| **Google Books** | `volumeInfo.categories` | Hierarchical (e.g., "Fiction / Fantasy / Epic"), parsed automatically |
| **Open Library** | `subjects` | User-contributed, all subjects now included (no limit) |
| **Library of Congress** | `loc.gov/search` | Free, no sign-up, US-focused (future) |
| **BISAC Codes** | Static mapping | Industry standard ~50 categories (future) |
| **Thema Codes** | Static mapping | International, multilingual (future) |

### API Limitations

| Feature | Limitation | Workaround |
|---------|------------|------------|
| **Series in search results** | Google Books and Open Library search APIs don't return series data | Series only shown after ISBN lookup or when book is saved with series |
| **Series lookup API** | No free external API for series metadata (total books, book list) | Manual series management with user-entered totalBooks |
| **Cover quality** | API cover sizes vary | Fetch largest available at lookup time |

### Cover Image Sources

| Source | URL Pattern | Size | Notes |
|--------|-------------|------|-------|
| **Google Books (large)** | `books.googleapis.com/.../large` | ~300×450 | Preferred, not always available |
| **Google Books (medium)** | `books.googleapis.com/.../medium` | ~200×300 | Fallback |
| **Google Books (thumbnail)** | `books.googleapis.com/.../thumbnail` | ~128×192 | Last resort |
| **Open Library (L)** | `covers.openlibrary.org/b/id/{id}-L.jpg` | ~300×450 | Preferred |
| **Open Library (M)** | `covers.openlibrary.org/b/id/{id}-M.jpg` | ~180×270 | Fallback |

#### Cover Image Strategy

**At lookup time** (ISBN lookup, book search):
- API fetches the largest available cover: `large > medium > small > thumbnail`
- Single URL stored in `coverImageUrl` field

**At display time**:
- Same URL used everywhere (book cards, detail page, widgets)
- Book cards display at 60×90px with `loading="lazy"`
- Trade-off: Slightly more bandwidth, but simpler and cached for detail view

**Bulk update existing books**:
- Settings → Library Maintenance → Fetch Covers
- Re-fetches covers from APIs and updates `coverImageUrl` with larger versions

### Genre Normalization

Genres from APIs are automatically processed:
- **Hierarchical parsing**: Splits on `/`, `-`, `>`, `—` (e.g., "Fiction / Fantasy" → ["Fiction", "Fantasy"])
- **Variation mapping**: Normalizes abbreviations and synonyms (e.g., "Sci-Fi" → "Science Fiction", "YA" → "Young Adult")
- **Deduplication**: Merges genres from Google Books and Open Library, removing duplicates

### Caching Strategy
| Cache | Storage | TTL | Purpose |
|-------|---------|-----|---------|
| Books | localStorage | 5 min | Reduce Firestore reads |
| Genres | Memory | 5 min | Reduce Firestore reads |
| Series | Memory | 5 min | Reduce Firestore reads |
| ISBN Lookup | localStorage | 24 hrs | Cache API responses |
| Covers | Service Worker | 200 items | Image caching |
| Gravatar | localStorage | 24 hrs | Avatar existence check |

### Firebase Cost Optimisation
- [x] Local caching with TTL
- [x] Firestore offline persistence
- [x] On-demand fetching (not real-time listeners)
- [x] Auto-refresh on tab focus with configurable threshold/cooldown (Settings → Sync)
- [ ] Batch writes for multiple updates
- [ ] Lazy load book details

### Performance (Dec 2025 Audit)
| Asset | Size | Status |
|-------|------|--------|
| Tailwind CSS | 56KB | OK (minified) |
| Lucide Icons | 14KB | Tree-shaken ✅ |
| Quagga | 157KB | OK (lazy loaded) |
| Zod | 251KB | Minified ✅ |
| Custom JS | 259KB | Minified & bundled ✅ |

### Scalability (Tested: ~100 books)
For 500+ books:
- [ ] Server-side filtering with Firestore indexes
- [ ] Virtualised list rendering
- [ ] Limit initial load to 50-100 books
- [ ] Implement proper pagination

---

## API References
- [Firebase Auth](https://firebase.google.com/docs/auth/web/start)
- [Firebase Firestore](https://firebase.google.com/docs/firestore/quickstart)
- [Google Books API](https://developers.google.com/books/docs/v1/using)
- [Open Library API](https://openlibrary.org/dev/docs/api/books)

---

## Competitor Analysis

### Key Competitors
| App | Strengths | Weaknesses |
|-----|-----------|------------|
| Goodreads | Largest community, social features | Outdated UI, Amazon-owned, no half-stars |
| StoryGraph | Mood/pacing charts, AI recommendations, quarter-stars | No reading timer |
| Bookly | Reading timer, gamification, streaks, ambient sounds | Subscription required |
| Bookmory | Timer, quotes, notes with photos, statistics | Less social features |
| Hardcover | Ad-free, per-book privacy, modern UI, API | Smaller community |
| Literal | Quote-centric, public API, book clubs | Limited free features |
| Oku | Minimalist design, clean UI, ad-free | Premium required for goals |
| Book Tracker | Native iOS, OCR quote capture, loan tracking | iOS only |

### Feature Inspiration
- **Reading Timer**: Track sessions, calculate reading speed, ambient sounds
- **Mood Tracking**: Tag by mood, pacing, content warnings with severity levels
- **Gamification**: Streaks, badges, annual challenges, progress bars
- **Quote Capture**: OCR from photos, reading journal, highlight capture
- **Advanced Stats**: Year-over-year comparison, custom charts, reading speed trends
- **Privacy**: Per-book visibility, anonymous browsing mode
- **Social**: Buddy reads, readalongs, direct messaging

### Research Sources
- [The StoryGraph](https://thestorygraph.com/)
- [Bookly](https://getbookly.com/)
- [Book Tracker App](https://booktrack.app/)
- [Hardcover](https://hardcover.app/)
- [Literal](https://literal.club/)
- [Oku](https://oku.club/)
- [Book Riot Comparison](https://bookriot.com/best-book-tracking-app/)

---

## Implementation Notes

### Author Sorting
Uses last word of author name (e.g., "Stephen King" → "King").
- Limitation: Multi-word surnames not handled ("Le Guin" → "Guin")
- Future: Store separate `authorSurname` field

### Reading Stats Data Model
Available per book: `pageCount`, `reads[]`, `rating`, `genres[]`, `createdAt`

Can calculate: Total books/pages, books per month, genre distribution, reading streaks, average completion time.

---

**See [CHANGELOG.md](./CHANGELOG.md) for version history.**

**Last Updated**: 2025-12-27
