import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardSource = await readFile(
  new URL("../../src/ui/mission-dashboard.js", import.meta.url),
  "utf8",
);
const homeSource = await readFile(
  new URL("../../src/ui/home-view.js", import.meta.url),
  "utf8",
);
const citySource = await readFile(
  new URL("../../src/ui/city-overview.js", import.meta.url),
  "utf8",
);

test("首頁任務板涵蓋序章、個人化選擇、續讀與可休息契約", () => {
  for (const phrase of [
    "任務序章",
    "略過序章",
    "第一步：閱讀",
    "第二步：找文證",
    "第三步：建城",
    "探索者",
    "偵察者",
    "策展者",
    "找主旨",
    "推論",
    "找文證",
    "5 分鐘",
    "10 分鐘",
    "15 分鐘",
    "內容類別",
    "接著讀",
    "上次讀到第",
    "今天先休息",
    "隨時更改",
    "不會歸零",
    "不設公開排名",
  ]) {
    assert.match(dashboardSource, new RegExp(phrase));
  }
  assert.match(homeSource, /createMissionDashboard/);
  assert.match(homeSource, /readingProgress/);
});

test("浮城任務板呈現確定獎勵、能力裝備、故事與長期精熟契約", () => {
  for (const phrase of [
    "下一個確定獎勵",
    "怎麼使用這件裝備",
    "故事解鎖預覽",
    "故事檔案",
    "城市名稱",
    "晨曦紙城",
    "森綠書城",
    "星夜墨城",
    "知識房間",
    "第二航季",
    "精熟徽章",
    "匯出學習作品集",
  ]) {
    assert.match(dashboardSource, new RegExp(phrase));
  }
  assert.match(citySource, /createMissionDashboard/);
  assert.match(dashboardSource, /dataset\.knowledgeRoom/);
  assert.match(dashboardSource, /世界知識房/);
  assert.match(dashboardSource, /科學知識房/);
  assert.match(dashboardSource, /人文知識房/);
});

test("所有互動選擇都提供鍵盤可用的按鈕與 ARIA 狀態", () => {
  assert.match(dashboardSource, /button\.type = "button"/);
  assert.match(dashboardSource, /aria-pressed/);
  assert.match(dashboardSource, /role", "progressbar"/);
  assert.match(dashboardSource, /aria-live/);
  assert.doesNotMatch(dashboardSource, /leaderboard|loot box|抽卡|隨機獎勵/);
});
