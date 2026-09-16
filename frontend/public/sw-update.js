// Auto-refresh when new JS bundle detected
const BUNDLE_KEY = 'dl_bundle_hash';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (url.includes('/static/js/main.') && url.endsWith('.js')) {
    const hash = url.match(/main\.([a-f0-9]+)\.js/)?.[1];
    if (hash) {
      event.respondWith(
        fetch(event.request).then(response => {
          const stored = self.registration.scope + 'bundle_' + hash;
          caches.open('dl-bundle').then(cache => {
            const prev = localStorage?.getItem?.(BUNDLE_KEY);
            if (prev && prev !== hash) {
              // New bundle detected — notify all clients to reload
              self.clients.matchAll().then(clients => {
                clients.forEach(client => client.postMessage({ type: 'NEW_VERSION', hash }));
              });
            }
          });
          return response;
        }).catch(() => caches.match(event.request))
      );
    }
  }
});
