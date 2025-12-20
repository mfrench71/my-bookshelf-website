# MyBookShelf

A mobile-friendly book tracking PWA with barcode scanning.

## Features

- Scan ISBN barcodes to add books
- Search books by title or author via Google Books API
- Track your personal book library
- Rate and add notes to books
- Sort and filter your collection
- Export your library as JSON
- Works offline (PWA)

## Tech Stack

- **Frontend**: HTML, Tailwind CSS v4, vanilla JavaScript (ES6 modules)
- **Build**: 11ty (Eleventy) + Tailwind CSS CLI
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (email/password)
- **Barcode**: Quagga2 library
- **Book Data**: Google Books API + Open Library API fallback
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

The site is configured for Netlify deployment. Push to main to deploy automatically.

Build settings:
- Build command: `npm run build`
- Publish directory: `_site`
