const CACHE='earth-live-safe-area-v1-10';
const SHELL=['./','./index.html','./style.css','./app-version.js','./data-store.js','./app.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('earth-live-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==self.location.origin)return;if(!/\.(html|css|js)$/.test(u.pathname)&&!u.pathname.endsWith('/'))return;e.respondWith(fetch(r).then(response=>{if(response&&response.ok)caches.open(CACHE).then(c=>c.put(r,response.clone()));return response;}).catch(()=>caches.match(r).then(c=>c||caches.match('./index.html'))));});
