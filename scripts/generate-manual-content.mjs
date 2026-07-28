import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const slugIndex = args.indexOf("--slug");
const slug = slugIndex >= 0 ? args[slugIndex + 1] : null;
const topic = args
  .filter(
    (arg, index) =>
      arg !== "--slug" &&
      index !== slugIndex + 1,
  )
  .join(" ")
  .trim();

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error("請提供安全 slug，例如：--slug moon-phases");
  process.exit(1);
}
if (!topic) {
  console.error("請提供閱讀主題");
  process.exit(1);
}

const output = path.join(
  root,
  "content",
  "manual",
  "drafts",
  `${slug}.json`,
);
if (fs.existsSync(output)) {
  console.error(`不覆寫既有草稿：${path.relative(root, output)}`);
  process.exit(1);
}

const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Taipei",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const prompt = fs
  .readFileSync(path.join(root, "content", "manual", "PROMPT.md"), "utf8")
  .replaceAll("{{TOPIC}}", topic)
  .replaceAll("{{SLUG}}", slug)
  .replaceAll("{{DATE}}", date);

const result = spawnSync(
  "codex",
  [
    "exec",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "--output-schema",
    path.join(root, "content", "manual", "content-pack.schema.json"),
    "--output-last-message",
    output,
    "-C",
    root,
    prompt,
  ],
  {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "inherit", "inherit"],
  },
);
if (result.error) {
  console.error(`無法啟動 Codex CLI：${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`Codex CLI 失敗，exit ${result.status}`);
  process.exit(result.status ?? 1);
}

const validation = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "validate-manual-content.mjs"), output],
  {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  },
);
process.exit(validation.status ?? 1);
