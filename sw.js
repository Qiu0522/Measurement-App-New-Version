/*
  Deploy note: bump CACHE_VERSION whenever you upload new app files so
  devices actually fetch the update instead of running the old cached copy.
*/
const CACHE_VERSION = "room-measurement-v1";
const CACHE_NAME = CACHE_VERSION;

const APP_SHELL = [
  "./",
  "index.html",
  "style.css",
  "db.js",
  "app.js",
  "manifest.json",
  "lib/pdf.min.js",
  "lib/pdf.worker.min.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const networkFetch = fetch(request)
      .then(response => {
        if (response && response.status === 200) cache.put(request, response.clone());
        return response;
      })
      .catch(() => null);

    if (cached) {
      networkFetch; // stale-while-revalidate: refresh cache in the background
      return cached;
    }

    const fresh = await networkFetch;
    if (fresh) return fresh;

    if (request.mode === "navigate") {
      const fallback = await cache.match("index.html");
      if (fallback) return fallback;
    }

    return new Response("Offline and not cached.", { status: 503 });
  })());
});
