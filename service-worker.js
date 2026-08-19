const CACHE_VERSION = "fthue-rehab-v17-20260819-level67-interactions";
const OFFLINE_PAGE = "./offline.html";

importScripts("./offline-assets.js");

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const assets = Array.isArray(self.__OFFLINE_ASSETS) ? self.__OFFLINE_ASSETS : [OFFLINE_PAGE, "./index.html"];
    await Promise.allSettled(assets.map(async (asset) => {
      const request = new Request(asset, { cache: "reload" });
      const response = await fetch(request);
      if (response.ok || response.type === "opaque") await cache.put(request, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok || response.type === "opaque") {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(event.request, response.clone());
      }
      return response;
    })());
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(event.request, response.clone());
        return response;
      } catch (_error) {
        return (await caches.match(event.request))
          || (await caches.match("./index.html"))
          || (await caches.match(OFFLINE_PAGE));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      await cache.put(event.request, response.clone());
    }
    return response;
  })());
});
