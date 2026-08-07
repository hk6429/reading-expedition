import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const topics = JSON.parse(
  fs.readFileSync(
    path.join(root, "content", "manual", "topics.json"),
    "utf8",
  ),
);
const draftsDir = path.join(root, "content", "manual", "drafts");
const concurrency = 3;
const scheduleStart = new Date("2026-08-08T00:00:00Z");
const args = process.argv.slice(2);
const daysIndex = args.indexOf("--days");
const requestedDays = daysIndex >= 0 ? Number(args[daysIndex + 1]) : null;
if (
  requestedDays !== null &&
  (!Number.isInteger(requestedDays) || requestedDays < 1)
) {
  console.error("--days 必須是大於零的整數");
  process.exit(1);
}
const scheduleCounts = new Map();
const scheduledTopics = topics.map((entry) => {
  const key = `${entry.level}:${entry.category}`;
  const offset = scheduleCounts.get(key) ?? 0;
  scheduleCounts.set(key, offset + 1);
  const date = new Date(scheduleStart);
  date.setUTCDate(date.getUTCDate() + offset);
  return {
    ...entry,
    scheduleOffset: offset,
    topicDate: date.toISOString().slice(0, 10),
  };
});
const selectedTopics = scheduledTopics.filter(
  ({ scheduleOffset }) =>
    requestedDays === null || scheduleOffset < requestedDays,
);
const pending = selectedTopics.filter(
  ({ slug }) => !fs.existsSync(path.join(draftsDir, `${slug}.json`)),
);
const failures = [];
let nextIndex = 0;

function topicPrompt({ topic, category, level, textType, preferredSource, topicDate }) {
  return [
    topic,
    `factPack.category 必須是 ${category}`,
    `兩份 package 的 level 都必須是 ${level}`,
    `factPack.topicDate 必須是 ${topicDate}`,
    `guided 與 challenge 的 textType 都必須是 ${textType}`,
    `優先核對並使用正式來源：${preferredSource}`,
  ].join("；");
}

function generateTopic(entry) {
  return new Promise((resolve) => {
    console.log(`START ${entry.slug}`);
    const child = spawn(
      process.execPath,
      [
        path.join(root, "scripts", "generate-manual-content.mjs"),
        "--slug",
        entry.slug,
        "--level",
        entry.level,
        "--date",
        entry.topicDate,
        topicPrompt(entry),
      ],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let errors = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, 12 * 60 * 1000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      errors = `${errors}${chunk}`.slice(-6000);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      failures.push({ slug: entry.slug, message: error.message });
      console.log(`FAIL ${entry.slug}`);
      resolve();
    });
    child.on("exit", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        console.log(`PASS ${entry.slug}`);
      } else {
        failures.push({
          slug: entry.slug,
          message:
            (timedOut ? "超過 12 分鐘，已停止後等待重試。\n" : "") +
            (errors.trim() || `exit ${code}`),
        });
        console.log(`FAIL ${entry.slug}`);
      }
      resolve();
    });
  });
}

async function worker() {
  while (nextIndex < pending.length) {
    const entry = pending[nextIndex];
    nextIndex += 1;
    await generateTopic(entry);
  }
}

console.log(
  `BATCH ${pending.length} pending, ${selectedTopics.length - pending.length} existing, ${selectedTopics.length} selected`,
);
await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n[${failure.slug}]\n${failure.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`COMPLETE ${selectedTopics.length} topics`);
}
