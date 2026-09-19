/* MAAR QR — offline service worker.
   Plain static site (no build step / hashed filenames), so this is a
   hand-written precache list rather than a generated one. Everything
   is served stale-while-revalidate: a cached copy answers instantly
   (and works with no connection at all), while a background fetch
   quietly refreshes the cache whenever there *is* a connection — so a
   future edit to an existing file (or a brand-new file that gets
   fetched at least once online) becomes the new offline copy on its
   own, without needing this list or a version number bumped by hand
   for every change. Bump CACHE only if you want to force everyone's
   old cache to be dropped immediately (a broken cached file, etc). */
const CACHE = 'maar-qr-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './privacy.html',
  './css/styles.css',
  './js/app.js',
  './js/button-shine.js',
  './js/floating-lines.js',
  './js/qr-engine.js',
  './js/vendor/qrcode.min.js',
  './js/vendor/jspdf.umd.min.js',
  './site.webmanifest',
  './icons/favicon.svg',
  './icons/favicon-16.png',
  './icons/favicon-32.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isFont(url) {
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response('Offline', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Own site (any file, present now or added later) + the Google Fonts
  // this page loads: cache-and-refresh, so the tool works offline.
  if (url.origin === self.location.origin || isFont(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
  // Everything else (the jsdelivr CDN fallback for the QR/PDF libraries,
  // which normally never fires since they're bundled locally) is left
  // to pass straight through to the network as usual.
});
