# Periodic Audit Checklists

Comprehensive checklists for periodic code quality and compliance reviews. Run these audits regularly (monthly or before major releases).

---

## Quick Commands

```bash
npm audit                    # Check for vulnerabilities
npm outdated                 # Check for outdated packages
npm run lint                 # ESLint check
npm run typecheck            # TypeScript check
npm run test:coverage        # Coverage report
npm run test:e2e             # E2E + accessibility tests
npx lighthouse http://localhost:8080 --view  # Performance audit
```

---

## Dependencies Audit

```bash
npm audit
npm outdated
```

- [ ] No high/critical vulnerabilities (`npm audit`)?
- [ ] Dependencies reasonably up to date (`npm outdated`)?
- [ ] No unused dependencies in package.json?
- [ ] Dependabot PRs reviewed and merged?

---

## PWA/Service Worker Audit

- [ ] Service worker registered successfully?
- [ ] Offline page works when network unavailable?
- [ ] Cache strategy appropriate? (network-first for API, cache-first for assets)
- [ ] manifest.json valid? (icons, theme colours, display mode)
- [ ] App installable on mobile?
- [ ] STATIC_ASSETS list in sw.js up to date with current routes?
- [ ] Cache version incremented after asset changes?

---

## Error Handling Audit

- [ ] All async operations have try/catch?
- [ ] User-friendly error messages shown (not raw `error.message`)?
- [ ] Errors logged to console for debugging?
- [ ] Network failures handled gracefully?
- [ ] Form submission errors don't lose user input?
- [ ] Firebase error codes mapped to friendly messages?

---

## SEO Audit

### Meta Tags & Open Graph
- [ ] Every page has unique `<title>` tag (50-60 chars)?
- [ ] Every page has `<meta name="description">` (150-160 chars)?
- [ ] Open Graph tags present? (`og:title`, `og:description`, `og:image`, `og:url`)
- [ ] Twitter Card meta tags present?
- [ ] Canonical URL set on all pages?
- [ ] Language attribute on `<html>` tag?

### Semantic HTML & Structure
- [ ] Single `<h1>` per page matching page purpose?
- [ ] Heading hierarchy correct? (h1 → h2 → h3, no skips)
- [ ] Semantic elements used? (`<main>`, `<nav>`, `<article>`, `<section>`)
- [ ] Images have descriptive `alt` text?
- [ ] Links have descriptive text (not "click here")?

### Technical SEO
- [ ] sitemap.xml exists and lists all public pages?
- [ ] robots.txt exists and allows crawling of public pages?
- [ ] No broken internal links (404s)?
- [ ] Page load time acceptable? (< 3 seconds)
- [ ] Mobile-friendly? (responsive, readable text, tap targets)

### Content & URLs
- [ ] URLs are clean and descriptive? (no query strings for content pages)
- [ ] No duplicate content across pages?
- [ ] Important content visible without JavaScript? (for crawlers)

### Crawlability
- [ ] Auth-required pages excluded from sitemap?
- [ ] Login/register pages have `noindex` if not needed in search?
- [ ] Internal linking between related pages?

---

## Mobile UX Audit

### Touch Targets
- [ ] All interactive elements (buttons, links, inputs) minimum 44x44px?
- [ ] Icon-only buttons use `min-w-[44px] min-h-[44px]` with centered content?
- [ ] Small buttons inside badges/chips have `p-1` padding minimum?
- [ ] Adequate spacing between adjacent touch targets (8px+ gap)?

### Viewport & Safe Areas
- [ ] Viewport meta includes `viewport-fit=cover` for notch handling?
- [ ] Fixed elements (FAB, toast) use `env(safe-area-inset-*)` padding?
- [ ] Bottom sheets account for home indicator on iOS?

### Scrolling & Overflow
- [ ] No horizontal scroll on any page?
- [ ] Long text uses `break-words` or `truncate` where appropriate?
- [ ] Images constrained with `max-w-full`?
- [ ] Modals/sheets scrollable if content overflows (`max-h-[90vh] overflow-y-auto`)?
- [ ] No nested scroll conflicts (inner scroll blocks outer gesture)?

### Forms & Input
- [ ] Input font size 16px+ to prevent iOS zoom on focus?
- [ ] Appropriate `inputmode` for keyboard type (`numeric`, `email`, `tel`)?
- [ ] `autocomplete` attributes for autofill support?
- [ ] Submit buttons accessible when keyboard is open?
- [ ] Form errors visible without scrolling?

### Gestures & Feedback
- [ ] Touch feedback on interactive elements (`active:` states)?
- [ ] Swipe gestures work correctly (bottom sheets, carousels)?
- [ ] No 300ms tap delay (`touch-action: manipulation`)?
- [ ] Pull-to-refresh works where expected (book list)?
- [ ] Tap highlight disabled (`-webkit-tap-highlight-color: transparent`)?

### Performance
- [ ] No layout shift during loading (skeleton loaders match final size)?
- [ ] Images lazy loaded with `loading="lazy"`?
- [ ] Heavy operations don't block UI (use async/debounce)?

---

## Form Validation Audit

- [ ] All forms use Zod schemas (no manual `if (!value)` checks)?
- [ ] Input `name` attributes match schema field names exactly?
- [ ] Required fields marked with asterisk (`<span class="text-red-500">*</span>`)?
- [ ] Validation errors shown inline near field (not toast-only)?
- [ ] Error messages are helpful (not just "Invalid")?
- [ ] Form state preserved on validation failure?
- [ ] Submit button disabled during submission?
- [ ] Modal forms clear errors when opening (`clearFormErrors()`)?
- [ ] Form switching clears errors AND resets form?
- [ ] Dynamic UI (password strength, etc.) reset when switching forms?
- [ ] Success feedback shown after submission?
- [ ] Scroll to first invalid field on validation failure (`scrollToFirstError()`)?
- [ ] Inputs have `scroll-margin-top` to account for sticky headers?

---

## Memory/Cleanup Audit

- [ ] Event listeners removed when component unmounts?
- [ ] Intervals/timeouts cleared on cleanup?
- [ ] No listeners on removed DOM elements?
- [ ] Large data structures cleared when no longer needed?
- [ ] Components have `destroy()` methods where needed?
- [ ] `beforeunload` listeners cleaned up properly?

---

## Bundle Size Audit

```bash
ls -la _site/js/*.js | awk '{print $5, $9}' | sort -n
```

- [ ] No duplicate dependencies?
- [ ] Large libraries tree-shaken or lazy loaded?
- [ ] Images optimised and appropriately sized?
- [ ] Vendor files minified?
- [ ] No unused code in bundles?

### Current Targets
| Asset | Target | Check |
|-------|--------|-------|
| Custom JS (bundled) | <300KB | [ ] |
| Vendor JS (Zod, etc.) | <300KB | [ ] |
| Tailwind CSS | <60KB | [ ] |
| Lucide Icons | <20KB | [ ] |

---

## Core Web Vitals Audit

Test with Lighthouse or PageSpeed Insights.

### LCP (Largest Contentful Paint) - Target: < 2.5s
- [ ] Hero images optimised and served in modern formats (WebP/AVIF)?
- [ ] Critical CSS inlined or loaded early?
- [ ] Web fonts preloaded with `<link rel="preload">`?
- [ ] Server response time (TTFB) acceptable?
- [ ] Largest element (usually hero image or heading) loads quickly?
- [ ] No render-blocking resources in `<head>`?

### CLS (Cumulative Layout Shift) - Target: < 0.1
- [ ] Images have explicit `width`/`height` or aspect-ratio?
- [ ] Fonts use `font-display: swap` with fallback sizing?
- [ ] Dynamic content has reserved space (skeleton loaders)?
- [ ] Ads/embeds have reserved dimensions?
- [ ] Icons have explicit dimensions before Lucide loads?
- [ ] No content inserted above existing content after load?

### INP (Interaction to Next Paint) - Target: < 200ms
- [ ] Event handlers complete quickly (< 50ms)?
- [ ] Long tasks broken up with `requestAnimationFrame` or `setTimeout`?
- [ ] Heavy computations moved to Web Workers?
- [ ] Input handlers debounced/throttled appropriately?
- [ ] No synchronous operations blocking main thread?
- [ ] DOM updates batched to minimise reflows?

### Other Performance Metrics
- [ ] FCP (First Contentful Paint) < 1.8s?
- [ ] TTI (Time to Interactive) acceptable?
- [ ] Total Blocking Time < 200ms?
- [ ] JavaScript execution time reasonable?

---

## Scalability Audit

- [ ] Firestore queries use proper indexes?
- [ ] Pagination implemented for large collections? (don't load all at once)
- [ ] Caching reduces repeated reads? (localStorage, in-memory)
- [ ] Batch writes used where possible? (`writeBatch` for multiple docs)
- [ ] No N+1 query patterns? (fetching related data in loops)
- [ ] Images use appropriate sizes? (thumbnails vs full-size)
- [ ] Search uses efficient indexing? (pre-normalised fields)
- [ ] Large lists virtualised? (only render visible items)
- [ ] API calls debounced/throttled where appropriate?
- [ ] Real-time listeners minimised? (prefer on-demand fetching)

---

## Privacy/GDPR Audit

### Data Collection & Consent
- [ ] Privacy policy exists and is up to date (`/privacy/`)?
- [ ] Privacy policy accurately describes all data collected?
- [ ] No data collected beyond what's necessary for functionality?
- [ ] Third-party services disclosed? (Firebase, book APIs)
- [ ] Analytics/tracking disclosed if present?

### User Rights (GDPR Article 15-22)
- [ ] Users can view their data? (profile, book list)
- [ ] Users can export their data? (Export My Data feature)
- [ ] Users can delete their account and all data?
- [ ] Data deletion is complete? (Firestore subcollections, bin, wishlist)
- [ ] No data retained after deletion request?

### Data Security
- [ ] Sensitive data encrypted in transit? (HTTPS)
- [ ] No sensitive data in localStorage? (tokens, passwords)
- [ ] Firestore rules restrict access to own data only?
- [ ] No PII logged to console in production?
- [ ] Session tokens expire appropriately?

### Data Minimisation
- [ ] Only necessary fields stored?
- [ ] No tracking cookies without consent?
- [ ] Book cover URLs fetched on-demand (not stored if unnecessary)?
- [ ] Deleted items purged after retention period? (30-day bin)

### Third-Party Data Sharing
- [ ] No user data shared with third parties without consent?
- [ ] API requests don't leak user identity? (book lookups are anonymous)
- [ ] Firebase Analytics configured appropriately (or disabled)?

---

## Browser Compatibility Audit

### Core Functionality
- [ ] Works in Chrome (latest 2 versions)?
- [ ] Works in Safari (latest 2 versions)?
- [ ] Works in Firefox (latest 2 versions)?
- [ ] Works in Edge (latest 2 versions)?
- [ ] Works in Safari iOS?
- [ ] Works in Chrome Android?

### PWA Features
- [ ] Service worker registers in all browsers?
- [ ] App installable on iOS Safari? (Add to Home Screen)
- [ ] App installable on Android Chrome?
- [ ] Offline mode works across browsers?

### iOS Safari Quirks
- [ ] No 300ms tap delay? (`touch-action: manipulation`)
- [ ] Viewport height correct? (100vh issues with address bar)
- [ ] Input zoom prevented? (font-size >= 16px)
- [ ] Safe area insets handled? (`env(safe-area-inset-*)`)
- [ ] Momentum scrolling works? (`-webkit-overflow-scrolling: touch`)
- [ ] Date inputs work correctly?

### CSS Compatibility
- [ ] Flexbox/Grid works in all browsers?
- [ ] CSS custom properties (variables) supported?
- [ ] Backdrop blur has fallback? (`backdrop-filter`)
- [ ] No `-webkit-` prefixes missing where needed?

### JavaScript Compatibility
- [ ] No ES2022+ features without transpilation?
- [ ] Optional chaining (`?.`) supported in target browsers?
- [ ] Nullish coalescing (`??`) supported?
- [ ] `fetch` API available? (or polyfilled)
- [ ] `IntersectionObserver` available for lazy loading?

---

## Accessibility Audit

Run automated and manual accessibility checks.

### Automated Testing
```bash
npm run test:e2e  # Includes axe-core accessibility tests
```
- [ ] All axe-core tests pass?
- [ ] No critical or serious violations?

### Keyboard Navigation
- [ ] All interactive elements focusable with Tab?
- [ ] Focus order is logical (left-to-right, top-to-bottom)?
- [ ] Focus indicator visible on all focusable elements?
- [ ] No keyboard traps (can always escape)?
- [ ] Modal focus trapped within modal?
- [ ] Focus returns to trigger after modal closes?

### Screen Readers
- [ ] Page structure announced correctly? (landmarks, headings)
- [ ] Images have appropriate alt text?
- [ ] Form inputs have associated labels?
- [ ] Error messages announced to screen readers?
- [ ] Dynamic content updates announced? (`aria-live`)
- [ ] Decorative elements hidden? (`aria-hidden="true"`)

### Visual
- [ ] Colour contrast meets WCAG AA (4.5:1 text, 3:1 large text)?
- [ ] Information not conveyed by colour alone?
- [ ] Text resizable to 200% without loss of content?
- [ ] Animations respect `prefers-reduced-motion`?

### Forms
- [ ] Labels associated with inputs? (`for` attribute or `aria-labelledby`)
- [ ] Required fields indicated? (not just by colour)
- [ ] Error messages linked to inputs? (`aria-describedby`)
- [ ] Autocomplete attributes present?

### Landmarks & Structure
- [ ] Skip link present and works? (`#main-content`)
- [ ] Single `<main>` element per page?
- [ ] Proper heading hierarchy? (h1 → h2 → h3)
- [ ] Landmarks used appropriately? (`<nav>`, `<aside>`, `<footer>`)

---

## Security Audit

### XSS Prevention
- [ ] All user input escaped before rendering? (`escapeHtml()`, `escapeAttr()`)
- [ ] No `innerHTML` with unsanitised user data?
- [ ] Template literals don't include raw user input?
- [ ] URL parameters validated before use?

### Input Validation
- [ ] All forms use Zod schemas?
- [ ] Server-side validation via Firestore rules?
- [ ] File uploads validated (type, size)?
- [ ] No SQL/NoSQL injection vectors?

### Authentication & Authorisation
- [ ] Firestore rules restrict access to own data only?
- [ ] No sensitive data in localStorage?
- [ ] Session handling secure?
- [ ] Password requirements enforced (8+ chars)?

### API Security
- [ ] API keys not exposed in client code? (Firebase config is OK)
- [ ] External API calls validated?
- [ ] No arbitrary URL fetching from user input?
- [ ] Rate limiting considered for expensive operations?

### Quick Security Check
```bash
# Check innerHTML usage vs escapeHtml usage
grep -rn "innerHTML\s*=" src/js --include="*.ts" | wc -l
grep -rn "escapeHtml\|escapeAttr" src/js --include="*.ts" | wc -l
```

---

## Test Coverage Audit

### Coverage Thresholds
- [ ] Lines: ≥60%
- [ ] Functions: ≥60%
- [ ] Branches: ≥50%
- [ ] Statements: ≥60%

```bash
npm run test:coverage
```

### Coverage Gaps
- [ ] New features have corresponding tests?
- [ ] Edge cases covered (empty states, errors, boundaries)?
- [ ] Integration points tested (API calls, Firebase)?
- [ ] UI components have render tests?
- [ ] E2E tests cover critical user flows?

### Test Health
- [ ] All tests passing?
- [ ] No flaky tests?
- [ ] Tests run in reasonable time (<2 minutes)?
- [ ] Mocks properly isolated between tests?

---

## Audit Schedule

| Audit | Frequency | Last Run |
|-------|-----------|----------|
| Dependencies | Weekly | |
| Security | Weekly | |
| Accessibility | Monthly | |
| Performance | Monthly | |
| Mobile UX | Monthly | |
| SEO | Quarterly | |
| Privacy/GDPR | Quarterly | |
| Browser Compatibility | Before major release | |

---

*Last updated: 2025-12-31*
