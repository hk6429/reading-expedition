const VERSION = "reading-expedition-v9";
const CACHE_PREFIX = "reading-expedition-";
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
    (async () => {
      const keys = await caches.keys();
      const staleKeys = keys.filter(
        (key) => key.startsWith(CACHE_PREFIX) && key !== VERSION,
      );
      await Promise.all(staleKeys.map((key) => caches.delete(key)));
      await self.clients.claim();

      if (staleKeys.length) {
        const clients = await self.clients.matchAll({ type: "window" });
        await Promise.all(
          clients.map((client) => client.navigate(client.url)),
        );
      }
    })(),
  );
});

function isReadingRequest(url) {
  return (
    url.pathname === "/api/v1/daily" ||
    /^\/api\/v1\/readings\/[a-zA-Z0-9-]+$/.test(url.pathname)
  );
}

function isAppShellRequest(request, url) {
  return (
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname === "/styles.css" ||
    url.pathname.startsWith("/src/")
  );
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(VERSION);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return (
      cached ??
      new Response("目前離線，且這個畫面尚未下載。", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
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

  if (isAppShellRequest(event.request, url)) {
    event.respondWith(networkFirst(event.request));
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
