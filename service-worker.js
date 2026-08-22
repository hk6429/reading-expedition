const VERSION = "reading-expedition-v17";
const CACHE_PREFIX = "reading-expedition-";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/manifest.webmanifest",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/characters/song-jiang.webp",
  "/assets/characters/wu-yong.webp",
  "/assets/characters/wu-song.webp",
  "/assets/characters/lu-zhi-shen.webp",
  "/assets/characters/hu-san-niang.webp",
  "/assets/characters/li-kui.webp",
  "/assets/scenes/hero-640.webp",
  "/assets/scenes/hero-960.webp",
  "/assets/scenes/hero-1600.webp",
  "/assets/scenes/world-720.webp",
  "/assets/scenes/science-720.webp",
  "/assets/scenes/humanities-720.webp",
  "/src/app.js",
  "/src/data/building-catalog.js",
  "/src/data/chapter-catalog.js",
  "/src/data/character-catalog.js",
  "/src/data/content-schema.js",
  "/src/data/demo-answer-key.js",
  "/src/data/demo-daily.js",
  "/src/data/demo-readings.js",
  "/src/data/level-answer-keys.js",
  "/src/data/level-readings.js",
  "/src/data/placement-reading.js",
  "/src/data/story-catalog.js",
  "/src/domain/ability-growth.js",
  "/src/domain/ability-mastery.js",
  "/src/domain/active-days.js",
  "/src/domain/assessment-session.js",
  "/src/domain/assessment-variants.js",
  "/src/domain/backup-health.js",
  "/src/domain/city.js",
  "/src/domain/class-contribution.js",
  "/src/domain/class-mission.js",
  "/src/domain/daily-routes.js",
  "/src/domain/device-identity.js",
  "/src/domain/family-report.js",
  "/src/domain/gamification-profile.js",
  "/src/domain/journey-progression.js",
  "/src/domain/measurement.js",
  "/src/domain/portfolio-export.js",
  "/src/domain/reading-history.js",
  "/src/domain/reading-inventory.js",
  "/src/domain/reading-level.js",
  "/src/ui/reading-view.js",
  "/src/ui/reading-controls.js",
  "/src/ui/learning-loop.js",
  "/src/ui/assessment-view.js",
  "/src/domain/reading-quest.js",
  "/src/domain/reading-session.js",
  "/src/domain/weekly-review.js",
  "/src/storage/class-contribution-queue.js",
  "/src/storage/family-client.js",
  "/src/storage/local-store.js",
  "/src/storage/network.js",
  "/src/storage/offline-cache.js",
  "/src/storage/offline-pack.js",
  "/src/storage/schema.js",
  "/src/storage/state-validator.js",
  "/src/storage/sync-queue.js",
  "/src/theme/accessibility.css",
  "/src/theme/motion.css",
  "/src/theme/tokens.css",
  "/src/theme/water-margin.js",
  "/src/ui/backup-reminder.js",
  "/src/ui/bookshelf-view.js",
  "/src/ui/chapter-card.js",
  "/src/ui/city-overview.js",
  "/src/ui/city-view.js",
  "/src/ui/class-view.js",
  "/src/ui/classroom-management.js",
  "/src/ui/family-view.js",
  "/src/ui/home-view.js",
  "/src/ui/mission-dashboard.js",
  "/src/ui/navigation.js",
  "/src/ui/placement-view.js",
  "/src/ui/privacy-consent.js",
  "/src/ui/reading-journal.js",
  "/src/ui/review-console.js",
  "/src/ui/review-diff.js",
  "/src/ui/route-card.js",
  "/src/ui/router.js",
  "/src/ui/student-preview.js",
  "/src/ui/usage-guide.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await cache.addAll(SHELL);
      if (!self.registration.active) return;
      const clients = await self.clients.matchAll({ type: "window" });
      await Promise.all(
        clients.map((client) =>
          client.postMessage({ type: "UPDATE_READY", version: VERSION }),
        ),
      );
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const appKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
      const previousKeys = appKeys.filter((key) => key !== VERSION);
      const previous = previousKeys[previousKeys.length - 1];
      const retained = new Set([VERSION, previous].filter(Boolean));
      const staleKeys = appKeys.filter((key) => !retained.has(key));
      await Promise.all(staleKeys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

async function fetchWithTimeout(request, timeoutMs = 5_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isReadingRequest(url) {
  return (
    url.pathname === "/api/v1/daily" ||
    url.pathname === "/api/v1/readings" ||
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
    const response = await fetchWithTimeout(request);
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
      fetchWithTimeout(event.request)
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

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
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
