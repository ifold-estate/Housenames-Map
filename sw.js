// Ifold Tube Map – offline support.
// Pages and data.csv: try the network first (so updates show up straight away),
// but give up after a few seconds and use the saved copy, so it still works with weak or no signal.
// Fonts and icons: use the saved copy.
const CACHE = 'ifold-tube-map-v2';
const CORE = [
  './',
  './index.html',
  './data.csv',
  './manifest.webmanifest',
  './fonts/hammersmith-one-latin-400-normal.woff2',
  './fonts/hammersmith-one-latin-ext-400-normal.woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(CORE.map(url => cache.add(new Request(url, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    fetch(request).then(response => {
      clearTimeout(timer);
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request.mode === 'navigate' ? './index.html' : request, copy));
      }
      resolve(response);
    }, err => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const path = new URL(req.url).pathname;
  const fresh = req.mode === 'navigate' || path.endsWith('/') || path.endsWith('.html') || path.endsWith('data.csv') || path.endsWith('data.js');

  if (fresh) {
    event.respondWith(
      fromNetwork(req, 4000).catch(() =>
        caches.match(req, { ignoreSearch: true })
          .then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : null))
          .then(hit => hit || fetch(req))
      )
    );
  } else {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(response => {
        if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return response;
      }))
    );
  }
});
