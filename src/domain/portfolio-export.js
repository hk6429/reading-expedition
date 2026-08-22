const DATA_DICTIONARY = Object.freeze({
  readingHistory: "已完成的有效閱讀、日期、主題與保留的原文文證。",
  diagnosticHistory: "每次初答、修正、文證查看與能力類型的結構化診斷。",
  completedReadings: "各篇達標狀態與依規則計算的學習成果。",
  abilityMastery: "由診斷紀錄推導的理解、推論與文證能力證據。",
  city: "由有效閱讀推導的本機城市、收藏與故事進度。",
  preferences: "閱讀模式、輔助方式與個人任務選擇。",
});

export function buildPortfolioExport(
  learningState,
  { exportedAt = new Date().toISOString() } = {},
) {
  if (!learningState || typeof learningState !== "object") {
    throw new TypeError("learning state is required");
  }
  if (!Number.isFinite(Date.parse(exportedAt))) {
    throw new TypeError("exportedAt must be an ISO timestamp");
  }
  return Object.freeze({
    kind: "reading-expedition-portfolio",
    version: 1,
    exportedAt,
    dataDictionary: DATA_DICTIONARY,
    privacy: Object.freeze({
      summary:
        "這份作品集由本機產生；下載不會自動上傳。檔案可能含閱讀文證與學習紀錄，請由家庭自行保管。",
      serverUploadRequired: false,
      containsIdentity: false,
      containsAnswerText: false,
    }),
    learningState: structuredClone(learningState),
  });
}

export function unwrapPortfolioExport(value) {
  if (
    value?.kind === "reading-expedition-portfolio" &&
    value?.version === 1 &&
    value.learningState &&
    typeof value.learningState === "object" &&
    !Array.isArray(value.learningState)
  ) {
    return value.learningState;
  }
  return value;
}
