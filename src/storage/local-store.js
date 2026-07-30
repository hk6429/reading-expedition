import {
  LOCAL_SCHEMA_VERSION,
  LOCAL_STORAGE_KEY,
} from "./schema.js";
import { createAbilityMastery } from "../domain/ability-mastery.js";
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
      const parsed = JSON.parse(raw);
      assertLearningState(parsed, { allowLegacy: true });
      const restored = normalizeState(parsed);
      storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(restored));
      return restored;
    },
  });
}
