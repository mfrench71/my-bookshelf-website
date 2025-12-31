# Changelog

All notable changes to MyBookShelf are documented here.

---

## 2025-12-31

- Per-picker suggestion order settings in Settings > Library:
  - Genre picker: Toggle in Genres section to show public source suggestions first
  - Series picker: Toggle in Series section to show public source suggestions first
  - Default: Your items shown first (independent settings per picker)
- Complete export/import backup:
  - Now includes series (all series including soft-deleted)
  - Now includes bin items (soft-deleted books)
  - Import remaps series IDs to prevent broken references
  - Upgrade export format to v2 (still imports v1 backups)

## 2025-12-30

- Internal: Convert all UI components and domain modules to TypeScript for improved code reliability
- New AuthorPicker component for book add/edit forms:
  - Library-aware suggestions showing authors from your existing books
  - Book counts displayed next to each author (e.g., "Stephen King (5 books)")
  - Fuzzy matching handles variations like "J.R.R. Tolkien" vs "JRR Tolkien"
  - "Use typed value" option for entering new authors not in your library
  - Close button and keyboard navigation (arrow keys, Enter, Escape)
- Fix false dirty state on book edit page (Save Changes button no longer active on load)
- Fix discard changes modal on book add page (now only shows when form has actual content)
- Fix auto-sync not showing books added from other devices (now fetches all pages from server)
- Barcode scanner UX improvements:
  - Add viewfinder frame with corner accents to guide barcode positioning
  - Add loading spinner ("Starting camera...") while camera initialises
  - Add audio beep on successful scan for iOS (vibration not supported)
  - Fix camera not releasing after closing (force-stop video streams)
  - Add escape key to close scanner modal
- Add Book page polish:
  - Smooth crossfade transitions between search and form sections
- Form navigation protection:
  - In-app links (header, breadcrumbs) now show ConfirmSheet when form has unsaved changes
  - Prevents accidental data loss with app-like confirmation dialog
- Add `ConfirmSheet.show()` static method for Promise-based confirmations
- Book view page improvements:
  - Author link now clickable (blue with arrow, filters book list by author)
  - Genre badges now clickable (filters book list by genre)
  - Hover effects on genre badges (opacity + scale)
- Fix service worker missing pages (wishlist, bin, privacy) - found via PWA audit
- Increase test coverage from 73% to 77% (exceeds 75% target)
  - Add ImageGallery component tests (41 tests)
  - Add image-upload utility tests (27 tests)
- UX polish - visual enhancements:
  - Add cover shadow/depth effect to book covers (list and view pages)
  - Add badge pulse animation when wishlist/filter counts change
  - Add content fade-in animation on page load (book list, wishlist, bin, search)
  - Add `cover-shadow` utility class for any-size cover shadows
- Menu improvements:
  - Add hover transitions and active page highlighting
  - Fix active state spacing (use text colour instead of background)
- Search skeleton loader while books are loading
- Add `npm run dev` command for full file watching (JS, CSS, templates)
- Accessibility testing and fixes:
  - Add E2E accessibility tests for authenticated pages (using JS disabled mode)
  - Fix duplicate h1 on books list page (sr-only h1 + aria-hidden visual headings)
  - Expand accessibility test coverage to all pages (46 tests total)
  - Standardise empty state styling across all pages (consistent icon, text, spacing)
- UX polish animations:
  - Search overlay: header slides down from top when opening
  - Search results: stagger animation on book cards
  - Filter chips: scale animation when appearing
  - Empty states: fade-in animation across all pages
- Enhance book card component:
  - Add `className` option for custom CSS classes
  - Add `animationDelay` option for stagger effects

---

## 2025-12-29

- Search UX improvements:
  - Remove loading spinner from empty search state (no spinner before typing)
  - Only save recent searches when user clicks a result (not on every keystroke)
  - Expand search to include ISBN, series, notes, publisher fields
  - Update search empty state text to list all searchable fields
- Save button change tracking site-wide (disabled until form has changes):
  - Genre modal: disabled until name entered (add) or fields changed (edit)
  - Series modal: disabled until name entered (add) or fields changed (edit)
  - Wishlist edit modal: disabled until priority or notes changed
  - Password change modal: disabled until all three fields filled
  - Delete account modal: disabled until password and "DELETE" confirmation filled
  - Book add page: disabled until title AND author entered
- Fix colour picker scroll position when modal opens (scroll to top)
- Update privacy policy:
  - Add wishlist data to "Data We Collect" section
  - Add 30-day bin retention to "Data Retention" section
  - Fix links to correct settings sub-pages (Library, Preferences, Bin)
- Add scroll to first invalid field on form validation failure:
  - New `scrollToFirstError()` utility in validation.js
  - Applied to book add and edit forms
  - CSS `scroll-margin-top` on inputs for sticky header offset
  - Focus disabled on mobile to avoid virtual keyboard popup
- Accessibility improvements:
  - Add `role="alert"` to error toasts for immediate screen reader announcement
  - Add `role="search"` landmark to search overlay
  - Add `aria-live="polite"` to book/wishlist count elements for filter updates
- Fix semantic HTML structure across all templates:
  - Remove duplicate `<main id="main-content">` elements that conflicted with base.njk
  - Fix blank book view/edit pages caused by duplicate IDs
- Fix mobile filter panel counts not updating when clicking checkboxes:
  - Filter counts now update live as user interacts with mobile bottom sheet
  - Fixed missing author filter sync when opening mobile filter sheet
  - Add tests for filter count calculation with override support
- Add UX polish animations and transitions:
  - Toast notifications: slide-in from bottom (mobile) / right (desktop) with fade-out animation
  - Filter panel: smooth height transition when expanding/collapsing secondary filters
  - Widget loading: crossfade animation when skeleton is replaced with content
  - Navigation menu: backdrop fade animation when opening/closing
  - Search overlay: backdrop blur effect and fade transitions
  - Page entry: fade-in animation using `.page-content` class
  - Book cards: stagger animation on initial load using `.card-animate` class
  - Search results: live result count badge ("12 results")
  - Toast: tap-to-dismiss functionality with cursor pointer affordance

---

## 2025-12-28

- Add book image gallery with Firebase Storage:
  - Upload up to 10 images per book (covers, interior photos, personal photos)
  - Client-side compression: WebP format (30% smaller), 1200px max, 0.75 quality
  - ImageGallery component with drag-to-reorder and primary selection
  - Set uploaded image as book cover option in CoverPicker
  - Read-only gallery on book view page with custom lightbox
  - Lightbox: keyboard navigation (arrows/ESC), touch swipe, loading states
  - Consistent image loading: skeleton spinner, lazy loading, error fallback
- Improve genre parsing from book APIs:
  - Add comma-separated genre support (Open Library format like "Fiction, humorous, general")
  - Add double-dash separator support ("Rich people -- fiction")
  - Normalize compound genres: "fantasy fiction" → "Fantasy", "horror fiction" → "Horror"
  - Normalize ampersand formats: "Action & Adventure" → "Adventure"
  - Convert ALL CAPS to Title Case for consistency
  - Filter metadata: series markers, reading levels, NYT lists, translation notes
  - Filter award metadata: "Award:National_book_award=1992", "National Book Award Winner"
  - Add ~60 genre normalization mappings based on API audit
  - British spelling: "humorous" → "Humour"
  - Fix bug where filtered genres like "General" were still appearing (|| operator issue)
  - Fix inconsistent casing: "College teachers" now becomes "College Teachers"
- Add genre merge functionality:
  - Merge button on genre rows in Settings > Library
  - Modal to select target genre
  - Books with source genre get target genre (if not already present)
  - Source genre is deleted after merge
- Refactor genre colour assignment:
  - Auto-assign random colour when creating genres (no picker needed)
  - Expand colour palette from ~60 to ~120 colours (Tailwind 200-800 shades)
  - Edit genre shows colour picker with only available colours (used hidden)
  - Scrollable colour picker with max-height for compact display
- Add author filter to book list with typeahead search:
  - Searchable dropdown in filter panel (between Rating and Genre)
  - Shows author counts (faceted filtering)
  - Keyboard navigation support (Arrow/Enter/Escape)
  - Syncs between desktop sidebar and mobile filter sheet
- Add book count display to book list header:
  - Shows "X books" when no filters active
  - Shows "X of Y books" when filters reduce results
- Fix genre chip styling on book edit page (cleaner, smaller badges)
- Fix filter panel scrollbar overlapping checkboxes
- Add Wishlist widget for home page dashboard:
  - Shows wishlist items with priority sorting (high first)
  - Configurable: items to show (3-12), sort by (Priority/Date/Title)
  - Priority badges (high=red, medium=yellow, low=gray)
  - Links to wishlist page
- Truncate long email addresses in header menu
- Add wishlist to backup/restore:
  - Export now includes wishlist items
  - Import handles wishlist with duplicate detection
- Improve import with cross-checks between wishlist and library:
  - Skip importing wishlist items that match books you already own
  - Auto-remove wishlist items when matching book is imported from backup
- Add detailed on-page import summary:
  - Shows counts of imported vs skipped items with icons
  - Explains why items were skipped (duplicate, already owned)
  - Shows auto-removed wishlist items when now owned
  - Persists on page so user can read (no auto-redirect)
- Show filled heart icon on search results for already-wishlisted books
- Show last modified date on book view page (only if different from added date)
- Codebase audit fixes:
  - Fix touch targets below 44px (header search clear button, preferences widget buttons)
  - Add Zod validation to wishlist edit form (priority and notes fields)
  - Remove redundant validation toast messages (inline errors are sufficient)
  - Add try/catch to async event handlers (wishlist badge update, infinite scroll)
  - Add proper toast types to library export/import messages
- Accessibility: Add proper label associations to all form inputs site-wide:
  - Add `for` attributes to labels in add.njk, edit.njk, wishlist/index.njk
  - Add `for` attributes to settings/index.njk (password change, delete account forms)
  - Add `for` attributes to settings/library.njk (genre, series, merge forms)
  - Add sr-only labels to sort selects (books/index.njk, wishlist/index.njk)
  - Add `aria-labelledby` to genre-picker and series-picker inputs
  - Add unique IDs with instance counters to filter-panel selects
  - Add `aria-label` to widget toggle checkboxes in preferences
  - Add `aria-label` to rating star buttons
  - Add `aria-label` to genre colour picker buttons
  - Add `aria-label` to filter chip remove buttons
- Mobile usability audit fixes:
  - Add `viewport-fit=cover` for safe area/notch handling
  - Fix touch targets in genre-picker (close button, remove genre button)
  - Fix touch target in series-picker (clear button)
- SEO audit fixes:
  - Remove auth-protected pages from sitemap (only public pages now)
  - Add meta descriptions to home, login, and books pages
  - Add sr-only `<h1>` to home and books list pages for SEO
- Core Web Vitals audit:
  - Add `loading="lazy"` to remaining images (maintenance, add book search)
- Privacy/GDPR audit:
  - Fix account deletion to also delete series and wishlist subcollections
- Fix series order sorting when linking from series widget to book list
- Fix picker components not closing when another picker opens
- Add option to delete empty series when deleting last book in series:
  - Soft-deletes series so it can be restored with the book
  - Auto-restore series when restoring book from bin
- Fix series section on book view showing binned books
- Soft-delete audit: Filter deleted books from all queries:
  - Home page dashboard and widgets
  - Header search
  - Genre and series book counts
  - Maintenance page health analysis
  - Genre deletion and migration operations
- Settings audit and reorganisation:
  - Remove duplicate Export My Data from Profile (use Library's Backup/Restore)
  - Move Clear Cache from Profile to Preferences (new Browser section)
  - Add tab indicators: Maintenance (amber dot if issues), Bin (count badge)
  - Reduced profile.js bundle from 23.6KB to 21.3KB
- Button state UX improvements:
  - Add visual distinction for "Add Anyway" button (amber styling for override action)
  - Clear password field on wrong password error in delete account flow

---

## 2025-12-27

- Add Wishlist feature for books user wants to buy:
  - Separate collection from owned books
  - Wishlist page with sorting (date, priority, title, author by surname)
  - Add to wishlist button on book search results (heart icon)
  - Edit priority (high/medium/low) and notes
  - "I bought this" action moves item to library with ISBN data enrichment
  - Delete items with confirmation
  - Wishlist link in offcanvas menu with dynamic count badge
  - Duplicate detection by ISBN or title+author
  - Compact card layout with action buttons
  - 23 unit tests
- Add multi-select checkbox filters with OR logic:
  - Status, genre, and series filters now support multiple selections
  - Faceted search shows count on each checkbox option
  - Options with 0 results are disabled
  - Active filter chips with individual removal
  - 225 new filter tests (51 FilterPanel + 174 filter logic)
- Add URL filter persistence for bookmarking/sharing filtered views
- Add loading spinner to book cover images
- Fix duplicate filter chips on mobile
- Fix filter bottom sheet scroll conflicts:
  - Scrolling filter content no longer triggers swipe-to-close
  - Pull-to-refresh disabled when filter sheet is open
  - Remove redundant X close button (use handle swipe or backdrop tap)
  - Apply filters on dismiss (backdrop tap or swipe) for better mobile UX
- Fix raw error.message exposure to users (14 occurrences)
- Add .claude/settings.local.json to .gitignore.
- Fix duplicate IDs in FilterPanel (now uses classes for reusable component)

---

## 2025-12-26

- Redesign book list filters:
  - Desktop/tablet: Always-visible sidebar on left with all filter controls
  - Mobile: Bottom sheet triggered by filter button in sticky header
  - Filter count badge shows number of active filters on mobile
  - Create reusable FilterPanel component for consistent UI
  - Swipe-to-dismiss gesture for mobile filter sheet
  - Add 36 FilterPanel component tests
- Move genre picker above series picker on add/edit book forms
- Fix technical debt issues:
  - API refresh highlight now persists until save (was fading after 3 seconds)
  - Add error handling to all Firebase operations in genres.js and series.js
  - Prevent duplicate event listeners (beforeunload, online/offline, touch)
  - Add destroy() cleanup methods to CoverPicker and RatingInput components
- Add Library Health Dashboard to Maintenance page:
  - Shows completeness score with progress bar (weighted by field importance)
  - Lists books with missing data, sorted by most issues first
  - Compact badges show all missing fields per book (cover, genres, pages, etc.)
  - Edit link takes you to book edit page to fix all issues at once
- Add Bin for deleted books with 30-day restore window:
  - Delete now moves books to bin instead of permanent delete
  - Bin page in Settings shows deleted books with restore/delete options
  - Days remaining badge (amber when less than 7 days)
  - Auto-purge expired books (older than 30 days)
  - Empty Bin button to permanently delete all
  - Handles orphan genres/series on restore (removes invalid references)
- Add Privacy Policy page at /privacy/
- Add site-wide footer with copyright, Privacy link, and version
- Add Privacy & Data section to Profile settings:
  - Export My Data (download all books, genres, series as JSON)
  - Clear Local Cache (remove browser-cached data)
- Version number now sourced from package.json (footer and About page)
- Security: Fix XSS vulnerability in genre rendering
- Security: Add colour validation to prevent CSS injection
- Accessibility: Add ARIA attributes to modals (role, aria-modal, aria-labelledby)
- Accessibility: Add ARIA to genre picker (aria-expanded, aria-selected, role)
- Improve scanner error messages (user-friendly instead of raw errors)
- Use event delegation in library settings (reduces memory usage)
- Convert modals to bottom sheets on mobile (slide up, swipe to dismiss)
- Fix double carets on book list filter selects
- Fix iOS Chrome issues with menu and search overlays
- Make header menu responsive (bottom sheet on mobile, slide-out on desktop)
- Add swipe-to-close for mobile menu bottom sheet
- Split Settings into 5 focused pages:
  - Profile: Account info, avatar, password, delete account
  - Library: Genres, series, backup & restore
  - Preferences: Sync settings, widget configuration
  - Maintenance: Genre cleanup, recount, cover fetch
  - About: App info, changelog
- Add tabbed navigation for settings pages
- Tree-shake Lucide icons (378KB → 14KB)
- Bundle and minify JavaScript with esbuild (797KB → 259KB)
- Add novalidate to forms, rely fully on Zod validation
- Update password requirements hint to 8+ characters
- Update documentation and build commands

---

## 2025-12-25

- Replace back buttons with breadcrumb navigation
- Breadcrumbs prevent confusing back/cancel navigation loops
- Static breadcrumbs for Settings and Add Book (no layout shift)
- Dynamic breadcrumbs for View and Edit pages (show book title)
- Hide action button labels on mobile (icons only)
- Fix sub-nav height consistency across all pages
- Align metadata section with content above on book detail
- Fix cover image not saving when adding books via ISBN scan
- Add auto-refresh on tab focus to sync library across devices
- Add configurable sync settings (threshold, cooldown, toggle)
- Move "Refresh Library" from header menu to Settings page
- Icon buttons centred within touch targets
- Fetch larger cover images from APIs at lookup time
- Fix series section to use Firestore indexed query
- Minify Zod library (301KB → 257KB)
- Improve mobile touch targets to 44px minimum
- Add red border styling to reading date validation errors
- Fix PWA service worker registration and update cache
- Improve error handling with user-friendly messages
- Fix race conditions and null checks across codebase
- Add image URL validation and loading timeout
- Fix author audit issues and add missing tests
- Handle Open Library 404 responses gracefully
- Fix codebase audit issues (security, accessibility, UI/UX)

---

## 2025-12-24

- Add series badges to library search results
- Add contextual Series Order sort for series filter
- Fix reset button not showing for URL param series filter
- Add clickable author link with filter on books list
- Add visible author filter badge on books list
- Improve cover image handling and picker UX
- Auto-generate in-app changelog from CHANGELOG.md
- Add loading spinner for cover image on book detail page

---

## 2025-12-23

- Add design tokens and split utils into focused modules
- Replace CDN dependencies with local npm packages
- Improve cover fetch UX and add genre sources documentation
- Add Zod validation for all forms (Sprint 2)
- Refactor to components directory structure (Sprint 3)
- Add CoverPicker and Modal components
- RESTful file restructure and View/Edit split
- Add CSS animations and modal animation support
- Add skeleton loaders for loading states
- Improve empty state designs with icons
- Add E2E tests with Playwright
- Add SEO improvements (Open Graph, sitemap, robots.txt)
- Add accessibility improvements (skip links, aria-labels)
- Improve touch targets and add lazy loading
- Fix settings accordion CSS animation on mobile
- Add widget system infrastructure
- Add widget implementations and main export
- Add widget settings storage with Firestore persistence
- Add 12-column widget grid CSS
- Add widget renderer module
- Integrate widget system into home page
- Add widget system tests (49 tests)
- Add widget settings UI and fix rating stars styling
- Fix widget grid equal heights and tablet sizing
- Add Welcome widget and My Library header button
- Add skeleton loaders to Profile and Cover Stats sections
- Auto-merge new widgets into existing user settings
- Show library icon button on mobile header
- Add CLS prevention for Lucide icons
- Fix rating validation to allow 0 (no rating)
- Add skeleton loaders to Add Book search results
- Fix leave site prompt after saving book edits
- Add checkmark badge to selected cover in book edit
- Improve genre suggestions with parsing and normalization
- Codebase audit: touch targets, tests, performance, CLS
- Fix widget See All link parameters
- Add series parser utility
- Add book series integration
- Add cover picker visual improvements
- Add series preview to add and edit book pages
- Add full series management system

---

## 2025-12-22

- Codebase audit: remove dead code, add caching, improve performance
- Fix duplicate lookupISBN declaration in add.js
- Add missing fields to add book page
- Replace Format text input with select dropdown
- Fix physical_format retrieval from Open Library API
- Fix physical_format for search results
- Fix cached ISBN lookups missing physicalFormat
- Refactor reading status to date-based inference with read history
- Fix reading date inputs to stack on mobile
- Add page count field and fix book edit issues
- Add multi-source cover picker and bulk cover fetch
- Add data enrichment and scalability documentation

---

## 2025-12-21

- Add API data supplementation and genre data cleanup utilities
- Disable save button until form has changes
- Add comprehensive tests for duplicate book detection
- Fix save button active on page load due to genre picker race condition
- Add rating reset toggle and reduce star size
- Add ISBN display to book edit page
- Add profile section with photo modal, password change, and account deletion
- Replace offcanvas menu logo with profile avatar
- Widen offcanvas menu and add md5 tests
- Add mobile accordion layout for settings page
- Fix accordion content visibility after resize to desktop
- Auto-hide cleanup success messages after 5 seconds
- Restyle mobile accordion to contain content within card
- Only one accordion open at a time with auto-scroll
- Remove gaps between accordion sections on mobile
- Account for sticky header when scrolling to accordion
- Fix inconsistent border on Profile accordion section
- Add favicon support with updated book-open icon
- Add normalization for book titles, authors, and publishers from APIs
- Add published date normalization to extract year only
- Add sticky sub-navigation and consistent label styling
- Add comprehensive test coverage and codebase audit fixes
- Fix normalization to also convert all lowercase to Title Case
- Add UX improvements and fix title normalization
- Disable auto-focus on mobile for modals
- Make sub-navigation sticky site-wide
- Add home page dashboard with reading status and carousel sections
- Fix mobile filters layout on books page
- Improve layout and navigation across pages
- Add backup/restore, UI improvements, and image fallbacks
- Add email verification with soft enforcement
- Audit fixes: consolidate ISBN lookup, remove dead code
- Simplify book detail sidebar layout

---

## 2025-12-20

- Initial commit: MyBookShelf PWA
- Fix barcode scanner error handling and HTTPS check
- Remove format filter, increase scan area, add feedback
- Add photo-based barcode scanning as iOS fallback
- Improve barcode scanner iOS compatibility
- Switch to Quagga2 barcode scanner for better iOS support
- Add barcode scan confidence checking and fix deprecation warning
- Simplify camera constraints for iOS Chrome compatibility
- Add explicit camera permission request before Quagga init
- Migrate to 11ty + Tailwind build system
- Add Tailwind v4 fix, password confirmation, and infinite scroll
- Refactor codebase with shared modules and common header
- Add comprehensive testing suite with Vitest
- Add CI/CD pipeline for test-before-deploy
- Add Open Library fallback for book search
- Add infinite scroll and clear button to book search
- Add comprehensive caching and fix search overlay scroll
- Implement Firebase usage optimizations
- Add consistent clear button to header search input
- Fix refresh button icon selector for Lucide SVG
- Fix refresh button spin not stopping
- Fix book list caching, date display, and sorting issues
- Lazy load books for search on demand
- Add tests for pagination, cache loading, and search functionality
- Refactor: Extract shared utilities and optimize performance
- Add genre management system and settings page
- Add duplicate detection, offline support, and pull-to-refresh
- Update book edit page to two-column layout on desktop
- Fix toast disappearing prematurely
- Add refresh book data from APIs feature
- Display publisher, published date, and format on book edit page
- Update cover image display when refreshing book data
- Add editable publisher, published date, and format fields

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.12.0 | 2025-12-30 | Book View & Toast Polish |
| 0.11.0 | 2025-12-29 | Search UX & Form Tracking |
| 0.10.0 | 2025-12-28 | Image Gallery & Genres |
| 0.9.0 | 2025-12-27 | Wishlist Feature |
| 0.8.0 | 2025-12-26 | Filter Redesign & Bin |
| 0.7.0 | 2025-12-25 | Breadcrumb Navigation |
| 0.6.0 | 2025-12-24 | Series Badges & Sorting |
| 0.5.0 | 2025-12-23 | Widgets & Components |
| 0.4.0 | 2025-12-22 | Cover Picker & Read History |
| 0.3.0 | 2025-12-21 | Home Dashboard & Settings |
| 0.2.0 | 2025-12-20 | Build System & Testing |
| 0.1.0 | 2025-12-20 | Initial Release |
