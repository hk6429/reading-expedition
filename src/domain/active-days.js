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

export function resolveChapterProgress(completedReadings = {}) {
  const totalActiveDays = countActiveDays(completedReadings);
  return Object.freeze({
    activeDay: Math.min(totalActiveDays, 30),
    totalActiveDays,
    nextSeasonUnlocked: totalActiveDays >= 30,
    resetCity: false,
  });
}
