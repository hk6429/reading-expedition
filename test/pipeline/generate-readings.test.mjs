import assert from "node:assert/strict";
import test from "node:test";

import { generateReadings } from "../../worker/src/pipeline/generate-readings.js";

const factPack = {
  id: "2026-07-28-science",
  verificationStatus: "verified",
  facts: [{ claim: "海水受熱會膨脹。", sourceItemId: "s1" }],
};
const variedText =
  "甲乙丙丁戊己庚辛壬癸天地人物山川風雨日月星辰學思行知信義禮智";

test("兩種難度必須共用同一事實包並通過結構驗證", async () => {
  const provider = {
    async generate() {
      return {
        readings: [
          {
            difficulty: "guided",
            textType: "vernacular",
            title: "海水的刻度",
            hookQuestion: "海平面為何改變？",
            body: [{
              id: "p1",
              text: `海水受熱會膨脹。${variedText.repeat(10).slice(0, 293)}`,
            }],
            glossary: [{ term: "膨脹", definition: "體積變大。" }],
            readingMinutes: 8,
          },
          {
            difficulty: "challenge",
            textType: "vernacular",
            title: "海平面變化的線索",
            hookQuestion: "如何判讀海平面變化？",
            body: [{
              id: "p1",
              text: `海水受熱會膨脹。${variedText.repeat(15).slice(0, 443)}`,
            }],
            glossary: [],
            readingMinutes: 10,
          },
        ],
      };
    },
  };

  const readings = await generateReadings(provider, factPack);

  assert.deepEqual(readings.map(({ difficulty }) => difficulty), ["guided", "challenge"]);
  assert.ok(readings.every(({ factPackId }) => factPackId === factPack.id));
});

test("未達 300 字的白話文不得進入文章", async () => {
  const provider = {
    async generate() {
      return {
        readings: ["guided", "challenge"].map((difficulty) => ({
          difficulty,
          textType: "vernacular",
          title: "過短文章",
          hookQuestion: "這篇文章為何不合格？",
          body: [{ id: "p1", text: "不足三百字。" }],
          glossary: [],
          readingMinutes: 5,
        })),
      };
    },
  };

  await assert.rejects(
    generateReadings(provider, factPack),
    (error) => error.code === "vernacular_length_out_of_range",
  );
});

test("第一次篇幅不足時，第二次提示會帶回實際漢字數與安全目標", async () => {
  const prompts = [];
  let calls = 0;
  const makeReading = (difficulty, size) => ({
    difficulty,
    textType: "vernacular",
    title: "海水的刻度",
    hookQuestion: "海平面為何改變？",
    body: [{ id: "p1", text: variedText.repeat(20).slice(0, size) }],
    glossary: [],
    readingMinutes: 8,
  });
  const provider = {
    async generate(receivedPrompt) {
      prompts.push(receivedPrompt);
      calls += 1;
      return calls === 1
        ? {
            readings: [
              makeReading("guided", 180),
              makeReading("challenge", 220),
            ],
          }
        : {
            readings: [
              makeReading("guided", 360),
              makeReading("challenge", 480),
            ],
          };
    },
  };

  const readings = await generateReadings(provider, factPack);

  assert.equal(readings.length, 2);
  assert.match(prompts[1].system, /guided=180個漢字/);
  assert.match(prompts[1].system, /380 到 430 個漢字/);
});

test("衝突事實包與不完整 JSON 不得進入文章", async () => {
  const provider = { async generate() { return { readings: [] }; } };

  await assert.rejects(
    generateReadings(provider, { ...factPack, verificationStatus: "conflicted" }),
    /verified/,
  );
  await assert.rejects(
    generateReadings(provider, factPack),
    (error) => error.code === "reading_collection_invalid",
  );
});
