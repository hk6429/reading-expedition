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

if (process.env.READING_API_ORIGIN && process.env.NETLIFY !== "true") {
  const apiOrigin = new URL(process.env.READING_API_ORIGIN);
  if (apiOrigin.protocol !== "https:") {
    throw new TypeError("READING_API_ORIGIN must use HTTPS");
  }
  fs.writeFileSync(
    path.join(output, "_redirects"),
    `/api/*  ${apiOrigin.origin}/api/:splat  200!\n`,
  );
}
