export const READER_IDENTITIES = Object.freeze([
  "explorer",
  "scout",
  "curator",
]);
export const DAILY_INTENTS = Object.freeze([
  "comprehension",
  "inference",
  "evidence",
]);
export const TIME_BUDGETS = Object.freeze([5, 10, 15]);
export const CONTENT_CATEGORIES = Object.freeze([
  "any",
  "world",
  "science",
  "humanities",
]);
export const WEEKLY_TARGETS = Object.freeze([0, 1, 3, 5, 7]);
export const CITY_THEMES = Object.freeze(["dawn", "forest", "night"]);
const CITY_THEME_TOKENS = Object.freeze({
  dawn: Object.freeze({
    "--panel-background": "#fffaf0",
    "--chip-background": "#f6ead2",
    "--mineral-blue": "#557f91",
    "--mineral-green": "#53765a",
  }),
  forest: Object.freeze({
    "--panel-background": "#f3f7ef",
    "--chip-background": "#e2eddd",
    "--mineral-blue": "#527269",
    "--mineral-green": "#446b50",
  }),
  night: Object.freeze({
    "--panel-background": "#eef0f7",
    "--chip-background": "#dfe3f0",
    "--mineral-blue": "#515f87",
    "--mineral-green": "#536b70",
  }),
});
export const GAMIFICATION_PROFILE_KEY =
  "reading-expedition:gamification-profile:v1";

const DEFAULT_PROFILE = Object.freeze({
  version: 1,
  prologueSeen: false,
  readerIdentity: null,
  dailyIntent: null,
  timeBudget: null,
  contentCategory: "any",
  weeklyTarget: 1,
  weeklyAbility: "evidence",
  cityName: "我的萬卷浮城",
  cityTheme: "dawn",
});

function allowed(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function cleanCityName(value, fallback) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.replaceAll(/[<>]/g, "").trim().slice(0, 20);
  return cleaned || fallback;
}

export function cityThemeTokens(theme) {
  return CITY_THEME_TOKENS[theme] ?? CITY_THEME_TOKENS.dawn;
}

export function createGamificationProfile(input = {}) {
  return Object.freeze({
    version: 1,
    prologueSeen: input.prologueSeen === true,
    readerIdentity: allowed(
      input.readerIdentity,
      READER_IDENTITIES,
      DEFAULT_PROFILE.readerIdentity,
    ),
    dailyIntent: allowed(
      input.dailyIntent,
      DAILY_INTENTS,
      DEFAULT_PROFILE.dailyIntent,
    ),
    timeBudget: allowed(
      input.timeBudget,
      TIME_BUDGETS,
      DEFAULT_PROFILE.timeBudget,
    ),
    contentCategory: allowed(
      input.contentCategory,
      CONTENT_CATEGORIES,
      DEFAULT_PROFILE.contentCategory,
    ),
    weeklyTarget: allowed(
      input.weeklyTarget,
      WEEKLY_TARGETS,
      DEFAULT_PROFILE.weeklyTarget,
    ),
    weeklyAbility: allowed(
      input.weeklyAbility,
      DAILY_INTENTS,
      DEFAULT_PROFILE.weeklyAbility,
    ),
    cityName: cleanCityName(input.cityName, DEFAULT_PROFILE.cityName),
    cityTheme: allowed(
      input.cityTheme,
      CITY_THEMES,
      DEFAULT_PROFILE.cityTheme,
    ),
  });
}

export function updateGamificationProfile(profile, changes = {}) {
  const current = createGamificationProfile(profile);
  return createGamificationProfile({
    ...current,
    ...changes,
    readerIdentity: allowed(
      changes.readerIdentity,
      READER_IDENTITIES,
      current.readerIdentity,
    ),
    dailyIntent: allowed(
      changes.dailyIntent,
      DAILY_INTENTS,
      current.dailyIntent,
    ),
    timeBudget: allowed(
      changes.timeBudget,
      TIME_BUDGETS,
      current.timeBudget,
    ),
    contentCategory: allowed(
      changes.contentCategory,
      CONTENT_CATEGORIES,
      current.contentCategory,
    ),
    weeklyTarget: allowed(
      changes.weeklyTarget,
      WEEKLY_TARGETS,
      current.weeklyTarget,
    ),
    weeklyAbility: allowed(
      changes.weeklyAbility,
      DAILY_INTENTS,
      current.weeklyAbility,
    ),
    cityName: cleanCityName(changes.cityName, current.cityName),
    cityTheme: allowed(changes.cityTheme, CITY_THEMES, current.cityTheme),
  });
}

export function loadGamificationProfile(storage = globalThis.localStorage) {
  if (!storage?.getItem) return createGamificationProfile();
  try {
    const value = storage.getItem(GAMIFICATION_PROFILE_KEY);
    return createGamificationProfile(value ? JSON.parse(value) : {});
  } catch {
    return createGamificationProfile();
  }
}

export function saveGamificationProfile(
  storage = globalThis.localStorage,
  profile = {},
) {
  const safeProfile = createGamificationProfile(profile);
  storage?.setItem?.(GAMIFICATION_PROFILE_KEY, JSON.stringify(safeProfile));
  return safeProfile;
}

function startOfLocalWeek(now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function validDatedRecords(records, start) {
  return records.filter(({ date }) => {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return false;
    }
    return new Date(`${date}T00:00:00`) >= start;
  });
}

function progress(completed, target) {
  return Object.freeze({
    completed,
    target,
    percent:
      target === 0
        ? 0
        : Math.min(100, Math.round((completed / target) * 100)),
  });
}

export function deriveMissionProgress({
  profile = createGamificationProfile(),
  readingHistory = [],
  abilityMastery = {},
  now = new Date(),
} = {}) {
  const safeProfile = createGamificationProfile(profile);
  const weekStart = startOfLocalWeek(now);
  const weeklyReadings = validDatedRecords(readingHistory, weekStart);
  const readingCount = new Set(
    weeklyReadings.map(({ readingId, id }) => readingId ?? id),
  ).size;
  const abilityRecords = validDatedRecords(
    abilityMastery.skills?.[safeProfile.weeklyAbility]?.successes ?? [],
    weekStart,
  );
  const abilityCount = new Set(
    abilityRecords.map(({ readingId }) => readingId),
  ).size;
  const datedHistory = readingHistory
    .filter(({ date }) => /^\d{4}-\d{2}-\d{2}$/.test(date ?? ""))
    .sort((a, b) => b.date.localeCompare(a.date));
  const lastDate = datedHistory[0]?.date;
  const daysAway = lastDate
    ? Math.floor(
        (new Date(now).setHours(0, 0, 0, 0) -
          new Date(`${lastDate}T00:00:00`).getTime()) /
          86_400_000,
      )
    : 0;

  return Object.freeze({
    weeklyReading: progress(readingCount, safeProfile.weeklyTarget),
    weeklyAbility: Object.freeze({
      ability: safeProfile.weeklyAbility,
      ...progress(abilityCount, safeProfile.weeklyTarget),
    }),
    returnMission:
      daysAway >= 7
        ? Object.freeze({
            title: "先讀一小段，找回熟悉感",
            message: "不補進度，也沒有連續天數歸零；今天願意回來就很好。",
          })
        : null,
  });
}
