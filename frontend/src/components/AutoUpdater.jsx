/**
 * AutoUpdater — يكتشف bundle جديد ويعمل reload تلقائي
 * يفحص كل 5 دقائق إذا في نسخة جديدة من الـ app
 */
import { useEffect } from 'react';

const BUNDLE_KEY = 'dl_app_version';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function AutoUpdater() {
  useEffect(() => {
    const checkForUpdate = async () => {
      try {
        // Fetch index.html with no-cache to get latest bundle hash
        const res = await fetch('/', {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const html = await res.text();
        
        // Extract main bundle hash from HTML
        const match = html.match(/main\.([a-f0-9]+)\.js/);
        if (!match) return;
        
        const newHash = match[1];
        const currentHash = localStorage.getItem(BUNDLE_KEY);
        
        if (!currentHash) {
          // First visit — store current hash
          localStorage.setItem(BUNDLE_KEY, newHash);
          return;
        }
        
        if (currentHash !== newHash) {
          // New version detected — clear cache and reload
          localStorage.setItem(BUNDLE_KEY, newHash);
          
          // Clear all caches
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map(k => caches.delete(k)));
          }
          
          // Reload to get new version
          window.location.reload(true);
        }
      } catch {
        // Silent fail — network issue
      }
    };

    // Check on mount
    checkForUpdate();
    
    // Check every 5 minutes
    const interval = setInterval(checkForUpdate, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return null; // No UI
}
