import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(
  new URL("../../scripts/deploy-quick.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8"),
);
const deployment = await readFile(
  new URL("../../docs/deployment.md", import.meta.url),
  "utf8",
);

test("快速部署只做快速測試、建置、推送、部署與健康檢查", () => {
  assert.equal(packageJson.scripts["deploy:quick"], "node scripts/deploy-quick.mjs");
  for (const contract of [
    'run("gh", ["auth", "status"])',
    'run("npx", ["wrangler", "whoami"])',
    'run("npm", ["test"])',
    'run("npm", ["run", "build"])',
    'run("git", ["push", "origin", "main"])',
    'run("npm", ["run", "deploy:worker"])',
    '"pages",\n    "deploy"',
    "expectHttp(",
  ]) {
    assert.match(script, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")));
  }
  assert.doesNotMatch(script, /test:e2e|d1 export|migrations apply|turso db export/u);
});

test("部署手冊把快速部署設為預設並保留高風險升級條件", () => {
  assert.match(deployment, /快速部署（預設）/u);
  assert.match(deployment, /npm run deploy:quick/u);
  for (const risk of ["migrations/", "登入／權限／個資安全", "大量匯入"]) {
    assert.match(deployment, new RegExp(risk.replaceAll("/", "\\/"), "u"));
  }
});
