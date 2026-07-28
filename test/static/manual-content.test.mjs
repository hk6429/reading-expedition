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

test("手動草稿固定待審，未滿30組不能產生正式匯入 SQL", () => {
  const schema = JSON.parse(
    read("content/manual/content-pack.schema.json"),
  );
  const packageSchema = schema.properties.packages.items.properties;
  assert.equal(packageSchema.publicationStatus.const, "manual_review");
  assert.equal(schema.properties.packages.minItems, 2);
  assert.equal(packageSchema.assessment.minItems, 3);

  const result = spawnSync(
    process.execPath,
    ["scripts/validate-manual-content.mjs", "--require-count", "30"],
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
  assert.match(validator, /world/);
  assert.match(validator, /science/);
  assert.match(validator, /humanities/);
  assert.match(validator, /count !== 10/);
});
