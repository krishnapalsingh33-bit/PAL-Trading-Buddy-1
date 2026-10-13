"use strict";
const CACHE_NAME = "pal-trading-buddy-shell-v1";
const APP_SHELL = ["/dashboard?app=1", "/manifest.webmanifest", "/app-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("pal-trading-buddy-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache market quotes, health checks, macro reports, news or calendar.
  if (url.pathname === "/health" || url.pathname.startsWith("/pal/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/dashboard?app=1", copy));
        }
        return response;
      }).catch(async () => (await caches.match("/dashboard?app=1")) || Response.error())
    );
    return;
  }

  if (["/manifest.webmanifest", "/app-icon.svg"].includes(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
