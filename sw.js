// Service Worker para Fichas EPI - Capacidad Offline y PWA
const CACHE_NAME = 'fichas-epi-cache-v16';

const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './catalogos.json',
  './formato_epi.pdf',
  './formato_epi_resto.pdf',
  './formato_tb.pdf',
  './plantillas_sppat/acta_y_autorizacion.pdf',
  './plantillas_sppat/form_024_consentimiento.pdf',
  './plantillas_sppat/reclamacion_sppat.pdf',
  './plantillas_sppat/form_008_emergencia.pdf',
  './plantillas_sppat/form_012a_imagenologia.pdf',
  './js/main.js',
  './js/constants.js',
  './js/formLogic.js',
  './js/contacts.js',
  './js/storage.js',
  './js/ui.js',
  './js/api.js',
  './js/cloud.js',
  './js/medicos.js',
  './js/sppat.js'
];

const EXTERNAL_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/css/tom-select.bootstrap5.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/js/tom-select.complete.min.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(STATIC_ASSETS);
      await Promise.allSettled(
        EXTERNAL_ASSETS.map((url) =>
          fetch(url, { mode: 'cors' })
            .then((res) => { if (res.ok) cache.put(url, res); })
            .catch(() => {})
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorar llamadas POST y llamadas a APIs de base de datos
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  if (url.origin.includes('script.google.com') || url.origin.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // En segundo plano actualizamos la caché si hay red
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {/* Modo offline silencioso */});
        return cachedResponse;
      }

      // Si no estaba en caché, buscar en red y cachear respuestas válidas (incluso opaque de CDNs)
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        // Fallback básico para navegación si no hay red
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
