const CACHE_NAME = "recetario-digital-manual-20260528-91";
const APP_SHELL = [
  "./",
  "./index.html",
  "./index.html?app=pwa",
  "./styles.css?v=manual-20260528-91",
  "./app.js?v=manual-20260528-91",
  "./manifest.webmanifest?v=manual-20260528-91",
  "./icons/icon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-1024.png",
  "./data/medicamentos.json",
  "./data/cartera_servicios.json",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clients) => {
        clients.forEach((client) => {
          if (client.url) client.navigate(client.url);
        });
      }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (new URL(event.request.url).pathname.endsWith("/licencia-hmlpt-recetas.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-store" }).catch(() => caches.match(event.request, { ignoreSearch: true })),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "reload" })
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true })),
    );
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isVersionedAsset =
    requestUrl.searchParams.has("v") || /\.(?:css|js|webmanifest)$/i.test(requestUrl.pathname);

  if (isVersionedAsset) {
    event.respondWith(
      fetch(event.request, { cache: "reload" })
        .then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(event.request, { ignoreSearch: false })
            .then((cached) => cached || caches.match(event.request, { ignoreSearch: true })),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          if (!response || response.status !== 200) return response;
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
      );
    }),
  );
});


















