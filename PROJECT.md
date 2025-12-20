# MyBookShelf - Project Documentation

## Overview
A mobile-friendly book tracking PWA with barcode scanning. Built with vanilla HTML/CSS/JS and Firebase.

## Tech Stack
- **Frontend**: HTML, CSS (Tailwind via CDN), vanilla JavaScript (ES6 modules)
- **Database**: Firebase Firestore
- **Auth**: Firebase Authentication (email/password)
- **Barcode**: html5-qrcode library
- **Book Data**: Google Books API + Open Library API
- **Hosting**: Netlify
- **PWA**: Service worker + web manifest

## Project Structure
```
MyBookShelf/
├── index.html          # Login/register page
├── books.html          # Book list (main view)
├── add.html            # Add new book
├── book.html           # Book detail/edit
├── css/
│   └── styles.css      # Custom styles
├── js/
│   ├── firebase-config.js  # Firebase init
│   ├── auth.js             # Authentication
│   ├── books.js            # Book CRUD + listing
│   ├── add.js              # Add book logic
│   ├── book-detail.js      # Detail/edit logic
│   └── api.js              # ISBN lookup
├── icons/              # PWA icons
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── netlify.toml        # Deployment config
└── PROJECT.md          # This file
```

## Firebase Configuration
- **Project**: book-tracker-b786e
- **Auth**: Email/password enabled
- **Firestore**: User-scoped book collections at `/users/{userId}/books`

## Development Progress

### Completed
- [x] Project setup
- [x] Firebase configuration
- [x] Login page (index.html)
- [ ] Authentication logic (auth.js)
- [ ] Books list page (books.html)
- [ ] Add book page (add.html)
- [ ] Book detail page (book.html)
- [ ] Barcode scanner integration
- [ ] PWA manifest and icons
- [ ] Service worker
- [ ] Netlify deployment

### In Progress
- Building core pages and functionality

## Future Development Ideas

### High Priority
- [ ] Search books in library
- [ ] Sort books (by title, author, date added, rating)
- [ ] Filter by genre
- [ ] Offline support (cached books)
- [ ] Pull-to-refresh on mobile

### Medium Priority
- [ ] Book notes/reviews
- [ ] Reading dates (start/finish)
- [ ] Custom cover image upload
- [ ] Export to CSV/JSON
- [ ] Import from Goodreads

### Nice to Have
- [ ] Reading statistics/charts
- [ ] Dark mode
- [ ] Social sharing
- [ ] Book recommendations
- [ ] Reading goals/challenges
- [ ] Multiple shelves/lists

## Deployment

### Netlify Setup
1. Connect GitHub repo to Netlify
2. Build command: (none - static files)
3. Publish directory: `/`
4. Add `_redirects` for SPA-style routing if needed

### Local Development
```bash
# Simple HTTP server
npx serve .
# or
python3 -m http.server 8000
```

## Testing Strategy

### Unit Testing
- **Vitest** or **Jest** for JavaScript unit tests
- Test API functions, data transformations, validation logic

### E2E Testing
- **Playwright** (recommended - free, fast, cross-browser)
- Test user flows: login, add book, scan barcode, edit, delete

### Manual Testing
- **Primary**: Chrome on iPhone (uses WebKit engine on iOS)
- Test PWA installation ("Add to Home Screen")
- Test barcode scanning with real books
- Test offline behavior

## Image Storage Options (for custom covers)

| Provider | Free Tier | Auth Required | Notes |
|----------|-----------|---------------|-------|
| **Cloudinary** | 25GB storage, 25GB bandwidth/mo | Yes | Best features, transforms |
| **ImgBB** | Unlimited | Optional | Simple, no transforms |
| **Imgur** | Unlimited | Optional | Good API, may compress |
| **Firebase Storage** | 5GB | Yes (already using) | Integrated with project |

**Recommendation**: Start with Cloudinary (already configured in old project) or use ImgBB for simplicity.

## API References
- [Firebase Auth](https://firebase.google.com/docs/auth/web/start)
- [Firebase Firestore](https://firebase.google.com/docs/firestore/quickstart)
- [Google Books API](https://developers.google.com/books/docs/v1/using)
- [Open Library API](https://openlibrary.org/dev/docs/api/books)
- [html5-qrcode](https://github.com/mebjas/html5-qrcode)

---
**Last Updated**: 2025-12-20
