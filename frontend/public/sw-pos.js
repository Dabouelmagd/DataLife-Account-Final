/* App-shell offline cache — loaded by sw-push.js with importScripts, so the
 * site keeps ONE service worker at the root scope (push + offline). A second
 * worker registered at "/" would replace the push worker and vice versa.
 *
 *  - navigation: network first; offline → the cached index.html
 *  - /static/ (hashed, immutable): cache first, filled as chunks are loaded
 *  - /api/: never touched — the POS screen keeps its own data in IndexedDB
 */
(function () {
  var SHELL = 'dl-shell-v1';
  var STATIC = 'dl-static-v1';
  var STATIC_MAX = 250;
  var LOCAL = /^(localhost|127\.|0\.0\.0\.0)/.test(self.location.hostname);
  if (LOCAL) return;                         // dev server: hot reload must not be cached

  function shellUrls() {
    return fetch('/asset-manifest.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : {}; })
      .then(function (m) {
        var files = (m && m.files) || {};
        var urls = ['/', '/index.html', '/manifest.json'];
        ['main.js', 'main.css'].forEach(function (k) { if (files[k]) urls.push(files[k]); });
        ((m && m.entrypoints) || []).forEach(function (e) { urls.push('/' + String(e).replace(/^\//, '')); });
        return urls.filter(function (u, i) { return urls.indexOf(u) === i; });
      })
      .catch(function () { return ['/', '/index.html']; });
  }

  function trim(cacheName, max) {
    return caches.open(cacheName).then(function (c) {
      return c.keys().then(function (keys) {
        if (keys.length <= max) return null;
        return Promise.all(keys.slice(0, keys.length - max).map(function (k) { return c.delete(k); }));
      });
    });
  }

  self.addEventListener('install', function (event) {
    event.waitUntil(
      shellUrls().then(function (urls) {
        return caches.open(SHELL).then(function (c) {
          // one missing file must not fail the whole install
          return Promise.all(urls.map(function (u) {
            return fetch(u, { cache: 'no-store' }).then(function (r) { return r.ok ? c.put(u, r) : null; })
              .catch(function () { return null; });
          }));
        });
      }).then(function () { return self.skipWaiting(); })
    );
  });

  self.addEventListener('activate', function (event) {
    event.waitUntil(
      caches.keys().then(function (names) {
        return Promise.all(names.filter(function (n) {
          return n === 'dl-bundle' || ((n.indexOf('dl-shell-') === 0 || n.indexOf('dl-static-') === 0) && n !== SHELL && n !== STATIC);
        }).map(function (n) { return caches.delete(n); }));
      }).then(function () { return self.clients.claim(); })
    );
  });

  self.addEventListener('fetch', function (event) {
    var req = event.request;
    if (req.method !== 'GET') return;
    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.indexOf('/api/') === 0 || url.pathname === '/api') return;

    if (req.mode === 'navigate') {
      event.respondWith(
        fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(SHELL).then(function (c) { c.put('/index.html', copy); });
          }
          return res;
        }).catch(function () {
          return caches.open(SHELL).then(function (c) {
            return c.match('/index.html').then(function (hit) { return hit || c.match('/'); });
          }).then(function (hit) {
            return hit || new Response('<h1 dir="rtl">لا يوجد اتصال بالإنترنت</h1>',
              { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
          });
        })
      );
      return;
    }

    if (url.pathname.indexOf('/static/') === 0) {
      event.respondWith(
        caches.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) {
              var copy = res.clone();
              caches.open(STATIC).then(function (c) { return c.put(req, copy); })
                .then(function () { return trim(STATIC, STATIC_MAX); });
            }
            return res;
          });
        })
      );
    }
  });
})();
