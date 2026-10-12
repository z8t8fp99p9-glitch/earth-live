const CACHE_NAME = 'earth-live-shell-v5c-safe-skin-fallback';
const SHELL = ['./','./index.html','./app.js','./manifest.webmanifest','./icons/icon.svg'];
self.addEventListener('install', event => {
  // Do not make install depend on the optional generated texture being present.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(cache => cache.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html'))));
});
