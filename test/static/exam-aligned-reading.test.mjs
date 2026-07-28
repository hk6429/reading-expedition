import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { evaluateContentProfile } from "../../worker/src/pipeline/content-profile.js";

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
