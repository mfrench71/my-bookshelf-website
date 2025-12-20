// Service Worker for MyBookShelf PWA
const CACHE_NAME = 'mybookshelf-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/books.html',
  '/add.html',
  '/book.html',
  '/css/styles.css',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/books.js',
  '/js/add.js',
  '/js/book-detail.js',
  '/manifest.json'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Firebase/external API requests
  const url = new URL(event.request.url);
  if (
    url.origin !== location.origin ||
    url.pathname.startsWith('/api') ||
    event.request.url.includes('firebase') ||
    event.request.url.includes('googleapis') ||
    event.request.url.includes('gstatic')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          // For navigation, return index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
