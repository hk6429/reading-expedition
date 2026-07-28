import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSafeUrl,
  fetchAllowlisted,
} from "../../worker/src/pipeline/url-safety.js";

const allowedHosts = new Set(["science.example.org"]);

test("URL 安全層拒絕非 HTTP、私網、localhost 與非白名單主機", () => {
  assert.throws(() => assertSafeUrl("file:///etc/passwd", allowedHosts), /scheme/);
  assert.throws(() => assertSafeUrl("http://127.0.0.1/a", allowedHosts), /private/);
  assert.throws(() => assertSafeUrl("http://[::1]/a", allowedHosts), /private/);
  assert.throws(() => assertSafeUrl("https://localhost/a", allowedHosts), /private/);
  assert.throws(() => assertSafeUrl("https://evil.test/a", allowedHosts), /allowlisted/);
});

test("重新導向必須仍在白名單，超大回應會中止", async () => {
  const redirectFetch = async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://evil.test/redirected" },
    });
  await assert.rejects(
    fetchAllowlisted("https://science.example.org/feed", {
      allowedHosts,
      fetchImpl: redirectFetch,
    }),
    /allowlisted/,
  );

  const largeFetch = async () =>
    new Response("x".repeat(101), {
      headers: { "content-length": "101" },
    });
  await assert.rejects(
    fetchAllowlisted("https://science.example.org/feed", {
      allowedHosts,
      fetchImpl: largeFetch,
      maxBytes: 100,
    }),
    /too large/,
  );
});

test("adapter 逾時會回傳可判讀錯誤碼", async () => {
  const neverFetch = (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });

  await assert.rejects(
    fetchAllowlisted("https://science.example.org/feed", {
      allowedHosts,
      fetchImpl: neverFetch,
      timeoutMs: 5,
    }),
    (error) => error.code === "source_timeout",
  );
});
