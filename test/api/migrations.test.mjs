import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../../", import.meta.url);

test("D1 migration 鎖住來源、發布版本與稽核事件", async () => {
  const [contentSql, reviewSql, classSql] = await Promise.all([
    readFile(new URL("migrations/0001_content.sql", projectRoot), "utf8"),
    readFile(new URL("migrations/0002_review.sql", projectRoot), "utf8"),
    readFile(new URL("migrations/0003_class_aggregate.sql", projectRoot), "utf8"),
  ]);
  const sql = `${contentSql}\n${reviewSql}\n${classSql}`;

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
});
