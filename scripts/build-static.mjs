import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "dist");
const entries = [
  "index.html",
  "styles.css",
  "service-worker.js",
  "src",
  "assets",
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const entry of entries) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), {
    recursive: true,
    filter(source) {
      return !source.includes(`${path.sep}generated${path.sep}`);
    },
  });
}
