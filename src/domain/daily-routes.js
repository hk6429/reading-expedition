import { normalizeReadingLevel } from "./reading-level.js";

const CATEGORY_ORDER = ["world", "science", "humanities"];

function readingLevel(reading) {
  return normalizeReadingLevel(reading.level ?? "tower");
}

export function groupDailyRoutes(
  readings,
  { level = "launch", supportMode = "guided" } = {},
) {
  const selectedLevel = normalizeReadingLevel(level);
  return CATEGORY_ORDER.map((category) => {
    const candidates = readings.filter(
      (reading) =>
        reading.category === category &&
        readingLevel(reading) === selectedLevel,
    );
    const reading =
      candidates.find((candidate) => candidate.supportMode === supportMode) ??
      candidates[0] ??
      null;
    return { category, reading };
  }).filter(({ reading }) => reading);
}
