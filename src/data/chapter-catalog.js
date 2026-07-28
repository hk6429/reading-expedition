const TITLES = Object.freeze([
  "墨海來潮", "無字航圖", "三路分流", "行舟與登樓", "第一盞義燈",
  "神行急報", "百步摘句", "真假潮痕", "數字有腳", "誰在說話",
  "因果繩結", "舊聞新衣", "缺角的地圖", "明辨樓成", "眾聲入港",
  "交換一盞燈", "不同的公平", "看見沉默者", "共守一口井", "遠方的鄰人",
  "聚義成橋", "回看來時路", "把疑問留下", "一卷連一卷", "知識入城",
  "修築自己的路", "為未來留燈", "新航圖展開", "萬卷同流", "浮城啟航",
]);

function phaseFor(activeDay) {
  if (activeDay <= 7) return "安家";
  if (activeDay <= 14) return "明辨";
  if (activeDay <= 21) return "聚義";
  return "開城";
}

export const chapterCatalog = Object.freeze(
  TITLES.map((title, index) => {
    const activeDay = index + 1;
    const phase = phaseFor(activeDay);
    return Object.freeze({
      id: `chapter-${String(activeDay).padStart(2, "0")}`,
      activeDay,
      phase,
      title,
      story: `第${activeDay}個活躍日，把今日文證帶回${phase}航程。`,
      review: [7, 14, 21, 30].includes(activeDay),
      skippable: true,
      blocksReading: false,
    });
  }),
);

export function chapterForActiveDay(activeDay) {
  const safeDay = Math.min(Math.max(Number(activeDay) || 1, 1), 30);
  return chapterCatalog[safeDay - 1];
}
