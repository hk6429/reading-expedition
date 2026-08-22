import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const tokens = fs.readFileSync(
  new URL("../../src/theme/tokens.css", import.meta.url),
  "utf8",
);
const accessibility = fs.readFileSync(
  new URL("../../src/theme/accessibility.css", import.meta.url),
  "utf8",
);
const motion = fs.readFileSync(
  new URL("../../src/theme/motion.css", import.meta.url),
  "utf8",
);

test("水墨色票以深墨、宣紙、礦物色與少量朱砂命名", () => {
  for (const token of [
    "--ink-950",
    "--paper-100",
    "--cinnabar-600",
    "--mineral-blue-700",
    "--mineral-green-700",
  ]) {
    assert.match(tokens, new RegExp(token));
  }
});

test("提供 reduced motion、關閉紋理與全站靜音偏好", () => {
  assert.match(motion, /prefers-reduced-motion/);
  assert.match(motion, /data-reduced-motion="true"/);
  assert.match(accessibility, /data-texture="off"/);
  assert.match(accessibility, /data-muted="true"/);
});

test("閱讀偏好使用既有 textures 與 lineHeight 欄位並立即套用", () => {
  const navigation = fs.readFileSync(
    new URL("../../src/ui/navigation.js", import.meta.url),
    "utf8",
  );
  const controls = fs.readFileSync(
    new URL("../../src/ui/reading-controls.js", import.meta.url),
    "utf8",
  );
  assert.match(navigation, /preferences\.textures/);
  assert.match(navigation, /--reading-line-height/);
  assert.match(controls, /閱讀行距/);
  assert.match(controls, /減少動效/);
  assert.match(controls, /純色背景/);
});
