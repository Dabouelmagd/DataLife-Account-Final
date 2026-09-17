/**
 * AutoUpdater — يكتشف bundle جديد ويعمل reload فوري
 */
import { useEffect } from 'react';

const BUNDLE_KEY = 'dl_app_version';
const CHECK_INTERVAL = 30 * 1000; // 30 seconds

export default function AutoUpdater() {
  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        const res = await fetch('/', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
        });
        const html = await res.text();
        const match = html.match(/main\.([a-f0-9]+)\.js/);
        if (!match) return;

        const newHash = match[1];
        const currentHash = localStorage.getItem(BUNDLE_KEY);

        if (!currentHash) {
          localStorage.setItem(BUNDLE_KEY, newHash);
          return;
        }

        if (currentHash !== newHash) {
          localStorage.setItem(BUNDLE_KEY, newHash);
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          window.location.reload(true);
        }
      } catch { /* silent */ }
    };

    checkForUpdate();
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return null;
}
