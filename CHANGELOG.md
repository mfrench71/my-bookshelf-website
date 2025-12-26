# Changelog

All notable changes to MyBookShelf are documented here.

---

## 2025-12-26

- Convert modals to bottom sheets on mobile (slide up, swipe to dismiss)
- Fix double carets on book list filter selects
- Fix iOS Chrome issues with menu and search overlays
- Make header menu responsive (bottom sheet on mobile, slide-out on desktop)
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
| 0.7.0 | 2025-12-25 | Breadcrumb Navigation & Polish |
| 0.6.0 | 2025-12-23 | Widget Dashboard & Series |
| 0.5.0 | 2025-12-23 | Polish & Testing |
| 0.4.0 | 2025-12-23 | Component Refactoring |
| 0.3.0 | 2025-12-22 | Cover Picker & Read History |
| 0.2.0 | 2025-12-21 | Home Dashboard & Settings |
| 0.1.0 | 2025-12-20 | Initial Release |
