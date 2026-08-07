import fs from "node:fs";
import path from "node:path";

import { validateAssessmentAnswers } from "../worker/src/pipeline/answer-validator.js";
import { evaluateContentProfile } from "../worker/src/pipeline/content-profile.js";
import { compareDifficultyLevels } from "../worker/src/pipeline/reading-level.js";
import { manualProfileLimits } from "./manual-content-profile.mjs";

const root = path.resolve(import.meta.dirname, "..");
const draftsDir = path.join(root, "content", "manual", "drafts");
const args = process.argv.slice(2);
const requireCountIndex = args.indexOf("--require-count");
const categoryQuotaIndex = args.indexOf("--category-quota");
const requiredCount =
  requireCountIndex >= 0 ? Number(args[requireCountIndex + 1]) : null;
const categoryQuota =
  categoryQuotaIndex >= 0
    ? Object.fromEntries(
        String(args[categoryQuotaIndex + 1] ?? "")
          .split(",")
          .map((entry) => entry.split("="))
          .map(([category, count]) => [category, Number(count)]),
      )
    : null;
const explicitFiles = args.filter(
  (arg, index) =>
    !["--require-count", "--category-quota"].includes(arg) &&
    (requireCountIndex < 0 || index !== requireCountIndex + 1) &&
    (categoryQuotaIndex < 0 || index !== categoryQuotaIndex + 1),
);
const files =
  explicitFiles.length > 0
    ? explicitFiles.map((file) => path.resolve(file))
    : fs
        .readdirSync(draftsDir)
        .filter((file) => file.endsWith(".json"))
        .sort()
        .map((file) => path.join(draftsDir, file));

const failures = [];
const seenIds = new Set();
const seenContentKeys = new Set();
const seenScheduleSlots = new Set();
const categoryCounts = { world: 0, science: 0, humanities: 0 };
const LEVELS = new Set(["launch", "voyage", "tower"]);

function fail(file, message) {
  failures.push(`${path.relative(root, file)}: ${message}`);
}

function checkUnique(file, value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(file, `${label} 缺失`);
    return;
  }
  if (seenIds.has(value)) fail(file, `${label} 重複：${value}`);
  seenIds.add(value);
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function validateReadingStrategy(strategy) {
  const errors = [];
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) {
    return ["缺少閱讀策略拆解"];
  }
  const textRules = [
    ["name", 6, 12, "策略名稱"],
    ["purpose", 25, 55, "策略目的"],
    ["structureMap", 35, 80, "文章結構圖"],
    ["expertTip", 25, 60, "專家提醒"],
    ["selfCheck", 20, 50, "自我檢核"],
  ];
  for (const [field, minimum, maximum, label] of textRules) {
    const value = strategy[field];
    if (
      typeof value !== "string" ||
      value.trim().length < minimum ||
      value.trim().length > maximum
    ) {
      errors.push(`${label}須為 ${minimum}–${maximum} 字`);
    }
  }
  if (!Array.isArray(strategy.steps) || strategy.steps.length !== 3) {
    errors.push("閱讀策略必須正好有三個步驟");
  } else {
    strategy.steps.forEach((step, index) => {
      if (
        !step ||
        typeof step !== "object" ||
        typeof step.label !== "string" ||
        step.label.trim().length < 2 ||
        step.label.trim().length > 8
      ) {
        errors.push(`第 ${index + 1} 步短名須為 2–8 字`);
      }
      if (
        typeof step?.instruction !== "string" ||
        step.instruction.trim().length < 25 ||
        step.instruction.trim().length > 60
      ) {
        errors.push(`第 ${index + 1} 步操作須為 25–60 字`);
      }
      if (
        typeof step?.example !== "string" ||
        step.example.trim().length < 25 ||
        step.example.trim().length > 70
      ) {
        errors.push(`第 ${index + 1} 步示範須為 25–70 字`);
      }
    });
  }
  return errors;
}

for (const file of files) {
  let fixture;
  try {
    fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `JSON 無法解析：${error.message}`);
    continue;
  }
  if (/INVALID|```/.test(JSON.stringify(fixture))) {
    fail(file, "含有模型生成失敗標記、程式碼圍欄或占位符");
  }
  const slug = path.basename(file, ".json");
  if (!fixture?.source || !fixture?.sourceItem || !fixture?.factPack) {
    fail(file, "缺少來源、來源項目或事實包");
    continue;
  }
  if (!isHttpsUrl(fixture.source.baseUrl)) {
    fail(file, "source.baseUrl 必須使用 HTTPS");
  }
  if (!isHttpsUrl(fixture.sourceItem.canonicalUrl)) {
    fail(file, "sourceItem.canonicalUrl 必須使用 HTTPS");
  }
  if (
    fixture.source.allowedUsage !== "facts-and-short-extracts" ||
    fixture.factPack.verificationStatus !== "verified"
  ) {
    fail(file, "來源授權或事實包尚未核實");
  }
  if (
    !Array.isArray(fixture.factPack.sourceLinks) ||
    !fixture.factPack.sourceLinks.includes(fixture.sourceItem.canonicalUrl)
  ) {
    fail(file, "事實包必須保存 canonicalUrl");
  }
  if (!Object.hasOwn(categoryCounts, fixture.factPack.category)) {
    fail(file, `不支援的類別：${fixture.factPack.category}`);
  } else {
    categoryCounts[fixture.factPack.category] += 1;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fixture.factPack.topicDate ?? "")) {
    fail(file, "factPack.topicDate 必須是 YYYY-MM-DD");
  }
  if (seenContentKeys.has(fixture.contentKey)) {
    fail(file, `contentKey 重複：${fixture.contentKey}`);
  }
  seenContentKeys.add(fixture.contentKey);
  checkUnique(file, fixture.source.id, "source.id");
  checkUnique(file, fixture.sourceItem.id, "sourceItem.id");
  checkUnique(file, fixture.factPack.id, "factPack.id");

  if (!Array.isArray(fixture.packages) || fixture.packages.length !== 2) {
    fail(file, "每個主題必須正好有兩個難度");
    continue;
  }
  const byDifficulty = Object.fromEntries(
    fixture.packages.map((reading) => [reading.difficulty, reading]),
  );
  if (!byDifficulty.guided || !byDifficulty.challenge) {
    fail(file, "必須同時包含 guided 與 challenge");
    continue;
  }
  const packageLevels = new Set(fixture.packages.map(({ level }) => level));
  const level = fixture.packages[0]?.level;
  if (packageLevels.size !== 1 || !LEVELS.has(level)) {
    fail(file, "guided 與 challenge 必須使用同一個有效 level");
    continue;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(fixture.factPack.topicDate ?? "")) {
    const scheduleSlot = [
      fixture.factPack.topicDate,
      fixture.factPack.category,
      level,
      fixture.factPack.version,
    ].join(":");
    if (seenScheduleSlots.has(scheduleSlot)) {
      fail(file, `日期、類別與階段時段重複：${scheduleSlot}`);
    }
    seenScheduleSlots.add(scheduleSlot);
  }
  for (const reading of fixture.packages) {
    checkUnique(file, reading.id, "reading.id");
    if (!reading.id.startsWith(slug)) {
      fail(file, `reading.id 必須以檔名 slug「${slug}」開頭`);
    }
    if (
      reading.publicationStatus !== "manual_review" ||
      reading.hardGateStatus !== "passed" ||
      reading.qualityScore < 92
    ) {
      fail(file, `${reading.difficulty} 必須是通過硬門檻的待審稿`);
    }
    const profile = evaluateContentProfile(
      reading,
      manualProfileLimits(reading.level),
    );
    if (!profile.ok) {
      fail(
        file,
        `${reading.difficulty} 正文不合格：${profile.reasons.join(", ")}`,
      );
    }
    if (!Array.isArray(reading.assessment) || reading.assessment.length !== 3) {
      fail(file, `${reading.difficulty} 必須正好有三題`);
      continue;
    }
    const strategyErrors = validateReadingStrategy(reading.readingStrategy);
    if (strategyErrors.length > 0) {
      fail(
        file,
        `${reading.difficulty} 閱讀策略不合格：${strategyErrors.join(", ")}`,
      );
    }
    const types = reading.assessment.map((item) => item.type);
    if (
      types.join(",") !== "comprehension,inference,evidence"
    ) {
      fail(file, `${reading.difficulty} 題型順序不正確`);
    }
    for (const item of reading.assessment) {
      checkUnique(file, item.id, "assessment.id");
    }
    const assessmentCheck = validateAssessmentAnswers(
      reading,
      reading.assessment,
    );
    if (!assessmentCheck.ok) {
      fail(
        file,
        `${reading.difficulty} 題組不合格：${assessmentCheck.errors.join(", ")}`,
      );
    }
  }
  if (
    byDifficulty.guided.readingStrategy?.name ===
    byDifficulty.challenge.readingStrategy?.name
  ) {
    fail(file, "guided 與 challenge 必須使用不同層次的閱讀策略");
  }
  const levels = compareDifficultyLevels(
    byDifficulty.guided,
    byDifficulty.challenge,
  );
  if (!levels.ok) fail(file, "challenge 難度未明顯高於 guided");
}

if (requiredCount !== null) {
  if (!Number.isInteger(requiredCount) || requiredCount <= 0) {
    failures.push("--require-count 必須是正整數");
  } else if (files.length !== requiredCount) {
    failures.push(`草稿數量為 ${files.length}，目標為 ${requiredCount}`);
  }
}

if (categoryQuota !== null) {
  const valid =
    Object.keys(categoryQuota).length === 3 &&
    Object.keys(categoryCounts).every(
      (category) =>
        Number.isInteger(categoryQuota[category]) &&
        categoryQuota[category] >= 0,
    );
  if (!valid) {
    failures.push(
      "--category-quota 必須是 world=N,science=N,humanities=N",
    );
  } else {
    for (const [category, expected] of Object.entries(categoryQuota)) {
      if (categoryCounts[category] !== expected) {
        failures.push(
          `${category} 草稿數量為 ${categoryCounts[category]}，配額為 ${expected}`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `VALID manual content: ${files.length} topics, ${files.length * 2} readings, ${files.length * 6} questions`,
  );
}
