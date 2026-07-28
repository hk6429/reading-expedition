import assert from "node:assert/strict";
import test from "node:test";

import {
  createNetlifyApiProxy,
} from "../../netlify/functions/api.mjs";

test("Netlify 只將 /api 路徑代理到 HTTPS 環境來源", async () => {
  let target;
  const proxy = createNetlifyApiProxy({
    apiOrigin: "https://api.example.test",
    fetchImpl: async (url) => {
      target = url;
      return Response.json({ ok: true });
    },
  });
  const response = await proxy(
    new Request(
      "https://site.example.test/.netlify/functions/api/v1/daily?date=2026-07-28",
    ),
  );

  assert.equal(response.status, 200);
  assert.equal(
    target.href,
    "https://api.example.test/api/v1/daily?date=2026-07-28",
  );
});

test("Netlify 未設定安全 API 來源時拒絕代理", async () => {
  const proxy = createNetlifyApiProxy({
    apiOrigin: "http://127.0.0.1:8787",
  });
  const response = await proxy(
    new Request("https://site.example.test/api/v1/daily"),
  );
  assert.equal(response.status, 503);
});
