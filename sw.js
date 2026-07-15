const VERSION = 'v12';
const CACHE = `sudodoku-${VERSION}`;
const CORE = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './src/app.js', './src/sudoku.js', './src/techniques.js', './src/academy.js', './src/backup.js', './src/i18n.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => event.request.mode === 'navigate' ? caches.match('./index.html') : cached))
  );
});

self.addEventListener('message', (event) => {
  const respond = (payload) => event.ports[0]?.postMessage(payload);
  if (event.data?.type === 'GET_VERSION') respond({ version: VERSION, cache: CACHE });
  if (event.data?.type === 'SKIP_WAITING') {
    respond({ ok: true });
    event.waitUntil(self.skipWaiting());
  }
  if (event.data?.type === 'REFRESH_CACHE') {
    event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => respond({ ok: true })).catch(() => respond({ ok: false })));
  }
});
