export function backupHealthStatus(recordCount) {
  const count = Number.isInteger(recordCount) ? Math.max(0, recordCount) : 0;
  if (count === 0) {
    return Object.freeze({
      shouldRemind: true,
      milestone: 0,
      message: "還沒有閱讀成果；先知道備份位置即可，這次略過不影響使用。",
    });
  }
  const milestone = count === 1 || count === 5 || count % 10 === 0 ? count : 0;
  return Object.freeze({
    shouldRemind: milestone > 0,
    milestone,
    message: milestone
      ? `本機已累積 ${count} 份有效閱讀成果，可以下載一份作品集備份；稍後處理也不影響閱讀。`
      : `本機已有 ${count} 份有效閱讀成果，目前不需要打斷你提醒備份。`,
  });
}
