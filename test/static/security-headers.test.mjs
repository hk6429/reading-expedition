import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);

test("Cloudflare Pages 發布 CSP 且雜湊允許現有 inline script", async () => {
  const [headers, html, build] = await Promise.all([
    readFile(new URL("_headers", projectRoot), "utf8"),
    readFile(new URL("index.html", projectRoot), "utf8"),
    readFile(new URL("scripts/build-static.mjs", projectRoot), "utf8"),
  ]);
  const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript);
  const hash = createHash("sha256").update(inlineScript).digest("base64");

  assert.match(headers, /Content-Security-Policy:/);
  assert.match(headers, new RegExp(`'sha256-${hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'`));
  assert.match(headers, /object-src 'none'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(build, /"_headers"/);
});
