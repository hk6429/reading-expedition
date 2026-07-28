export const STORY_ACTIVE_DAYS = Object.freeze([
  3, 5, 7, 10, 14, 17, 21, 24, 27, 30,
]);

const STORY_TITLES = Object.freeze({
  3: "三路航圖解鎖",
  5: "第一盞義燈故事",
  7: "首週文證回顧",
  10: "真假潮痕故事",
  14: "明辨航程回顧",
  17: "公平之橋故事",
  21: "班級聚義任務",
  24: "萬卷相連故事",
  27: "未來義燈故事",
  30: "下一航圖解鎖",
});

export function journeyRewardForActiveDay(activeDay) {
  if (!Number.isInteger(activeDay) || activeDay < 1 || activeDay > 30) {
    throw new TypeError("active day must be between 1 and 30");
  }
  if (STORY_ACTIVE_DAYS.includes(activeDay)) {
    return Object.freeze({
      activeDay,
      type: "story",
      inkBricks: 0,
      fellowshipSeals: 1,
      title: STORY_TITLES[activeDay],
    });
  }
  return Object.freeze({
    activeDay,
    type: "building",
    inkBricks: 5,
    fellowshipSeals: 0,
    title: "修築浮城",
  });
}
