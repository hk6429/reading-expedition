import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const draftsDir = path.join(root, "content", "manual", "drafts");
const files = fs
  .readdirSync(draftsDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => path.join(draftsDir, file));

const validation = spawnSync(
  process.execPath,
  [
    path.join(root, "scripts", "validate-manual-content.mjs"),
    "--require-count",
    "30",
  ],
  {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  },
);
if (validation.status !== 0) process.exit(validation.status ?? 1);

const rendered = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "render-seed-sql.mjs"), ...files],
  {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  },
);
if (rendered.error) {
  console.error(`SQL 產生失敗：${rendered.error.message}`);
  process.exit(1);
}
if (rendered.status !== 0) {
  process.stderr.write(rendered.stderr);
  process.exit(rendered.status ?? 1);
}

const outputDir = path.join(root, "tmp");
const output = path.join(outputDir, "manual-content.sql");
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(output, rendered.stdout, "utf8");
console.log(`WROTE ${path.relative(root, output)} (${files.length} topics)`);
