import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
const plan = await readFile(
  new URL("../../docs/gamification-100-plan.md", import.meta.url),
  "utf8",
);
const rows = plan
  .split("\n")
  .filter((line) => /^\| G\d{3} \|/.test(line))
  .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

test("遊戲化稽核表恰好列出 G001 至 G100，且 ID 不重複", () => {
  assert.equal(rows.length, 100);
  assert.equal(new Set(rows.map(([id]) => id)).size, 100);
  assert.deepEqual(
    rows.map(([id]) => id),
    Array.from({ length: 100 }, (_, index) =>
      `G${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("最終稽核恰為 96 項完成與 4 項禁止，不得保留模糊狀態", () => {
  assert.doesNotMatch(plan, /⚠️|🛠|⬜/);
  assert.equal(rows.filter(([, status]) => status === "✅").length, 96);
  assert.equal(rows.filter(([, status]) => status === "🚫").length, 4);
  for (const [id, status] of rows) {
    assert.match(status, /^(?:✅|🚫)$/);
    if (["G090", "G091", "G092", "G093"].includes(id)) {
      assert.equal(status, "🚫");
    } else {
      assert.equal(status, "✅");
    }
  }
});

test("每一項都留下至少一個程式證據與一個現存測試證據", () => {
  for (const [id, _status, _requirement, _acceptance, evidence] of rows) {
    const paths = [...evidence.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
    assert.ok(paths.length >= 2, `${id} 至少需要兩個證據路徑`);
    assert.ok(
      paths.some((path) => !/^(?:test|tests)\//.test(path)),
      `${id} 缺少程式或文件證據`,
    );
    assert.ok(
      paths.some((path) => /^(?:test|tests)\//.test(path)),
      `${id} 缺少測試證據`,
    );
    for (const path of paths) {
      assert.equal(existsSync(resolve(projectRoot, path)), true, `${id} 證據不存在：${path}`);
    }
  }
});
