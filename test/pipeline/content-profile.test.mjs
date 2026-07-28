import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateContentProfile,
  selectDailyTextType,
} from "../../worker/src/pipeline/content-profile.js";

function reading(overrides = {}) {
  const base =
    "甲乙丙丁戊己庚辛壬癸天地人物山川風雨日月星辰學思行知信義禮智";
  return {
    textType: "vernacular",
    difficulty: "guided",
    body: [{ id: "p1", text: base.repeat(10).slice(0, 300) }],
    glossary: [],
    ...overrides,
  };
}

test("白話文正文必須介於 300 到 600 字", () => {
  assert.equal(evaluateContentProfile(reading()).ok, true);
  assert.equal(
    evaluateContentProfile(
      reading({
        difficulty: "challenge",
        body: [{
          id: "p1",
          text: "甲乙丙丁戊己庚辛壬癸天地人物山川風雨日月星辰學思行知信義禮智".repeat(11).slice(0, 320),
        }],
      }),
    ).ok,
    true,
  );
  assert.equal(
    evaluateContentProfile(
      reading({
        difficulty: "challenge",
        body: [{
          id: "p1",
          text: "甲乙丙丁戊己庚辛壬癸天地人物山川風雨日月星辰學思行知信義禮智".repeat(20).slice(0, 600),
        }],
      }),
    ).ok,
    true,
  );
  assert.deepEqual(
    evaluateContentProfile(
      reading({
        body: [{
          id: "p1",
          text: "甲乙丙丁戊己庚辛壬癸天地人物山川風雨日月星辰學思行知信義禮智".repeat(10).slice(0, 299),
        }],
      }),
    ).reasons,
    ["vernacular_length_out_of_range"],
  );
  assert.deepEqual(
    evaluateContentProfile(
      reading({
        difficulty: "challenge",
        body: [{
          id: "p1",
          text: "甲乙丙丁戊己庚辛壬癸天地人物山川風雨日月星辰學思行知信義禮智".repeat(21).slice(0, 601),
        }],
      }),
    ).reasons,
    ["vernacular_length_out_of_range"],
  );
});

test("文言文維持國中篇幅且至少三則正文內生難詞注釋", () => {
  const classical = reading({
    textType: "classical",
    body: [
      {
        id: "p1",
        text: "學思行知信義禮智天地人物山川風雨日月星辰".repeat(6),
      },
    ],
    glossary: [
      { term: "學", definition: "學習。" },
      { term: "思", definition: "思考。" },
      { term: "行", definition: "實踐。" },
    ],
  });

  assert.equal(evaluateContentProfile(classical).ok, true);
  assert.deepEqual(
    evaluateContentProfile({ ...classical, glossary: classical.glossary.slice(0, 2) })
      .reasons,
    ["classical_glossary_out_of_range"],
  );
  assert.deepEqual(
    evaluateContentProfile({
      ...classical,
      glossary: [
        ...classical.glossary.slice(0, 2),
        { term: "未見", definition: "正文沒有這個詞。" },
      ],
    }).reasons,
    ["glossary_invalid"],
  );
  assert.ok(
    evaluateContentProfile({
      ...classical,
      glossary: [
        { term: "學", definition: "學習。" },
        { term: "學", definition: "仍是學習。" },
        { term: "行", definition: "實踐。" },
      ],
    }).reasons.includes("glossary_invalid"),
  );
});

test("全標點或重複字不能冒充三百字閱讀文本", () => {
  assert.equal(
    evaluateContentProfile(
      reading({ body: [{ id: "p1", text: "。".repeat(300) }] }),
    ).ok,
    false,
  );
  assert.ok(
    evaluateContentProfile(
      reading({ body: [{ id: "p1", text: "甲".repeat(300) }] }),
    ).reasons.includes("reading_text_repetitive"),
  );
});

test("世界與科學固定白話，人文每週二四六安排文言改寫", () => {
  assert.equal(
    selectDailyTextType({ category: "science", date: "2026-07-28" }),
    "vernacular",
  );
  assert.equal(
    selectDailyTextType({ category: "humanities", date: "2026-07-28" }),
    "classical",
  );
  assert.equal(
    selectDailyTextType({ category: "humanities", date: "2026-07-29" }),
    "vernacular",
  );
});
