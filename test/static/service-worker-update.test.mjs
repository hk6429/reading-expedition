import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceWorker = fs.readFileSync(
  new URL("../../service-worker.js", import.meta.url),
  "utf8",
);

test("新版離線程式接管時會重新載入仍停在舊版的視窗", () => {
  assert.match(serviceWorker, /self\.clients\.matchAll/);
  assert.match(serviceWorker, /client\.navigate\(client\.url\)/);
});

test("導覽與程式骨架採網路優先，離線時才回快取", () => {
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(serviceWorker, /isAppShellRequest/);
  assert.match(serviceWorker, /networkFirst/);
  assert.match(
    serviceWorker,
    /fetch\(request\)[\s\S]+caches\.match\(request\)/,
  );
});
