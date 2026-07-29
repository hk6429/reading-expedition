import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

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

test("30組正式內容要求世界、科學、人文各10組", () => {
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
        `${draft.factPack.topicDate}:${draft.factPack.category}:${draft.factPack.version}`,
    );
  assert.match(validator, /world/);
  assert.match(validator, /science/);
  assert.match(validator, /humanities/);
  assert.match(validator, /count !== 10/);
  assert.match(validator, /日期與類別時段重複/);
  assert.equal(new Set(scheduleSlots).size, 30);
  assert.match(batch, /concurrency = 3/);
  assert.match(batch, /topics\.json/);
});

test("手動長文採白話1300至1700字、文言500至900字", () => {
  const prompt = read("content/manual/PROMPT.md");
  const validator = read("scripts/validate-manual-content.mjs");
  const generator = read("scripts/generate-manual-content.mjs");

  assert.match(prompt, /1,300～1,700/);
  assert.match(prompt, /500～900/);
  assert.match(prompt, /8～15 則/);
  assert.match(validator, /vernacularMin: 1300/);
  assert.match(validator, /vernacularMax: 1700/);
  assert.match(validator, /classicalMin: 500/);
  assert.match(validator, /classicalMax: 900/);
  assert.match(validator, /classicalGlossaryMin: 8/);
  assert.match(validator, /classicalGlossaryMax: 15/);
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

test("SQL 匯入以來源網址解析既有來源 ID，避免共用網域造成外鍵失敗", () => {
  const renderer = read("scripts/render-seed-sql.mjs");
  assert.match(
    renderer,
    /SELECT id FROM sources WHERE base_url = \$\{value\(fixture\.source\.baseUrl\)\}/,
  );
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
