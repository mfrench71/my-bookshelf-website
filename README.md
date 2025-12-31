# MyBookShelf

A mobile-friendly book tracking PWA with barcode scanning.

## Features

- **Home Dashboard** with configurable sections:
  - Currently Reading, Recently Added, Top Rated, Recently Finished
  - Book recommendations based on your highly-rated authors
  - Configurable via Settings > Content (visibility + item count)
- **Reading Status** tracking (Want to Read, Reading, Finished)
  - Auto-tracks start and finish dates
  - Status badges on book cards
  - Filter books by status
- Scan ISBN barcodes to add books (Quagga2)
- Search books by title/author (Google Books + Open Library fallback)
- Infinite scroll for search results
- Track your personal book library
- Rate and add notes to books
- Sort and filter your collection (by date, title, author, rating, genre, status)
- Automatic title/author normalization from API data
- Genre management with color-coded badges and API suggestions
- Settings page for managing genres, content preferences, and exporting data
- Export your library as JSON backup
- Duplicate detection when adding books (by ISBN or title/author)
- Pull-to-refresh on mobile devices
- Works offline with cached books and offline indicator
- Firestore offline persistence for reduced API calls
- **Wishlist** for books you want to read/buy
- **Series tracking** with reading order
- Soft delete with 30-day bin recovery
- Accessibility tested (WCAG 2.1 AA compliant)

## Tech Stack

- **Frontend**: HTML, Tailwind CSS v4, TypeScript (ES modules)
- **Build**: 11ty (Eleventy) + esbuild + Tailwind CSS CLI
- **Database**: Firebase Firestore (with offline persistence)
- **Auth**: Firebase Authentication (email/password)
- **Barcode**: Quagga2 library
- **Book Data**: Google Books API + Open Library API fallback
- **Testing**: Vitest with jsdom (2,438 tests), Playwright E2E
- **CI/CD**: GitHub Actions + Netlify
- **Hosting**: Netlify

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
# Watch all files (JS, CSS, templates) with live reload
npm run dev

# Or use start (JS/CSS built once, only templates watched)
npm run start
```

### Production Build

```bash
npm run build
```

This builds the site to `_site/`.

### Testing

```bash
# Run unit tests
npm test

# Watch mode for development
npm run test:watch

# Run with coverage
npm run test:coverage

# Run E2E accessibility tests
npm run test:e2e
```

## Project Structure

```
src/
├── _layouts/         # Base HTML templates
├── _includes/        # Reusable partials (header)
├── index.njk         # Home page (/)
├── login.njk         # Login/register (/login/)
├── books/            # Book-related pages
│   ├── index.njk     # Book list (/books/)
│   ├── add.njk       # Add book (/books/add/)
│   ├── view.njk      # View book (/books/view/?id=X)
│   └── edit.njk      # Edit book (/books/edit/?id=X)
├── wishlist/         # Wishlist pages
│   └── index.njk     # Wishlist (/wishlist/)
├── settings/         # Settings pages
│   ├── index.njk     # Profile settings (/settings/)
│   ├── library.njk   # Genres & Series (/settings/library/)
│   ├── preferences.njk # Content preferences (/settings/preferences/)
│   ├── maintenance.njk # Export/Import (/settings/maintenance/)
│   ├── bin.njk       # Deleted books (/settings/bin/)
│   └── about.njk     # About page (/settings/about/)
├── js/
│   ├── index.ts      # Home page logic
│   ├── login.ts      # Login/register logic
│   ├── header.ts     # Common header logic
│   ├── books/        # Book-related page logic
│   ├── wishlist/     # Wishlist page logic
│   ├── settings/     # Settings page logic
│   ├── components/   # Reusable UI components (TypeScript)
│   ├── repositories/ # Data access layer (TypeScript)
│   ├── utils/        # Utility modules (TypeScript)
│   ├── widgets/      # Home dashboard widgets
│   └── schemas/      # Zod validation schemas
└── css/              # Tailwind CSS source
```

## Documentation

Detailed documentation is in the `docs/` folder:

- **[PROJECT.md](docs/PROJECT.md)** - Architecture, features, and roadmap
- **[CLAUDE.md](docs/CLAUDE.md)** - AI assistant coding guidelines
- **[AUDITS.md](docs/AUDITS.md)** - Periodic audit checklists (security, accessibility, performance)
- **[docs/adr/](docs/adr/)** - Architecture Decision Records

## Deployment

The site uses CI/CD with GitHub Actions and Netlify:

1. Push to main triggers GitHub Actions workflow
2. Tests run automatically (`npm test`)
3. If tests pass, build runs (`npm run build`)
4. Netlify deploys the `_site` directory

Build settings:
- Build command: `npm test && npm run build`
- Publish directory: `_site`
