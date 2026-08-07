const LEVEL_LIMITS = Object.freeze({
  launch: Object.freeze({
    vernacularMin: 300,
    vernacularMax: 600,
    classicalMin: 300,
    classicalMax: 900,
  }),
  voyage: Object.freeze({
    vernacularMin: 700,
    vernacularMax: 1_000,
    classicalMin: 400,
    classicalMax: 900,
  }),
  tower: Object.freeze({
    vernacularMin: 1_300,
    vernacularMax: 1_700,
    classicalMin: 500,
    classicalMax: 900,
  }),
});

export function manualProfileLimits(level) {
  const limits = LEVEL_LIMITS[level];
  if (!limits) throw new TypeError(`不支援的閱讀階段：${level}`);
  return {
    ...limits,
    // 文言文仍維持最多 900 字與 8–15 則註解；較短階段只逐級降低
    // 正文下限，讓啟航與行舟不被登樓的 500 字門檻錯誤排除。
    classicalGlossaryMin: 8,
    classicalGlossaryMax: 15,
  };
}

export function manualLengthRule(level) {
  const limits = manualProfileLimits(level);
  return `白話文 ${limits.vernacularMin}～${limits.vernacularMax} 個漢字；文言文 ${limits.classicalMin}～${limits.classicalMax} 個漢字，並附 8～15 則註解`;
}
