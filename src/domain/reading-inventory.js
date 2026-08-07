import { normalizeReadingLevel } from "./reading-level.js";

function topicKey(reading) {
  return reading.contentKey || reading.id;
}

export function buildReadingInventory(
  readings,
  completedReadings = {},
  { level = "launch", supportMode = "guided", unreadOnly = false } = {},
) {
  const selectedLevel = normalizeReadingLevel(level);
  const groups = new Map();
  for (const reading of readings) {
    if (normalizeReadingLevel(reading.level ?? "tower") !== selectedLevel) {
      continue;
    }
    const key = topicKey(reading);
    const group = groups.get(key) ?? [];
    group.push(reading);
    groups.set(key, group);
  }

  const entries = [...groups.values()]
    .map((group) => {
      const completedVariant = group.find(
        ({ id }) => completedReadings[id],
      );
      const preferredVariant = group.find(
        ({ supportMode: mode }) => mode === supportMode,
      );
      const reading = preferredVariant ?? completedVariant ?? group[0];
      return {
        reading,
        completionReadingId: completedVariant?.id ?? null,
        completion: completedVariant
          ? completedReadings[completedVariant.id]
          : null,
      };
    })
    .sort((left, right) =>
      left.reading.title.localeCompare(right.reading.title, "zh-Hant"),
    );
  const completedCount = entries.filter(({ completion }) => completion).length;

  return {
    level: selectedLevel,
    totalCount: entries.length,
    completedCount,
    allCompleted: entries.length > 0 && completedCount === entries.length,
    entries: unreadOnly
      ? entries.filter(({ completion }) => !completion)
      : entries,
  };
}

export function nextUnreadReading(
  readings,
  completedReadings = {},
  {
    level = "launch",
    supportMode = "guided",
    currentReadingId = "",
  } = {},
) {
  const inventory = buildReadingInventory(readings, completedReadings, {
    level,
    supportMode,
  });
  if (inventory.entries.length === 0 || inventory.allCompleted) return null;
  const currentIndex = inventory.entries.findIndex(
    ({ reading }) => reading.id === currentReadingId,
  );
  for (let offset = 1; offset <= inventory.entries.length; offset += 1) {
    const index =
      (Math.max(currentIndex, -1) + offset) % inventory.entries.length;
    const entry = inventory.entries[index];
    if (!entry.completion) return entry.reading;
  }
  return null;
}
