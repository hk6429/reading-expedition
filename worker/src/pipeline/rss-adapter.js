import { fingerprintSourceItem } from "./source-registry.js";

function decodeXml(value = "") {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function field(block, name) {
  const match = new RegExp(
    `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,
    "i",
  ).exec(block);
  return match ? decodeXml(match[1]) : "";
}

export function createRssAdapter({ fetchSource }) {
  return Object.freeze({
    async fetch(source, url) {
      const { text, finalUrl } = await fetchSource(source, url);
      const blocks = text.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ?? [];
      const items = [];
      const errors = [];
      for (const block of blocks) {
        const title = field(block, "title");
        const canonicalUrl = field(block, "link");
        const summary = field(block, "description").slice(0, 500);
        if (!title || !canonicalUrl) {
          errors.push({
            code: "rss_item_invalid",
            message: "RSS item is missing title or link",
          });
          continue;
        }
        try {
          const fingerprint = await fingerprintSourceItem({
            canonicalUrl,
            title,
            extract: summary,
          });
          items.push({
            ...fingerprint,
            title,
            publisher: source.publisher,
            publishedAt: field(block, "pubDate") || null,
            fetchedFrom: finalUrl ?? url,
            licenseSnapshot: source.license,
            extractScope: source.extractScope,
            extract: summary,
          });
        } catch {
          errors.push({
            code: "rss_item_invalid",
            message: "RSS item URL or content is invalid",
          });
        }
      }
      return { sourceId: source.id, items, errors };
    },
  });
}
