/* Retired. This worker was never registered by the app; it also called
 * localStorage, which does not exist inside a service worker. Offline caching
 * now lives in sw-pos.js (imported by sw-push.js). If a browser still has this
 * file registered, it cleans up its cache and unregisters itself. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.delete('dl-bundle')
      .catch(function () { return null; })
      .then(function () { return self.registration.unregister(); })
  );
});
