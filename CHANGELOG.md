# Changelog

All notable changes to MyBookShelf are documented here.

## [Unreleased]

### Genre Suggestions Improvements
- **Hierarchical Parsing**: Genre categories like "Fiction / Science Fiction / Space Opera" now split into individual genres
- **All Open Library Subjects**: Removed 5-subject limit, now includes all available subjects
- **API Merging**: Genres from both Google Books and Open Library now combined (deduplicated)
- **Variation Normalization**: Maps abbreviations and synonyms (e.g., "Sci-Fi" → "Science Fiction", "YA" → "Young Adult")
- **Documentation**: Added Data Enrichment Sources section to PROJECT.md

---

## 2025-12-23 (Evening)

### Series System Fixes
- **Book Detail Page**: Fixed series display to use `seriesId` lookup instead of legacy `seriesName`
- **Series Widget Links**: Fixed to use series ID for reliable filtering (was using name, causing no results)
- **Firestore Rules**: Added series subcollection rules

### Documentation
- **Colour Scheme**: Documented semantic colour usage for buttons, badges, and icons
- **Cover Image Sources**: Documented Google Books and Open Library cover sizes
- **API Limitations**: Documented series search limitations and workarounds
- **Series Features**: Documented current capabilities and future enhancements

---

## 2025-12-23

### Sprint 4: Widget Dashboard ✅
- **Widget System**: Extensible registry pattern with base widget class
- **5 Widgets**: Welcome, Currently Reading, Recently Added, Top Rated, Recently Finished
- **12-Column Grid**: Responsive layout with 4 size options (quarter, half, three-quarter, full)
- **Settings Configuration**: Reorder, toggle visibility, and resize widgets
- **Firestore Sync**: Widget settings persist across devices
- **Auto-Merge**: New widgets automatically added to existing user settings
- **CLS Prevention**: Fixed icon layout shift with CSS
- **Bug Fixes**: Rating validation (0 allowed), form dirty state after save

### Sprint 5: Polish & Testing
- **E2E Testing**: Added Playwright tests (34 tests covering navigation, auth, accessibility)
- **Animations**: Page transitions, modal animations, skeleton shimmer, toast animations
- **Skeleton Loaders**: Loading states for all pages (books list, book detail, settings)
- **Empty States**: Improved designs with icons for search results and lists
- **SEO**: Open Graph tags, Twitter Cards, canonical URLs, sitemap.xml, robots.txt
- **Accessibility**: Skip links, aria-labels, touch target improvements (44px minimum)
- **Performance**: Documented bundle sizes and optimisation opportunities

### Sprint 3: Component Refactoring (continued)
- **RESTful URLs**: Restructured to `/books/`, `/books/add/`, `/books/view/`, `/books/edit/`
- **View/Edit Split**: Separated book detail into read-only View and form-based Edit pages
- **Components**: Created reusable CoverPicker, Modal, ConfirmModal, RatingInput components
- **Directory Structure**: Moved JS to `src/js/books/` and `src/js/components/`

### Sprint 2: Form Validation
- **Zod Validation**: Added validation schemas for Book, Auth, and Genre forms
- **Validation Helpers**: Created `validateForm`, `showFieldError`, `clearFieldError` utilities

### Other Changes
- Replaced CDN dependencies with local npm packages (Lucide, Quagga)
- Added design tokens and split utils into focused modules
- Improved cover fetch UX with detailed update list
- Added UI/UX principles to CLAUDE.md

---

## 2025-12-22

### Features
- **Multi-source Cover Picker**: Select cover from Google Books or Open Library
- **Bulk Cover Fetch**: Update all book covers from Settings
- **Page Count Field**: Retrieved from Google Books / Open Library APIs
- **Format Dropdown**: Replaced text input with select (Paperback, Hardcover, etc.)

### Reading Status
- **Date-based Status**: Reading status inferred from start/finish dates
- **Read History**: Full history of re-reads with start/finish dates
- **Re-read Tracking**: "Start Re-read" button to begin a new read

### Bug Fixes
- Fixed reading date inputs stacking on mobile
- Fixed cached ISBN lookups missing physicalFormat
- Fixed physical_format retrieval from Open Library API
- Fixed duplicate lookupISBN declaration

### Code Quality
- Codebase audit: removed dead code, improved caching, performance fixes
- Consolidated ISBN lookup utility
- Added missing fields to add book page

---

## 2025-12-21

### Features
- **Home Dashboard**: Carousel sections for Currently Reading, Recently Added, Top Rated, Recently Finished
- **Content Settings**: Configure home page section visibility and item counts
- **Email Verification**: Soft enforcement with banner on home page
- **Backup & Restore**: Full JSON backup with genres, cross-account restore with duplicate detection
- **Profile Section**: Avatar upload, password change, account deletion
- **Sticky Sub-navigation**: Consistent across all pages

### UX Improvements
- **Mobile Accordion**: Collapsible settings sections on mobile
- **Smart Back Button**: History-aware navigation
- **Cover Fallbacks**: Placeholder shown for broken image URLs
- **Password Confirmation**: Added to signup form
- **Title Normalisation**: Proper case conversion for API data

### Bug Fixes
- Fixed mobile filters layout on books page
- Fixed accordion content visibility after resize
- Fixed auto-hide for cleanup success messages
- Fixed border inconsistencies on Profile accordion

### Code Quality
- Comprehensive test coverage added (601+ tests)
- Added sticky sub-navigation site-wide
- Disabled auto-focus on mobile for modals
- Added favicon with book-open icon

---

## Earlier Development

### Core Features (Initial Release)
- Firebase Authentication (email/password)
- Firestore database with offline persistence
- Book list with sort (title, author, date, rating) and filter (genre, status)
- Add book via ISBN barcode scanning (Quagga2)
- Add book via search (Google Books + Open Library)
- Book detail view and editing
- Genre management with colour-coded badges
- PWA with service worker (offline support)
- Infinite scroll for search results
- Duplicate book detection

### Settings
- Profile management
- Genre CRUD operations
- Export to JSON backup
- Data cleanup utilities (genre migration, cover refresh)

---

## Version History

| Version | Date | Milestone |
|---------|------|-----------|
| 0.6.0 | 2025-12-23 | Sprint 4 - Widget Dashboard |
| 0.5.0 | 2025-12-23 | Sprint 5 - Polish & Testing |
| 0.4.0 | 2025-12-23 | Sprint 3 - Component Refactoring |
| 0.3.0 | 2025-12-22 | Cover Picker & Read History |
| 0.2.0 | 2025-12-21 | Home Dashboard & Settings |
| 0.1.0 | 2025-12-20 | Initial Release |
