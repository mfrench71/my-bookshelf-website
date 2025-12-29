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
- **Plan**: Blaze (pay-as-you-go)
- **Firestore**: `/users/{userId}/books`, `/users/{userId}/genres`, `/users/{userId}/series`, `/users/{userId}/wishlist`
- **Storage**: `/users/{userId}/books/{bookId}/images/{imageId}` (book photos)

#### Blaze Features (Potential Future Use)

| Feature | What It Does | Potential Use |
|---------|--------------|---------------|
| **Cloud Functions** | Server-side code triggered by events | Auto-delete bin items after 30 days, send reading reminders, server-side API calls (no CORS) |
| **Resize Images Extension** | Auto-generate thumbnails on upload | Smaller thumbnails for list view, faster loading |
| **Cloud Messaging (FCM)** | Push notifications | Reading reminders, "finish that book" nudges |
| **Remote Config** | Feature flags without deploy | A/B test features, enable/disable at runtime |
| **Scheduled Functions** | Cron jobs | Daily/weekly reading stats emails, scheduled backups |
| **Firebase ML** | Machine learning | OCR book spines from photos |
| **BigQuery Export** | Analytics export | Reading habit insights, advanced statistics |

**Quick wins to consider:**
1. Scheduled bin cleanup - auto-purge items > 30 days (currently client-side)
2. Thumbnail generation - Resize Images extension creates smaller versions on upload
3. Reading reminders - push notification if a book's been "Reading" for 2+ weeks

#### Cloud Function: Orphaned Image Cleanup (Future Implementation)

Orphaned images can occur when users upload images but don't save the book (e.g., navigate away, close browser). Client-side cleanup attempts to delete these on `pagehide`, but this is best-effort and may not complete.

**Recommended: Scheduled Cloud Function**

```javascript
// functions/src/cleanupOrphanedImages.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Scheduled function to delete orphaned images from Firebase Storage
 * Runs daily at 3 AM UTC
 */
exports.cleanupOrphanedImages = functions.pubsub
  .schedule('0 3 * * *')
  .timeZone('UTC')
  .onRun(async (context) => {
    const db = admin.firestore();
    const storage = admin.storage().bucket();

    // Get all users
    const usersSnapshot = await db.collection('users').get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;

      // Get all image paths referenced in user's books
      const booksSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('books')
        .get();

      const referencedPaths = new Set();
      booksSnapshot.docs.forEach(doc => {
        const book = doc.data();
        if (book.images && Array.isArray(book.images)) {
          book.images.forEach(img => {
            if (img.storagePath) {
              referencedPaths.add(img.storagePath);
            }
          });
        }
      });

      // List all files in user's storage folder
      const [files] = await storage.getFiles({
        prefix: `users/${userId}/`
      });

      // Delete files not referenced by any book
      for (const file of files) {
        if (!referencedPaths.has(file.name)) {
          console.log(`Deleting orphaned file: ${file.name}`);
          await file.delete();
        }
      }
    }

    console.log('Orphaned image cleanup completed');
    return null;
  });
```

**Deployment:**
```bash
cd functions
npm install
firebase deploy --only functions:cleanupOrphanedImages
```

**Current Client-Side Mitigations:**
1. `ImageGallery.cleanupUnsavedUploads()` - Called on cancel button click
2. `pagehide` event listener - Best-effort cleanup on navigation
3. Maintenance page "Scan for Orphaned Images" - Manual user-triggered cleanup

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
| Wishlist | High-priority wishlist items | 12 (full) |

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
| Uploaded Images | Gallery of user-uploaded book photos | 12 (full) |

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
- ✅ Wishlist dashboard widget (horizontal scroll, priority sorting, configurable count/sort)

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
- [x] Custom cover image upload (Firebase Storage, up to 10 images per book)
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
- [x] Settings tab indicators: Maintenance (attention dot if issues), Bin (count badge if items)
- [x] Bin for deleted books (soft-delete with 30-day restore) - unique feature, no competitors offer this
- [ ] Book change history (activity log showing edits) - no competitors offer this, could be differentiator
- [ ] Barcode scanner: Add visual feedback/progress indicator while scanning (can take time)

### Bulk Tools
- [ ] Bulk select mode (checkbox on each book card)
- [ ] Select all / deselect all
- [ ] Bulk delete selected books
- [ ] Bulk update fields (rating, genres)
- [ ] Bulk export selected books (JSON/CSV)
- [ ] Bulk add from ISBN list (paste multiple ISBNs)

### Genre Enhancements ✅
- [x] Merge duplicate genres ✅
- [x] Improved genre suggestions (parse hierarchical categories, normalise variations) ✅
- [x] Auto-select existing genres when API suggestions match (GenrePicker filters suggestions against existing) ✅

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
- [ ] Audit: Check disabled buttons remain disabled until required (site-wide)

---

## Public Frontend (Marketing Site)

Currently, non-logged-in users see minimal content. Need a proper marketing frontend to attract new users.

### Current State
- `/` - Redirects to `/books/` (requires login) or shows login prompt
- `/login/` - Login/register form
- `/privacy/` - Privacy policy (public)
- No features page, screenshots, or promotional content

### Proposed Pages

| Page | Purpose | Content |
|------|---------|---------|
| **Landing** `/` | First impression, conversion | Hero, value prop, screenshots, CTA |
| **Features** `/features/` | Detailed feature showcase | Feature grid, comparisons, screenshots |
| **About** `/about/` | Story, mission, differentiators | Why we built it, privacy focus |
| **Pricing** `/pricing/` | If monetising | Free tier, premium features |

### Landing Page Elements
- [ ] Hero section with tagline and primary CTA
- [ ] App screenshots/mockups (mobile + desktop)
- [ ] Key features grid (3-6 highlights)
- [ ] Social proof (if available - user count, testimonials)
- [ ] "No tracking, no ads" privacy message
- [ ] Secondary CTA (learn more → features page)
- [ ] Footer with links (privacy, about, login)

### Differentiators to Highlight
- **Privacy-first**: No tracking, no ads, no data selling
- **Offline-capable**: PWA works without internet
- **Book bin**: 30-day soft delete (unique feature)
- **Multiple images**: Up to 10 photos per book
- **Series tracking**: With completion progress
- **Import/export**: Own your data

### Competitor Landing Pages (Reference)
| App | Style | Notable Elements |
|-----|-------|------------------|
| StoryGraph | Clean, friendly | Stats preview, mood tracking pitch |
| Literal | Minimalist | Quote-focused, social features |
| Hardcover | Modern, polished | Feature comparison table |
| Oku | Ultra-minimal | Single hero, immediate signup |

### Technical Considerations
- Static pages (no auth required)
- SEO optimised (meta tags, structured data)
- Fast loading (minimal JS)
- Mobile-responsive
- Separate from app chrome (no header menu)

### Implementation Priority
1. Landing page (essential for discoverability)
2. Features page (for users wanting details)
3. About page (builds trust)
4. Pricing page (only if monetising)

---

## Demo Account & Monetisation

### Demo Account Options

| Approach | Pros | Cons |
|----------|------|------|
| **Shared read-only demo** | Simple, no signup friction | Can't test adding books, stale data |
| **Personal sandbox** | Full experience, isolated | Needs cleanup job, storage costs |
| **Interactive tour** | Guided, no real data | Complex to build, not "real" |
| **Time-limited trial** | Full features, urgency | Annoying, may lose users |

**Recommendation:** Shared demo account with curated library (50-100 books). Read-only by default, or reset nightly if allowing writes.

### Demo Account Implementation
- [ ] Create demo user in Firebase Auth (demo@mybookshelf.app)
- [ ] Pre-populate with diverse library (various genres, series, ratings)
- [ ] "Try Demo" button on landing page (auto-login as demo user)
- [ ] Banner when logged in as demo: "This is a demo. Sign up to save your own books."
- [ ] Restrict destructive actions in demo mode (delete account, empty bin)
- [ ] Optional: Nightly Cloud Function to reset demo data

### Monetisation Models

| Model | Description | Competitors Using |
|-------|-------------|-------------------|
| **Freemium** | Core free, premium features paid | StoryGraph, Literal |
| **Pay once** | One-time purchase, lifetime access | BookTrack (iOS) |
| **Subscription** | Monthly/annual recurring | Goodreads (ad-free) |
| **Donation/tip** | Free with optional support | Oku |
| **Usage-based** | Free tier with limits | — |

### Potential Premium Features
| Feature | Free Tier | Premium |
|---------|-----------|---------|
| Books | 100 books | Unlimited |
| Images per book | 3 | 10 |
| Storage | 100MB | 5GB |
| Export formats | JSON only | JSON, CSV, Goodreads |
| Reading stats | Basic | Advanced + charts |
| Backups | Manual | Automatic daily |
| Series tracking | ✓ | ✓ |
| Offline mode | ✓ | ✓ |

### Payment Integration
- **Stripe** - Industry standard, good docs, handles subscriptions
- **Paddle** - Handles VAT/tax for international (simpler compliance)
- **RevenueCat** - If adding native mobile apps later

### Implementation Considerations
- [ ] User record: `isPremium`, `premiumUntil`, `stripeCustomerId`
- [ ] Feature flags: Check premium status before allowing action
- [ ] Graceful degradation: Don't break existing data if subscription lapses
- [ ] Trial period: 14-day free trial of premium?
- [ ] Upgrade prompts: Non-annoying, contextual (e.g., "Upgrade for more images")

### Pricing Research (Competitors)
| App | Free | Paid | Model |
|-----|------|------|-------|
| StoryGraph | Yes (limited stats) | $4.99/mo or $49.99/yr | Subscription |
| Literal | Yes | $5/mo | Subscription |
| Hardcover | Yes | $5/mo or $50/yr | Subscription |
| BookTrack | — | $4.99 once (iOS) | One-time |

### UK Legal Considerations

| Legislation | Requirement | Impact |
|-------------|-------------|--------|
| **UK GDPR / Data Protection Act 2018** | Privacy policy, consent, data rights | Already compliant ✓ |
| **Consumer Rights Act 2015** | Digital content must be as described, fit for purpose | Clear feature descriptions |
| **Consumer Contracts Regulations 2013** | 14-day cooling-off period for online purchases | Must offer refunds within 14 days |
| **VAT (digital services)** | 20% VAT on UK sales; VAT MOSS for EU | Use Paddle/Stripe Tax to handle |
| **Electronic Commerce Regulations 2002** | Business details, clear pricing, order confirmation | Footer with business info |
| **Payment Services Regulations 2017** | If handling payments directly | Use Stripe/Paddle (they're regulated) |

**Practical Steps:**
- [ ] Terms of Service page (subscription terms, cancellation, refunds)
- [ ] Clear pricing with VAT included (or clearly marked "+ VAT")
- [ ] Business name/address in footer (or link to About page)
- [ ] Order confirmation emails via payment provider
- [ ] Easy cancellation process (can't make it harder than signup)
- [ ] Consider Paddle over Stripe (Paddle is Merchant of Record, handles VAT compliance)

**VAT Thresholds (2024):**
- UK VAT registration required if turnover > £85,000/year
- Below threshold: Can still voluntarily register
- Using Paddle: They handle VAT as Merchant of Record (simplest option)

### Decision Points
1. **Monetise at all?** Could stay free/donation-based
2. **What to gate?** Must not punish early adopters
3. **Pricing?** $3-5/mo or $30-50/yr seems standard
4. **When to implement?** After user base established?
5. **Payment provider?** Paddle (handles UK/EU VAT) vs Stripe (more control)

---

## Other Considerations

### Growth & Marketing
| Channel | Effort | Cost | Notes |
|---------|--------|------|-------|
| **SEO/Content** | High | Free | Blog posts, book lists, reading tips |
| **Reddit/forums** | Medium | Free | r/books, r/52book, book communities |
| **Product Hunt** | Low | Free | One-time launch boost |
| **Word of mouth** | Low | Free | Referral program? |
| **Social media** | High | Free | Ongoing effort required |
| **Paid ads** | Low | $$ | Google/Meta ads (expensive for niche) |

### Privacy-Respecting Analytics
Since we don't track users, how to measure success?
- **Aggregate Firebase counts**: Total users, total books (no PII)
- **Plausible/Fathom**: Privacy-friendly, GDPR compliant, ~$9/mo
- **Self-hosted Umami**: Free, open source, own your data
- **None**: Just track signups and trust the product

### User Feedback & Support
- [ ] Feedback form in-app (Settings → Send Feedback)
- [ ] GitHub Issues for bug reports (if open source)
- [ ] Email support (support@mybookshelf.app)
- [ ] In-app changelog with "What's New" prompt
- [ ] Feature voting board? (Canny, Nolt, or simple Google Form)

### Native Mobile Apps
| Option | Pros | Cons |
|--------|------|------|
| **PWA only** | Single codebase, no app store fees | No push notifications (iOS), less "native" feel |
| **Capacitor wrapper** | Reuse web code, app store presence | Still web-based, limited native APIs |
| **React Native** | True native, good performance | Separate codebase, more maintenance |
| **Flutter** | Cross-platform, fast | Learn Dart, separate codebase |

**Recommendation**: Stay PWA for now. Consider Capacitor wrapper if app store presence becomes important.

### Apple App Store Considerations
If going native iOS:
- 30% cut on subscriptions (15% after year 1 for small developers <$1M)
- Must use Apple In-App Purchase for digital goods
- Review process can reject/delay releases
- "Reader apps" exception may apply (content purchased elsewhere)

### Import/Export & Portability
Key for user trust and reducing lock-in:
- [x] Export to JSON (implemented)
- [ ] Export to CSV
- [ ] Export to Goodreads format
- [ ] Import from Goodreads CSV
- [ ] Import from StoryGraph
- [ ] Import from LibraryThing
- [ ] Import from JSON backup

### Open Source?
| Approach | Pros | Cons |
|----------|------|------|
| **Fully open** | Community contributions, trust | Competitors can copy, harder to monetise |
| **Open core** | Core open, premium closed | Complex to manage |
| **Source available** | Visible but not OSS license | Limited community benefit |
| **Closed** | Full control, easier monetisation | Less trust, no contributions |

### Disaster Recovery
- Firebase handles backups automatically
- [ ] Document manual restore process
- [ ] Test restore from backup periodically
- [ ] Consider multi-region for high availability (cost increase)

### Competition Risk
What if Goodreads/Amazon adds our differentiating features?
- **Mitigation**: Focus on privacy (Amazon won't), niche features, community
- **Moat**: Data portability (easy to leave = easy to stay), no lock-in

### Beta/Early Adopter Program
- [ ] Invite-only beta before public launch?
- [ ] Early adopter perks (lifetime discount, founder badge)
- [ ] Feedback loop with beta users

### Internationalisation (i18n)

**Current State:** English only, British English for UI text.

**What Needs Localising:**
| Content Type | Complexity | Notes |
|--------------|------------|-------|
| UI text (buttons, labels) | Medium | ~200-500 strings |
| Error messages | Medium | Validation, toasts |
| Date formatting | Low | Use `Intl.DateTimeFormat` |
| Number formatting | Low | Use `Intl.NumberFormat` |
| Currency (payments) | Low | Handled by Stripe/Paddle |
| Book metadata | N/A | User-entered, stays as-is |
| Email templates | Medium | If sending transactional emails |

**Technical Implementation Options:**
| Library | Size | Notes |
|---------|------|-------|
| **i18next** | ~40KB | Industry standard, many plugins |
| **FormatJS/react-intl** | ~30KB | React-focused, ICU format |
| **Lit Localize** | ~5KB | Lightweight, build-time |
| **DIY JSON** | 0KB | Simple key-value, no plurals |
| **Browser Intl API** | 0KB | Built-in, dates/numbers only |

**Recommended Approach:**
1. Extract strings to JSON files (`/locales/en.json`, `/locales/es.json`)
2. Use i18next (well-supported, handles plurals, interpolation)
3. Detect language from browser (`navigator.language`) with manual override
4. Store preference in user settings

**Language Priority (by potential users):**
| Language | Speakers | Book Market | Priority |
|----------|----------|-------------|----------|
| English | 1.5B | Largest | ✅ Current |
| Spanish | 550M | Large | High |
| German | 130M | Strong book culture | High |
| French | 280M | Strong book culture | High |
| Portuguese | 260M | Growing | Medium |
| Japanese | 125M | Huge manga/book market | Medium |
| Chinese | 1.1B | Complex (simplified/traditional) | Low (complexity) |
| Arabic | 420M | RTL support needed | Low (complexity) |

**RTL (Right-to-Left) Considerations:**
- Arabic, Hebrew, Farsi need RTL layout
- Tailwind has `rtl:` variant for RTL-specific styles
- Significant CSS work, defer unless targeting these markets

**Implementation Checklist:**
- [ ] Audit all hardcoded strings in `.njk` and `.js` files
- [ ] Set up i18next with JSON locale files
- [ ] Add language selector (Settings or footer)
- [ ] Store language preference in user profile
- [ ] Handle pluralisation (`1 book` vs `2 books`)
- [ ] Format dates/numbers with `Intl` API
- [ ] Consider professional translation vs community/AI

**Translation Management:**
| Service | Cost | Notes |
|---------|------|-------|
| **Crowdin** | Free for open source | Community translations |
| **Lokalise** | $120/mo+ | Professional, integrations |
| **Phrase** | $25/mo+ | Good for small teams |
| **POEditor** | Free tier | Simple, affordable |
| **Google Translate API** | Pay per character | For initial drafts only |
| **DeepL API** | €5/mo+ | Higher quality than Google |
| **Community volunteers** | Free | Slow, inconsistent quality |

**Recommendation:** Start English-only. Add i18n infrastructure when expanding to new markets. Spanish/German/French are highest ROI for European book readers.

### Accessibility Legal Requirements

| Legislation | Region | Requirement |
|-------------|--------|-------------|
| **Equality Act 2010** | UK | Services must be accessible to disabled users |
| **European Accessibility Act** | EU | Digital services must meet EN 301 549 by June 2025 |
| **ADA Title III** | US | Websites as "places of public accommodation" |
| **WCAG 2.1 AA** | Standard | Target level for compliance |

**Current Status:** Basic accessibility implemented (see CLAUDE.md checklist).
- [ ] Run automated audit (axe-core, Lighthouse)
- [ ] Manual screen reader testing (VoiceOver, NVDA)
- [ ] Keyboard-only navigation test
- [ ] Add accessibility statement page

### Monitoring & Error Tracking

| Service | Cost | Notes |
|---------|------|-------|
| **Sentry** | Free tier (5K errors/mo) | Error tracking, stack traces |
| **LogRocket** | Free tier | Session replay, debugging |
| **Firebase Crashlytics** | Free | Mobile-focused but works for web |
| **Uptime Robot** | Free tier | Uptime monitoring, alerts |
| **Better Uptime** | Free tier | Status page included |

**Recommended:** Sentry (free tier) + Uptime Robot for basics.

### Security Hardening

- [x] HTTPS everywhere (Netlify handles)
- [x] Firestore security rules (user can only access own data)
- [ ] Content Security Policy headers
- [ ] Rate limiting on auth endpoints (Firebase handles some)
- [ ] Security headers audit (securityheaders.com)
- [ ] Dependency vulnerability scanning (npm audit in CI)
- [ ] Consider penetration testing before public launch

### Domain & Branding

- [ ] Secure domain (mybookshelf.app, mybookshelf.co.uk?)
- [ ] Logo design (simple book icon?)
- [ ] Favicon and PWA icons (multiple sizes)
- [ ] Open Graph images for social sharing
- [ ] Brand colours (already have primary blue)
- [ ] Email domain (hello@mybookshelf.app)

### Legal Entity (UK)

| Structure | Pros | Cons |
|-----------|------|------|
| **Sole Trader** | Simple, cheap, private | Personal liability, less credible |
| **Ltd Company** | Limited liability, tax efficient | Admin, public accounts, £50/yr |
| **LLP** | Flexible, limited liability | Needs 2+ partners |

**Recommendation:** Start as sole trader. Incorporate Ltd if revenue exceeds ~£30-40K or wanting investment.

### Insurance

| Type | Coverage | Cost |
|------|----------|------|
| **Professional Indemnity** | Errors, bad advice | ~£100-200/yr |
| **Cyber Liability** | Data breaches, hacks | ~£150-300/yr |
| **Public Liability** | If meeting users in person | ~£50-100/yr |

**Recommendation:** Professional indemnity at minimum if charging users.

### Scalability Checkpoints

| Users | Concerns | Actions |
|-------|----------|---------|
| **100** | Nothing | Current setup fine |
| **1,000** | Firebase free tier limits | Monitor usage |
| **10,000** | Firestore reads, Storage bandwidth | Optimize caching, consider paid tier |
| **100,000** | Performance, search speed | Algolia search, CDN for images |
| **1,000,000** | Everything | Major architecture review |

### User Documentation

- [ ] Getting started guide
- [ ] FAQ page
- [ ] Feature documentation (how to use series, genres, etc.)
- [ ] Video tutorials? (YouTube, Loom)
- [ ] In-app tooltips/onboarding tour

### Book Cover Copyright

Book covers are copyrighted by publishers. Current approach:
- Linking to Google Books / Open Library URLs (not hosting)
- User uploads are user's responsibility
- **Risk:** Low for personal use app, higher if displaying publicly
- **Mitigation:** Terms of service disclaimer, don't scrape/redistribute

### Email Deliverability (if sending emails)

- [ ] Use transactional email service (SendGrid, Postmark, Resend)
- [ ] Set up SPF, DKIM, DMARC records
- [ ] Warm up sending domain gradually
- [ ] Keep emails relevant (avoid spam triggers)
- [ ] Easy unsubscribe

### Rate Limiting & Abuse Prevention

- Firebase Auth has built-in rate limiting
- [ ] Consider Cloudflare for DDoS protection (free tier)
- [ ] Monitor for spam account creation
- [ ] CAPTCHA on registration? (hurts UX, defer unless needed)

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

**Current Data Quality:**
| Data | Field | Quality |
|------|-------|---------|
| Start/finish dates | `reads[].startedAt/finishedAt` | ✅ Good |
| Page count | `pageCount` | ⚠️ Often missing |
| Rating | `rating` (1-5) | ✅ Good |
| Genres | `genres[]` | ✅ Good |
| Author | `author` | ✅ Good |
| Format | `physicalFormat` | ⚠️ Often missing |
| Published date | `publishedDate` | ⚠️ Inconsistent format |

**Stats We Can Calculate Now:**
- ✅ Books read per year/month/week
- ✅ Pages read (where pageCount exists)
- ✅ Rating distribution chart
- ✅ Genre breakdown
- ✅ Author breakdown
- ✅ Basic reading streaks (consecutive finish dates)
- ✅ Average book length, average rating

**Competitor Features We're Missing (StoryGraph, Goodreads):**
| Feature | What We'd Need |
|---------|----------------|
| Reading goals | New `readingGoals` user setting |
| Daily progress tracking | New `currentPage` field + daily logs |
| Reading pace (pages/day) | Daily progress tracking |
| DNF (Did Not Finish) | Add DNF status to reads array |
| Mood/pacing tags | Additional content metadata |

**Conclusion:** Sufficient data for basic Reading Stats widget (books/pages this year, rating distribution, genre breakdown). Advanced features like reading pace and goals would require schema changes.

---

**See [CHANGELOG.md](./CHANGELOG.md) for version history.**

**Last Updated**: 2025-12-28
