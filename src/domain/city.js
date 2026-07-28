const BUILDING_IDS = Object.freeze([
  "library",
  "strategyTower",
  "craftHarbor",
  "worldPost",
]);

export function rewardVerifiedReading({
  completed,
  evidenceSubmitted,
  correctCount,
  revisedCount,
  repeatedSameDay,
}) {
  if (repeatedSameDay || !completed || !evidenceSubmitted) {
    return { inkBricks: 0, baseEarned: false };
  }
  return {
    inkBricks: 5,
    baseEarned: true,
  };
}

export function investInBuilding(
  state,
  { buildingId, readingId, date, inkBricks },
) {
  if (!BUILDING_IDS.includes(buildingId)) {
    throw new TypeError("unknown building");
  }
  if (
    state.city.investments.some(
      (investment) =>
        investment.readingId === readingId && investment.date === date,
    )
  ) {
    throw new Error("reading already invested today");
  }
  if (!Number.isInteger(inkBricks) || inkBricks < 1) {
    throw new TypeError("inkBricks must be a positive integer");
  }
  if (state.city.materials.inkBricks < inkBricks) {
    throw new Error("not enough ink bricks");
  }

  state.city.materials.inkBricks -= inkBricks;
  const previousStage = state.city.buildings[buildingId] ?? 0;
  const stage = Math.min(5, previousStage + 1);
  state.city.buildings[buildingId] = stage;
  state.city.investments.push({
    buildingId,
    readingId,
    date,
    inkBricks,
    stage,
  });
  return { buildingId, stage, inkBricks };
}
