function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function listActiveDays(completedReadings = {}) {
  return [
    ...new Set(
      Object.values(completedReadings)
        .map(({ date } = {}) => date)
        .filter(validDate),
    ),
  ].sort();
}

export function countActiveDays(completedReadings = {}) {
  return listActiveDays(completedReadings).length;
}

export function listHistoryActiveDays(history = []) {
  return [
    ...new Set(
      history
        .map(({ date } = {}) => date)
        .filter(validDate),
    ),
  ].sort();
}

export function countHistoryActiveDays(history = []) {
  return listHistoryActiveDays(history).length;
}

export function resolveChapterProgress(completedReadings = {}) {
  const totalActiveDays = countActiveDays(completedReadings);
  return chapterProgress(totalActiveDays);
}

export function resolveHistoryChapterProgress(history = []) {
  return chapterProgress(countHistoryActiveDays(history));
}

function chapterProgress(totalActiveDays) {
  return Object.freeze({
    activeDay: Math.min(totalActiveDays, 30),
    totalActiveDays,
    nextSeasonUnlocked: totalActiveDays >= 30,
    resetCity: false,
  });
}
