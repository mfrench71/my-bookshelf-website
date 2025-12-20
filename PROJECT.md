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
│   ├── index.njk             # Login/register page
│   ├── books.njk             # Book list (main view)
│   ├── add.njk               # Add new book
│   ├── book.njk              # Book detail/edit
│   ├── settings.njk          # Settings page (genres, export)
│   ├── css/tailwind.css      # Tailwind v4 config
│   ├── js/
│   │   ├── firebase-config.js  # Firebase init + offline persistence
│   │   ├── header.js           # Header auth, menu, search
│   │   ├── auth.js             # Authentication
│   │   ├── books.js            # Book CRUD + listing
│   │   ├── add.js              # Add book logic + barcode scanner
│   │   ├── book-detail.js      # Detail/edit logic
│   │   ├── utils.js            # Shared utilities
│   │   ├── book-card.js        # Book card component
│   │   ├── genres.js           # Genre CRUD and utilities
│   │   ├── genre-picker.js     # Genre picker component
│   │   └── settings.js         # Settings page logic
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
- [x] Comprehensive test suite (261 tests)
- [x] Open Library fallback for book search
- [x] Infinite scroll for search results
- [x] Genre management system with color-coded badges
- [x] Settings page with left-hand navigation
- [x] Export books as JSON backup
- [x] Refresh book data from APIs (repopulate title, author, cover from Google Books/Open Library)

### In Progress
- None currently

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
- [ ] Reading dates (start/finish)
- [ ] Custom cover image upload
- [ ] Cover image picker (select from multiple API sources: Google Books, Open Library)
- [x] Export to JSON
- [ ] Export to CSV
- [ ] Import from Goodreads

### Nice to Have
- [ ] Reading statistics/charts
- [ ] Dark mode
- [ ] Social sharing
- [ ] Book recommendations
- [ ] Reading goals/challenges
- [ ] Multiple shelves/lists

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

### User Profile & Settings
- [ ] User profile page/modal
- [ ] Edit display name
- [ ] Change password
- [ ] Profile avatar/photo
- [ ] Account deletion
- [ ] Privacy settings
- [ ] Manage lists from profile
- [ ] View reading statistics from profile
- [ ] Export/import data from profile

### User Lists / Shelves
- [ ] Custom user lists (e.g., "Want to Read", "Currently Reading", "Finished")
- [ ] Default lists created for new users
- [ ] Assign books to multiple lists
- [ ] List CRUD (create, read, update, delete)
- [ ] Drag and drop reordering within lists
- [ ] List view page (all books in a list)
- [ ] Filter books by list
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
| **StoryGraph** | Mood/pacing charts, AI recommendations, quarter-star ratings | No reading timer |
| **Bookly** | Reading timer, gamification, streaks, ambient sounds | Subscription required for full features |
| **Bookmory** | Timer, quotes, notes with photos, statistics | Less social features |
| **Hardcover** | Ad-free, privacy controls, modern UI | Smaller community |
| **Literal/Oku** | Clean design, social clubs | Limited features |

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
- [ ] Start/finish reading dates
- [ ] Re-read tracking (read count)
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

### Sources
- [Beyond Goodreads: 5 Game-Changing Apps](https://medium.com/macoclock/beyond-goodreads-the-5-game-changing-book-tracking-apps-you-need-to-try-482b2811e8ab)
- [Best Book Tracking Apps - ISBNDB](https://isbndb.com/blog/book-tracking-apps-and-websites/)
- [The StoryGraph](https://thestorygraph.com/)
- [Bookly](https://getbookly.com/)
- [Book Tracker App](https://booktrack.app/)

---
**Last Updated**: 2025-12-20
