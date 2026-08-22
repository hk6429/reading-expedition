import assert from "node:assert/strict";
import test from "node:test";

import { fetchWithTimeout } from "../../src/storage/network.js";

test("網路要求逾時會中止 fetch 並提供可辨識錯誤", async () => {
  let receivedSignal;
  const fetchImpl = async (_input, { signal }) => {
    receivedSignal = signal;
    return new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
  };

  await assert.rejects(
    fetchWithTimeout("/slow", {}, { timeoutMs: 10, fetchImpl }),
    (error) => error.name === "TimeoutError" && /逾時/.test(error.message),
  );
  assert.equal(receivedSignal.aborted, true);
});

test("上游取消訊號會原樣取消而不誤報逾時", async () => {
  const upstream = new AbortController();
  const expected = new Error("route changed");
  const fetchImpl = async (_input, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), {
        once: true,
      });
    });
  const pending = fetchWithTimeout(
    "/cancelled",
    { signal: upstream.signal },
    { timeoutMs: 100, fetchImpl },
  );
  upstream.abort(expected);
  await assert.rejects(pending, expected);
});
