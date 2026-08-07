import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);

test("D1 migration 鎖住來源、發布版本、文體、閱讀策略、家庭護照、分級排程、稽核事件與班級去重", async () => {
  const [contentSql, reviewSql, classSql, textTypeSql, classDedupeSql, strategySql, familySql, levelScheduleSql] = await Promise.all([
    readFile(new URL("migrations/0001_content.sql", projectRoot), "utf8"),
    readFile(new URL("migrations/0002_review.sql", projectRoot), "utf8"),
    readFile(new URL("migrations/0003_class_aggregate.sql", projectRoot), "utf8"),
    readFile(new URL("migrations/0006_reading_text_type.sql", projectRoot), "utf8"),
    readFile(
      new URL(
        "migrations/0007_classroom_contribution_idempotency.sql",
        projectRoot,
      ),
      "utf8",
    ),
    readFile(
      new URL("migrations/0008_reading_strategy.sql", projectRoot),
      "utf8",
    ),
    readFile(
      new URL("migrations/0009_family_passport_and_levels.sql", projectRoot),
      "utf8",
    ),
    readFile(
      new URL("migrations/0010_fact_pack_level_schedule.sql", projectRoot),
      "utf8",
    ),
  ]);
  const sql = `${contentSql}\n${reviewSql}\n${classSql}\n${textTypeSql}\n${classDedupeSql}\n${familySql}`;

  for (const table of [
    "sources",
    "source_items",
    "fact_packs",
    "reading_packages",
    "assessment_items",
    "review_events",
    "teacher_sessions",
    "class_aggregates",
    "pipeline_runs",
    "family_passports",
    "family_sessions",
    "family_children",
    "family_child_states",
  ]) {
    assert.match(sql, new RegExp(`CREATE TABLE ${table}`));
  }

  assert.match(contentSql, /canonical_url TEXT NOT NULL UNIQUE/);
  assert.match(
    contentSql,
    /UNIQUE\s*\(\s*content_key,\s*difficulty,\s*version\s*\)/,
  );
  assert.match(reviewSql, /CREATE TRIGGER review_events_no_update/);
  assert.match(reviewSql, /CREATE TRIGGER review_events_no_delete/);
  assert.match(textTypeSql, /ADD COLUMN text_type TEXT NOT NULL/);
  assert.match(
    textTypeSql,
    /CHECK \(text_type IN \('vernacular', 'classical'\)\)/,
  );
  assert.match(classDedupeSql, /ADD COLUMN content_id/);
  assert.match(
    classDedupeSql,
    /classroom_id,\s*participant_id,\s*content_id/,
  );
  assert.match(strategySql, /ADD COLUMN reading_strategy_json TEXT NOT NULL/);
  assert.match(familySql, /ADD COLUMN reading_level TEXT NOT NULL DEFAULT 'tower'/);
  assert.match(familySql, /ADD COLUMN support_mode TEXT NOT NULL DEFAULT 'independent'/);
  assert.match(familySql, /passport_code_hash TEXT NOT NULL UNIQUE/);
  assert.match(familySql, /state_json TEXT NOT NULL/);
  assert.match(levelScheduleSql, /reading_level TEXT NOT NULL DEFAULT 'tower'/);
  assert.match(
    levelScheduleSql,
    /UNIQUE \(topic_date, category, reading_level, version\)/,
  );
});
