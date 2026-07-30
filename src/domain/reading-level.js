export const LEVEL_ORDER = Object.freeze(["launch", "voyage", "tower"]);

export const READING_LEVELS = Object.freeze({
  launch: Object.freeze({
    label: "啟航",
    description: "300–600 字，短句與具體線索較多",
    minCharacters: 300,
    maxCharacters: 600,
  }),
  voyage: Object.freeze({
    label: "行舟",
    description: "700–1,000 字，練習段落統整與近距離推論",
    minCharacters: 700,
    maxCharacters: 1_000,
  }),
  tower: Object.freeze({
    label: "登樓",
    description: "1,300–1,700 字，跨段整合、觀點比較與文證判斷",
    minCharacters: 1_300,
    maxCharacters: 1_700,
  }),
});

export function normalizeReadingLevel(value) {
  return LEVEL_ORDER.includes(value) ? value : "launch";
}

export function recommendLevelFromPlacement(correctCount) {
  const score = Math.max(0, Math.min(3, Number(correctCount) || 0));
  const recommendedLevel =
    score >= 3 ? "tower" : score >= 2 ? "voyage" : "launch";
  return {
    recommendedLevel,
    unlockedLevels: LEVEL_ORDER,
  };
}

export function recommendNextLevel({
  currentLevel,
  completedCount,
  lastPromptCount = 0,
}) {
  const normalized = normalizeReadingLevel(currentLevel);
  const completed = Math.max(0, Number(completedCount) || 0);
  if (
    normalized === "tower" ||
    completed === 0 ||
    completed % 5 !== 0 ||
    completed <= lastPromptCount
  ) {
    return null;
  }
  const currentIndex = LEVEL_ORDER.indexOf(normalized);
  return {
    currentLevel: normalized,
    suggestedLevel: LEVEL_ORDER[currentIndex + 1],
    promptAt: completed,
  };
}
