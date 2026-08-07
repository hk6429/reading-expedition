import { normalizeReadingLevel } from "./reading-level.js";

const CATEGORY_ORDER = ["world", "science", "humanities"];

function readingLevel(reading) {
  return normalizeReadingLevel(reading.level ?? "tower");
}

function stableHash(value) {
  let hash = 2_166_136_261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function deterministicCandidate(candidates, seed, category) {
  if (candidates.length === 0) return null;
  const ordered = [...candidates].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  return ordered[stableHash(`${seed}:${category}`) % ordered.length];
}

export function groupDailyRoutes(
  readings,
  {
    level = "launch",
    supportMode = "guided",
    completedIds = [],
    selectionSeed = "",
  } = {},
) {
  const selectedLevel = normalizeReadingLevel(level);
  const completed = new Set(completedIds);
  const completedTopics = new Set(
    readings
      .filter(({ id }) => completed.has(id))
      .map((reading) => reading.contentKey || reading.id),
  );
  return CATEGORY_ORDER.map((category) => {
    const candidates = readings.filter(
      (reading) =>
        reading.category === category &&
        readingLevel(reading) === selectedLevel &&
        !completedTopics.has(reading.contentKey || reading.id),
    );
    const preferred = candidates.filter(
      (candidate) => candidate.supportMode === supportMode,
    );
    const reading = deterministicCandidate(
      preferred.length > 0 ? preferred : candidates,
      selectionSeed,
      category,
    );
    return { category, reading };
  }).filter(({ reading }) => reading);
}
