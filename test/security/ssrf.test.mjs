import assert from "node:assert/strict";
import test from "node:test";

import { assertSafeUrl } from "../../worker/src/pipeline/url-safety.js";

test("惡意來源不能讀取本機、私網、非白名單或帶憑證網址", () => {
  const allowed = new Set(["science.nasa.gov"]);
  for (const url of [
    "http://127.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://192.168.1.1/",
    "file:///etc/passwd",
    "https://attacker.example/",
  ]) {
    assert.throws(() => assertSafeUrl(url, allowed));
  }
  const safe = assertSafeUrl(
    "https://user:secret@science.nasa.gov/feed/#fragment",
    allowed,
  );
  assert.equal(safe.username, "");
  assert.equal(safe.password, "");
  assert.equal(safe.hash, "");
});
