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
const pending = topics.filter(
  ({ slug }) => !fs.existsSync(path.join(draftsDir, `${slug}.json`)),
);
const failures = [];
let nextIndex = 0;

function topicPrompt({ topic, category, textType, preferredSource }) {
  return [
    topic,
    `factPack.category 必須是 ${category}`,
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
  `BATCH ${pending.length} pending, ${topics.length - pending.length} existing`,
);
await Promise.all(Array.from({ length: concurrency }, () => worker()));

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`\n[${failure.slug}]\n${failure.message}`);
  }
  process.exitCode = 1;
} else {
  console.log(`COMPLETE ${topics.length} topics`);
}
