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
│   ├── _includes/header.njk    # Common header partial
│   ├── index.njk               # Home dashboard (/)
│   ├── login.njk               # Login/register (/login/)
│   ├── settings.njk            # Settings (/settings/)
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
│   │   ├── settings.js         # Settings page
│   │   ├── genres.js           # Genre CRUD
│   │   ├── books/              # Book page modules
│   │   ├── components/         # Reusable UI components
│   │   ├── schemas/            # Zod validation schemas
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
- **Firestore**: `/users/{userId}/books`, `/users/{userId}/genres`

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

## Roadmap

### High Priority
- [x] Widget dashboard system (Sprint 4) ✅
- [ ] View mode setting (Card/Compact/List)
- [ ] Dark mode
- [ ] Book quick view modal

### Medium Priority
- [ ] Custom cover image upload
- [ ] Export to CSV
- [ ] Import from Goodreads
- [ ] Configurable display constants
- [ ] Reading statistics charts
- [ ] Scheduled automatic backups

### Future Features
- [ ] Reading timer with sessions
- [ ] Book series tracking
- [ ] Multiple shelves/lists
- [ ] Social features (follow, share)
- [ ] Reading goals/challenges

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

### Book Series
- [ ] Link books to a series (e.g., "Harry Potter #1")
- [ ] Series view page (all books in a series)
- [ ] Auto-detect series from API data
- [ ] Series completion progress

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

### Library Health Dashboard
- [ ] Books missing cover image
- [ ] Books missing genre
- [ ] Books missing publisher/date/format
- [ ] Quick-fix actions (batch assign genre, refresh from API)

### Privacy Settings
- [ ] Profile visibility (public/private)
- [ ] Per-book privacy controls
- [ ] Download all my data (GDPR-style export)
- [ ] Clear local cache/data

### Technical Debt
- [ ] Full Zod validation (remove HTML validation attributes)
- [ ] Tree-shake Lucide icons (387KB → ~30KB)
- [ ] Minify/bundle JavaScript
- [ ] Server-side search (Algolia/Firestore)
- [ ] Virtualised list for 500+ books

---

## Technical Reference

### Data Enrichment Sources

| Source | API | Notes |
|--------|-----|-------|
| **Google Books** | `volumeInfo.categories` | Hierarchical (e.g., "Fiction / Fantasy / Epic"), parsed automatically |
| **Open Library** | `subjects` | User-contributed, all subjects now included (no limit) |
| **Library of Congress** | `loc.gov/search` | Free, no sign-up, US-focused (future) |
| **BISAC Codes** | Static mapping | Industry standard ~50 categories (future) |
| **Thema Codes** | Static mapping | International, multilingual (future) |

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
| ISBN Lookup | localStorage | 24 hrs | Cache API responses |
| Covers | Service Worker | 200 items | Image caching |
| Gravatar | localStorage | 24 hrs | Avatar existence check |

### Firebase Cost Optimisation
- [x] Local caching with TTL
- [x] Firestore offline persistence
- [x] On-demand fetching (not real-time listeners)
- [x] Manual refresh instead of auto-sync
- [ ] Batch writes for multiple updates
- [ ] Lazy load book details

### Performance (Dec 2025 Audit)
| Asset | Size | Status |
|-------|------|--------|
| Tailwind CSS | 56KB | OK (minified) |
| Lucide Icons | 387KB | Needs tree-shaking |
| Quagga | 157KB | OK (lazy loaded) |
| Zod | 294KB | Consider smaller alt |
| Custom JS | 772KB | Needs minification |

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

**Last Updated**: 2025-12-23
