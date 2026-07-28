import assert from "node:assert/strict";
import test from "node:test";

import {
  createSourceRegistry,
  fingerprintSourceItem,
} from "../../worker/src/pipeline/source-registry.js";

const source = {
  id: "science-feed",
  name: "科學公開資料",
  baseUrl: "https://science.example.org",
  publisher: "科學公開資料",
  license: { type: "public-domain", version: null },
  allowedUsage: "facts-and-short-extracts",
  extractScope: "title-summary-link",
  adapter: "rss",
};

test("來源登錄只接受完整白名單資料，並以 hostname 查找", () => {
  const registry = createSourceRegistry([source]);

  assert.equal(registry.requireForUrl("https://science.example.org/feed").id, "science-feed");
  assert.throws(
    () => registry.requireForUrl("https://unknown.example.org/feed"),
    /not allowlisted/,
  );
  assert.throws(
    () => createSourceRegistry([{ ...source, allowedUsage: "" }]),
    /allowedUsage/,
  );
});

test("相同 canonical URL 與內容會產生穩定去重指紋", async () => {
  const first = await fingerprintSourceItem({
    canonicalUrl: "https://science.example.org/a",
    title: "海水為何升高",
    extract: "海水受熱膨脹。",
  });
  const second = await fingerprintSourceItem({
    canonicalUrl: "https://science.example.org/a#fragment",
    title: "海水為何升高",
    extract: "海水受熱膨脹。",
  });

  assert.equal(first.canonicalUrl, "https://science.example.org/a");
  assert.equal(first.contentFingerprint, second.contentFingerprint);
});
