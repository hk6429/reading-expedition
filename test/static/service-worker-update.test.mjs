import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const serviceWorker = fs.readFileSync(
  new URL("../../service-worker.js", import.meta.url),
  "utf8",
);

test("新版離線程式接管時只通知視窗，不強制中斷閱讀或作答", () => {
  assert.match(serviceWorker, /self\.clients\.matchAll/);
  assert.match(serviceWorker, /client\.postMessage/);
  assert.match(serviceWorker, /UPDATE_READY/);
  assert.doesNotMatch(serviceWorker, /client\.navigate\(client\.url\)/);
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

test("教師與班級 API 永遠直接讀正式資料，不使用舊快取", () => {
  assert.match(serviceWorker, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(
    serviceWorker,
    /url\.pathname\.startsWith\("\/api\/"\)[\s\S]+fetch\(event\.request\)/,
  );
});
