import { journeyRewardForActiveDay } from "./journey-progression.js";

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
  mainlineReward = true,
  activeDay = 1,
}) {
  if (
    repeatedSameDay ||
    !mainlineReward ||
    !completed ||
    !evidenceSubmitted
  ) {
    return {
      inkBricks: 0,
      fellowshipSeals: 0,
      baseEarned: false,
      rewardType: "collection",
    };
  }
  const journeyReward = journeyRewardForActiveDay(activeDay);
  return {
    inkBricks: journeyReward.inkBricks,
    fellowshipSeals: journeyReward.fellowshipSeals,
    baseEarned: true,
    rewardType: journeyReward.type,
    rewardTitle: journeyReward.title,
  };
}

export function investInBuilding(
  state,
  { buildingId, readingId, date, inkBricks, knowledge = null },
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

  const previousStage = state.city.buildings[buildingId] ?? 0;
  if (previousStage >= 5) {
    throw new Error("building already reached maximum stage");
  }
  state.city.materials.inkBricks -= inkBricks;
  const stage = Math.min(5, previousStage + 1);
  state.city.buildings[buildingId] = stage;
  state.city.investments.push({
    buildingId,
    readingId,
    date,
    inkBricks,
    stage,
    knowledge:
      knowledge &&
      typeof knowledge.title === "string" &&
      typeof knowledge.evidence === "string" &&
      ["world", "science", "humanities"].includes(knowledge.category) &&
      ["comprehension", "inference", "evidence"].includes(knowledge.ability)
        ? {
            title: knowledge.title.trim(),
            category: knowledge.category,
            evidence: knowledge.evidence.trim(),
            ability: knowledge.ability,
          }
        : null,
  });
  return { buildingId, stage, inkBricks };
}
