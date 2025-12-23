# MyBookShelf - Project Documentation

## Overview
A mobile-friendly book tracking PWA with barcode scanning. Built with vanilla HTML/CSS/JS and Firebase.

## Tech Stack
- **Build**: 11ty (Eleventy) + Tailwind CSS v4
- **Frontend**: HTML (Nunjucks templates), CSS (Tailwind), vanilla JavaScript (ES6 modules)
- **Database**: Firebase Firestore (with offline persistence)
- **Auth**: Firebase Authentication (email/password)
- **Barcode**: Quagga2 library
- **Book Data**: Google Books API + Open Library API (fallback)
- **Hosting**: Netlify (with CI/CD via GitHub Actions)
- **PWA**: Service worker (v4) + web manifest
- **Testing**: Vitest with jsdom

## Project Structure
```
MyBookShelf/
├── src/
│   ├── _layouts/base.njk     # Base HTML template
│   ├── _includes/header.njk  # Common header partial
│   ├── index.njk             # Home/dashboard page (/)
│   ├── login.njk             # Login/register page (/login/)
│   ├── books/                # Book-related pages
│   │   ├── index.njk         # Book list (/books/)
│   │   ├── add.njk           # Add book form (/books/add/)
│   │   ├── view.njk          # Book view page (/books/view/?id=X)
│   │   └── edit.njk          # Book edit page (/books/edit/?id=X)
│   ├── settings.njk          # Settings page (/settings/)
│   ├── css/tailwind.css      # Tailwind v4 config
│   ├── js/
│   │   ├── firebase-config.js  # Firebase init + offline persistence
│   │   ├── index.js            # Home page logic
│   │   ├── login.js            # Login/register page logic
│   │   ├── header.js           # Header auth, menu, search
│   │   ├── books/              # Book-related page logic
│   │   │   ├── index.js        # Book list rendering, sorting, filtering
│   │   │   ├── add.js          # Add book form, ISBN lookup, barcode scanner
│   │   │   ├── view.js         # Book view page (read-only display)
│   │   │   └── edit.js         # Book edit page (form-based editing)
│   │   ├── utils.js            # Shared utilities (re-exports from utils/)
│   │   ├── genres.js           # Genre CRUD and utilities
│   │   ├── settings.js         # Settings page logic
│   │   ├── md5.js              # MD5 hash for Gravatar
│   │   ├── components/         # Reusable UI components
│   │   │   ├── book-card.js    # Book card for list rendering
│   │   │   ├── cover-picker.js # Cover image source picker
│   │   │   ├── genre-picker.js # Multi-select genre input
│   │   │   ├── modal.js        # Modal and ConfirmModal
│   │   │   └── rating-input.js # Interactive star rating
│   │   ├── schemas/            # Zod validation schemas
│   │   │   ├── book.js         # Book form validation
│   │   │   ├── auth.js         # Auth form validation
│   │   │   └── genre.js        # Genre validation
│   │   └── utils/              # Utility modules
│   │       ├── cache.js        # Caching utilities
│   │       ├── dom.js          # DOM helpers
│   │       ├── api.js          # API utilities
│   │       └── validation.js   # Form validation helpers
│   └── sw.js                   # Service worker (v4)
├── tests/                # Vitest test files
├── _site/                # Built output (11ty)
├── icons/                # PWA icons
├── manifest.json         # PWA manifest
├── eleventy.config.js    # 11ty config
├── netlify.toml          # Deployment config
└── PROJECT.md            # This file
```

## Firebase Configuration
- **Project**: book-tracker-b786e
- **Auth**: Email/password enabled
- **Firestore**: User-scoped book collections at `/users/{userId}/books`

### Minimizing Firebase Usage/Costs
- [x] Implement local caching with localStorage (5-min TTL, per-user cache)
- [x] Use Firestore offline persistence (built-in caching) - Enabled in firebase-config.js
- [ ] Batch writes (combine multiple updates into single transaction)
- [x] Pagination with cursor-based queries (limit/startAfter, 20 books per page)
- [ ] Lazy load book details (only fetch full data when viewing)
- [x] Replaced real-time listeners with on-demand fetching (getDocs instead of onSnapshot)
- [x] Manual refresh button instead of automatic sync
- [ ] Compress stored data (shorter field names, remove unused fields)
- [ ] Monitor usage in Firebase Console and set billing alerts

### Caching Strategy (Implemented)
- **Service Worker** (sw.js v4): Comprehensive caching with separate cache stores
  - Static assets: Network-first with cache fallback
  - Cover images: Cache-first with background refresh (200 image limit)
  - API responses: Network-first with 15-min TTL cache fallback
  - Firebase requests: Skipped (Firestore handles its own caching)
- **Firestore Offline**: `persistentLocalCache()` enabled in firebase-config.js
- **Cover Image Sources**: books.google.com, covers.openlibrary.org
- **API Caching**: Google Books and Open Library responses cached with timestamp-based TTL
- **ISBN Lookup Cache**: 24-hour TTL in localStorage for Google Books/Open Library results
- **Genre Cache**: 5-minute in-memory TTL to reduce Firestore reads
- **Gravatar Cache**: 24-hour localStorage cache for avatar existence checks

### Caching Review (TODO)
Consider removing the need for manual "Refresh library" menu option while maintaining:
- **Cross-device sync**: Data should be up-to-date across all devices as quickly as possible
- **Immediate updates**: Newly added/edited content must be available immediately
- **Cost efficiency**: Minimise Firebase reads/writes

**Options to explore:**
1. **Firestore real-time listeners** (`onSnapshot`) - automatic sync but more reads
2. **Visibility-based refresh** - refetch when tab becomes visible after being hidden
3. **Stale-while-revalidate** - show cached data immediately, update in background
4. **Push notifications** - Firebase Cloud Messaging to trigger refresh on other devices
5. **Shorter cache TTL** - reduce from 5 min to 1-2 min for faster updates
6. **Hybrid approach** - real-time for recent changes, cached for older data

### Data Enrichment Opportunities

API fields available but not currently stored (for future features):

| Field | Source | Value |
|-------|--------|-------|
| `description` | Google Books | Book synopsis for browsing/search |
| `language` | Google Books | Filter by language |
| `previewLink` | Google Books | "Read sample" links |
| `averageRating` / `ratingsCount` | Google Books | Community rating comparison |
| `categories` / `subjects` | Both APIs | Better genre suggestions, mood inference |
| `maturityRating` | Google Books | Content warnings foundation |
| `firstPublishYear` | Open Library | Original vs edition publication date |
| Higher-res covers | Both APIs | `large`/`extraLarge` image URLs available |

**User-generated fields (for planned features):**
- `moods[]` - Mood/emotion tracking
- `pacing` - Pace tagging (fast/medium/slow)
- `contentWarnings[]` - Content warnings with severity
- `quotes[]` - Quote capture
- `plotOrCharacter` - Plot-driven vs character-driven

### Scalability Considerations

**Current limitations (tested scale: ~100 books per user):**

| Concern | Issue | Impact |
|---------|-------|--------|
| Full collection load | `books.js:223-226` loads ALL books on page load | 500 books = 25 API calls |
| Client-side filtering | `books.js:373-380` filters/sorts entire array | O(n log n) on every change |
| Sort triggers reload | `books.js:458-470` clears cache, refetches all | Expensive for large libraries |
| No query limits | `genres.js:360`, `settings.js:1041` fetch entire collections | Unbounded reads |
| No virtualisation | `books.js:416-431` renders all visible books at once | DOM bloat at scale |

**Recommended improvements for 500+ books:**
- [ ] Server-side filtering with Firestore composite indexes
- [ ] Virtualised list rendering (only render visible items)
- [ ] Limit initial load to 50-100 books, paginate on demand
- [ ] Add limits to all `getDocs()` calls
- [ ] Implement server-side search (Algolia or Firestore full-text)

## Development Progress

### Completed
- [x] Project setup with 11ty + Tailwind v4
- [x] Firebase configuration with offline persistence
- [x] Login/register page (index.njk)
- [x] Authentication logic (auth.js, header.js)
- [x] Books list page with sort/filter (books.njk)
- [x] Add book page with search/scanner (add.njk)
- [x] Book detail page with edit (book.njk)
- [x] Barcode scanner (Quagga2)
- [x] PWA manifest and icons
- [x] Service worker v4 (comprehensive caching)
- [x] Netlify deployment with CI/CD
- [x] Comprehensive test suite (601 tests)
- [x] Open Library fallback for book search
- [x] Infinite scroll for search results
- [x] Genre management system with color-coded badges
- [x] Settings page with left-hand navigation
- [x] Export books as JSON backup
- [x] Refresh book data from APIs (repopulate title, author, cover from Google Books/Open Library)
- [x] API data supplementation (fill missing fields from Open Library when Google Books data incomplete)
- [x] Data cleanup utility (fix genre references from names to IDs)
- [x] Codebase audit and fixes (XSS vulnerabilities, debug code removal, Firebase optimization, code consolidation)
- [x] Performance audit (parallel loading, touch event throttling, simplified sorting)
- [x] Caching audit (ISBN lookup cache with 24h TTL, genre cache with 5min TTL, Gravatar cache)
- [x] Dead code removal (unused exports: debouncedInitIcons, updateGenreBookCount, findOrCreateGenre, getGenre)
- [x] Home page dashboard with configurable sections
- [x] Reading status inferred from dates (Reading, Finished) with read history
- [x] Reading dates input on book edit (manual start/finish dates)
- [x] Re-read tracking with full read history
- [x] Book recommendations based on highly-rated authors (Google Books + Open Library)
- [x] Content settings to configure home page sections (visibility + item count)
- [x] Status filter on book list page
- [x] Full backup & restore (books + genres with ID remapping for cross-account transfer)
- [x] Email verification (soft enforcement with banner on home page)
- [x] Password confirmation on signup
- [x] Cover image fallbacks (placeholder shown on broken image URLs)
- [x] Shared ISBN lookup utility (consolidated Google Books + Open Library)
- [x] Smart back button navigation (history-aware)
- [x] Page count field (retrieved from Google Books / Open Library)
- [x] Cover image picker (select from Google Books or Open Library covers)
- [x] Bulk cover fetch (update all books with ISBNs from Settings)

### Recently Completed
- [x] RESTful file naming restructure
  - Templates: `src/books/` directory with `index.njk`, `add.njk`, `view.njk`, `edit.njk`
  - JavaScript: `src/js/books/` directory with matching files
  - URLs: `/books/`, `/books/add/`, `/books/view/?id=X`, `/books/edit/?id=X`
  - Renamed `home.njk` → `index.njk`, `index.njk` → `login.njk`
- [x] Split book detail into separate View and Edit pages
  - View page (`/books/view/?id=X`): Clean read-only display with cover, metadata, reading history, notes
  - Edit page (`/books/edit/?id=X`): Form-based editing with all current fields
  - Shared components: CoverPicker, RatingInput, GenrePicker, Modal
  - Refactored add.js to use CoverPicker component (reduced duplication)

### Planned Improvements
- [ ] Larger cover images on book view/edit pages (currently using thumbnail size)
- [ ] Full custom validation with Zod (remove native HTML validation)
  - Add `novalidate` to all forms
  - Remove `required`, `minlength`, `pattern` attributes from HTML
  - Keep `type="email"`, `type="number"` for keyboard hints only
  - Implement real-time validation on blur using `setupFieldValidation()`
  - Fix inconsistencies (HTML minlength="6" vs Zod min(8) for passwords)
  - Files: login.njk, books/add.njk, books/edit.njk, settings.njk, login.js, books/add.js, books/edit.js, settings.js

## Future Development Ideas

### High Priority
- [x] Search books in library
- [x] Sort books (by title, author, date added, rating)
- [x] Search for books by title/author when adding (live results with debounce)
- [x] Infinite scroll / lazy loading for search results
- [x] Open Library fallback when Google Books API fails
- [x] Firestore offline persistence for reduced API calls
- [x] Service worker caching (static assets, cover images, API responses)
- [x] Filter by genre
- [x] Check for duplicate book when adding (by ISBN or title/author match)
- [x] Offline support (cached books with offline banner indicator)
- [x] Pull-to-refresh on mobile (touch gesture)

### Medium Priority
- [ ] Book quick view modal from list/search results
- [ ] Book notes/reviews
- [x] Reading dates (start/finish) - Auto-tracked via status changes
- [ ] Custom cover image upload
- [x] Cover image picker (select from multiple API sources: Google Books, Open Library)
- [x] Export to JSON (full backup with genres)
- [x] Import from JSON backup (cross-account restore with duplicate detection)
- [ ] Export to CSV
- [ ] Import from Goodreads
- [ ] Scheduled backups (automatic periodic JSON export)
- [ ] Configurable display constants in Settings (e.g., books per page, max genre badges, etc.)

### Nice to Have
- [ ] Reading statistics/charts
- [ ] Dark mode
- [ ] Social sharing
- [x] Book recommendations - Based on highly-rated authors
- [ ] Reading goals/challenges
- [ ] Multiple shelves/lists
- [ ] Customisable home screen layout (section ordering, visibility, drag-and-drop, responsive multi-column)

### UX Improvements
- [ ] Improve "No books found" message on search to be more helpful (similar to filter empty state)
- [ ] Consistent empty state messaging across all lists/views
- [ ] Loading skeletons for book cards
- [ ] Better error messages with actionable suggestions
- [ ] View mode setting (Card/Compact/List) for book list and search results
  - Card: Current large cards with cover, title, author, rating, genres
  - Compact: Smaller cards with cover thumbnail, title, author only
  - List: Table/row layout for dense viewing (cover, title, author, rating, status)
- [ ] "Click to select a different cover" should only show if there IS another cover to select

### Bulk Tools
- [ ] Bulk select mode (checkbox on each book card)
- [ ] Select all / deselect all
- [ ] Bulk delete selected books
- [ ] Bulk update fields (rating, genres, etc.)
- [ ] Bulk update rating
- [ ] Bulk export selected books (JSON/CSV)
- [ ] Bulk add from ISBN list (paste multiple ISBNs)
- [ ] Bulk import from file (JSON/CSV upload)

### Genre Management
- [x] Genre CRUD (create, read, update, delete custom genres)
- [x] Manage genres page (in Settings)
- [x] Assign multiple genres per book
- [x] Filter books by genre
- [x] Genre auto-suggestions from API data (Google Books categories)
- [x] Genre color coding (64-color palette, unique per genre)
- [ ] Merge duplicate genres
- [ ] Improved genre suggestions (see sources below)

### Genre Suggestion Sources

Currently using Google Books `categories` and Open Library `subjects`. These can be inconsistent (e.g., "Fiction / Thrillers / Suspense" vs "Thriller"). Sources must be free with no sign-up required.

| Source | API | Notes |
|--------|-----|-------|
| **Google Books** | `categories` field | Already used. Hierarchical (e.g., "Fiction / Fantasy / Epic"). Needs parsing/normalization |
| **Open Library** | `subjects` field | Already used. User-contributed, can be noisy. Limit to first 5 |
| **Library of Congress** | `loc.gov/search` | Free, no sign-up. Academic/comprehensive. May be too granular |
| **BISAC Codes** | Static mapping | Industry standard. Map API results to ~50 top-level categories |
| **Thema Codes** | Static mapping | International standard. Multilingual. Map for non-English books |

**Improvement ideas:**
- [ ] Parse hierarchical categories (split on `/`, ` - `, ` > `)
- [ ] Normalize common variations ("Sci-Fi" → "Science Fiction", "YA" → "Young Adult")
- [ ] Deduplicate suggestions (case-insensitive)
- [ ] Prioritize top-level genres over sub-genres
- [ ] Match suggestions to existing user genres
- [ ] Build curated genre mapping (map API terms to 20-30 common genres)

### User Profile & Settings
- [x] User profile section in Settings
- [ ] Edit display name
- [x] Change password
- [x] Profile avatar/photo (upload or Gravatar fallback)
- [x] Account deletion
- [x] Email verification status (resend from Settings)
- [ ] Manage lists from profile
- [ ] View reading statistics from profile
- [ ] Export/import data from profile

### Library Health
- [ ] Data quality dashboard in Settings
- [ ] Books missing cover image
- [ ] Books missing genre
- [ ] Books missing publisher/date/format
- [ ] Quick-fix actions (batch assign genre, refresh from API)
- [ ] Duplicate book detection

### Privacy Settings
- [ ] Profile visibility (public/private/friends only)
- [ ] Show reading activity to others
- [ ] Hide specific books from public view
- [ ] Analytics opt-in/out
- [ ] Download all my data (GDPR-style export)
- [ ] Clear local cache/data
- [ ] Email notification preferences
- [ ] Marketing emails opt-in/out

### User Lists / Shelves
- [x] Built-in reading statuses: "Want to Read", "Reading", "Finished"
- [x] Status selector on book detail page
- [x] Filter books by status on library page
- [x] Status badges on book cards
- [ ] Custom user lists (beyond built-in statuses)
- [ ] Assign books to multiple lists
- [ ] List CRUD (create, read, update, delete)
- [ ] Drag and drop reordering within lists
- [ ] List view page (all books in a list)
- [ ] Quick "move to list" action from book card

### Book Series
- [ ] Link books to a series (e.g., "Harry Potter #1")
- [ ] Series CRUD (create, read, update, delete)
- [ ] Series view page (all books in a series)
- [ ] Auto-detect series from API data
- [ ] Series reading order tracking
- [ ] Series completion progress
- [ ] Filter/sort by series

### Book Images
- [ ] Upload custom cover image (not just URL)
- [ ] Multiple book images (spine, back cover, pages)
- [ ] Image gallery view per book
- [ ] Image compression/optimization
- [ ] Cloud storage integration (Cloudinary/Firebase Storage)

## Deployment

### Pre-Deployment Checklist
- [ ] All tests must pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] No console errors in browser
- [ ] Manual testing on mobile device

### Netlify Setup
1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `_site`
4. Add `_redirects` for SPA-style routing if needed
5. Environment: Ensure tests pass before deploying

### Local Development
```bash
# Simple HTTP server
npx serve .
# or
python3 -m http.server 8000
```

## Testing Strategy

### Unit Testing
- **Vitest** or **Jest** for JavaScript unit tests
- Test API functions, data transformations, validation logic

### E2E Testing
- **Playwright** (recommended - free, fast, cross-browser)
- Test user flows: login, add book, scan barcode, edit, delete

### Manual Testing
- **Primary**: Chrome on iPhone (uses WebKit engine on iOS)
- Test PWA installation ("Add to Home Screen")
- Test barcode scanning with real books
- Test offline behavior

## Image Storage Options (for custom covers)

| Provider | Free Tier | Auth Required | Notes |
|----------|-----------|---------------|-------|
| **Cloudinary** | 25GB storage, 25GB bandwidth/mo | Yes | Best features, transforms |
| **ImgBB** | Unlimited | Optional | Simple, no transforms |
| **Imgur** | Unlimited | Optional | Good API, may compress |
| **Firebase Storage** | 5GB | Yes (already using) | Integrated with project |

**Recommendation**: Start with Cloudinary (already configured in old project) or use ImgBB for simplicity.

## Implementation Notes

### Author Sorting (by Surname)
Books sorted by author use the **last word** of the author name as the sort key. This handles most Western names correctly (e.g., "Stephen King" → "King", "J.R.R. Tolkien" → "Tolkien").

**Known limitations:**
- Multi-word surnames not handled (e.g., "Ursula K. Le Guin" sorts under "Guin" not "Le Guin")
- Non-Western name conventions may not sort as expected

**Future enhancement options:**
1. **Store surname separately** - Add `authorSurname` field to book schema. Most accurate but requires data migration.
2. **Smart parsing** - Handle common surname prefixes ("van", "de", "Le", "von", "Mac", "Mc"). Could use a library or custom regex.
3. **User-editable sort key** - Let users manually override the sort key for edge cases.

### Reading Stats Data Model

The current data model supports comprehensive reading statistics:

**Available Data per Book:**
- `pageCount` - Number of pages (from Google Books / Open Library)
- `reads` - Array of read entries: `[{ startedAt: timestamp, finishedAt: timestamp | null }, ...]`
- `rating` - User rating (1-5 stars)
- `genres` - Array of genre IDs
- `createdAt` - When book was added to library

**Stats That Can Be Calculated:**
- Total books read (count of books with at least one completed read)
- Total pages read (sum of pageCount for completed books)
- Books per month/year (group by finishedAt date)
- Pages per month/year (aggregate pageCount by finishedAt)
- Average books per month
- Average rating
- Genre distribution (count per genre)
- Rating distribution (count per star level)
- Re-read count (books with multiple reads entries)
- Average reading time (finishedAt - startedAt for completed reads)
- Fastest/slowest read
- Reading streaks (consecutive days/weeks with finished books)
- Currently reading count

**Future Enhancements for Richer Stats:**
- Reading sessions with time tracking (pages read per session, reading speed)
- DNF (Did Not Finish) tracking
- Reading goals (books per year, pages per month)

## API References
- [Firebase Auth](https://firebase.google.com/docs/auth/web/start)
- [Firebase Firestore](https://firebase.google.com/docs/firestore/quickstart)
- [Google Books API](https://developers.google.com/books/docs/v1/using)
- [Open Library API](https://openlibrary.org/dev/docs/api/books)
- [html5-qrcode](https://github.com/mebjas/html5-qrcode)

---

## Competitor Research

### Key Competitors
| App | Strengths | Weaknesses |
|-----|-----------|------------|
| **Goodreads** | Largest community, social features | Outdated UI, owned by Amazon, no half-star ratings |
| **StoryGraph** | Mood/pacing charts, AI recommendations, quarter-star ratings, content warnings | No reading timer |
| **Bookly** | Reading timer, gamification, streaks, ambient sounds, reading speed | Subscription required for full features |
| **Bookmory** | Timer, quotes, notes with photos, statistics | Less social features |
| **Hardcover** | Ad-free, per-book privacy controls, modern UI, API | Smaller community |
| **Literal** | Quote-centric, public API, website widgets, book clubs | Limited free features |
| **Oku** | Minimalist design, clean UI, ad-free | Premium required for goals/stats |
| **Book Tracker** | Native iOS, OCR quote capture, loan tracking, widgets, iCloud sync | iOS only, no social features |

### Feature Ideas from Competitors

#### Reading Timer & Sessions
- [ ] Built-in reading timer with start/pause/stop
- [ ] Log reading sessions with duration and pages read
- [ ] Calculate reading speed (pages per minute/hour)
- [ ] Estimate time to finish book based on pace
- [ ] Session history with timestamps

#### Advanced Statistics
- [ ] Visual reading stats dashboard
- [ ] Books read per month/year charts
- [ ] Pages read over time graphs
- [ ] Reading streaks and daily goals
- [ ] Average book completion time
- [ ] Genre distribution pie chart
- [ ] Rating distribution histogram

#### Mood & Emotion Tracking
- [ ] Tag books by mood (adventurous, funny, dark, emotional, etc.)
- [ ] Tag books by pacing (fast, medium, slow)
- [ ] Log emotions during reading sessions
- [ ] Discover books by mood filters
- [ ] Content warnings/triggers

#### Gamification
- [ ] Reading streaks (days in a row)
- [ ] Achievement badges (first book, 10 books, etc.)
- [ ] Annual reading challenge/goals
- [ ] Progress bars and milestones
- [ ] Shareable reading stats cards

#### Social Features
- [ ] Follow other readers
- [ ] Book clubs/groups
- [ ] Activity feed
- [ ] Share reviews publicly
- [ ] Reading recommendations from friends

#### Enhanced Book Data
- [ ] Half-star or quarter-star ratings
- [x] Start/finish reading dates (manual date input on book edit)
- [x] Re-read tracking with full read history
- [ ] DNF (did not finish) status
- [ ] Loaned to / borrowed from tracking
- [ ] Physical location (which shelf)
- [ ] Purchase price / value tracking

#### Import/Export
- [ ] Import from Goodreads CSV
- [ ] Import from StoryGraph
- [ ] Import from Kindle highlights
- [ ] Export to various formats
- [ ] Backup to cloud storage (Google Drive, Dropbox, iCloud)

#### Quote Capture & Reading Journal
- [ ] Save favourite quotes manually
- [ ] OCR quote capture (photograph text, transcribe automatically)
- [ ] Reading journal with progress update notes
- [ ] Highlight and annotation capture
- [ ] Quote-centric sharing (share updates with quote snippets)

#### Widgets & System Integration
- [ ] Home screen widgets for reading stats/progress
- [ ] Lock screen widgets (iOS 16+)
- [ ] Siri/voice assistant support ("Add book", "Start reading timer")
- [ ] iOS Shortcuts integration for automation
- [ ] Live Activities for active reading sessions (iOS 16+)
- [ ] Ambient sounds while reading (rain, café, fireplace, etc.)

#### Enhanced Book Metadata
- [ ] Plot-driven vs character-driven tagging
- [ ] Content warning severity levels (graphic/moderate/minor)
- [ ] User-submitted content warnings with community voting
- [ ] Book edition tracking (hardcover, paperback, ebook, audiobook)
- [ ] Manga and international title support
- [ ] Original publication date vs edition date

#### Advanced Analytics
- [ ] Year-over-year reading comparison
- [ ] Month-over-month trend analysis
- [ ] Custom charts with user-defined colours and labels
- [ ] Reading by format breakdown (physical vs ebook vs audio)
- [ ] Compare any two time periods side-by-side
- [ ] Personalised book match percentage (how likely to enjoy based on history)

#### Privacy & Visibility
- [ ] Per-book privacy controls (public/private/friends-only)
- [ ] Profile visibility settings (public/private/friends-only)
- [ ] Hide specific books from public view
- [ ] Anonymous mode for browsing

#### Social Reading
- [ ] Buddy reads (read together with a friend, share progress)
- [ ] Readalongs (group reading events with schedules)
- [ ] Direct messaging between readers
- [ ] Reading activity feed

#### API & Integrations
- [ ] Public API for third-party integrations
- [ ] Website embed widget (display book lists on personal site)
- [ ] Browser extension for quick book adding
- [ ] Zapier/IFTTT integration

### Sources
- [Beyond Goodreads: 5 Game-Changing Apps](https://medium.com/macoclock/beyond-goodreads-the-5-game-changing-book-tracking-apps-you-need-to-try-482b2811e8ab)
- [Best Book Tracking Apps - ISBNDB](https://isbndb.com/blog/book-tracking-apps-and-websites/)
- [The StoryGraph](https://thestorygraph.com/)
- [Bookly](https://getbookly.com/)
- [Book Tracker App](https://booktrack.app/)
- [Hardcover](https://hardcover.app/)
- [Literal](https://literal.club/)
- [Oku](https://oku.club/)
- [Best Book Tracking App Comparison - Book Riot](https://bookriot.com/best-book-tracking-app/)
- [StoryGraph Features - Everyday Reading](https://everyday-reading.com/storygraph/)

---
**Last Updated**: 2025-12-23
