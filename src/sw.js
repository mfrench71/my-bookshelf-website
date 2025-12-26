// Service Worker for MyBookShelf PWA
const CACHE_VERSION = 'v11';
const STATIC_CACHE = `mybookshelf-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `mybookshelf-images-${CACHE_VERSION}`;
const API_CACHE = `mybookshelf-api-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/login/',
  '/books/',
  '/books/add/',
  '/books/view/',
  '/books/edit/',
  '/settings/',
  '/settings/library/',
  '/settings/preferences/',
  '/settings/maintenance/',
  '/settings/about/',
  '/css/styles.css',
  '/js/firebase-config.js',
  '/js/header.js',
  '/js/index.js',
  '/js/login.js',
  '/js/books/index.js',
  '/js/books/add.js',
  '/js/books/view.js',
  '/js/books/edit.js',
  '/js/settings/profile.js',
  '/js/settings/library.js',
  '/js/settings/preferences.js',
  '/js/settings/maintenance.js',
  '/js/settings/about.js',
  '/js/vendor/zod.js',
  '/manifest.json',
  '/vendor/lucide.min.js',
  '/vendor/quagga.min.js'
];

// Cache durations
const API_CACHE_DURATION = 15 * 60 * 1000; // 15 minutes for API responses
const IMAGE_CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days for images
const IMAGE_CACHE_MAX_ITEMS = 200; // Limit cached images

// Install - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, IMAGE_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !currentCaches.includes(name))
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch handler with different strategies per resource type
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Cover images - cache first, then network
  if (isCoverImage(url)) {
    event.respondWith(handleImageRequest(event.request));
    return;
  }

  // Book search APIs - network first with cache fallback and TTL
  if (isBookApi(url)) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Skip Firebase SDK requests (let Firestore handle its own caching)
  if (isFirebaseRequest(url)) {
    return;
  }

  // Static assets - network first, cache fallback
  if (url.origin === location.origin) {
    event.respondWith(handleStaticRequest(event.request));
  }
});

// Check if URL is a cover image
function isCoverImage(url) {
  return (
    url.hostname.includes('books.google.com') ||
    url.hostname.includes('covers.openlibrary.org')
  );
}

// Check if URL is a book API
function isBookApi(url) {
  return (
    (url.hostname.includes('googleapis.com') && url.pathname.includes('/books/')) ||
    (url.hostname.includes('openlibrary.org') && (url.pathname.includes('/search') || url.pathname.includes('/api/')))
  );
}

// Check if URL is Firebase-related
function isFirebaseRequest(url) {
  return (
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('gstatic.com')
  );
}

// Handle cover image requests - cache first strategy
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Return cached image immediately, refresh in background
    refreshImage(request, cache);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Clone and cache
      cache.put(request, response.clone());
      // Trim cache if too large
      trimImageCache(cache);
    }
    return response;
  } catch (error) {
    // Return placeholder or transparent pixel
    return new Response('', { status: 404 });
  }
}

// Background refresh for images
async function refreshImage(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response);
    }
  } catch (e) {
    // Ignore refresh errors
  }
}

// Limit image cache size
async function trimImageCache(cache) {
  const keys = await cache.keys();
  if (keys.length > IMAGE_CACHE_MAX_ITEMS) {
    // Delete oldest entries (first in list)
    const toDelete = keys.slice(0, keys.length - IMAGE_CACHE_MAX_ITEMS);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}

// Handle API requests - network first with TTL cache
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Store with timestamp
      const responseWithTime = response.clone();
      const headers = new Headers(responseWithTime.headers);
      headers.set('sw-cache-time', Date.now().toString());

      const body = await responseWithTime.blob();
      const cachedResponse = new Response(body, {
        status: responseWithTime.status,
        statusText: responseWithTime.statusText,
        headers
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch (error) {
    // Check cache with TTL
    const cached = await cache.match(request);
    if (cached) {
      const cacheTime = parseInt(cached.headers.get('sw-cache-time') || '0');
      const age = Date.now() - cacheTime;

      if (age < API_CACHE_DURATION) {
        return cached;
      }
    }
    throw error;
  }
}

// Handle static requests - network first, cache fallback
async function handleStaticRequest(request) {
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    // For navigation, return root page
    if (request.mode === 'navigate') {
      return caches.match('/');
    }
    return new Response('Offline', { status: 503 });
  }
}
