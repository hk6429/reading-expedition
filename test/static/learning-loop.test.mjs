import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const FEATURE_IDS = [
  "pre-reading-forecast",
  "reading-strategy",
  "reading-plan",
  "paragraph-waypoint",
  "paragraph-flag",
  "vocabulary-bag",
  "paragraph-focus",
  "structure-map",
  "source-radar",
  "midpoint-check",
  "scaffold-fade",
  "completion-map",
  "confidence-scale",
  "hint-ladder",
  "evidence-first",
  "diagnostic-code",
  "correction-drawer",
  "evidence-viewed",
  "transfer-task",
  "spaced-review",
  "three-axis-result",
  "revision-growth",
  "retry-checkpoint",
  "preserved-answer",
  "high-contrast-accessibility",
];

test("閱讀與作答畫面公開 25 項可驗收的學習迴圈功能", async () => {
  const urls = [
    "../../src/ui/learning-loop.js",
    "../../src/ui/reading-view.js",
    "../../src/ui/assessment-view.js",
  ];
  const source = (
    await Promise.all(
      urls.map((path) => readFile(new URL(path, import.meta.url), "utf8")),
    )
  ).join("\n");

  for (const feature of FEATURE_IDS) {
    assert.match(
      source,
      new RegExp(`data-learning-feature=["'\\\`]${feature}["'\\\`]`),
      `${feature} 必須出現在實際畫面`,
    );
  }
});

test("學習迴圈只使用結構化選項，不收集自由文字或製造壓迫感", async () => {
  const source = await readFile(
    new URL("../../src/ui/learning-loop.js", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /textarea|contenteditable/i);
  assert.doesNotMatch(source, /倒數|連續.*歸零|隨機獎勵|羞辱/);
  assert.match(source, /aria-live/);
});

test("閱讀輔助具備手動朗讀、鍵盤詞解與觀察器失效替代路徑", async () => {
  const [loop, reading, accessibility] = await Promise.all([
    readFile(new URL("../../src/ui/learning-loop.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/ui/reading-view.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/theme/accessibility.css", import.meta.url), "utf8"),
  ]);
  assert.match(loop, /speechSynthesis/);
  assert.match(loop, /data-action="pause"/);
  assert.match(loop, /data-action="stop"/);
  assert.match(reading, /event\.key !== "Escape"/);
  assert.match(reading, /aria-valuetext/);
  assert.match(reading, /我已讀到文末/);
  assert.match(reading, /typeof IntersectionObserver !== "function"/);
  assert.match(accessibility, /\.reading-thumb-bar/);
  assert.match(accessibility, /min-height:\s*44px/);
  assert.match(accessibility, /max-width:\s*48rem/);
});

test("易讀偏好可持久化，強制色彩模式仍有非顏色辨識線索", async () => {
  const [loop, accessibility] = await Promise.all([
    readFile(new URL("../../src/ui/learning-loop.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/theme/accessibility.css", import.meta.url), "utf8"),
  ]);
  assert.match(loop, /data-learning-feature="easy-reading-accessibility"/);
  assert.match(loop, /setDisplayPreference\("easyReading"/);
  assert.match(accessibility, /data-easy-reading="true"/);
  assert.match(accessibility, /@media \(forced-colors: active\)[\s\S]*question-feedback\.is-correct::before/);
  assert.match(accessibility, /@media \(forced-colors: active\)[\s\S]*assessment-option:has\(input:checked\)/);
  assert.match(accessibility, /@media \(forced-colors: active\)[\s\S]*reading-progress__bar/);
});

test("作答完成會把初次或修正後最新的 completionProof 交給整合層", async () => {
  const assessment = await readFile(
    new URL("../../src/ui/assessment-view.js", import.meta.url),
    "utf8",
  );
  assert.match(assessment, /latestCompletionProof\s*=\s*result\.completionProof\s*\?\?\s*null/);
  assert.match(assessment, /completionProof:\s*latestCompletionProof/);
});

test("作答頁依 session seed 顯示三能力的等價題型標記", async () => {
  const assessment = await readFile(
    new URL("../../src/ui/assessment-view.js", import.meta.url),
    "utf8",
  );
  assert.match(assessment, /getAssessmentSessionSeed\(window\.sessionStorage\)/);
  assert.match(assessment, /createAssessmentVariantSet\(reading\.assessment/);
  assert.match(assessment, /data-learning-feature", "assessment-equivalent-variant"/);
  assert.match(assessment, /本次等值任務/);
});

test("來源雷達明列總數、發布者與資料類型", async () => {
  const loop = await readFile(
    new URL("../../src/ui/learning-loop.js", import.meta.url),
    "utf8",
  );
  assert.match(loop, /sourceRadarSummary/);
  assert.match(loop, /來源共/);
  assert.match(loop, /發布者：/);
  assert.match(loop, /資料類型：/);
});

test("未達標報告以實際錯題建立能力與文證段落檢查點", async () => {
  const loop = await readFile(
    new URL("../../src/ui/learning-loop.js", import.meta.url),
    "utf8",
  );
  assert.match(loop, /retryCheckpoints\(reading\.assessment, finalResults\)/);
  assert.doesNotMatch(loop, /<li>重看錯誤類型<\/li>/);
  assert.doesNotMatch(loop, /<li>定位一段文證<\/li>/);
});

test("轉化選擇更新班級品質資料，離開結果頁前才同步佇列", async () => {
  const [assessment, loop] = await Promise.all([
    readFile(new URL("../../src/ui/assessment-view.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/ui/learning-loop.js", import.meta.url), "utf8"),
  ]);
  assert.match(loop, /onTransferChange/);
  assert.match(assessment, /onQualityChange/);
  assert.match(assessment, /beforeNavigate/);
});
