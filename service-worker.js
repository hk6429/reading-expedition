const VERSION = "reading-expedition-v2";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/src/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))),
      ),
  );
  self.clients.claim();
});

function isReadingRequest(url) {
  return (
    url.pathname === "/api/v1/daily" ||
    /^\/api\/v1\/readings\/[a-zA-Z0-9-]+$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isReadingRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          const cache = await caches.open(VERSION);
          if (response.status === 410) {
            await cache.put(event.request, response.clone());
          } else if (response.ok && response.headers.get("content-type")?.includes("json")) {
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          return (
            cached ??
            new Response(
              JSON.stringify({
                error: { code: "offline_unavailable", message: "這份讀卷尚未下載。" },
              }),
              {
                status: 503,
                headers: { "content-type": "application/json; charset=utf-8" },
              },
            )
          );
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ??
        fetch(event.request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(VERSION);
            await cache.put(event.request, response.clone());
          }
          return response;
        }),
    ),
  );
});
