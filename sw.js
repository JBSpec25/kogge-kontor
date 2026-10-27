// Offline-Cache für Kogge & Kontor. Version wechselt mit jedem neuen Stand des Codes.
// Hauptseite und Beta (/beta/) haben getrennte Caches und lassen sich gegenseitig in Ruhe.
const CACHE = 'kogge-f3fa9d53cb';
const OWN = k => k.startsWith('kogge-') && !k.startsWith('kogge-beta-');
const CORE = ['./', 'index.html', 'en.html', 'es.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => OWN(k) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const path = new URL(r.url).pathname;
  if (path.includes('/beta/')) return;   // die Beta hat ihren eigenen Cache
  if (r.mode === 'navigate') { // neue Version bevorzugen, offline die gespeicherte
    const page = /\/(en|es)\.html$/.test(path) ? path.split('/').pop() : 'index.html';
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put(page, cp)); return res; }).catch(() => caches.match(page)));
    return;
  }
  e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => {
    if (res.ok && (r.url.startsWith(self.location.origin))) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => hit)));
});
