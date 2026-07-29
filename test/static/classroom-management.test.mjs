import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("教師校閱臺提供建立、複製、列出與停用班級", () => {
  const review = read("src/ui/review-console.js");
  const manager = read("src/ui/classroom-management.js");

  assert.match(review, /renderClassroomManagement/);
  assert.match(manager, /建立新班級/);
  assert.match(manager, /複製班級碼/);
  assert.match(manager, /停用班級/);
  assert.match(manager, /\/api\/v1\/teacher\/classrooms/);
  assert.match(manager, /"x-csrf-token": getCsrfToken\(\)/);
});

test("班級碼只記在教師分頁，不寫入長期本機資料或公開畫面", () => {
  const manager = read("src/ui/classroom-management.js");
  const repository = read("worker/src/db/repository.js");

  assert.match(manager, /window\.sessionStorage/);
  assert.doesNotMatch(manager, /localStorage/);
  assert.doesNotMatch(repository, /class_code(?!_hash)/);
  assert.match(repository, /class_code_hash/);
});
