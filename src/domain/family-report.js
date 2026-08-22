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

function summarizeRecord(
  record,
  childId,
  childAlias,
  { levelCompletedCount = "", levelTotalCount = "" } = {},
) {
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
    levelCompletedCount,
    levelTotalCount,
  };
}

export function buildChildReport({
  childId,
  alias,
  records = [],
  today = new Date(),
  level = "",
  levelCompletedCount = null,
  levelTotalCount = null,
  unlockedStoryTitle = "",
}) {
  const rows = records.map((record) =>
    summarizeRecord(record, childId, alias, {
      levelCompletedCount: levelCompletedCount ?? "",
      levelTotalCount: levelTotalCount ?? "",
    }),
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
  const weeklyRecords = records.filter((record) => {
    const date = recordDate(record);
    return date >= weekStart && date <= current;
  });
  const previousWeekRecords = records.filter((record) => {
    const date = recordDate(record);
    return date >= previousWeekStart && date < weekStart;
  });
  const uniqueReadingDays = (items) =>
    new Set(items.map(({ readingId, date }) => `${readingId}:${date}`)).size;
  const weeklyCount = uniqueReadingDays(weeklyRecords);
  const previousWeekCount = uniqueReadingDays(previousWeekRecords);
  return {
    childId,
    alias,
    completedCount: new Set(records.map(({ readingId }) => readingId)).size,
    level,
    levelCompletedCount,
    levelTotalCount,
    unlockedStoryTitle,
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

export function buildFamilySupportCards(report) {
  const latest = report.rows?.at(-1) ?? {};
  const praise = latest.revisedCorrect > 0
    ? `我看見你願意回頭修正 ${latest.revisedCorrect} 題，這種修正力比一次答對更值得肯定。`
    : latest.evidenceViewed
      ? "我看見你先回原文找證據，再決定答案；這是可靠的閱讀方法。"
      : "我看見你依自己的節奏完成閱讀，也知道需要時可以休息。";
  const conversation = {
    comprehension: "如果只用一句話說，這篇最重要的重點是什麼？",
    inference: "文章哪一個線索，讓你推想到沒有直接寫出的意思？",
    evidence: "你會用哪一句原文支持自己的判斷？為什麼？",
  }[report.stuckSkill] ?? "這篇有哪些想法，可以用在今天的生活裡？";
  const story = report.unlockedStoryTitle
    ? `家庭故事卡：章回「${report.unlockedStoryTitle}」已解鎖。輪流說出最喜歡的片段與理由，只需口頭分享，不必上傳。`
    : "家庭故事卡：目前還沒有新章回；可以一起回想最近一次閱讀中最有感的片段，只需口頭分享，不必上傳。";
  return Object.freeze({
    praise,
    conversation,
    story,
    sharedGoalOptions: Object.freeze([
      "只陪伴，不設篇數",
      "一起讀 1 次",
      "一起讀 3 次",
    ]),
  });
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
  ["levelCompletedCount", "level_completed_count"],
  ["levelTotalCount", "level_total_count"],
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

export function reportRowsToCsv(rows = [], { anonymize = false } = {}) {
  const header = CSV_COLUMNS.map(([, label]) => label).join(",");
  const lines = rows.map((row) => {
    const safeRow = anonymize
      ? {
          ...row,
          childId: "",
          childAlias: "匿名孩子",
          date: "不顯示日期",
          title: "已完成讀卷",
        }
      : row;
    return CSV_COLUMNS.map(([field]) => csvCell(safeRow[field])).join(",");
  });
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}
