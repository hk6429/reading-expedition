import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createApi } from "../../worker/src/api/router.js";

test("快取命中的 daily API 在本機效能預算內", async () => {
  const api = createApi({
    repository: {
      getPublishedDaily: async () => [],
    },
    clock: () => new Date("2026-07-28T01:00:00Z"),
  });
  const started = performance.now();
  for (let index = 0; index < 100; index += 1) {
    const response = await api.fetch(
      new Request("https://example.test/api/v1/daily"),
    );
    assert.equal(response.status, 200);
  }
  assert.ok(performance.now() - started < 500);
});

test("手機首頁必要程式、樣式與首圖低於 500KB", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const files = [
    "index.html",
    "styles.css",
    "assets/scenes/hero-960.webp",
    ...fs
      .readdirSync(path.join(root, "src"), { recursive: true })
      .filter((file) => file.endsWith(".js"))
      .map((file) => path.join("src", file)),
  ];
  const bytes = files.reduce(
    (sum, file) => sum + fs.statSync(path.join(root, file)).size,
    0,
  );
  assert.ok(bytes < 500_000, `mobile shell is ${bytes} bytes`);
});
