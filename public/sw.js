// Service Worker: hält die App-Hülle vor, damit sie auch ohne Netz im Gym startet.
// Daten (/api) laufen nie über den Cache — dafür gibt es die Offline-Warteschlange in der App.
const CACHE = 'gymtracker-v1';
const HUELLE = ['/', '/manifest.json', '/icons/favicon.svg', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(HUELLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Seite selbst: zuerst Netz (immer aktuelle Version), offline aus dem Cache.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const kopie = res.clone();
      caches.open(CACHE).then(c => c.put('/', kopie));
      return res;
    }).catch(() => caches.match('/')));
    return;
  }

  // Icons, Schriften, Chart.js: aus dem Cache, im Hintergrund auffrischen.
  e.respondWith(caches.match(req).then(treffer => {
    const netz = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const kopie = res.clone(); caches.open(CACHE).then(c => c.put(req, kopie)); }
      return res;
    }).catch(() => treffer);
    return treffer || netz;
  }));
});
