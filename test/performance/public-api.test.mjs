import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { createApi } from "../../worker/src/api/router.js";

function localDependencyBytes(root, entry, kind) {
  const visited = new Set();
  const visit = (relativePath) => {
    const absolutePath = path.resolve(root, relativePath);
    if (visited.has(absolutePath)) return 0;
    visited.add(absolutePath);
    const source = fs.readFileSync(absolutePath, "utf8");
    const specifiers =
      kind === "css"
        ? [...source.matchAll(/@import\s+url\(["'](\.[^"']+)["']\)/g)].map(
            (match) => match[1],
          )
        : [
            ...source.matchAll(/\bfrom\s+["'](\.[^"']+)["']/g),
            ...source.matchAll(/^\s*import\s+["'](\.[^"']+)["']/gm),
          ].map((match) => match[1]);
    return (
      fs.statSync(absolutePath).size +
      specifiers.reduce(
        (sum, specifier) =>
          sum +
          visit(path.relative(root, path.resolve(path.dirname(absolutePath), specifier))),
        0,
      )
    );
  };
  return visit(entry);
}

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
  const bytes =
    fs.statSync(path.join(root, "index.html")).size +
    fs.statSync(path.join(root, "assets/scenes/hero-640.webp")).size +
    localDependencyBytes(root, "styles.css", "css") +
    localDependencyBytes(root, "src/app.js", "js");
  assert.ok(bytes < 500_000, `mobile shell is ${bytes} bytes`);
});
