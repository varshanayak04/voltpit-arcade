/**
 * sw.js — offline support.
 *
 * Strategy:
 *   - Precache the whole app shell on install (it is all local and tiny).
 *   - Navigations: network first, fall back to the cached index.html. That way a
 *     deploy shows up immediately when online, and the arcade still opens on a
 *     plane.
 *   - Everything else: cache first, then network, and quietly fill the cache.
 *
 * Google Fonts are deliberately NOT precached (they are cross-origin and opaque).
 * The CSS ships a full fallback stack, so offline just means system fonts.
 *
 * Bump CACHE when you change any precached file.
 */

const CACHE = "voltpit-v1";

const PRECACHE = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/js/main.js",
  "assets/js/motion.js",
  "assets/js/audio.js",
  "assets/js/store.js",
  "assets/js/arcade.js",
  "assets/js/attract.js",
  "assets/js/games/base.js",
  "assets/js/games/snake.js",
  "assets/js/games/breaker.js",
  "assets/js/games/recall.js",
  "assets/js/games/reflex.js",
  "assets/js/games/merge.js",
  "assets/icons/favicon.svg",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-512.png",
  "assets/icons/apple-touch-icon.png",
  "assets/art/og-cover.png",
  ...Array.from({ length: 21 }, (_, i) => `assets/art/cab-${String(i + 1).padStart(2, "0")}.svg`),
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll rejects the whole batch if one file 404s, so add individually
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => null)
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let fonts go to the network

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put("index.html", fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(CACHE);
          return (await cache.match("index.html")) || (await cache.match("./")) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request, { ignoreSearch: true });
      if (hit) return hit;
      try {
        const fresh = await fetch(request);
        if (fresh.ok && fresh.type === "basic") cache.put(request, fresh.clone());
        return fresh;
      } catch {
        return Response.error();
      }
    })()
  );
});
