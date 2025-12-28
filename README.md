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

## Tech Stack

- **Frontend**: HTML, Tailwind CSS v4, vanilla JavaScript (ES6 modules)
- **Build**: 11ty (Eleventy) + Tailwind CSS CLI
- **Database**: Firebase Firestore (with offline persistence)
- **Auth**: Firebase Authentication (email/password)
- **Barcode**: Quagga2 library
- **Book Data**: Google Books API + Open Library API fallback
- **Testing**: Vitest with jsdom (1842 tests)
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
# Build and serve with live reload
npm run start

# Or run separately:
npm run watch:11ty   # 11ty with --serve
npm run watch:css    # Tailwind with --watch
```

### Production Build

```bash
npm run build
```

This builds the site to `_site/`.

### Testing

```bash
# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Run with coverage
npm run test:coverage
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
├── settings.njk      # Settings page (/settings/)
├── js/
│   ├── index.js      # Home page logic
│   ├── login.js      # Login/register logic
│   ├── header.js     # Common header logic
│   ├── books/        # Book-related page logic
│   │   ├── index.js  # Book list
│   │   ├── add.js    # Add book form
│   │   ├── view.js   # View book
│   │   └── edit.js   # Edit book
│   ├── components/   # Reusable UI components
│   ├── genres.js     # Genre CRUD and utilities
│   └── settings.js   # Settings page logic
└── css/              # Tailwind CSS source
```

## Deployment

The site uses CI/CD with GitHub Actions and Netlify:

1. Push to main triggers GitHub Actions workflow
2. Tests run automatically (`npm test`)
3. If tests pass, build runs (`npm run build`)
4. Netlify deploys the `_site` directory

Build settings:
- Build command: `npm test && npm run build`
- Publish directory: `_site`
