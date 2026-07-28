import assert from "node:assert/strict";
import test from "node:test";

import { createRssAdapter } from "../../worker/src/pipeline/rss-adapter.js";

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

test("RSS 只保存標題、短摘要與連結，不把 feed 當全文授權", async () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel><item>
      <title>海水為何升高</title>
      <link>https://science.example.org/a</link>
      <description><![CDATA[海水受熱會膨脹，陸地冰融化也會增加海水。]]></description>
      <pubDate>Mon, 27 Jul 2026 08:00:00 GMT</pubDate>
    </item></channel></rss>`;
  const adapter = createRssAdapter({
    fetchSource: async () => ({ text: xml, finalUrl: "https://science.example.org/feed" }),
  });
  const result = await adapter.fetch(source, "https://science.example.org/feed");

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].canonicalUrl, "https://science.example.org/a");
  assert.equal(result.items[0].publisher, "科學公開資料");
  assert.equal(result.items[0].licenseSnapshot.type, "public-domain");
  assert.equal(result.items[0].extractScope, "title-summary-link");
  assert.equal("fullText" in result.items[0], false);
});

test("單一 RSS 項目解析失敗不會拖垮同來源其他項目", async () => {
  const xml = `<rss><channel>
    <item><title>缺連結</title></item>
    <item><title>有效資料</title><link>https://science.example.org/b</link><description>摘要</description></item>
  </channel></rss>`;
  const adapter = createRssAdapter({
    fetchSource: async () => ({ text: xml }),
  });
  const result = await adapter.fetch(source, "https://science.example.org/feed");

  assert.equal(result.items.length, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].code, "rss_item_invalid");
});
