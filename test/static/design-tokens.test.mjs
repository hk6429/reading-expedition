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
  assert.match(accessibility, /data-texture="off"/);
  assert.match(accessibility, /data-muted="true"/);
});
