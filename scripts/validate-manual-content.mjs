import fs from "node:fs";
import path from "node:path";

import { validateAssessmentAnswers } from "../worker/src/pipeline/answer-validator.js";
import { evaluateContentProfile } from "../worker/src/pipeline/content-profile.js";
import { compareDifficultyLevels } from "../worker/src/pipeline/reading-level.js";

const root = path.resolve(import.meta.dirname, "..");
const draftsDir = path.join(root, "content", "manual", "drafts");
const args = process.argv.slice(2);
const requireCountIndex = args.indexOf("--require-count");
const requiredCount =
  requireCountIndex >= 0 ? Number(args[requireCountIndex + 1]) : null;
const explicitFiles = args.filter(
  (arg, index) =>
    arg !== "--require-count" &&
    index !== requireCountIndex + 1,
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
const categoryCounts = { world: 0, science: 0, humanities: 0 };

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

for (const file of files) {
  let fixture;
  try {
    fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    fail(file, `JSON 無法解析：${error.message}`);
    continue;
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
    const profile = evaluateContentProfile(reading);
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
  if (
    requiredCount === 30 &&
    Object.values(categoryCounts).some((count) => count !== 10)
  ) {
    failures.push(
      `30 組正式內容須三類各 10 組，目前為 ${JSON.stringify(categoryCounts)}`,
    );
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
