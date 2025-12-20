# MyBookShelf - Project Documentation

## Overview
A mobile-friendly book tracking PWA with barcode scanning. Built with vanilla HTML/CSS/JS and Firebase.

## Tech Stack
- **Frontend**: HTML, CSS (Tailwind via CDN), vanilla JavaScript (ES6 modules)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (email/password)
- **Barcode**: html5-qrcode library
- **Book Data**: Google Books API + Open Library API
- **Hosting**: Netlify
- **PWA**: Service worker + web manifest

## Project Structure
```
MyBookShelf/
├── index.html          # Login/register page
├── books.html          # Book list (main view)
├── add.html            # Add new book
├── book.html           # Book detail/edit
├── css/
│   └── styles.css      # Custom styles
├── js/
│   ├── firebase-config.js  # Firebase init
│   ├── auth.js             # Authentication
│   ├── books.js            # Book CRUD + listing
│   ├── add.js              # Add book logic
│   ├── book-detail.js      # Detail/edit logic
│   └── api.js              # ISBN lookup
├── icons/              # PWA icons
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── netlify.toml        # Deployment config
└── PROJECT.md          # This file
```

## Firebase Configuration
- **Project**: book-tracker-b786e
- **Auth**: Email/password enabled
- **Firestore**: User-scoped book collections at `/users/{userId}/books`

## Development Progress

### Completed
- [x] Project setup
- [x] Firebase configuration
- [x] Login page (index.html)
- [ ] Authentication logic (auth.js)
- [ ] Books list page (books.html)
- [ ] Add book page (add.html)
- [ ] Book detail page (book.html)
- [ ] Barcode scanner integration
- [ ] PWA manifest and icons
- [ ] Service worker
- [ ] Netlify deployment

### In Progress
- Building core pages and functionality

## Future Development Ideas

### High Priority
- [x] Search books in library
- [x] Sort books (by title, author, date added, rating)
- [x] Search for books by title/author when adding (live results with debounce)
- [ ] Check for duplicate book when adding (by ISBN or title/author match)
- [ ] Filter by genre
- [ ] Offline support (cached books)
- [ ] Pull-to-refresh on mobile

### Medium Priority
- [ ] Book quick view modal from list/search results
- [ ] Book notes/reviews
- [ ] Reading dates (start/finish)
- [ ] Custom cover image upload
- [ ] Export to CSV/JSON
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
- [ ] Genre CRUD (create, read, update, delete custom genres)
- [ ] Manage genres page/modal
- [ ] Assign multiple genres per book
- [ ] Filter books by genre
- [ ] Genre auto-suggestions from API data
- [ ] Merge duplicate genres
- [ ] Genre color coding/icons

### Book Images
- [ ] Upload custom cover image (not just URL)
- [ ] Multiple book images (spine, back cover, pages)
- [ ] Image gallery view per book
- [ ] Image compression/optimization
- [ ] Cloud storage integration (Cloudinary/Firebase Storage)

## Deployment

### Netlify Setup
1. Connect GitHub repo to Netlify
2. Build command: (none - static files)
3. Publish directory: `/`
4. Add `_redirects` for SPA-style routing if needed

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
