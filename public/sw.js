// Antigravity Hub Service Worker
// Strategy: Network-first for pages and JS, cache-first only for static assets (images, fonts)
const CACHE_VERSION = "v-" + Date.now(); // Unique per deploy
const STATIC_CACHE = "antigravity-static-v2";

self.addEventListener("install", (event) => {
  // Skip waiting to immediately activate the new SW
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Clean up ALL old caches except the current static cache
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Immediately take control of all pages
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== "GET") return;

  // Skip cross-origin requests (googleapis, firebase, etc.)
  if (url.origin !== self.location.origin) return;

  // API routes: always network, no caching
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Static assets (images, fonts, manifest): cache-first
  if (
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|gif|webp|woff2?|ttf|eot)$/) ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Everything else (HTML, JS, CSS): NETWORK-FIRST
  // This ensures you always get the latest deploy
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request)) // Offline fallback only
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  const data = event.data?.json() || { title: "Antigravity", body: "You have a notification" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(clients.openWindow(url));
});
