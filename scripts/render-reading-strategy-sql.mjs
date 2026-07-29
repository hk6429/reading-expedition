import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const outputFile =
  outputIndex >= 0 && args[outputIndex + 1]
    ? path.resolve(args[outputIndex + 1])
    : null;
const draftsDir = path.join(root, "content", "manual", "drafts");
const files = fs
  .readdirSync(draftsDir)
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => path.join(draftsDir, file));

const value = (input) =>
  `'${String(input).replaceAll("'", "''")}'`;
const rows = [];

for (const file of files) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const reading of fixture.packages) {
    if (!reading.readingStrategy) {
      throw new TypeError(`${path.basename(file)} 缺少 readingStrategy`);
    }
    rows.push(`UPDATE reading_packages
SET reading_strategy_json = ${value(JSON.stringify(reading.readingStrategy))},
    updated_at = CURRENT_TIMESTAMP
WHERE id = ${value(reading.id)}
  AND publication_status = 'published';`);
  }
}

const sql = `${rows.join("\n")}\n`;
if (outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, sql, "utf8");
  console.log(`WROTE ${path.relative(root, outputFile)} (${rows.length} readings)`);
} else {
  process.stdout.write(sql);
}
