import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { evaluateContentProfile } from "../../worker/src/pipeline/content-profile.js";
import { validateAssessmentAnswers } from "../../worker/src/pipeline/answer-validator.js";

const fixtureNames = [
  "seed-reading-package.json",
  "seed-science-reading-package.json",
  "seed-humanities-reading-package.json",
];

const fixtures = fixtureNames.map((name) =>
  JSON.parse(
    fs.readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8"),
  ),
);

test("正式種子文章符合白話篇幅或國中文言注釋規格", () => {
  const packages = fixtures.flatMap((fixture) => fixture.packages);
  assert.ok(packages.some(({ textType }) => textType === "vernacular"));
  assert.ok(packages.some(({ textType }) => textType === "classical"));
  for (const packageRecord of packages) {
    assert.deepEqual(
      evaluateContentProfile(packageRecord).reasons,
      [],
      packageRecord.id,
    );
  }
});

test("正式題組依會考閱讀歷程提供三題四選一", () => {
  for (const packageRecord of fixtures.flatMap((fixture) => fixture.packages)) {
    assert.deepEqual(
      packageRecord.assessment.map(({ type }) => type),
      ["comprehension", "inference", "evidence"],
      packageRecord.id,
    );
    for (const item of packageRecord.assessment) {
      assert.equal(item.options.length, 4, item.id);
      assert.equal(
        item.options.filter((option) => option === item.correctAnswer).length,
        1,
        item.id,
      );
      assert.equal(
        Object.keys(item.distractorReasons).length,
        3,
        item.id,
      );
    }
  }
});

test("正式題組的文證必須是正文內 8 到 30 字的精準錨點", () => {
  for (const packageRecord of fixtures.flatMap((fixture) => fixture.packages)) {
    assert.deepEqual(
      validateAssessmentAnswers(
        packageRecord,
        packageRecord.assessment,
      ),
      { ok: true, errors: [] },
      packageRecord.id,
    );
  }
});

test("找證據題比較引文的支持力，不以段號當作選項", () => {
  for (const packageRecord of fixtures.flatMap((fixture) => fixture.packages)) {
    const evidenceItem = packageRecord.assessment.find(
      ({ type }) => type === "evidence",
    );
    assert.ok(evidenceItem, packageRecord.id);
    assert.ok(
      evidenceItem.options.every(
        (option) => !/^第[一二三四五六七八九十\\d]+段$/.test(option),
      ),
      packageRecord.id,
    );
    assert.ok(
      evidenceItem.options.every(
        (option) => option.length >= 8 && option.length <= 32,
      ),
      packageRecord.id,
    );
  }
});

test("干擾選項避免用絕對化語氣讓學生直接排除", () => {
  const absoluteShortcuts =
    /必然|唯一|永遠|一定|全部|只能|不必|完全相同|只要.+就/;
  for (const packageRecord of fixtures.flatMap((fixture) => fixture.packages)) {
    for (const item of packageRecord.assessment) {
      const distractors = item.options.filter(
        (option) => option !== item.correctAnswer,
      );
      for (const distractor of distractors) {
        assert.doesNotMatch(distractor, absoluteShortcuts, item.id);
      }
    }
  }
});

test("登樓卷的推論題以新情境要求跨段整合", () => {
  for (const packageRecord of fixtures
    .flatMap((fixture) => fixture.packages)
    .filter(({ difficulty }) => difficulty === "challenge")) {
    const inferenceItem = packageRecord.assessment.find(
      ({ type }) => type === "inference",
    );
    assert.ok(inferenceItem, packageRecord.id);
    assert.match(inferenceItem.prompt, /某|若|發現|面對/, packageRecord.id);
    assert.ok(
      packageRecord.body.every((paragraph) => {
        const text =
          typeof paragraph === "string" ? paragraph : paragraph?.text ?? "";
        return !text.includes(inferenceItem.correctAnswer);
      }),
      `${packageRecord.id} 的正解不應只是單段原句`,
    );
  }
});

test("自編文言讀卷清楚標示正文與參考資料的關係", () => {
  for (const packageRecord of fixtures
    .flatMap((fixture) => fixture.packages)
    .filter(({ textType }) => textType === "classical")) {
    assert.ok(
      packageRecord.sourceAttribution.some(
        ({ relationship, note }) =>
          relationship === "reference" && /自編/.test(note),
      ),
      packageRecord.id,
    );
  }
});

test("生成提示寫明會考學測能力層次且禁止複製考題", () => {
  const prompt = fs.readFileSync(
    new URL("../../worker/src/pipeline/prompt-boundary.js", import.meta.url),
    "utf8",
  );
  const assessment = fs.readFileSync(
    new URL("../../worker/src/pipeline/generate-assessments.js", import.meta.url),
    "utf8",
  );
  assert.match(prompt, /國中教育會考與學測/);
  assert.match(prompt, /不得複製或改寫歷屆考題/);
  assert.match(assessment, /擷取與理解/);
  assert.match(assessment, /比較統整與推論/);
  assert.match(assessment, /文證判讀與評鑑/);
});
