// Minimal service worker – handled by vite-plugin-pwa in production.
// This file exists for compatibility; the plugin generates a full one at build time.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));
