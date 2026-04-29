// DueDateHQ service worker
// Scope: offline shell + Web Push for state-alert pushes (PRD §8.5 / arch §10.6).
// Versioned cache: bump CACHE_VERSION to invalidate.

const CACHE_VERSION = "ddhq-v1";
const SHELL_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Cache-first for the shell; network-first for everything else.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Don't intercept HMR / dev-only paths.
  if (url.pathname.startsWith("/@") || url.pathname.startsWith("/node_modules/")) {
    return;
  }

  if (SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req))
  );
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
    })
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
    })
  );
});
