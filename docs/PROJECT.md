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

## Multi-User Architecture Assessment

### Current State: Secure Single-User Design

The app is built with proper multi-user data isolation:

**Data Structure** - All data under `/users/{userId}/`:
- `/users/{userId}/books/{bookId}`
- `/users/{userId}/genres/{genreId}`
- `/users/{userId}/series/{seriesId}`
- `/users/{userId}/wishlist/{itemId}`

**Security Rules** (firestore.rules):
- `request.auth.uid == userId` enforced on all paths
- Users can ONLY access their own data
- No shared/global collections

**Code Patterns**:
- All queries use `currentUser.uid` consistently
- Caches keyed by user ID with validation
- No hardcoded user assumptions

### Concerns for Scaling

| Area | Issue | Impact | Mitigation |
|------|-------|--------|------------|
| Soft-Delete | `deletedAt` filtered in memory | Slower at scale | Add Firestore index |
| No Roles | All users equal peers | Can't have admins | Add role field if needed |
| Book IDs | User-scoped paths | URLs not shareable | Redesign for global IDs |
| Gravatar | Email hash sent to API | Privacy concern | Document or make optional |
| Rate Limits | No client-side throttling | API abuse risk | Add debounce/throttle |

### Future: Social/Sharing Features

If sharing is desired, these changes are needed:

1. **Global Book IDs** - Use ISBN or app-wide IDs instead of user-scoped Firestore paths
2. **Visibility Field** - Add `visibility: 'private' | 'public' | 'link-only'` to book schema
3. **User Profiles** - Create `/profile/{username}/` with URL-safe usernames
4. **Firestore Rules Update** - Allow public reads on visible content:
   ```
   allow read: if resource.data.visibility == 'public'
               || request.auth.uid == userId;
   ```
5. **Sharing Tokens** - Generate temporary access tokens for wishlists/lists
6. **Follow System** - New collection for user-to-user relationships

### Privacy Considerations

- [ ] Document Gravatar usage in privacy policy (email hash sent externally)
- [ ] Consider Gravatar opt-out setting
- [ ] Document Google Books API usage (ISBN lookups)
- [ ] Document Open Library API usage (cover images, book data)
- [ ] No user PII in URLs (book IDs are opaque)
- [ ] localStorage contains only non-sensitive caches

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
│   │   ├── genres.ts           # Genre CRUD
│   │   ├── series.ts           # Series CRUD
│   │   ├── repositories/       # Data access layer (TypeScript)
│   │   ├── books/              # Book page modules
│   │   ├── wishlist/           # Wishlist page modules
│   │   ├── components/         # Reusable UI components (TypeScript)
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── widgets/            # Dashboard widget system
│   │   └── utils/              # Utility modules (TypeScript)
│   └── sw.js                   # Service worker
├── tests/                      # Test files
├── e2e/                        # Playwright E2E tests
├── _site/                      # Built output
├── docs/                       # Documentation
│   ├── CLAUDE.md               # AI assistant instructions
│   ├── PROJECT.md              # This file
│   └── DEVELOPMENT_STANDARDS.md # Coding standards & roadmap
├── CHANGELOG.md                # Version history
└── README.md                   # Repository overview
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

#### Image Duplicate Detection (Future Enhancement)

Prevent users uploading the same image twice per book using content hashing.

**Detection Methods:**
| Method | How It Works | Pros | Cons |
|--------|--------------|------|------|
| **Content hash (SHA-256)** | Hash file bytes with Web Crypto API | Fast, exact match | Won't catch resized/recompressed |
| **Canvas fingerprint** | Draw to canvas, hash pixel data | Format-agnostic | Slower, won't catch crops/edits |
| **Perceptual hash (pHash)** | Hash visual features | Catches similar images | Needs library, complex |
| **Size + dimensions** | Compare file size & width/height | Very fast | Many false negatives |

**Recommended Approach: Content Hash (SHA-256)**

```javascript
/**
 * Generate SHA-256 hash of file content
 * @param {File} file
 * @returns {Promise<string>} Hex hash
 */
async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Before upload, check if hash exists in book.images
const hash = await hashFile(file);
const isDuplicate = book.images.some(img => img.hash === hash);
if (isDuplicate) {
  showToast('This image has already been added', { type: 'error' });
  return;
}
```

**Implementation Steps:**
- [ ] Add `hash` field to ImageSchema
- [ ] Hash file before compression (original content)
- [ ] Store hash in image metadata on upload
- [ ] Check existing hashes before uploading new image
- [ ] Show user-friendly duplicate message

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
- [x] Barcode scanner: Add visual feedback/progress indicator while scanning (can take time)
- [x] Barcode scanner: Add audio beep fallback for iOS (Web Vibration API not supported on any iOS browser - all use WebKit)
- [ ] Camera photo upload: Allow users to take a photo directly from device camera to add as book image (counts towards image limit)

### Image Loading UX Improvements
Current image loading shows spinners indefinitely until the image loads or fails. This creates poor UX when images are slow to load or the server is unresponsive (e.g., Open Library 502 errors).

**Current Behaviour:**
- Spinner shows while image loads
- Placeholder shown on error
- No timeout - spinner can show indefinitely on slow/stalled requests

**Proposed Improvements:**

| Component | Current | Proposed |
|-----------|---------|----------|
| **Book cards** | Spinner → image/placeholder | Add 5s timeout, show placeholder if stalled |
| **Book detail cover** | Spinner → image/placeholder | Add 10s timeout, progressive enhancement |
| **Lightbox** | Spinner → image | Add 15s timeout, "Failed to load" message |
| **Widgets** | Spinner → image/placeholder | Add 5s timeout, consistent with cards |

**Implementation Tasks:**
- [ ] Add configurable timeout to image loading (default 5-10s)
- [ ] Show placeholder immediately, fade in image when loaded (no spinner)
- [ ] Use blur placeholder technique (tiny base64 preview → full image)
- [ ] Add "retry" button for failed images instead of just placeholder
- [ ] Consider using `loading="lazy"` + `decoding="async"` consistently

**Progressive Loading Pattern:**
```javascript
// Recommended pattern for image loading with timeout
function loadImageWithTimeout(img, src, timeout = 5000) {
  const timer = setTimeout(() => {
    img.src = '/images/placeholder.svg';
    img.classList.add('load-failed');
  }, timeout);

  img.onload = () => {
    clearTimeout(timer);
    img.classList.add('loaded');
  };

  img.onerror = () => {
    clearTimeout(timer);
    img.src = '/images/placeholder.svg';
  };

  img.src = src;
}
```

**CSS Fade-In Pattern:**
```css
/* Show placeholder immediately, crossfade to loaded image */
.book-cover {
  background: url('/images/placeholder.svg') center/cover;
}
.book-cover img {
  opacity: 0;
  transition: opacity 200ms ease-in;
}
.book-cover img.loaded {
  opacity: 1;
}
```

**Priority:** Medium - improves perceived performance and handles API failures gracefully.

---

### Image Lightbox UX Polish
Current lightbox is functional but needs polish for a premium feel.

**Transitions & Animations:**
- [x] Fade in/out backdrop on open/close (opacity 0→1)
- [x] Scale up from thumbnail on open (transform: scale)
- [x] Crossfade between images on prev/next (not instant swap)
- [ ] Smooth counter text transitions
- [x] Button hover/active states with transitions

**Mobile Gestures:**
- [ ] Pinch-to-zoom on touch devices
- [ ] Double-tap to zoom in/out
- [ ] Pan/drag when zoomed in
- [ ] Swipe velocity affects animation speed
- [x] Pull down to close (like iOS photos)
- [x] Swipe left/right for prev/next

**Performance & Loading:**
- [ ] Preload adjacent images (n-1, n+1)
- [ ] Blur placeholder while loading (blurhash or tiny preview)
- [ ] Progressive image loading (thumbnail → full size)
- [ ] Skeleton shimmer during load

**Visual Polish:**
- [ ] Backdrop blur (`backdrop-filter: blur()`)
- [ ] Subtle vignette on backdrop
- [x] Image shadow/glow effect
- [x] Rounded corners on image
- [ ] Safe area padding for notched devices

**Accessibility:**
- [x] Focus trap within lightbox
- [x] Announce image changes to screen readers
- [x] Reduce motion option (respect `prefers-reduced-motion`)

**Implementation Notes:**
```css
/* Example transitions */
.lightbox {
  transition: opacity 200ms ease-out;
}
.lightbox-image {
  transition: transform 200ms ease-out, opacity 150ms ease-out;
}
/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .lightbox, .lightbox-image {
    transition: none;
  }
}
```

**Libraries to Consider:**
- `photoswipe` - Full-featured, gestures, zoom (29KB)
- `lightgallery` - Feature-rich, plugins (25KB)
- `glightbox` - Lightweight, modern (12KB)
- Custom implementation - Full control, no dependency

**Recommendation:** Start with CSS transitions for open/close and crossfade. Add pinch-zoom later if needed (complex). Consider `glightbox` if gestures become priority.

### Toast Notifications UX Polish
Current toasts are functional but basic.

**Transitions & Animations:**
- [x] Add type icons (checkmark for success, X for error, info circle for info)
- [x] Smooth slide-in from bottom (mobile) / right (desktop)
- [x] Fade out animation on dismiss

**Mobile Gestures:**
- [x] Swipe-to-dismiss on touch devices
- [x] Tap anywhere on toast to dismiss early

**Performance & Loading:**
- [x] Toast queue system (stack multiple toasts, don't replace)
- [x] Max 3 visible toasts, queue remainder
- [x] Auto-dismiss pauses on hover/focus

**Visual Polish:**
- [x] Icon indicators per type (Lucide: `check-circle`, `x-circle`, `info`)
- [x] Subtle shadow for depth (shadow-lg in toast classes)

**Accessibility:**
- [x] `aria-live="polite"` on toast container
- [x] Role="alert" for error toasts

### Book Cards & List UX Polish
Book cards have basic hover states but could feel more premium.

**Transitions & Animations:**
- [x] Stagger animation on initial load (cards appear sequentially)
- [x] Use existing `.card-animate` class (already defined in CSS)
- [x] Smooth skeleton→content fade transition
- [x] Badge count update animation (brief pulse)

**Mobile Gestures:**
- [ ] Long-press context menu (edit, delete, share)
- [ ] Swipe actions on list view (quick status change)

**Performance & Loading:**
- [ ] Skeleton loader for card content (not just cover)
- [ ] Progressive image loading (blur placeholder → full)
- [ ] Virtualised list for 100+ books (render only visible)

**Visual Polish:**
- [x] Cover image shadow/depth effect
- [ ] Status badge micro-animations
- [x] Empty state with icon (standardised pattern - icons preferred over illustrations)

**Accessibility:**
- [x] Announce list updates to screen readers (aria-live on count elements)
- [ ] Card selection states for keyboard users

### Filter Panel UX Polish
Filter panel is functional but transitions feel instant.

**Transitions & Animations:**
- [x] Secondary filters: smooth height transition (max-height 0→auto)
- [x] Chevron rotation animation (already done via class)
- [ ] Dropdown options fade-in on open (deferred - requires custom dropdown component)
- [x] Active filter chips: scale animation on add/remove

**Mobile Gestures:**
- [ ] Pull-to-refresh on book list triggers filter reset option

**Performance & Loading:**
- [ ] Skeleton loader for filter counts
- [x] Debounced filter application (150ms)

**Visual Polish:**
- [ ] Filter count badges pulse when count changes
- [ ] Clear all filters button appears with animation
- [x] Bottom sheet handle affordance

### Search Overlay UX Polish
Search works but appears/disappears instantly.

**Transitions & Animations:**
- [x] Overlay fade in (opacity 0→1, 200ms)
- [x] Search input slide down from top
- [x] Results stagger animation (like book cards)
- [x] Close animation (fade out, 200ms)

**Visual Polish:**
- [x] Backdrop blur on overlay (`backdrop-filter: blur(4px)`)
- [x] Result count badge in header ("12 results")
- [x] Recent searches section (stored in localStorage)
- [x] "No results" state with icon (standardised empty state pattern)

**Performance & Loading:**
- [x] Search skeleton while loading
- [x] Highlight matching text in results

**Accessibility:**
- [x] Search landmark role (`role="search"`)
- [x] Announce result count changes (already had aria-live="polite")

### Navigation Menu UX Polish
Mobile menu shows/hides without animation.

**Transitions & Animations:**
- [x] Menu slides in (mobile: bottom sheet from below, desktop: slide from right)
- [x] Backdrop fades in (opacity 0→1, 200ms)
- [ ] Menu icon morphs to X on open
- [ ] Stagger animation for menu items

**Mobile Gestures:**
- [ ] Swipe from left edge to open menu
- [ ] Swipe left to close menu

**Visual Polish:**
- [x] Active page indicator (highlights current page in menu)
- [x] Menu item hover/active states with transitions

### Page Transitions UX Polish
Currently no page entry/exit animations.

**Transitions & Animations:**
- [x] Page content fades in on load (use existing `@keyframes pageIn`)
- [x] Add `.page-content` class to main content area (in base.njk)
- [ ] Stagger animation for page sections
- [ ] Consider View Transitions API for SPA-like feel

**Implementation Notes:**
```css
/* Already defined in tailwind.css */
@keyframes pageIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: pageIn 300ms ease-out;
}
```

### Widget Loading UX Polish
Widgets have skeleton loaders but swap is instant.

**Transitions & Animations:**
- [x] Skeleton fades out, content fades in (crossfade)
- [x] Widget scroll snap with momentum (already done)
- [x] Empty state fade-in animation

**Performance & Loading:**
- [ ] Preload widget data during idle time
- [ ] Stagger widget loading (most important first)

### Add Book UX Redesign
Current add book page shows all lookup methods and full form at once. Proposed progressive disclosure approach:

**Current Issues:**
- Form always visible (15+ fields on first load)
- Three separate lookup sections (scan, ISBN, search)
- User may skip lookup and type manually (worse data quality)
- No feedback showing data source

**Proposed Flow:**
```
┌─────────────────────────────────────────┐
│ Find Your Book                          │
│ [📷 Scan] [Search______________] [Go]   │
│ (results appear here)                   │
│                                         │
│ ▼ Can't find it? Add manually           │
└─────────────────────────────────────────┘
        ↓ After book found/manual ↓
┌─────────────────────────────────────────┐
│ ✓ Found via Google Books  [Start Over]  │
│ Title: [Pre-filled________]             │
│ ...form fields...                       │
│ [Add to Library]                        │
└─────────────────────────────────────────┘
```

**Implementation Tasks:**
- [x] Consolidate scan/ISBN/search into single search input ✅
- [x] Smart detection: ISBN pattern → direct lookup, else → search ✅
- [x] Hide form initially, show on book select or "add manually" ✅
- [x] Add "Start over" to reset and return to search ✅
- [x] Show data source badge ("Found via Google Books") ✅
- [ ] Smooth slide transition when form appears
- [ ] Preserve search state if user goes back

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

#### Library Health Scalability (Future)
As libraries grow, the health dashboard could become unwieldy with many issues listed.

**Potential Solutions:**
- [ ] Collapse issue sections by default, show count badges only
- [ ] "Show first 10" with "Load more" button per section
- [ ] Virtual scrolling for sections with 50+ items
- [ ] Filter by issue type (missing cover vs missing genre)
- [ ] Sort by severity or date added
- [ ] Batch fix actions with progress indicator

### Settings Page Scalability (Future)

#### Genres & Series Management
As users accumulate many genres/series, the Settings > Library page lists will need better management.

**Competitor Research Summary:**

| App | Pagination | Search/Filter | Sort | Performance |
|-----|------------|---------------|------|-------------|
| **Goodreads** | Yes (10/20/30 per page) | Limited | Alphabetical | Issues with 500+ items |
| **StoryGraph** | No (infinite scroll) | Yes (tags) | Alphabetical, by count | Lazy-loading planned |
| **Literal** | Not specified | Available | Custom | Not specified |
| **Hardcover** | Not specified | Typesense search | Most-used first | Slow with large lists |

**Key Findings:**
- No major app uses virtual scrolling (opportunity to differentiate)
- Bulk/batch editing commonly requested but not standard
- Performance degrades significantly at 500+ items
- StoryGraph actively working on lazy-loading for tag management

**Recommended Implementation:**
- [ ] Search/filter input above genre/series lists
- [ ] Sort options: alphabetical, by book count, recently used
- [ ] Virtual scrolling or "load more" for 50+ items
- [ ] Bulk select with multi-delete capability
- [ ] Collapse unused genres/series into "Show all" expander

### Privacy Settings
- [ ] Profile visibility (public/private)
- [ ] Per-book privacy controls
- [ ] Download all my data (GDPR-style export)
- [ ] Clear local cache/data

### Technical Debt

**Completed:**
- [x] Fix colour inconsistencies in Data Cleanup buttons (all amber)
- [x] Generate in-app changelog from CHANGELOG.md at build time
- [x] Full Zod validation (novalidate on all forms)
- [x] Tree-shake Lucide icons (378KB → 14KB)
- [x] Minify/bundle JavaScript (797KB → 259KB)
- [x] E2E validation tests + form-html-alignment tests
- [x] Event listener cleanup with destroy() methods
- [x] Repository pattern - All 6 repositories complete
- [x] TypeScript migration - 100% (73 files)
- [x] Event bus - Pub/sub for decoupled communication
- [x] Async error handling in all Firebase operations
- [x] Scroll to first invalid field on validation failure

**Remaining:**
- [ ] Server-side search (Algolia/Firestore) - for 500+ books
- [ ] Virtualised list rendering - for 500+ books
- [ ] Split large files (see File Size Review below)

### File Size Review (Dec 2025)

Several JS files have grown large and should be considered for refactoring:

| File | Lines | Status | Priority |
|------|-------|--------|----------|
| `books/index.js` | 1,688 | ⚠️ Very large | High |
| `settings/library.js` | 1,118 | ⚠️ Large | Medium |
| `books/add.js` | 1,011 | ⚠️ Large | Medium |
| `components/filter-panel.js` | 935 | Borderline | Low |
| `books/edit.js` | 771 | OK | - |
| `components/modal.js` | 635 | OK | - |
| `books/view.js` | 616 | OK | - |

**Recommended Refactoring:**

**1. `books/index.js` (1,688 lines)** - Split into:
- `books/list-renderer.js` - Book card rendering, infinite scroll
- `books/filter-logic.js` - Filter state, count calculation, filter application
- `books/index.js` - Page orchestration only

**2. `settings/library.js` (1,118 lines)** - Split into:
- `settings/genre-manager.js` - Genre CRUD, merge, colour picker
- `settings/series-manager.js` - Series CRUD
- `settings/backup-restore.js` - Export/import logic
- `settings/library.js` - Page orchestration

**3. `books/add.js` (1,011 lines)** - Split into:
- `books/barcode-scanner.js` - Quagga setup, camera handling
- `books/isbn-lookup.js` - API calls, result parsing
- `books/add.js` - Form handling, page orchestration

**Guidelines for splitting:**
- Extract pure functions first (no side effects, easy to test)
- Keep page orchestration in main file (DOM setup, event binding)
- Each extracted module should have single responsibility
- Add tests for extracted modules before splitting

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

### Lighthouse Audit (Dec 2025)

**Scores (excluding login page):**
| Category | Score |
|----------|-------|
| Accessibility | 100% ✅ |
| Best Practices | 100% ✅ |
| SEO | 100% ✅ |
| Performance | Needs improvement |

**Performance Issues Identified:**
1. Render-blocking resources (CSS, JS)
2. No cache headers on static assets
3. Back/forward cache not optimised

**Implemented Fixes:**
- [x] Add cache headers for static assets (netlify.toml)
- [x] Defer non-critical scripts (lucide.min.js)

**Future Improvements:**
- [ ] Inline critical CSS for above-the-fold content
- [ ] Lazy load Firebase SDK on pages that need it
- [ ] Code split large bundles (books/add.js: 89KB)
- [ ] Pre-cache critical assets in service worker

**Run audit:** `npm run audit` (requires server on port 8080)

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

## Author Lookup & Suggestions (Research)

### Implementation Status (2025-12-30)

**AuthorPicker component implemented** (`src/js/components/author-picker.js`) with:
- ✅ User Library Priority - Authors derived from user's existing books
- ✅ Library Indicator - Shows book count (e.g., "Stephen King (5 books)")
- ✅ Name Normalisation - Handles "J.R.R. Tolkien" vs "JRR Tolkien" via substring matching
- ✅ "Use typed value" option for new authors not in library
- ✅ Close button and keyboard navigation (consistent with other pickers)
- ✅ Data Model: Option B (derive from books, no new collection)

**Still to consider for future:**
- API Fallback - Search Open Library for external authors (see API details below)
- Fuse.js fuzzy matching - Better typo tolerance
- Multiple Authors - Support multiple authors with roles
- Author Thumbnails - Display author images in dropdown

### Open Library Authors API

Best free option for author data. No API key required (just User-Agent header).

**Search authors:**
```
GET https://openlibrary.org/search/authors.json?q=tolkien
```

**Response fields:**
- `key` - Author ID (e.g., "OL26320A")
- `name` - Author name
- `alternate_names` - Name variants (handles "J.R.R. Tolkien" vs "John Ronald Reuel Tolkien")
- `birth_date` - Birth date string
- `top_work` - Most notable work title
- `work_count` - Total number of works
- `top_subjects` - Subject categories

**Get author details:**
```
GET https://openlibrary.org/authors/OL26320A.json
```

**Get author photo:**
```
https://covers.openlibrary.org/a/olid/OL26320A-M.jpg
```
Sizes: S (small), M (medium), L (large)

**Get author's works:**
```
GET https://openlibrary.org/authors/OL26320A/works.json?limit=50
```

**Why Open Library over Google Books:**
- Dedicated author search endpoint
- Author photos available
- Work counts (similar to our "X books" indicator)
- Alternate names built-in (helps with matching)
- No API key required

### Competitor Analysis

| Feature | Goodreads | StoryGraph | Literal | BookTrack | Hardcover |
|---------|-----------|------------|---------|-----------|-----------|
| **Autocomplete from DB** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Suggest from User Library** | Limited | Requested (208 votes) | Unknown | Unknown | Unknown |
| **Fuzzy Matching** | Via Librarians | Unknown | Unknown | Unknown | Unknown |
| **Multiple Authors** | ✓ (with roles) | ✓ | ✓ | ✓ (with roles) | ✓ (contributors) |
| **Author Photos in Suggestions** | Profile only | No | No | No | ✓ (images) |
| **Author Bio Preview** | No | No | No | No | No |

### Key Findings

**Goodreads:**
- Authors have dedicated profile pages with photos, bios, bibliographies
- Multiple authors supported with role designation (Author, Editor, Illustrator, Translator, etc.)
- Author order matters for edition matching
- Fuzzy matching handled via Librarian system (community-driven)

**StoryGraph:**
- Author pages are "a mess" (team's words) - major improvement planned
- Users highly request showing "already in library" indicator (327 votes for author stats)
- Search suggestions appear "pretty random" (possibly by recency)

**Hardcover:**
- Uses "contributors" model instead of "authors" (more flexible for roles)
- GraphQL API includes contributor name, ID, and image
- Developer-friendly API structure

### Recommended Implementation

**High Priority (Must Have):**
1. **User Library Priority** - Query existing authors from user's books first
2. **API Fallback** - Search Google Books/Open Library for additional matches
3. **Library Indicator** - Show "X books in library" for known authors
4. **Multiple Authors** - Support multiple authors with role designation

**Medium Priority (Should Have):**
4. **Fuzzy Matching** - Use Fuse.js for typo tolerance and name variations
5. **Author Thumbnails** - Display small author images in dropdown (from API)

**Lower Priority (Nice to Have):**
6. **Author Bio Preview** - Show brief bio on hover (Open Library author API)
7. **Spelling Suggestions** - "Did you mean..." based on fuzzy match scores

### Technical Architecture

```javascript
// Proposed AuthorPicker component (similar to GenrePicker, SeriesPicker)
class AuthorPicker {
  constructor({ container, userId, onChange, initialValue }) {
    // Fetch user's existing authors for prioritized suggestions
    // Debounced API lookup for external authors
    // Fuzzy matching with Fuse.js
  }

  async getSuggestions(query) {
    // 1. Search user's library authors (local, fast)
    // 2. Fuzzy match against cached results
    // 3. API lookup for additional results (debounced)
    // Return merged, deduplicated results with library indicator
  }
}
```

### Multiple Author Roles (Best Practice from Goodreads)

| Suitable Roles | Unsuitable Roles |
|----------------|------------------|
| Author | Cover Artist |
| Editor | Proof-Reader |
| Illustrator | Copy-Editor |
| Translator | |
| Foreword | |
| Introduction | |
| Narrator | |

**Important:** List authors in order shown on book cover (critical for data consistency).

### Fuzzy Matching Considerations

**Name Variations to Handle:**
- Typos: "Barak Obama" vs "Barack Obama"
- Format: "J.R.R. Tolkien" vs "JRR Tolkien" vs "John Ronald Reuel Tolkien"
- International transliterations
- Pen names / pseudonyms

**Recommended Library:** Fuse.js (lightweight, configurable thresholds, client-side)

### Data Model Consideration

**Option A: Extract unique authors to user collection**
```
/users/{userId}/authors/{authorId}
  - name, photoUrl, bio (cached)
  - bookCount (auto-calculated)
```
Pros: Faster autocomplete, can store metadata
Cons: More Firestore documents, sync complexity

**Option B: Derive from existing books (current approach)**
```javascript
const uniqueAuthors = [...new Set(books.map(b => b.author))];
```
Pros: No schema change, always in sync
Cons: Slower, no metadata storage

**Recommendation:** Start with Option B, migrate to Option A if performance becomes an issue or author metadata features are needed.

---

## Author Pages Feature (Research)

### Competitor Analysis

| Feature | Goodreads | StoryGraph | Literal | Hardcover |
|---------|-----------|------------|---------|-----------|
| **Dedicated Author Pages** | ✓ (comprehensive) | Planned (not priority) | ✓ (basic) | ✓ |
| **Author Photo** | ✓ | No | ✓ | ✓ |
| **Author Bio** | ✓ (editable by author) | No | Limited | ✓ |
| **Bibliography** | ✓ (complete) | Basic list | ✓ | ✓ |
| **Series Grouping** | ✓ | Requested | Unknown | ✓ |
| **Sort/Filter Works** | Limited | Requested (high demand) | Unknown | ✓ |
| **Follow Author** | ✓ (77K+ followers for popular) | Requested | Unknown | ✓ |
| **New Release Notifications** | ✓ | Requested | No | ✓ |
| **Books in My Library** | No indicator | Highly requested | Unknown | Unknown |
| **Author Q&A** | ✓ (Ask the Author) | No | ✓ (club Q&As) | No |
| **Author Quotes** | ✓ | No | ✓ (highlights) | No |

### Key Findings

**Goodreads (Most Comprehensive):**
- Full author profiles with photo, bio, birthdate, birthplace
- Complete bibliography with ratings (e.g., The Hobbit: 4.30, 4.4M ratings)
- Series organisation (Middle-earth, Tales of Middle Earth)
- Follower system (77,333 followers for Tolkien)
- "Ask the Author" Q&A feature
- Notable quotes section with engagement metrics
- Related news, interviews, videos
- Author-managed via Goodreads Author Program

**StoryGraph (Major Gap):**
- Author pages described as "a mess" by team
- Highly requested feature (core feature for book tracking)
- Users want: series grouping, publication date sorting, "already in library" indicator
- Follow author with new release notifications requested
- Not prioritised - team hopes to address "early 2025"
- Users rely on external sites (BookSeriesInOrder.com) for bibliographies

**Literal:**
- Basic author pages implemented
- Focus on quotes/highlights integration
- Author Q&As through book clubs
- Less emphasis on comprehensive bibliographies

**Hardcover:**
- Uses "contributors" model (more flexible for roles)
- GraphQL API includes contributor data with images
- Developer-friendly approach

### User-Requested Features (from StoryGraph roadmap)

1. **Navigation & Organisation**
   - Navigate backlist by series/publication dates
   - Group books by series with publication order
   - Filter out certain content types (e.g., novellas under 50 pages)

2. **Library Integration**
   - Highlight books already in read/DNF/to-read lists
   - Show which works user has already added
   - DNR (Do Not Read) tagging with visual flags

3. **Discovery**
   - Show upcoming releases
   - Display most-read titles
   - Sort by popularity/ratings

4. **Notifications**
   - Follow authors for new book releases
   - Different notification levels (new book, new edition, publication date)

### Recommended Implementation for MyBookShelf

**Phase 1 - Basic Author Page (MVP):**
- `/authors/{name}` or `/authors/?name={name}` route
- Author name, photo (from Open Library API)
- List of user's books by this author
- Book count, average rating from user's collection
- Link to filter book list by author (already exists)

**Phase 2 - Enhanced Author Page:**
- Full bibliography from Open Library API
- "In My Library" indicators on works
- Series grouping (derive from existing series data)
- Birth date, bio from API

**Phase 3 - Author Tracking:**
- Follow/unfollow authors (store in user collection)
- New release notifications (requires background job)
- Author notes/tags

### Data Sources

**Open Library Authors API** (see above section for endpoints):
- Author search, details, photo, works list
- No API key required
- Good coverage for most authors

**Potential Schema Addition:**
```
/users/{userId}/followedAuthors/{authorId}
  - name: string
  - openLibraryKey: string (optional)
  - followedAt: timestamp
  - notifyOnNewRelease: boolean
```

### Differentiation Opportunity

StoryGraph users are frustrated with lack of author pages - this is a gap we could fill:
- "Already in library" indicator (StoryGraph's most requested)
- Series organisation (high demand)
- Clean, fast author bibliography

---

## Wishlist Feature Enhancements (Research)

### Competitor Analysis

| Feature | Goodreads | StoryGraph | Literal | Amazon Kindle |
|---------|-----------|------------|---------|---------------|
| **Price Displayed** | Deals only | No | No | ✓ |
| **Availability** | Via extensions | No | No | ✓ |
| **Release Date** | ✓ | ✓ | Limited | ✓ |
| **Priority Ranking** | Custom shelves | Up Next (5 books) | Random picker | List priority |
| **Price Drop Alerts** | Deals emails (US) | No | No | ✓ (built-in) |
| **New Release Notifications** | ✓ | Planned | No | Via Amazon |
| **Import from Other Sources** | Limited | Goodreads | GR/SG | URL/tools |
| **Recommendations** | Strong algorithm | Mood-based | Club-based | Purchase-based |
| **Shareable Wishlists** | Manual | Public tags | Shelves/API | ✓ (full) |
| **Gift List Feature** | Workaround | Planned (22 votes) | No | ✓ (registry) |
| **Library Availability** | Via extensions | No | No | No |
| **Where to Buy Links** | Deals program | No | No | ✓ (integrated) |

### Key Findings

**Goodreads:**
- Pre-published book alerts when shelved book hits stores
- "Goodreads Deals" emails for US members (price promotions on Want-to-Read)
- Users create workaround "wishlist" custom shelves for priority
- Third-party extensions (Library Extension, Available Reads) for library availability
- Recommendation engine uses 20 billion data points

**StoryGraph:**
- "Up Next" feature: Flag up to 5 priority books from TBR
- No author follow/new release notifications yet (highly requested)
- Wishlist with gift reservation planned (22 upvotes) - prevents duplicate purchases
- "Let us Pick for You" random selector from TBR

**Literal:**
- "Jump to a Random Book" from database or TBR
- Shareable shelves as playlists
- Website embedding widget for reading lists
- Open API for custom integrations

**Amazon Kindle:**
- Full price tracking with drop alerts
- Gift registry with reservation system
- Shareable lists with view/edit permissions
- Third-party tools: eReaderIQ, CamelCamelCamel, Keepa for enhanced tracking

### Market Gaps (Opportunities)

1. **Unified Price + Library** - No app combines price tracking with library availability
2. **Smart Priority Systems** - No interest level ratings (1-5 excitement scale)
3. **Notification Hub** - Author follow + release + price alerts in one place
4. **Gift Coordination** - Only Amazon prevents duplicate gift purchases
5. **Cross-Platform Import** - Most only support Goodreads import

### Recommended Implementation

**High Priority (Must Have):**
1. **Release Date Display** - Show publication date for upcoming books
2. **Release Notifications** - Alert when wishlisted books release
3. **Priority/Interest Level** - 1-5 scale for TBR ranking (not just high/medium/low)
4. **Import from Goodreads** - CSV import for want-to-read shelf

**Medium Priority (Should Have):**
5. **Library Availability** - Check Libby/OverDrive availability
6. **Shareable Wishlists** - Public link for gift coordination
7. **Gift Reservation** - Prevent duplicate purchases (mark "someone's getting this")

**Lower Priority (Nice to Have):**
8. **Where to Buy Links** - Links to major retailers (Amazon, Waterstones, etc.)
9. **Random Picker** - "What should I read next?" from TBR
10. **Price Tracking** - Integration with price tracking services

### Library Availability Integration

**Potential APIs:**
| Service | API | Notes |
|---------|-----|-------|
| **OverDrive/Libby** | Partner API | Requires library partnership |
| **Library Extension** | Browser only | 5,000+ library systems |
| **WorldCat** | OCLC API | Requires subscription |
| **Open Library** | Free | Limited availability data |

**Recommendation:** Start with Open Library (free), consider OverDrive partnership later.

### Gift List Data Model

```
/users/{userId}/wishlist/{itemId}
  + giftReservedBy: string | null  // Other user's ID
  + giftReservedAt: timestamp
  + isPublic: boolean              // Shareable link visibility
```

**Gift Coordination Flow:**
1. User shares wishlist link
2. Friend views wishlist, clicks "I'll get this"
3. Item marked as reserved (hidden from other gift-givers)
4. Original user doesn't see reservation (surprise preserved)

### Price Tracking Considerations

**Build vs Partner:**
| Approach | Pros | Cons |
|----------|------|------|
| **Build own** | Full control | Massive undertaking, retailer relationships |
| **Partner with eReaderIQ** | Existing data | May have API costs, dependency |
| **Link to CamelCamelCamel** | Free, trusted | No in-app data, external redirect |
| **User-entered prices** | Simple | Manual, stale data |

**Recommendation:** Link to existing price tracking tools rather than building. Focus on core reading features.

---

**See [CHANGELOG.md](./CHANGELOG.md) for version history.**

**Last Updated**: 2025-12-31
