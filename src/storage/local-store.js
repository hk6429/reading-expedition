import {
  LOCAL_SCHEMA_VERSION,
  LOCAL_STORAGE_KEY,
} from "./schema.js";
import {
  createAbilityMastery,
  recordAbilityEvidence,
} from "../domain/ability-mastery.js";
import { rewardVerifiedReading } from "../domain/city.js";
import { unwrapPortfolioExport } from "../domain/portfolio-export.js";
import { assertLearningState } from "./state-validator.js";

export function createDefaultState(deviceId = crypto.randomUUID()) {
  return {
    schemaVersion: LOCAL_SCHEMA_VERSION,
    deviceId,
    readingProgress: {},
    completedReadings: {},
    readingHistory: [],
    city: {
      materials: { inkBricks: 0, fellowshipSeals: 0, starFragments: 0 },
      buildings: {
        library: 0,
        strategyTower: 0,
        craftHarbor: 0,
        worldPost: 0,
      },
      investments: [],
      storyUnlocks: [],
    },
    collections: {
      stars: [],
      tokens: [],
      quotes: [],
    },
    abilityGrowth: {
      comprehension: 0,
      inference: 0,
      evidence: 0,
    },
    abilityMastery: createAbilityMastery(),
    diagnosticHistory: [],
    placement: {
      completed: false,
      correctCount: null,
      recommendedLevel: null,
      completedAt: null,
    },
    preferences: {
      mode: "paper",
      fontScale: 1,
      lineHeight: 1.85,
      reducedMotion: false,
      textures: true,
      muted: true,
      selectedLevel: "launch",
      supportMode: "guided",
      recommendedLevel: null,
      lastLevelPromptCount: 0,
    },
    weeklyGoal: null,
    offlineQueue: [],
  };
}

function historyFromCompletedReadings(completedReadings = {}) {
  const rewardedDates = new Set();
  return Object.entries(completedReadings)
    .map(([readingId, record]) => ({ readingId, ...record }))
    .filter(
      ({ readingId, date }) =>
        typeof readingId === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(date),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ readingId, date, category, evidence }) => {
      const mainlineReward = !rewardedDates.has(date);
      rewardedDates.add(date);
      return {
        id: `${readingId}:${date}`,
        readingId,
        date,
        category: ["world", "science", "humanities"].includes(category)
          ? category
          : "humanities",
        skill: "evidence",
        evidence:
          typeof evidence === "string" && evidence.trim()
            ? evidence.trim()
            : "已完成文證定位",
        mainlineReward,
      };
    });
}

function normalizeState(state) {
  const defaults = createDefaultState(state.deviceId);
  const readingHistory = Array.isArray(state.readingHistory)
    ? state.readingHistory
    : historyFromCompletedReadings(state.completedReadings);
  return {
    ...defaults,
    ...state,
    schemaVersion: LOCAL_SCHEMA_VERSION,
    readingHistory,
    city: {
      ...defaults.city,
      ...state.city,
      materials: {
        ...defaults.city.materials,
        ...state.city?.materials,
      },
      buildings: {
        ...defaults.city.buildings,
        ...state.city?.buildings,
      },
      investments: Array.isArray(state.city?.investments)
        ? state.city.investments
        : [],
      storyUnlocks: Array.isArray(state.city?.storyUnlocks)
        ? state.city.storyUnlocks
        : [],
    },
    collections: {
      ...defaults.collections,
      ...state.collections,
    },
    abilityGrowth: state.abilityGrowth ?? {
      comprehension: 0,
      inference: 0,
      evidence: readingHistory.length,
    },
    abilityMastery: {
      ...defaults.abilityMastery,
      ...state.abilityMastery,
      skills: {
        ...defaults.abilityMastery.skills,
        ...state.abilityMastery?.skills,
      },
      revisionStrength: Array.isArray(
        state.abilityMastery?.revisionStrength,
      )
        ? state.abilityMastery.revisionStrength
        : [],
      unlockedEquipment: Array.isArray(
        state.abilityMastery?.unlockedEquipment,
      )
        ? state.abilityMastery.unlockedEquipment
        : [],
    },
    diagnosticHistory: Array.isArray(state.diagnosticHistory)
      ? state.diagnosticHistory
      : [],
    placement: {
      ...defaults.placement,
      ...state.placement,
    },
    preferences: {
      ...defaults.preferences,
      ...state.preferences,
    },
  };
}

function recomputeImportedState(state) {
  const orderedHistory = [...state.readingHistory].sort(
    (left, right) =>
      left.date.localeCompare(right.date) || left.id.localeCompare(right.id),
  );
  const activeDates = [...new Set(orderedHistory.map(({ date }) => date))];
  const dayForDate = new Map(
    activeDates.map((date, index) => [date, index + 1]),
  );
  const rewardedDates = new Set();
  let earnedInkBricks = 0;
  let earnedFellowshipSeals = 0;
  const rewardByReading = new Map();
  const storyUnlocks = [];

  state.readingHistory = orderedHistory.map((event) => {
    const activeDay = dayForDate.get(event.date);
    const mainlineReward = !rewardedDates.has(event.date) && activeDay <= 30;
    rewardedDates.add(event.date);
    const reward = rewardVerifiedReading({
      completed: true,
      evidenceSubmitted: true,
      repeatedSameDay: false,
      mainlineReward,
      activeDay: Math.min(activeDay, 30),
    });
    earnedInkBricks += reward.inkBricks;
    earnedFellowshipSeals += reward.fellowshipSeals;
    rewardByReading.set(event.readingId, { reward, activeDay });
    if (reward.rewardType === "story") {
      storyUnlocks.push({
        activeDay,
        title: reward.rewardTitle,
        date: event.date,
      });
    }
    return { ...event, mainlineReward };
  });

  state.completedReadings = Object.fromEntries(
    Object.entries(state.completedReadings)
      .filter(([readingId]) => rewardByReading.has(readingId))
      .map(([readingId, record]) => {
        const { reward, activeDay } = rewardByReading.get(readingId);
        return [
          readingId,
          {
            ...record,
            reward: reward.inkBricks,
            rewards: {
              inkBricks: reward.inkBricks,
              fellowshipSeals: reward.fellowshipSeals,
              type: reward.rewardType,
              title: reward.rewardTitle ?? "",
            },
            activeDay: Math.min(activeDay, 30),
          },
        ];
      }),
  );

  const buildings = {
    library: 0,
    strategyTower: 0,
    craftHarbor: 0,
    worldPost: 0,
  };
  const validInvestments = [];
  const usedReadings = new Set();
  let spentInkBricks = 0;
  for (const investment of state.city.investments) {
    const proofKey = `${investment.readingId}:${investment.date}`;
    const hasReading = state.readingHistory.some(
      ({ readingId, date }) =>
        readingId === investment.readingId && date === investment.date,
    );
    if (
      !hasReading ||
      usedReadings.has(proofKey) ||
      !(investment.buildingId in buildings) ||
      investment.inkBricks !== 5 ||
      buildings[investment.buildingId] >= 5 ||
      spentInkBricks + 5 > earnedInkBricks
    ) {
      continue;
    }
    usedReadings.add(proofKey);
    spentInkBricks += 5;
    buildings[investment.buildingId] += 1;
    validInvestments.push({
      ...investment,
      inkBricks: 5,
      stage: buildings[investment.buildingId],
    });
  }
  state.city = {
    ...state.city,
    materials: {
      inkBricks: earnedInkBricks - spentInkBricks,
      fellowshipSeals: earnedFellowshipSeals,
      starFragments: 0,
    },
    buildings,
    investments: validInvestments,
    storyUnlocks,
  };

  let mastery = createAbilityMastery();
  for (const record of state.diagnosticHistory) {
    mastery = recordAbilityEvidence(mastery, record);
  }
  state.abilityMastery = mastery;
  state.abilityGrowth = Object.fromEntries(
    Object.entries(mastery.skills).map(([skill, value]) => [
      skill,
      value.successes.length,
    ]),
  );
  return state;
}

export function createLocalStore(
  storage,
  { createDeviceId = () => crypto.randomUUID() } = {},
) {
  if (
    !storage ||
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function"
  ) {
    throw new TypeError("A Storage-compatible object is required");
  }

  return Object.freeze({
    load() {
      const raw = storage.getItem(LOCAL_STORAGE_KEY);
      if (raw === null) return createDefaultState(createDeviceId());
      try {
        const parsed = JSON.parse(raw);
        assertLearningState(parsed, { allowLegacy: true });
        return normalizeState(parsed);
      } catch {
        storage.setItem("reading-expedition:backup:invalid", raw);
        return createDefaultState(createDeviceId());
      }
    },
    save(state) {
      assertLearningState(state);
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    },
    clear() {
      storage.removeItem(LOCAL_STORAGE_KEY);
    },
    export() {
      return storage.getItem(LOCAL_STORAGE_KEY);
    },
    restore(raw) {
      const parsed = unwrapPortfolioExport(JSON.parse(raw));
      assertLearningState(parsed, { allowLegacy: true });
      const restored = recomputeImportedState(normalizeState(parsed));
      assertLearningState(restored);
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(restored));
      return restored;
    },
  });
}
