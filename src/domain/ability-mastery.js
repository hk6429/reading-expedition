export const ABILITY_EQUIPMENT = Object.freeze({
  comprehension: Object.freeze({
    id: "main-idea-seal",
    name: "定錨腰牌",
    ability: "找重點",
    description: "能從文章中辨認核心訊息與段落重點。",
    action: "先圈出重複出現的主題與轉折句。",
  }),
  inference: Object.freeze({
    id: "inference-fan",
    name: "連線羽扇",
    ability: "想意思",
    description: "能把不同線索連起來，形成有根據的推論。",
    action: "把原因、結果與人物立場連成一條線。",
  }),
  evidence: Object.freeze({
    id: "evidence-lens",
    name: "文證放大鏡",
    ability: "找證據",
    description: "能回到原文定位支持判斷的直接證據。",
    action: "選答案前，先指出最能支持它的原句。",
  }),
});

const SKILLS = Object.freeze(Object.keys(ABILITY_EQUIPMENT));

function emptySkill() {
  return { successes: [] };
}

export function createAbilityMastery() {
  return {
    skills: {
      comprehension: emptySkill(),
      inference: emptySkill(),
      evidence: emptySkill(),
    },
    revisionStrength: [],
    unlockedEquipment: [],
  };
}

function normalizeMastery(current = {}) {
  const defaults = createAbilityMastery();
  return {
    skills: Object.fromEntries(
      SKILLS.map((skill) => [
        skill,
        {
          successes: Array.isArray(current.skills?.[skill]?.successes)
            ? [...current.skills[skill].successes]
            : [],
        },
      ]),
    ),
    revisionStrength: Array.isArray(current.revisionStrength)
      ? [...current.revisionStrength]
      : [],
    unlockedEquipment: Array.isArray(current.unlockedEquipment)
      ? [...current.unlockedEquipment]
      : [],
  };
}

function appendUniqueReading(records, entry) {
  if (records.some(({ readingId }) => readingId === entry.readingId)) {
    return records;
  }
  return [...records, entry];
}

export function recordAbilityEvidence(current, record) {
  const next = normalizeMastery(current);
  for (const item of record.items ?? []) {
    if (!SKILLS.includes(item.type)) continue;
    if (item.firstCorrect) {
      next.skills[item.type].successes = appendUniqueReading(
        next.skills[item.type].successes,
        {
          readingId: record.readingId,
          date: record.date,
        },
      );
    } else if (item.finalCorrect) {
      next.revisionStrength = appendUniqueReading(next.revisionStrength, {
        readingId: record.readingId,
        itemType: item.type,
        date: record.date,
      });
    }
  }

  for (const skill of SKILLS) {
    const successes = next.skills[skill].successes;
    const uniqueReadings = new Set(successes.map(({ readingId }) => readingId));
    const equipmentId = ABILITY_EQUIPMENT[skill].id;
    if (
      successes.length >= 3 &&
      uniqueReadings.size >= 2 &&
      !next.unlockedEquipment.includes(equipmentId)
    ) {
      next.unlockedEquipment.push(equipmentId);
    }
  }
  return next;
}

const REVISION_MILESTONES = Object.freeze([
  Object.freeze({ target: 3, name: "回讀校準者", strategy: "先指出原選項卡住的詞，再回原文校準。" }),
  Object.freeze({ target: 6, name: "修正策略家", strategy: "比較初答與修正答案，說清楚是哪一條證據改變判斷。" }),
  Object.freeze({ target: 10, name: "證據重建者", strategy: "把錯誤類型、關鍵文證與新判斷整理成可重用方法。" }),
]);

export function revisionMilestone(count = 0) {
  const safeCount = Math.max(0, Number(count) || 0);
  const achieved = [...REVISION_MILESTONES]
    .reverse()
    .find(({ target }) => safeCount >= target) ?? null;
  const next = REVISION_MILESTONES.find(({ target }) => safeCount < target) ?? null;
  return Object.freeze({
    count: safeCount,
    achieved,
    next,
    progress: next
      ? Object.freeze({
          completed: safeCount,
          target: next.target,
          percent: Math.min(100, Math.round((safeCount / next.target) * 100)),
        })
      : Object.freeze({ completed: safeCount, target: safeCount, percent: 100 }),
  });
}
