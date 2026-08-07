import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { manualProfileLimits } from "../../scripts/manual-content-profile.mjs";
import { evaluateContentProfile } from "../../worker/src/pipeline/content-profile.js";

const root = new URL("../../", import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), "utf8");

test("Codex CLI 手動內容流程不讀取或輸出 OAuth 憑證", () => {
  const generator = read("scripts/generate-manual-content.mjs");
  const packageJson = JSON.parse(read("package.json"));
  assert.match(generator, /codex/);
  assert.match(generator, /--output-schema/);
  assert.match(generator, /--sandbox/);
  assert.match(generator, /read-only/);
  assert.doesNotMatch(
    generator,
    /access[_-]?token|refresh[_-]?token|OPENAI_API_KEY/i,
  );
  assert.equal(
    packageJson.scripts["content:new"],
    "node scripts/generate-manual-content.mjs",
  );
});

test("手動草稿固定待審，29組內容不能通過30組匯入門檻", () => {
  const schema = JSON.parse(
    read("content/manual/content-pack.schema.json"),
  );
  const packageSchema = schema.properties.packages.items.properties;
  assert.equal(packageSchema.publicationStatus.const, "manual_review");
  assert.ok(schema.properties.packages.items.required.includes("level"));
  assert.deepEqual(packageSchema.level.enum, ["launch", "voyage", "tower"]);
  assert.equal(schema.properties.packages.minItems, 2);
  assert.equal(packageSchema.assessment.minItems, 3);

  const incompleteDrafts = fs
    .readdirSync(new URL("content/manual/drafts/", root))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .slice(0, 29)
    .map((name) => `content/manual/drafts/${name}`);
  const result = spawnSync(
    process.execPath,
    [
      "scripts/validate-manual-content.mjs",
      "--require-count",
      "30",
      ...incompleteDrafts,
    ],
    {
      cwd: new URL("../../", import.meta.url),
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /目標為 30/);
});

test("草稿數量與分類配額皆為選配，時段唯一鍵包含 level", () => {
  const validator = read("scripts/validate-manual-content.mjs");
  const batch = read("scripts/generate-manual-batch.mjs");
  const scheduleSlots = fs
    .readdirSync(new URL("content/manual/drafts/", root))
    .filter((name) => name.endsWith(".json"))
    .map((name) =>
      JSON.parse(read(`content/manual/drafts/${name}`)),
    )
    .map(
      (draft) =>
        `${draft.factPack.topicDate}:${draft.factPack.category}:${draft.packages[0].level}:${draft.factPack.version}`,
    );
  assert.match(validator, /world/);
  assert.match(validator, /science/);
  assert.match(validator, /humanities/);
  assert.match(validator, /--category-quota/);
  assert.match(validator, /日期、類別與階段時段重複/);
  assert.doesNotMatch(
    read("scripts/render-manual-sql.mjs"),
    /--require-count/,
  );
  assert.equal(new Set(scheduleSlots).size, scheduleSlots.length);
  assert.match(batch, /concurrency = 3/);
  assert.match(batch, /topics\.json/);
});

test("手動內容依三階段套用白話與文言字數門檻", () => {
  const prompt = read("content/manual/PROMPT.md");
  const validator = read("scripts/validate-manual-content.mjs");
  const generator = read("scripts/generate-manual-content.mjs");

  assert.match(prompt, /\{\{LENGTH_RULE\}\}/);
  assert.match(prompt, /level.*\{\{LEVEL\}\}/);
  assert.deepEqual(manualProfileLimits("launch"), {
    vernacularMin: 300,
    vernacularMax: 600,
    classicalMin: 300,
    classicalMax: 900,
    classicalGlossaryMin: 8,
    classicalGlossaryMax: 15,
  });
  assert.equal(manualProfileLimits("voyage").vernacularMin, 700);
  assert.equal(manualProfileLimits("voyage").vernacularMax, 1_000);
  assert.equal(manualProfileLimits("voyage").classicalMin, 400);
  assert.equal(manualProfileLimits("tower").vernacularMin, 1_300);
  assert.equal(manualProfileLimits("tower").vernacularMax, 1_700);
  assert.equal(manualProfileLimits("tower").classicalMin, 500);
  assert.match(validator, /manualProfileLimits\(reading\.level\)/);
  assert.match(validator, /requireCountIndex < 0/);
  assert.match(generator, /"--search"/);
  assert.match(generator, /"--ignore-user-config"/);
  assert.match(generator, /"--ignore-rules"/);
  assert.match(generator, /model_reasoning_effort="low"/);
  assert.match(generator, /normalizeManualContentFile/);
  const normalizer = read("scripts/manual-content-normalizer.mjs");
  assert.match(normalizer, /normalizeDistractorReasons/);
  assert.match(normalizer, /normalizeEvidenceSpans/);
  assert.match(normalizer, /Math\.min\(span\.text\.length, 30\)/);
  assert.match(normalizer, /Number\.isInteger\(span\.start\)/);

  const schema = JSON.parse(
    read("content/manual/content-pack.schema.json"),
  );
  const reasons =
    schema.properties.packages.items.properties.assessment.items.properties
      .distractorReasons;
  assert.equal(reasons.type, "array");
  assert.equal(reasons.minItems, 4);
  assert.equal(reasons.maxItems, 4);
});

test("三階段白話與文言正文會由實際漢字數驗證", () => {
  const base = "天地玄黃宇宙洪荒日月盈昃辰宿列張寒來暑往秋收冬藏";
  const hanText = (length) =>
    base.repeat(Math.ceil(length / base.length)).slice(0, length);
  for (const level of ["launch", "voyage", "tower"]) {
    const limits = manualProfileLimits(level);
    const vernacular = {
      textType: "vernacular",
      body: [hanText(limits.vernacularMin)],
      glossary: [],
    };
    assert.equal(evaluateContentProfile(vernacular, limits).ok, true);
    assert.equal(
      evaluateContentProfile(
        { ...vernacular, body: [hanText(limits.vernacularMin - 1)] },
        limits,
      ).ok,
      false,
    );
    const classicalText = hanText(limits.classicalMin);
    const classical = {
      textType: "classical",
      body: [classicalText],
      glossary: [...new Set([...classicalText])]
        .slice(0, 8)
        .map((term) => ({ term, definition: `${term}的語境義` })),
    };
    assert.equal(evaluateContentProfile(classical, limits).ok, true);
    assert.equal(
      evaluateContentProfile(
        { ...classical, body: [hanText(limits.classicalMin - 1)] },
        limits,
      ).ok,
      false,
    );
  }
});

test("SQL renderer 對三階段都寫入 level 並由 difficulty 推導模式", () => {
  const source = JSON.parse(read("test/fixtures/seed-reading-package.json"));
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reading-level-sql-"));
  const files = ["launch", "voyage", "tower"].map((level) => {
    const fixture = structuredClone(source);
    fixture.contentKey = `${level}-fixture`;
    fixture.factPack.id = `${level}-fact`;
    for (const reading of fixture.packages) reading.level = level;
    const file = path.join(directory, `${level}.json`);
    fs.writeFileSync(file, JSON.stringify(fixture));
    return file;
  });
  const rendered = spawnSync(
    process.execPath,
    ["scripts/render-seed-sql.mjs", ...files],
    { cwd: new URL("../../", import.meta.url), encoding: "utf8" },
  );

  assert.equal(rendered.status, 0, rendered.stderr);
  assert.match(rendered.stdout, /reading_level, support_mode/);
  for (const level of ["launch", "voyage", "tower"]) {
    assert.match(rendered.stdout, new RegExp(`'${level}'`));
  }
  assert.match(rendered.stdout, /'guided'/);
  assert.match(rendered.stdout, /'independent'/);
});

test("SQL 匯入以來源網址解析既有來源 ID，避免共用網域造成外鍵失敗", () => {
  const renderer = read("scripts/render-seed-sql.mjs");
  assert.match(
    renderer,
    /SELECT id FROM sources WHERE base_url = \$\{value\(fixture\.source\.baseUrl\)\}/,
  );
  assert.match(renderer, /reading_level, support_mode/);
  assert.match(renderer, /reading\.difficulty === "guided" \? "guided" : "independent"/);
  assert.match(
    renderer,
    /WHERE base_url = \$\{value\(fixture\.source\.baseUrl\)\}/,
  );
  assert.match(
    renderer,
    /reading\.publicationStatus === "manual_review"[\s\S]*\? "review"/,
  );
  assert.match(renderer, /outputIndex < 0/);
});

test("題目清單含三階段各100筆，slug全域唯一且文言文不超過一成", () => {
  const topics = JSON.parse(read("content/manual/topics.json"));
  assert.equal(topics.length, 300);
  assert.equal(new Set(topics.map(({ slug }) => slug)).size, 300);
  for (const topic of topics) {
    assert.match(topic.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(topic.preferredSource, /^https:\/\//);
    assert.ok(["launch", "voyage", "tower"].includes(topic.level));
  }
  for (const level of ["launch", "voyage", "tower"]) {
    const levelTopics = topics.filter((topic) => topic.level === level);
    assert.equal(levelTopics.length, 100);
    assert.deepEqual(
      Object.fromEntries(
        ["world", "science", "humanities"].map((category) => [
          category,
          levelTopics.filter((topic) => topic.category === category).length,
        ]),
      ),
      { world: 34, science: 33, humanities: 33 },
    );
  }
  const classical = topics.filter(({ textType }) => textType === "classical");
  assert.ok(classical.length <= 30);
  assert.ok(classical.every(({ level }) => level !== "launch"));
});
