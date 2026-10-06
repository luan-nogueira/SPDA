// Service Worker simples: rede primeiro, cache como reserva (funciona offline em campo)
const CACHE = 'spda-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];
// Apenas fontes (CORS). Tiles de mapa e fotos ficam fora para não estourar a cota de armazenamento.
const CACHEABLE_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cacheableHost = CACHEABLE_HOSTS.some((h) => url.hostname.endsWith(h));
  if (!sameOrigin && !cacheableHost) return; // Firestore/Auth são tratados pelo próprio SDK

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === 'navigate') return caches.match('/index.html');
        return Response.error();
      })
  );
});
