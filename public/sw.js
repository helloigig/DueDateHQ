// DueDateHQ service worker
// Scope: offline shell + Web Push for state-alert pushes (PRD §8.5 / arch §10.6).
//
// Update strategy (the painful lesson learned):
// - HTML / manifest are NETWORK-FIRST → users always see the freshest deploy.
//   Without this, the cached index.html references an old asset hash; the
//   browser tries to load that hash; fails (404 once Vercel garbage-collects
//   the old chunk); user sees a blank page or stale UI. This was the root
//   cause of every "but I just deployed..." frustration.
// - Hashed assets (/assets/*.{js,css}) are CACHE-FIRST → they're immutable
//   per Vite's content-hash naming, so caching them aggressively is safe and
//   gives offline-shell support.
// - skipWaiting() + clients.claim() ensure the new SW takes over immediately
//   on the next page load, not after the user closes all tabs.
// - Bump CACHE_VERSION on any breaking change to force a clean slate.

const CACHE_VERSION = "ddhq-v3";

// Static, content-immutable assets that are safe to cache aggressively.
const STATIC_PATHS = [
  "/manifest.webmanifest",
  "/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_PATHS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Don't intercept HMR / dev paths.
  if (url.pathname.startsWith("/@") || url.pathname.startsWith("/node_modules/")) {
    return;
  }

  // Network-first for HTML / SPA routes — the entry point must reference
  // the latest asset hashes from the most recent deploy. Falls back to
  // cached index.html ONLY when offline.
  const isHtmlNav =
    req.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    (req.headers.get("accept") || "").includes("text/html");
  if (isHtmlNav) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Stash the latest HTML for offline fallback.
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html").then((c) => c || Response.error())),
    );
    return;
  }

  // Cache-first for hashed assets — Vite gives them content hashes so the
  // path itself changes when content changes. Safe to cache forever.
  const isHashedAsset = /^\/assets\/.+\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico)$/i.test(
    url.pathname,
  );
  if (isHashedAsset || STATIC_PATHS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        });
      }),
    );
    return;
  }

  // Everything else (API calls, etc.) — pass through to network without
  // touching cache. Caching API responses without invalidation logic is a
  // recipe for stale data.
});

// Web Push handler — fires when the alert pipeline emits announcement.matched.
// Payload contract (mirrors the skim card identity atoms):
//   { alertId, stateCode, title, affectedCount, topic }
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "New alert", body: event.data ? event.data.text() : "" };
  }
  const {
    alertId,
    stateCode = "",
    title = "New state alert",
    affectedCount,
    topic,
  } = payload;

  const headline = stateCode ? `${stateCode}: ${title}` : title;
  const body =
    typeof affectedCount === "number"
      ? `${affectedCount} of your client${
          affectedCount === 1 ? "" : "s"
        } affected${topic ? ` · ${topic}` : ""}`
      : payload.body || "Tap to review.";

  event.waitUntil(
    self.registration.showNotification(headline, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: alertId ? `alert:${alertId}` : "alert",
      data: { alertId, url: alertId ? `/alerts/${alertId}` : "/alerts" },
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const existing = clients.find((c) => c.url.endsWith(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    }),
  );
});
