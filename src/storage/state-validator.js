import {
  LOCAL_ALLOWED_KEYS,
  LOCAL_SCHEMA_VERSION,
} from "./schema.js";

const ID = /^[A-Za-z0-9:_-]{1,160}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(["world", "science", "humanities"]);
const SKILLS = new Set(["comprehension", "inference", "evidence"]);
const LEVELS = new Set(["launch", "voyage", "tower"]);
const SUPPORT_MODES = new Set(["guided", "independent"]);
const EQUIPMENT = new Set([
  "main-idea-seal",
  "inference-fan",
  "evidence-lens",
]);

function plain(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function fail(path) {
  throw new TypeError(`${path} is not valid learning state`);
}

function keys(value, allowed, path, required = []) {
  if (!plain(value)) fail(path);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new TypeError(`${path}.${key} is not allowed in learning state`);
    }
  }
  for (const key of required) {
    if (!Object.hasOwn(value, key)) fail(`${path}.${key}`);
  }
}

function string(value, path, max = 500) {
  if (typeof value !== "string" || value.length > max) fail(path);
}

function integer(value, path, min = 0, max = 1_000_000) {
  if (!Number.isInteger(value) || value < min || value > max) fail(path);
}

function boolean(value, path) {
  if (typeof value !== "boolean") fail(path);
}

function limitedArray(value, path, max = 2_000) {
  if (!Array.isArray(value) || value.length > max) fail(path);
}

function validateReadingProgress(value) {
  keys(value, Object.keys(value), "readingProgress");
  if (Object.keys(value).length > 500) fail("readingProgress");
  for (const [readingId, position] of Object.entries(value)) {
    if (!ID.test(readingId)) fail(`readingProgress.${readingId}`);
    keys(
      position,
      ["contentKey", "paragraph", "offset", "progress"],
      `readingProgress.${readingId}`,
      ["paragraph", "offset"],
    );
    if (position.contentKey !== undefined) {
      string(position.contentKey, `readingProgress.${readingId}.contentKey`, 160);
    }
    integer(position.paragraph, `readingProgress.${readingId}.paragraph`, 0, 500);
    integer(position.offset, `readingProgress.${readingId}.offset`, 0, 1_000_000);
    if (
      position.progress !== undefined &&
      (typeof position.progress !== "number" ||
        position.progress < 0 ||
        position.progress > 1)
    ) {
      fail(`readingProgress.${readingId}.progress`);
    }
  }
}

function validateCompleted(value) {
  keys(value, Object.keys(value), "completedReadings");
  if (Object.keys(value).length > 2_000) fail("completedReadings");
  for (const [readingId, record] of Object.entries(value)) {
    if (!ID.test(readingId)) fail(`completedReadings.${readingId}`);
    keys(
      record,
      [
        "date",
        "version",
        "reward",
        "rewards",
        "activeDay",
        "evidenceSubmitted",
        "category",
        "skill",
        "evidence",
      ],
      `completedReadings.${readingId}`,
    );
    if (record.date !== undefined && !DATE.test(record.date)) fail(`${readingId}.date`);
    if (record.version !== undefined) integer(record.version, `${readingId}.version`, 1);
    if (record.reward !== undefined) integer(record.reward, `${readingId}.reward`);
    if (record.activeDay !== undefined) integer(record.activeDay, `${readingId}.activeDay`, 1, 10_000);
    if (record.evidenceSubmitted !== undefined) boolean(record.evidenceSubmitted, `${readingId}.evidenceSubmitted`);
    if (record.category !== undefined && !CATEGORIES.has(record.category)) fail(`${readingId}.category`);
    if (record.skill !== undefined) string(record.skill, `${readingId}.skill`, 40);
    if (record.evidence !== undefined) string(record.evidence, `${readingId}.evidence`, 500);
    if (record.rewards !== undefined) {
      keys(
        record.rewards,
        ["inkBricks", "fellowshipSeals", "type", "title"],
        `${readingId}.rewards`,
      );
      for (const field of ["inkBricks", "fellowshipSeals"]) {
        if (record.rewards[field] !== undefined) {
          integer(record.rewards[field], `${readingId}.rewards.${field}`);
        }
      }
      if (record.rewards.type !== undefined) string(record.rewards.type, `${readingId}.rewards.type`, 30);
      if (record.rewards.title !== undefined) string(record.rewards.title, `${readingId}.rewards.title`, 120);
    }
  }
}

function validateHistory(value) {
  limitedArray(value, "readingHistory");
  for (const [index, event] of value.entries()) {
    const path = `readingHistory.${index}`;
    keys(
      event,
      ["id", "readingId", "date", "category", "skill", "title", "evidence", "mainlineReward"],
      path,
      ["id", "readingId", "date", "category", "skill", "evidence", "mainlineReward"],
    );
    if (!ID.test(event.id) || !ID.test(event.readingId)) fail(path);
    if (!DATE.test(event.date) || !CATEGORIES.has(event.category)) fail(path);
    string(event.skill, `${path}.skill`, 40);
    if (event.title !== undefined) string(event.title, `${path}.title`, 200);
    string(event.evidence, `${path}.evidence`, 500);
    boolean(event.mainlineReward, `${path}.mainlineReward`);
  }
}

function validateCity(city) {
  keys(city, ["materials", "buildings", "investments", "storyUnlocks"], "city", [
    "materials",
    "buildings",
    "investments",
    "storyUnlocks",
  ]);
  keys(
    city.materials,
    ["inkBricks", "fellowshipSeals", "starFragments"],
    "city.materials",
    ["inkBricks", "fellowshipSeals", "starFragments"],
  );
  for (const [field, value] of Object.entries(city.materials)) {
    integer(value, `city.materials.${field}`);
  }
  keys(
    city.buildings,
    ["library", "strategyTower", "craftHarbor", "worldPost"],
    "city.buildings",
    ["library", "strategyTower", "craftHarbor", "worldPost"],
  );
  for (const [field, value] of Object.entries(city.buildings)) {
    integer(value, `city.buildings.${field}`, 0, 5);
  }
  limitedArray(city.investments, "city.investments");
  for (const [index, item] of city.investments.entries()) {
    const path = `city.investments.${index}`;
    keys(item, ["buildingId", "readingId", "date", "inkBricks", "stage", "knowledge"], path);
    string(item.buildingId, `${path}.buildingId`, 40);
    string(item.readingId, `${path}.readingId`, 160);
    if (!DATE.test(item.date)) fail(`${path}.date`);
    integer(item.inkBricks, `${path}.inkBricks`);
    integer(item.stage, `${path}.stage`, 1, 5);
    if (item.knowledge !== null && item.knowledge !== undefined) {
      keys(item.knowledge, ["title", "category", "evidence", "ability"], `${path}.knowledge`);
      string(item.knowledge.title, `${path}.knowledge.title`, 200);
      if (!CATEGORIES.has(item.knowledge.category)) fail(`${path}.knowledge.category`);
      string(item.knowledge.evidence, `${path}.knowledge.evidence`, 500);
      if (!SKILLS.has(item.knowledge.ability)) fail(`${path}.knowledge.ability`);
    }
  }
  limitedArray(city.storyUnlocks, "city.storyUnlocks", 500);
  for (const [index, item] of city.storyUnlocks.entries()) {
    keys(item, ["activeDay", "title", "date"], `city.storyUnlocks.${index}`);
    integer(item.activeDay, `city.storyUnlocks.${index}.activeDay`, 1, 10_000);
    string(item.title, `city.storyUnlocks.${index}.title`, 120);
    if (!DATE.test(item.date)) fail(`city.storyUnlocks.${index}.date`);
  }
}

function validateMastery(mastery) {
  keys(mastery, ["skills", "revisionStrength", "unlockedEquipment"], "abilityMastery", [
    "skills",
    "revisionStrength",
    "unlockedEquipment",
  ]);
  keys(mastery.skills, [...SKILLS], "abilityMastery.skills", [...SKILLS]);
  for (const skill of SKILLS) {
    keys(mastery.skills[skill], ["successes"], `abilityMastery.skills.${skill}`, ["successes"]);
    limitedArray(mastery.skills[skill].successes, `abilityMastery.skills.${skill}.successes`);
    for (const [index, success] of mastery.skills[skill].successes.entries()) {
      keys(success, ["readingId", "date"], `abilityMastery.skills.${skill}.successes.${index}`);
      string(success.readingId, `abilityMastery.skills.${skill}.successes.${index}.readingId`, 160);
      if (!DATE.test(success.date)) fail(`abilityMastery.skills.${skill}.successes.${index}.date`);
    }
  }
  limitedArray(mastery.revisionStrength, "abilityMastery.revisionStrength");
  for (const [index, revision] of mastery.revisionStrength.entries()) {
    keys(revision, ["readingId", "itemType", "date"], `abilityMastery.revisionStrength.${index}`);
    string(revision.readingId, `abilityMastery.revisionStrength.${index}.readingId`, 160);
    if (!SKILLS.has(revision.itemType) || !DATE.test(revision.date)) fail(`abilityMastery.revisionStrength.${index}`);
  }
  limitedArray(mastery.unlockedEquipment, "abilityMastery.unlockedEquipment", 3);
  if (mastery.unlockedEquipment.some((id) => !EQUIPMENT.has(id))) {
    fail("abilityMastery.unlockedEquipment");
  }
}

function validateDiagnostics(records) {
  limitedArray(records, "diagnosticHistory");
  for (const [index, record] of records.entries()) {
    const path = `diagnosticHistory.${index}`;
    keys(record, ["readingId", "title", "date", "category", "level", "supportMode", "items"], path);
    string(record.readingId, `${path}.readingId`, 160);
    string(record.title, `${path}.title`, 200);
    if (!DATE.test(record.date) || !CATEGORIES.has(record.category)) fail(path);
    if (!LEVELS.has(record.level) || !SUPPORT_MODES.has(record.supportMode)) fail(path);
    limitedArray(record.items, `${path}.items`, 20);
    for (const [itemIndex, item] of record.items.entries()) {
      const itemPath = `${path}.items.${itemIndex}`;
      keys(item, ["type", "firstCorrect", "finalCorrect", "revised", "evidenceViewed", "diagnostic"], itemPath);
      if (!SKILLS.has(item.type)) fail(`${itemPath}.type`);
      for (const field of ["firstCorrect", "finalCorrect", "revised", "evidenceViewed"]) {
        boolean(item[field], `${itemPath}.${field}`);
      }
      string(item.diagnostic, `${itemPath}.diagnostic`, 500);
    }
  }
}

export function assertLearningState(state, { allowLegacy = false } = {}) {
  keys(state, LOCAL_ALLOWED_KEYS, "state");
  if (
    state.schemaVersion !== LOCAL_SCHEMA_VERSION &&
    !(allowLegacy && state.schemaVersion === 1)
  ) {
    fail("state.schemaVersion");
  }
  if (allowLegacy && state.schemaVersion === 1) return state;
  for (const key of LOCAL_ALLOWED_KEYS) {
    if (!Object.hasOwn(state, key)) fail(`state.${key}`);
  }
  if (typeof state.deviceId !== "string" || !ID.test(state.deviceId)) fail("state.deviceId");
  validateReadingProgress(state.readingProgress);
  validateCompleted(state.completedReadings);
  validateHistory(state.readingHistory);
  validateCity(state.city);
  keys(state.collections, ["stars", "tokens", "quotes"], "collections", ["stars", "tokens", "quotes"]);
  for (const field of ["stars", "tokens", "quotes"]) {
    limitedArray(state.collections[field], `collections.${field}`, 500);
    if (state.collections[field].some((item) => typeof item !== "string" || item.length > 500)) {
      fail(`collections.${field}`);
    }
  }
  keys(state.abilityGrowth, [...SKILLS], "abilityGrowth", [...SKILLS]);
  for (const skill of SKILLS) integer(state.abilityGrowth[skill], `abilityGrowth.${skill}`);
  validateMastery(state.abilityMastery);
  validateDiagnostics(state.diagnosticHistory);
  keys(state.placement, ["completed", "correctCount", "recommendedLevel", "completedAt"], "placement", [
    "completed",
    "correctCount",
    "recommendedLevel",
    "completedAt",
  ]);
  boolean(state.placement.completed, "placement.completed");
  if (state.placement.correctCount !== null) integer(state.placement.correctCount, "placement.correctCount", 0, 3);
  if (state.placement.recommendedLevel !== null && !LEVELS.has(state.placement.recommendedLevel)) fail("placement.recommendedLevel");
  if (state.placement.completedAt !== null) string(state.placement.completedAt, "placement.completedAt", 40);
  keys(
    state.preferences,
    [
      "mode",
      "fontScale",
      "lineHeight",
      "reducedMotion",
      "textures",
      "muted",
      "selectedLevel",
      "supportMode",
      "recommendedLevel",
      "lastLevelPromptCount",
    ],
    "preferences",
  );
  if (!["paper", "plain", "night"].includes(state.preferences.mode)) fail("preferences.mode");
  if (typeof state.preferences.fontScale !== "number" || state.preferences.fontScale < 0.8 || state.preferences.fontScale > 2) fail("preferences.fontScale");
  if (typeof state.preferences.lineHeight !== "number" || state.preferences.lineHeight < 1.2 || state.preferences.lineHeight > 2.5) fail("preferences.lineHeight");
  for (const field of ["reducedMotion", "textures", "muted"]) boolean(state.preferences[field], `preferences.${field}`);
  if (!LEVELS.has(state.preferences.selectedLevel) || !SUPPORT_MODES.has(state.preferences.supportMode)) fail("preferences");
  if (state.preferences.recommendedLevel !== null && !LEVELS.has(state.preferences.recommendedLevel)) fail("preferences.recommendedLevel");
  integer(state.preferences.lastLevelPromptCount, "preferences.lastLevelPromptCount");
  if (state.weeklyGoal !== null) {
    keys(state.weeklyGoal, ["target"], "weeklyGoal", ["target"]);
    if (![0, 1, 3, 5, 7].includes(state.weeklyGoal.target)) fail("weeklyGoal.target");
  }
  limitedArray(state.offlineQueue, "offlineQueue", 500);
  if (state.offlineQueue.length > 0) fail("offlineQueue");
  if (JSON.stringify(state).length > 750_000) fail("state");
  return state;
}
