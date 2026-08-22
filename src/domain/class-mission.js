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

const ABILITY_METRIC_KEYS = Object.freeze([
  "comprehension",
  "inference",
  "evidence",
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
    const level = ["launch", "voyage", "tower"].includes(record?.level)
      ? record.level
      : null;
    const category = ["world", "science", "humanities"].includes(
      record?.category,
    )
      ? record.category
      : null;
    const supportMode = ["guided", "independent"].includes(
      record?.supportMode,
    )
      ? record.supportMode
      : null;
    readings.push(
      Object.freeze({
        readingId,
        title,
        ...(level ? { level } : {}),
        ...(category ? { category } : {}),
        ...(supportMode ? { supportMode } : {}),
      }),
    );
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
  const completed = Number.isInteger(aggregate.missionProgress)
    ? Math.max(0, aggregate.missionProgress)
    : Number.isInteger(aggregate.weeklyValidReadings)
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
    abilityMetrics: privacyProtected
      ? null
      : Object.freeze(
          Object.fromEntries(
            ABILITY_METRIC_KEYS.map((skill) => {
              const raw = aggregate.abilityMetrics?.[skill] ?? {};
              const opportunities = Number.isInteger(raw.opportunities)
                ? Math.max(0, raw.opportunities)
                : 0;
              const firstCorrect = Number.isInteger(raw.firstCorrect)
                ? Math.max(0, Math.min(opportunities, raw.firstCorrect))
                : 0;
              return [
                skill,
                Object.freeze({
                  opportunities,
                  firstCorrect,
                  firstCorrectRate:
                    opportunities > 0 ? firstCorrect / opportunities : null,
                }),
              ];
            }),
          ),
        ),
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

export function interventionForAbilityMetrics(metrics = {}, minimumSample = 5) {
  const candidates = ABILITY_METRIC_KEYS.map((skill) => {
    const opportunities = Number(metrics?.[skill]?.opportunities ?? 0);
    const firstCorrect = Number(metrics?.[skill]?.firstCorrect ?? 0);
    return {
      skill,
      opportunities: Number.isInteger(opportunities) ? opportunities : 0,
      firstCorrect: Number.isInteger(firstCorrect) ? firstCorrect : 0,
      rate: opportunities > 0 ? firstCorrect / opportunities : null,
    };
  }).filter(({ opportunities }) => opportunities >= minimumSample);
  if (candidates.length === 0) {
    return Object.freeze({
      skill: null,
      title: "樣本仍在累積",
      steps: "本週各能力尚未達最低樣本，不判定弱點；先安排混合練習再觀察。",
      example: "示例：每種能力至少完成 5 次作答機會後再比較首次正確率。",
      practice: "練習：各選一題主旨、推論與文證題，使用相同完成標準。",
      exitCheck: "Exit check：學生能說出本題在練哪一種能力。",
      opportunities: 0,
      firstCorrect: 0,
      rate: null,
      minimumSample,
    });
  }
  const weakest = candidates.sort(
    (left, right) =>
      left.rate - right.rate ||
      right.opportunities - left.opportunities ||
      left.skill.localeCompare(right.skill),
  )[0];
  const card = {
    comprehension: {
      title: "10 分鐘主旨接力",
      steps: "步驟：讀一段、圈重複詞、找轉折，再用一句話說出主旨。",
      example: "示例：雖然方案成本較高，但能長期節水；主旨要包含取捨與理由。",
      practice: "練習：刪除一個只講細節的選項，說明它為何不是主旨。",
      exitCheck: "Exit check：用 20 字內寫出主旨，並圈出一個支持詞。",
    },
    inference: {
      title: "10 分鐘線索連線",
      steps: "步驟：找兩個線索、畫出關係、說明推論依據。",
      example: "示例：人物先沉默再改口，可推論立場動搖，但不能推論他已完全同意。",
      practice: "練習：為同一組線索比較『可推論』與『過度推論』各一項。",
      exitCheck: "Exit check：說出一個推論，並指出兩個原文線索。",
    },
    evidence: {
      title: "10 分鐘文證定位",
      steps: "步驟：看一題、定位原句、比較原句與選項。",
      example: "示例：選項說『全部』，原文只說『部分』，量詞不一致就不能支持。",
      practice: "練習：替一個判斷找最直接的一句原文，刪掉無關背景句。",
      exitCheck: "Exit check：圈出支持判斷的最短文證並口頭解釋。",
    },
  }[weakest.skill];
  return Object.freeze({
    skill: weakest.skill,
    ...card,
    opportunities: weakest.opportunities,
    firstCorrect: weakest.firstCorrect,
    rate: weakest.rate,
    minimumSample,
  });
}
