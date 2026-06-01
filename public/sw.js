/* global self, caches, fetch, URL, Promise */

const CACHE_NAME = "family-os-shell-v1";
const SHELL_URLS = [
  "/",
  "/money/personal",
  "/money/shared-funds",
  "/tasks",
  "/points",
  "/wishes",
  "/reports",
  "/notifications",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/maskable-icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
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
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/"))
      )
  );
});

self.addEventListener("push", (event) => {
  const fallback = {
    title: "Family OS",
    body: "You have a new family notification.",
    url: "/notifications"
  };
  let payload = fallback;

  try {
    payload = event.data?.json?.() ?? fallback;
  } catch {
    payload = fallback;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Family OS", {
      body: payload.body ?? "You have a new family notification.",
      data: {
        url: payload.url ?? "/notifications",
        notificationId: payload.notificationId,
        type: payload.type
      },
      icon: "/icons/icon.svg",
      badge: "/icons/maskable-icon.svg"
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/notifications";

  event.waitUntil(self.clients.openWindow(url));
});
