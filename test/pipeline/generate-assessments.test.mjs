import assert from "node:assert/strict";
import test from "node:test";

import { generateAssessments } from "../../worker/src/pipeline/generate-assessments.js";

const reading = {
  id: "science-guided",
  factPackId: "2026-07-28-science",
  difficulty: "guided",
  body: [{ id: "p1", text: "海水受熱會膨脹，陸地冰融化也會增加海水。" }],
};

function item(type, prompt, correctAnswer, evidenceSpan) {
  const options = [correctAnswer, `${type}誤一`, `${type}誤二`, `${type}誤三`];
  return {
    type,
    prompt,
    options,
    correctAnswer,
    rationale: "依正文線索可判斷。",
    distractorReasons: Object.fromEntries(
      options.slice(1).map((option, index) => [
        option,
        `這是第 ${index + 1} 種常見誤讀。`,
      ]),
    ),
    evidenceSpan,
  };
}

test("每題有唯一答案、干擾理由及發布文本內的文證", async () => {
  const provider = {
    async generate() {
      return {
        items: [
          item(
            "comprehension",
            "海水受熱會如何？",
            "膨脹",
            {
              paragraph: 1,
              start: 0,
              end: 7,
              text: "海水受熱會膨脹",
            },
          ),
          item(
            "inference",
            "依文章推論，哪些因素會增加海水？",
            "受熱與陸冰融化",
            {
              paragraph: 1,
              start: 0,
              end: 19,
              text: "海水受熱會膨脹，陸地冰融化也會增加海水",
            },
          ),
          item(
            "evidence",
            "哪一段可支持前述推論？",
            "第一段",
            {
              paragraph: 1,
              start: 0,
              end: 19,
              text: "海水受熱會膨脹，陸地冰融化也會增加海水",
            },
          ),
        ],
      };
    },
  };

  const items = await generateAssessments(provider, reading);

  assert.equal(items[0].correctAnswer, "膨脹");
  assert.equal(items[0].evidenceSpan.text, "海水受熱會膨脹");
});

test("模型提供錯誤文證座標時，以發布正文的逐字位置重新定位", async () => {
  const provider = {
    async generate() {
      return {
        items: ["comprehension", "inference", "evidence"].map((type) =>
          item(type, `${type}題`, `${type}答案`, {
            paragraph: 9,
            start: 99,
            end: 120,
            text: "陸地冰融化",
          }),
        ),
      };
    },
  };

  const items = await generateAssessments(provider, reading);

  assert.deepEqual(items[0].evidenceSpan, {
    paragraph: 1,
    start: 8,
    end: 13,
    text: "陸地冰融化",
  });
});

test("模型以選項代號回覆正解時，正規化為完整選項文字", async () => {
  const provider = {
    async generate() {
      return {
        items: ["comprehension", "inference", "evidence"].map((type) => ({
          ...item(type, `${type}題`, `${type}答案`, {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
          correctAnswer: "A",
        })),
      };
    },
  };

  const items = await generateAssessments(provider, reading);

  assert.equal(items[0].correctAnswer, "comprehension答案");
});

test("模型以選項代號作為干擾理由鍵時，正規化為完整選項文字", async () => {
  const provider = {
    async generate() {
      return {
        items: ["comprehension", "inference", "evidence"].map((type) => {
          const generated = item(type, `${type}題`, `${type}答案`, {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          });
          generated.distractorReasons = {
            B: "只看到局部訊息。",
            C: "加入文章沒有的推論。",
            D: "倒置正文的因果。",
          };
          return generated;
        }),
      };
    },
  };

  const items = await generateAssessments(provider, reading);

  assert.equal(
    items[0].distractorReasons.comprehension誤一,
    "只看到局部訊息。",
  );
});

test("模型以正解索引與四格理由陣列輸出時，轉為學生題組格式", async () => {
  const provider = {
    async generate() {
      return {
        items: ["comprehension", "inference", "evidence"].map((type) => {
          const generated = item(type, `${type}題`, `${type}答案`, {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          });
          delete generated.correctAnswer;
          generated.correctIndex = 0;
          generated.distractorReasons = [
            "這是正文直接支持的答案。",
            "只看到局部訊息。",
            "加入文章沒有的推論。",
            "倒置正文的因果。",
          ];
          return generated;
        }),
      };
    },
  };

  const items = await generateAssessments(provider, reading);

  assert.equal(items[0].correctAnswer, "comprehension答案");
  assert.equal("correctIndex" in items[0], false);
  assert.equal(
    items[0].distractorReasons.comprehension誤三,
    "倒置正文的因果。",
  );
});

test("模型重複干擾理由時，以三種固定誤讀診斷補正", async () => {
  const provider = {
    async generate() {
      return {
        items: ["comprehension", "inference", "evidence"].map((type) => {
          const generated = item(type, `${type}題`, `${type}答案`, {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          });
          generated.distractorReasons = Object.fromEntries(
            generated.options.slice(1).map((option) => [option, "理由相同"]),
          );
          return generated;
        }),
      };
    },
  };

  const items = await generateAssessments(provider, reading);
  const reasons = Object.values(items[0].distractorReasons);

  assert.equal(new Set(reasons).size, 3);
  assert.match(reasons[0], /局部訊息/);
  assert.match(reasons[1], /文證不足/);
  assert.match(reasons[2], /因果/);
});

test("空白題幹、空白解析或套版干擾理由會被拒絕", async () => {
  const provider = {
    async generate() {
      return {
        items: ["comprehension", "inference", "evidence"].map((type) => ({
          ...item(type, " ", "答案", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
          rationale: " ",
          distractorReasons: {
            [`${type}誤一`]: "同一句套版理由",
            [`${type}誤二`]: "同一句套版理由",
            [`${type}誤三`]: "同一句套版理由",
          },
        })),
      };
    },
  };

  await assert.rejects(
    generateAssessments(provider, reading),
    (error) => error.code === "assessment_structure_invalid",
  );
});

test("重複答案或不在發布文字內的文證會被拒絕", async () => {
  const provider = {
    async generate() {
      return {
        items: [
          {
            type: "evidence",
            prompt: "哪一句是文證？",
            options: ["同一答案", "同一答案"],
            correctAnswer: "同一答案",
            rationale: "理由",
            distractorReasons: {},
            evidenceSpan: { paragraph: 1, start: 0, end: 4, text: "不存在" },
          },
        ],
      };
    },
  };

  await assert.rejects(
    generateAssessments(provider, reading),
    (error) => error.code === "assessment_collection_invalid",
  );
});

test("題組必須依序包含三種能力且每題固定四選一", async () => {
  const provider = {
    async generate() {
      return {
        items: [
          item("comprehension", "題一", "答案一", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
          item("evidence", "順序錯誤", "答案二", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
          item("inference", "順序錯誤", "答案三", {
            paragraph: 1,
            start: 0,
            end: 7,
            text: "海水受熱會膨脹",
          }),
        ],
      };
    },
  };

  await assert.rejects(
    generateAssessments(provider, reading),
    (error) => error.code === "assessment_types_invalid",
  );
});
