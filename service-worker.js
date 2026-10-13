const CACHE = 'earth-live-main-shell-v27-live-location-polish';
const SHELL = ['./', './index.html', './style.css', './data-store.js', './app.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('earth-live-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!/\.(html|css|js)$/.test(url.pathname) && !url.pathname.endsWith('/')) return;
  event.respondWith(fetch(req).then(response => {
    if (response && response.ok) caches.open(CACHE).then(cache => cache.put(req, response.clone()));
    return response;
  }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html'))));
});
