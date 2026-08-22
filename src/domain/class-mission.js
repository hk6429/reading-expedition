export const CLASS_MISSION_TYPES = Object.freeze([
  "shared_readings",
  "category_balance",
  "ability_practice",
]);

export const CLASS_MISSION_CHOICES = Object.freeze([
  "shared_readings",
  "category_balance",
  "ability_practice",
]);

export const EXIT_CODES = Object.freeze([
  "found_evidence",
  "changed_view",
  "need_support",
]);

export const ASSIGNMENT_ABILITIES = Object.freeze([
  "comprehension",
  "inference",
  "evidence",
]);

export const ASSIGNMENT_ROUTES = Object.freeze([
  "guided",
  "independent",
  "equivalent",
]);

export const ANONYMOUS_ROLES = Object.freeze([
  Object.freeze({
    code: "pathfinder",
    label: "探路",
    action: "先看文章主題與來源，指出值得追查的方向。",
  }),
  Object.freeze({
    code: "verifier",
    label: "查證",
    action: "回到原文核對關鍵句，確認判斷有文證支持。",
  }),
  Object.freeze({
    code: "organizer",
    label: "整理",
    action: "把類別與能力線索整理成共同閱讀地圖。",
  }),
]);

const VALID_READING_DEFINITION =
  "完成閱讀、通過作答門檻，並帶回一段原文文證";

const MISSION_LABELS = Object.freeze({
  shared_readings: Object.freeze({
    title: "共同篇數",
    description: "一起累積有效閱讀，完成多少由共同進度呈現。",
  }),
  category_balance: Object.freeze({
    title: "類別平衡",
    description: "讓世界議題、自然科學與人文故事都有閱讀片段。",
  }),
  ability_practice: Object.freeze({
    title: "能力練習",
    description: "一起練習找主旨、推論與找文證，不比較個人。",
  }),
});

const DISTRIBUTION_KEYS = Object.freeze({
  category: ["world", "science", "humanities"],
  skill: ["comprehension", "inference", "evidence"],
  vote: CLASS_MISSION_CHOICES,
  exit: EXIT_CODES,
});

const QUALITY_RATE_KEYS = Object.freeze([
  "firstCorrectRate",
  "revisedCorrectRate",
  "evidenceViewedRate",
  "transferCompletedRate",
]);

function normalizeDistribution(value, keys) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    keys.map((key) => [
      key,
      Number.isInteger(value[key]) && value[key] >= 0 ? value[key] : 0,
    ]),
  );
}

function normalizeQualityRates(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (
    Object.keys(value).sort().join(",") !==
    [...QUALITY_RATE_KEYS].sort().join(",")
  ) {
    return null;
  }
  for (const key of QUALITY_RATE_KEYS) {
    if (
      typeof value[key] !== "number" ||
      !Number.isFinite(value[key]) ||
      value[key] < 0 ||
      value[key] > 1
    ) {
      return null;
    }
  }
  return Object.freeze(
    Object.fromEntries(QUALITY_RATE_KEYS.map((key) => [key, value[key]])),
  );
}

function validIsoDate(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : false;
}

export function normalizeAssignmentReadings(records = []) {
  const readings = [];
  const seen = new Set();
  for (const record of Array.isArray(records) ? records : []) {
    const readingId = record?.readingId ?? record?.id;
    const title = typeof record?.title === "string" ? record.title.trim() : "";
    if (
      typeof readingId !== "string" ||
      !/^[A-Za-z0-9-]{1,120}$/.test(readingId) ||
      !title ||
      title.length > 160 ||
      /[\u0000-\u001f\u007f]/.test(title) ||
      seen.has(readingId)
    ) {
      continue;
    }
    seen.add(readingId);
    readings.push(Object.freeze({ readingId, title }));
  }
  return Object.freeze(readings);
}

export function buildClassAssignment(input = {}, availableReadings = []) {
  const readings = normalizeAssignmentReadings(availableReadings);
  const reading = readings.find(
    ({ readingId }) => readingId === input.readingId,
  );
  const dueDate = validIsoDate(input.dueDate);
  if (
    !reading ||
    !ASSIGNMENT_ABILITIES.includes(input.ability) ||
    !ASSIGNMENT_ROUTES.includes(input.route) ||
    dueDate === false
  ) {
    return null;
  }
  return Object.freeze({
    readingId: reading.readingId,
    title: reading.title,
    ability: input.ability,
    route: input.route,
    dueDate,
  });
}

export function normalizeMissionChoice(value) {
  return CLASS_MISSION_CHOICES.includes(value) ? value : null;
}

export function normalizeExitCode(value) {
  return EXIT_CODES.includes(value) ? value : null;
}

export function missionTypeDetails(type) {
  const safeType = CLASS_MISSION_TYPES.includes(type)
    ? type
    : "shared_readings";
  return Object.freeze({ type: safeType, ...MISSION_LABELS[safeType] });
}

export function buildClassMission(aggregate = {}) {
  const details = missionTypeDetails(
    aggregate.mission?.type ??
      aggregate.weeklyMissionType ??
      "shared_readings",
  );
  const target =
    Number.isInteger(aggregate.mission?.target) && aggregate.mission.target > 0
      ? aggregate.mission.target
      : Number.isInteger(aggregate.weeklyMissionTarget) &&
          aggregate.weeklyMissionTarget > 0
        ? aggregate.weeklyMissionTarget
        : 10;
  const completed = Number.isInteger(aggregate.weeklyValidReadings)
    ? Math.max(0, aggregate.weeklyValidReadings)
    : 0;
  const period = /^\d{4}-W\d{2}$/.test(aggregate.weeklyPeriod ?? "")
    ? aggregate.weeklyPeriod
    : "本週";
  const privacyProtected = aggregate.privacyProtected !== false;

  return Object.freeze({
    ...details,
    period,
    target,
    completed,
    progress: Math.min(target, completed),
    percent: Math.min(100, Math.round((completed / target) * 100)),
    remaining: Math.max(0, target - completed),
    validReadingDefinition: VALID_READING_DEFINITION,
    privacyProtected,
    participantThreshold:
      Number.isInteger(aggregate.participantThreshold) &&
      aggregate.participantThreshold >= 5
        ? aggregate.participantThreshold
        : 5,
    categoryDistribution: privacyProtected
      ? null
      : Object.freeze(
          normalizeDistribution(
            aggregate.categoryDistribution,
            DISTRIBUTION_KEYS.category,
          ),
        ),
    skillDistribution: privacyProtected
      ? null
      : Object.freeze(
          normalizeDistribution(
            aggregate.skillDistribution,
            DISTRIBUTION_KEYS.skill,
          ),
        ),
    voteDistribution:
      privacyProtected ||
      !aggregate.voteDistribution ||
      typeof aggregate.voteDistribution !== "object"
      ? null
      : Object.freeze(
          normalizeDistribution(
            aggregate.voteDistribution,
            DISTRIBUTION_KEYS.vote,
          ),
        ),
    exitDistribution:
      privacyProtected ||
      !aggregate.exitDistribution ||
      typeof aggregate.exitDistribution !== "object"
      ? null
      : Object.freeze(
          normalizeDistribution(
            aggregate.exitDistribution,
            DISTRIBUTION_KEYS.exit,
          ),
        ),
    qualityRates: privacyProtected
      ? null
      : normalizeQualityRates(aggregate.qualityRates),
  });
}

function stableHash(value) {
  let hash = 2_166_136_261;
  for (const character of String(value)) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function classMissionCelebrationKey(
  participantToken,
  period,
  missionType,
) {
  const digest = stableHash(
    `${String(participantToken)}:${String(period)}:${String(missionType)}`,
  )
    .toString(16)
    .padStart(8, "0");
  return `reading-expedition.class-celebrated:v1:${digest}`;
}

export function chooseAnonymousRole(participantToken, period) {
  const index = stableHash(`${participantToken}:${period}`) % ANONYMOUS_ROLES.length;
  return ANONYMOUS_ROLES[index];
}

export function buildClassDeepLink(baseUrl, classCode) {
  if (!/^[A-Z2-9]{8}$/.test(classCode ?? "")) return null;
  const url = new URL(baseUrl);
  url.pathname = "/";
  url.hash = `/class?code=${encodeURIComponent(classCode)}`;
  url.search = "";
  return url.toString();
}

export function interventionForDistribution(distribution = {}) {
  const skills = normalizeDistribution(distribution, DISTRIBUTION_KEYS.skill);
  const weakest = Object.entries(skills).sort(
    ([keyA, valueA], [keyB, valueB]) =>
      valueA - valueB || keyA.localeCompare(keyB),
  )[0]?.[0] ?? "evidence";
  return Object.freeze(
    {
      comprehension: {
        skill: weakest,
        title: "10 分鐘主旨接力",
        steps: "讀一段、圈重複詞、用一句話說出主旨。",
      },
      inference: {
        skill: weakest,
        title: "10 分鐘線索連線",
        steps: "找兩個線索、畫出關係、說明推論依據。",
      },
      evidence: {
        skill: weakest,
        title: "10 分鐘文證定位",
        steps: "看一題、定位原句、比較原句與選項。",
      },
    }[weakest],
  );
}
