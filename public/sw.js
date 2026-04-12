// Self-destructing service worker — unregisters itself and clears all caches
// This ensures any previously installed SW is properly cleaned up

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      // Delete all caches
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
      // Unregister this service worker
      self.registration.unregister(),
    ])
  );
});
