const TAIPEI_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function taipeiDate(now = new Date()) {
  return TAIPEI_DATE_FORMATTER.format(now);
}

export function isValidIsoDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const READING_LEVELS = new Set(["launch", "voyage", "tower"]);

export function parseReadingListQuery(url) {
  const level = url.searchParams.get("level");
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 100);
  if (
    !READING_LEVELS.has(level) ||
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 200
  ) {
    return null;
  }
  return { level, page, pageSize, offset: (page - 1) * pageSize };
}

function projectReading(reading) {
  const {
    id,
    contentKey,
    category,
    difficulty,
    level,
    supportMode,
    textType,
    title,
    hookQuestion,
    readingMinutes,
    version,
  } = reading;
  return {
    id,
    contentKey,
    category,
    difficulty,
    level,
    supportMode,
    textType,
    title,
    hookQuestion,
    readingMinutes,
    version,
  };
}

export async function getReadingListPayload(repository, query) {
  const result = await repository.listPublishedReadings({
    level: query.level,
    limit: query.pageSize,
    offset: query.offset,
  });
  const total = result.total;
  return {
    readings: result.readings.map(projectReading),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasMore: query.offset + result.readings.length < total,
    },
  };
}

export async function getDailyPayload(repository, date) {
  let readings = await repository.getPublishedDaily(date);
  if (
    readings.length === 0 &&
    typeof repository.getLatestPublishedDaily === "function"
  ) {
    readings = await repository.getLatestPublishedDaily(date);
  }
  const contentDate = readings[0]?.topicDate ?? date;
  return {
    date,
    contentDate,
    isEncore: contentDate !== date,
    readings: readings.map(projectReading),
  };
}

export async function getReadingPayload(repository, id) {
  const reading = await repository.getPublishedReading(id);
  if (!reading) return null;

  return {
    id: reading.id,
    contentKey: reading.contentKey,
    category: reading.category,
    difficulty: reading.difficulty,
    level: reading.level,
    supportMode: reading.supportMode,
    textType: reading.textType,
    title: reading.title,
    hookQuestion: reading.hookQuestion,
    body: reading.body,
    glossary: reading.glossary,
    readingStrategy: reading.readingStrategy,
    sourceAttribution: reading.sourceAttribution,
    readingMinutes: reading.readingMinutes,
    version: reading.version,
    assessment: reading.assessment.map(({ id: itemId, type, prompt, options }) => ({
      id: itemId,
      type,
      prompt,
      options,
    })),
  };
}
