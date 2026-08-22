import assert from "node:assert/strict";
import test from "node:test";

import {
  assessmentAxes,
  auditHighContrastPalette,
  buildStructureMap,
  createReadingQuest,
  diagnosticCode,
  HIGH_CONTRAST_AA_PALETTE,
  paragraphWaypoints,
  PREDICTION_CHOICES,
  READING_PLANS,
  READING_STRATEGIES,
  reviewSuggestion,
  retryCheckpoints,
  sourceRadar,
  sourceRadarSummary,
  taipeiCalendarDate,
} from "../../src/domain/reading-quest.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test("讀前任務只接受結構化選項，並保留在本機工作階段", () => {
  const sessionStorage = memoryStorage();
  const localStorage = memoryStorage();
  const quest = createReadingQuest("reading-1", {
    sessionStorage,
    localStorage,
  });

  quest.choosePrediction(PREDICTION_CHOICES[1].id);
  quest.chooseStrategy(READING_STRATEGIES[2].id);
  quest.choosePlan(READING_PLANS[0]);

  assert.deepEqual(quest.snapshot().preparation, {
    prediction: PREDICTION_CHOICES[1].id,
    strategy: READING_STRATEGIES[2].id,
    planMinutes: 5,
  });
  assert.throws(() => quest.choosePrediction("我的自由文字"), /prediction/);
  assert.throws(() => quest.chooseStrategy("祕密捷徑"), /strategy/);
  assert.throws(() => quest.choosePlan(20), /plan/);

  const restored = createReadingQuest("reading-1", {
    sessionStorage,
    localStorage,
  });
  assert.deepEqual(restored.snapshot().preparation, quest.snapshot().preparation);
});

test("段落旗標與焦點留在當次閱讀，詞彙袋只保存既有詞條", () => {
  const sessionStorage = memoryStorage();
  const localStorage = memoryStorage();
  const quest = createReadingQuest("reading-1", {
    sessionStorage,
    localStorage,
    approvedVocabulary: [
      { term: "水循環", definition: "水在環境中的移動" },
    ],
  });

  quest.toggleParagraph(1, 4);
  quest.focusParagraph(1, 4);
  quest.setScaffoldsVisible(false);
  quest.collectVocabulary({ term: "水循環", definition: "水在環境中的移動" });

  assert.deepEqual(quest.snapshot().reading, {
    completedParagraphs: [1],
    focusParagraph: 1,
    scaffoldsVisible: false,
    midpointChecked: false,
  });
  assert.deepEqual(quest.vocabularyBag(), [
    { readingId: "reading-1", term: "水循環", definition: "水在環境中的移動" },
  ]);
  assert.throws(
    () => quest.collectVocabulary({ term: "", definition: "任意輸入" }),
    /vocabulary/,
  );
});

test("作答歷程保留信心、提示、文證與選項，但不接受自由文字", () => {
  const sessionStorage = memoryStorage();
  const localStorage = memoryStorage();
  const quest = createReadingQuest("reading-1", {
    sessionStorage,
    localStorage,
    questionIds: ["q1"],
    answerChoices: { q1: ["甲", "乙"] },
    transferChoices: ["在另一篇文章找相同因果", "比較兩個來源"],
  });

  quest.setConfidence("q1", 3);
  quest.revealHint("q1", 1);
  quest.revealHint("q1", 2);
  quest.locateEvidence("q1", 2, 4);
  quest.markEvidenceViewed("q1");
  quest.setAnswer("q1", "乙");
  quest.chooseTransfer("比較兩個來源");

  assert.deepEqual(quest.snapshot().assessment, {
    confidence: { q1: 3 },
    hintLevels: { q1: 2 },
    evidenceParagraphs: { q1: 2 },
    evidenceViewed: ["q1"],
    answers: { q1: "乙" },
    transferChoice: "比較兩個來源",
  });
  assert.throws(() => quest.setConfidence("q1", 5), /confidence/);
  assert.throws(() => quest.setAnswer("q1", "我自己寫答案"), /answer/);
  assert.throws(() => quest.chooseTransfer("我的自由文字"), /transfer/);
  quest.prepareRetry();
  assert.deepEqual(quest.snapshot().assessment, {
    confidence: {},
    hintLevels: {},
    evidenceParagraphs: {},
    evidenceViewed: [],
    answers: {},
    transferChoice: null,
  });
});

test("閱讀地圖與來源雷達把文章資料轉成可掃讀線索", () => {
  const reading = {
    category: "science",
    body: ["第一段", "第二段", "第三段", "第四段"],
    sourceAttribution: [
      {
        publisher: "中央氣象署",
        license: "政府資料開放授權",
        url: "https://www.cwa.gov.tw/example",
      },
    ],
  };

  assert.deepEqual(paragraphWaypoints(reading), [
    "先看全貌",
    "追蹤機制",
    "連起變化",
    "整理模型",
  ]);
  assert.equal(buildStructureMap(reading), "先看全貌 → 追蹤機制 → 連起變化 → 整理模型");
  assert.deepEqual(sourceRadar(reading)[0], {
    publisher: "中央氣象署",
    host: "www.cwa.gov.tw",
    license: "政府資料開放授權",
    dataType: "政府公開資料",
    checks: ["有發布單位", "可追查網址", "有授權說明"],
  });
  assert.deepEqual(sourceRadarSummary(reading), {
    total: 1,
    publishers: ["中央氣象署"],
    dataTypes: ["政府公開資料"],
  });
});

test("作答結果以三軸、錯誤代碼與複習節點呈現成長", () => {
  const items = [
    { id: "q1", type: "comprehension" },
    { id: "q2", type: "inference" },
    { id: "q3", type: "evidence" },
  ];
  const first = [
    { id: "q1", correct: true },
    { id: "q2", correct: false },
    { id: "q3", correct: false },
  ];
  const final = [
    { id: "q1", correct: true },
    { id: "q2", correct: true },
    { id: "q3", correct: false },
  ];

  assert.deepEqual(assessmentAxes(items, first, final, ["q3"]), {
    comprehension: { correct: 1, total: 1, revised: 0 },
    inference: { correct: 1, total: 1, revised: 1 },
    evidence: { correct: 0, total: 1, revised: 0, viewed: 1 },
  });
  assert.equal(diagnosticCode("inference"), "推論跨步");
  assert.deepEqual(reviewSuggestion("2026-08-22"), [
    "2026-08-23",
    "2026-08-25",
    "2026-08-29",
  ]);
  assert.equal(
    taipeiCalendarDate("2026-08-22T16:06:00.000Z"),
    "2026-08-23",
  );
  assert.equal(
    taipeiCalendarDate("2026-08-23T15:59:59.000Z"),
    "2026-08-23",
  );
});

test("易讀與高對比偏好獨立保存在本機，不寫入學習紀錄", () => {
  const sessionStorage = memoryStorage();
  const localStorage = memoryStorage();
  const quest = createReadingQuest("reading-1", {
    sessionStorage,
    localStorage,
  });

  quest.setDisplayPreference("easyReading", true);
  quest.setDisplayPreference("highContrast", true);

  assert.deepEqual(quest.displayPreferences(), {
    easyReading: true,
    highContrast: true,
  });
  assert.equal(
    JSON.parse(
      localStorage.getItem("reading-expedition:learning-display"),
    ).easyReading,
    true,
  );
  assert.equal(quest.snapshot().displayPreferences, undefined);
  assert.throws(
    () => quest.setDisplayPreference("studentName", true),
    /display preference/,
  );
});

test("未達標重試檢查點逐題指出能力、錯誤類型與文證段落", () => {
  const checkpoints = retryCheckpoints(
    [
      { id: "q1", type: "comprehension" },
      { id: "q2", type: "inference" },
      { id: "q3", type: "evidence" },
    ],
    [
      { id: "q1", correct: true, evidenceSpan: { paragraph: 1 } },
      { id: "q2", correct: false, evidenceSpan: { paragraph: 3 } },
      { id: "q3", correct: false, evidenceSpan: { paragraph: 4 } },
    ],
  );

  assert.deepEqual(checkpoints, [
    {
      id: "q2",
      ability: "推論",
      code: "推論跨步",
      paragraph: 3,
      instruction: "推論・推論跨步：回到第 3 段，重新比對題目與原文線索。",
    },
    {
      id: "q3",
      ability: "文證",
      code: "文證失焦",
      paragraph: 4,
      instruction: "文證・文證失焦：回到第 4 段，重新比對題目與原文線索。",
    },
  ]);
});

test("高對比模式的文字、控制項、焦點與圖表皆通過 WCAG AA", () => {
  const results = auditHighContrastPalette(HIGH_CONTRAST_AA_PALETTE);

  assert.deepEqual(
    results.map(({ role, passed }) => [role, passed]),
    [
      ["文字", true],
      ["控制項", true],
      ["焦點", true],
      ["圖表", true],
    ],
  );
  assert.ok(results.every(({ ratio }) => ratio >= 4.5));
  assert.throws(
    () =>
      auditHighContrastPalette({
        ...HIGH_CONTRAST_AA_PALETTE,
        focus: "#aaaaaa",
      }),
    /WCAG AA contrast/,
  );
});
