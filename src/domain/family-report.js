const SKILL_LABELS = Object.freeze({
  comprehension: "找重點",
  inference: "想意思",
  evidence: "找證據",
});

const NEXT_ACTIONS = Object.freeze({
  comprehension: "下一篇先找重複主題與轉折句，再用一句話說出重點。",
  inference: "下一篇把原因、結果與人物立場連起來，再檢查推論。",
  evidence: "下一篇選答案前，先回到原文指出一個直接證據。",
});

export function buildDiagnosticRecord({
  reading,
  date,
  supportMode,
  firstResults,
  finalResults,
  evidenceViewedIds = [],
}) {
  const viewed = new Set(evidenceViewedIds);
  return {
    readingId: reading.id,
    title: reading.title,
    date,
    category: reading.category,
    level: reading.level ?? "tower",
    supportMode,
    items: reading.assessment.map((item, index) => {
      const first = firstResults[index] ?? {};
      const final = finalResults[index] ?? first;
      return {
        type: item.type,
        firstCorrect: Boolean(first.correct),
        finalCorrect: Boolean(final.correct),
        revised: !first.correct && Boolean(final.correct),
        evidenceViewed: viewed.has(item.id),
        diagnostic: first.correct ? "" : String(first.diagnostic ?? ""),
      };
    }),
  };
}

function summarizeRecord(record, childId, childAlias) {
  const firstCorrect = record.items.filter(
    ({ firstCorrect: correct }) => correct,
  ).length;
  const revisedCorrect = record.items.filter(({ revised }) => revised).length;
  const stuckItem =
    record.items.find(({ finalCorrect }) => !finalCorrect) ??
    record.items.find(({ firstCorrect: correct }) => !correct);
  const stuckSkill = stuckItem?.type ?? "";
  return {
    childId,
    childAlias,
    date: record.date,
    title: record.title,
    level: record.level,
    supportMode: record.supportMode,
    firstCorrect,
    revisedCorrect,
    stuckSkill,
    evidenceViewed: record.items.some(({ evidenceViewed }) => evidenceViewed),
    nextAction:
      NEXT_ACTIONS[stuckSkill] ??
      "維持目前節奏，下一篇繼續說出答案所根據的原文。",
  };
}

export function buildChildReport({
  childId,
  alias,
  records = [],
  today = new Date(),
}) {
  const rows = records.map((record) =>
    summarizeRecord(record, childId, alias),
  );
  const finalFailures = Object.fromEntries(
    Object.keys(SKILL_LABELS).map((skill) => [skill, 0]),
  );
  for (const record of records) {
    for (const item of record.items ?? []) {
      if (item.type in finalFailures && !item.finalCorrect) {
        finalFailures[item.type] += 1;
      }
    }
  }
  const [stuckSkill, failures] = Object.entries(finalFailures).sort(
    (a, b) => b[1] - a[1],
  )[0] ?? ["", 0];
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() - ((current.getDay() + 6) % 7));
  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(weekStart.getDate() - 7);
  const recordDate = ({ date }) => new Date(`${date}T00:00:00`);
  const weeklyCount = records.filter((record) => {
    const date = recordDate(record);
    return date >= weekStart && date <= current;
  }).length;
  const previousWeekCount = records.filter((record) => {
    const date = recordDate(record);
    return date >= previousWeekStart && date < weekStart;
  }).length;
  return {
    childId,
    alias,
    completedCount: records.length,
    weeklyCount,
    previousWeekCount,
    weeklyTrend:
      weeklyCount > previousWeekCount
        ? "up"
        : weeklyCount < previousWeekCount
          ? "down"
          : "steady",
    stuckSkill: failures > 0 ? stuckSkill : "",
    stuckSkillLabel: failures > 0 ? SKILL_LABELS[stuckSkill] : "",
    nextAction:
      failures > 0
        ? NEXT_ACTIONS[stuckSkill]
        : "目前三項能力表現穩定，下一篇可保持程度或嘗試更少提示。",
    rows,
  };
}

const CSV_COLUMNS = Object.freeze([
  ["childId", "child_id"],
  ["childAlias", "child_alias"],
  ["date", "date"],
  ["title", "title"],
  ["level", "level"],
  ["supportMode", "support_mode"],
  ["firstCorrect", "first_correct"],
  ["revisedCorrect", "revised_correct"],
  ["stuckSkill", "stuck_skill"],
  ["evidenceViewed", "evidence_viewed"],
  ["nextAction", "next_action"],
]);

function csvCell(value) {
  const raw = String(value ?? "");
  const text = /^[=+\-@\t\r]/.test(raw.trimStart())
    ? `'${raw}`
    : raw;
  return /[",\n\r，]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

export function reportRowsToCsv(rows = []) {
  const header = CSV_COLUMNS.map(([, label]) => label).join(",");
  const lines = rows.map((row) =>
    CSV_COLUMNS.map(([field]) => csvCell(row[field])).join(","),
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}
