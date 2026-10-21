const CACHE_NAME = 'caces-medprep-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './js/app.js',
  './js/exam-engine.js',
  './js/ai-tutor.js',
  './js/storage.js',
  './js/analytics.js',
  './js/calculators.js',
  './js/flashcards.js',
  './js/games.js',
  './js/pdf-importer.js',
  './js/supabase-config.js',
  './data/banco_inicial.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        console.warn('Pre-cache parcial advertencia:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Solo interceptar peticiones GET
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cachedResp) => {
      // Si está en caché, devolverlo y actualizar en segundo plano (stale-while-revalidate)
      const fetchPromise = fetch(req).then((networkResp) => {
        if (networkResp && networkResp.status === 200) {
          const respClone = networkResp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, respClone));
        }
        return networkResp;
      }).catch(() => {
        // En modo offline, el fetch fallará y se usará la copia en caché
      });

      return cachedResp || fetchPromise;
    })
  );
});
