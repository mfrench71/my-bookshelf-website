# MyBookShelf

A mobile-friendly book tracking PWA with barcode scanning.

## Features

- Scan ISBN barcodes to add books (Quagga2)
- Search books by title/author (Google Books + Open Library fallback)
- Infinite scroll for search results
- Track your personal book library
- Rate and add notes to books
- Sort and filter your collection
- Export your library as JSON
- Works offline (PWA with comprehensive caching)
- Firestore offline persistence for reduced API calls

## Tech Stack

- **Frontend**: HTML, Tailwind CSS v4, vanilla JavaScript (ES6 modules)
- **Build**: 11ty (Eleventy) + Tailwind CSS CLI
- **Database**: Firebase Firestore (with offline persistence)
- **Auth**: Firebase Authentication (email/password)
- **Barcode**: Quagga2 library
- **Book Data**: Google Books API + Open Library API fallback
- **Testing**: Vitest with jsdom (106 tests)
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
├── js/               # JavaScript modules
│   ├── utils.js      # Shared utilities
│   ├── book-card.js  # Book card component
│   ├── header.js     # Common header logic
│   └── ...           # Page-specific scripts
├── css/              # Tailwind CSS source
└── *.njk             # Page templates
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
