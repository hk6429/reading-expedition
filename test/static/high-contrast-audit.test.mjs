import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { auditHighContrastPalette } from "../../src/domain/reading-quest.js";

function cssVariable(block, name) {
  const value = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{3,6})`, "i"))?.[1];
  assert.ok(value, `缺少 --${name}`);
  return value.length === 4
    ? `#${[...value.slice(1)].map((part) => part.repeat(2)).join("")}`
    : value;
}

test("實際高對比 CSS 色票可重跑 WCAG AA 稽核", async () => {
  const css = await readFile(
    new URL("../../src/theme/accessibility.css", import.meta.url),
    "utf8",
  );
  const block = css.match(
    /:root\[data-learning-contrast="high"\]\s*\{([^}]+)\}/,
  )?.[1];
  assert.ok(block, "缺少高對比色票區塊");

  const results = auditHighContrastPalette({
    background: cssVariable(block, "paper-primary"),
    text: cssVariable(block, "ink-primary"),
    control: cssVariable(block, "ink-primary"),
    focus: cssVariable(block, "mineral-blue"),
    chart: cssVariable(block, "mineral-green"),
  });

  assert.ok(results.every(({ ratio }) => ratio >= 4.5));
  assert.match(css, /data-learning-contrast="high"[^}]+button/s);
  assert.match(css, /data-learning-contrast="high"[^}]+focus-visible/s);
  assert.match(css, /data-learning-contrast="high"[^}]+three-axis-result/s);
});
