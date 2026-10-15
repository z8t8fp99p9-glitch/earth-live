const CACHE_NAME = "earth-live-esri-zoom-limit-only-v1-2-0";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./app-version.js", "./manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .catch(error => console.warn("EARTH LIVE shell cache skipped:", error))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith("earth-live-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (!(/\.(html|css|js|webmanifest|svg|webp|jpg|png)$/.test(url.pathname) || url.pathname.endsWith("/"))) return;
  event.respondWith(
    fetch(request, { cache: "no-cache" }).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
  );
});
