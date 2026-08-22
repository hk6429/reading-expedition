import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [student, teacher, styles] = await Promise.all([
  readFile(new URL("../../src/ui/class-view.js", import.meta.url), "utf8"),
  readFile(
    new URL("../../src/ui/classroom-management.js", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../../styles.css", import.meta.url), "utf8"),
]);

test("學生共同任務提供匿名投票、輪替角色、拼圖與結束單", () => {
  for (const phrase of [
    "有效閱讀定義",
    "引導路線",
    "獨立路線",
    "探路",
    "查證",
    "整理",
    "匿名投票",
    "匿名觀點",
    "拼圖閱讀",
    "共同達標",
  ]) {
    assert.match(student, new RegExp(phrase));
  }
  assert.match(student, /\/api\/v1\/classrooms\/vote/);
  assert.match(student, /authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(student, /textarea|contenteditable/i);
});

test("G058/G060 群體分布受隱私門檻保護，結束單可匿名送出", () => {
  assert.match(student, /匿名投票結果/);
  assert.match(student, /匿名觀點牆/);
  assert.match(student, /voteDistribution/);
  assert.match(student, /exitDistribution/);
  assert.match(student, /\/api\/v1\/classrooms\/exit/);
  assert.match(student, /body: JSON\.stringify\(\{ code \}\)/);
  assert.match(student, /保留選擇，可以稍後重試/);
});

test("G062 共同達標動畫以匿名任務鍵保證只播放一次", () => {
  assert.match(student, /classMissionCelebrationKey/);
  assert.match(student, /storage\.getItem\(celebrationKey\)/);
  assert.match(student, /storage\.setItem\(celebrationKey, "seen"\)/);
  assert.match(student, /is-celebrating/);
});

test("教師可設定三種任務、複製匿名深連結並查看聚合介入卡", () => {
  for (const phrase of [
    "共同篇數",
    "類別平衡",
    "能力練習",
    "複製加入連結",
    "匿名能力熱圖",
    "10 分鐘介入卡",
    "學習品質聚合",
    "首次正確率",
    "修正成功率",
    "文證查看率",
    "遷移完成率",
  ]) {
    assert.match(teacher, new RegExp(phrase));
  }
  assert.match(
    teacher,
    /`\/api\/v1\/teacher\/classrooms\/\$\{classroomId\}\/mission`/,
  );
  assert.match(teacher, /method: "POST"/);
  assert.match(teacher, /"x-csrf-token": getCsrfToken\(\)/);
});

test("G067 教師可只列印十分鐘介入卡", () => {
  assert.match(teacher, /data-print-intervention/);
  assert.match(teacher, /列印介入卡/);
  assert.match(teacher, /window\.print\(\)/);
  assert.match(
    styles,
    /@media print[\s\S]*body\.is-printing-intervention \*[\s\S]*visibility:\s*hidden[\s\S]*\.class-mission__intervention\.is-print-target[\s\S]*visibility:\s*visible/,
  );
});

test("G069 教師指派提供文章、能力、等價路線與無壓力期限", () => {
  for (const phrase of [
    "指派閱讀任務",
    "選擇文章",
    "練習能力",
    "引導路線",
    "獨立路線",
    "兩者等價",
    "日期期限",
    "無期限",
    "不扣分",
    "不倒數",
    "不歸零",
  ]) {
    assert.match(teacher, new RegExp(phrase));
  }
  assert.match(
    teacher,
    /`\/api\/v1\/teacher\/classrooms\/\$\{classroomId\}\/assignment`/,
  );
  assert.match(teacher, /body: JSON\.stringify\(assignment\)/);
  assert.doesNotMatch(teacher, /<textarea|contenteditable/i);
});

test("共同任務 UI 有隱私門檻、ARIA、44px 點擊區與減少動畫契約", () => {
  assert.match(student, /privacyProtected/);
  assert.match(student, /aria-live/);
  assert.match(student, /aria-pressed/);
  assert.match(student, /prefers-reduced-motion/);
  assert.match(styles, /\.class-mission/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});
