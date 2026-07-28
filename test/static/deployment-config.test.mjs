import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("CI 固定 Node 24 並執行完整測試與建置", () => {
  const workflow = read(".github/workflows/test.yml");
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run test:e2e/);
  assert.match(workflow, /npm run build/);
});

test("三平台統一發布 dist 且 API 來源只來自環境變數", () => {
  const vercel = read("vercel.ts");
  const vercelProxy = read("api/[...path].js");
  const netlify = read("netlify.toml");
  const netlifyProxy = read("netlify/functions/api.mjs");
  const cloudflare = read("functions/api/[[path]].js");
  assert.match(vercel, /outputDirectory: "dist"/);
  assert.match(vercel, /READING_API_ORIGIN/);
  assert.match(vercel, /source: "\/api\/:path\*"/);
  assert.match(vercel, /destination: `\$\{apiOrigin\}\/api\/:path\*`/);
  assert.match(netlify, /publish = "dist"/);
  assert.match(netlify, /\/\.netlify\/functions\/api\/:splat/);
  assert.match(netlifyProxy, /READING_API_ORIGIN/);
  assert.match(vercelProxy, /READING_API_ORIGIN/);
  assert.match(cloudflare, /READING_API_ORIGIN/);
  assert.doesNotMatch(
    `${vercel}${vercelProxy}${netlify}${netlifyProxy}${cloudflare}`,
    /workers\.dev/,
  );
});

test("部署文件明定 migration、Worker、前端順序與 Preview 隔離", () => {
  const deployment = read("docs/deployment.md");
  assert.match(deployment, /migration[\s\S]*Worker[\s\S]*Pages[\s\S]*Vercel[\s\S]*Netlify/i);
  assert.match(deployment, /Preview D1/);
  assert.doesNotMatch(deployment, /[A-Za-z0-9_-]{30,}/);
});

test("正式環境停用每日 AI Cron，內容改由 Codex CLI 人工策展", () => {
  const config = read("wrangler.worker.toml");
  const worker = read("worker/src/index.js");
  const deployment = read("docs/deployment.md");
  assert.match(config, /\[triggers\]\s+crons = \[\]/);
  assert.doesNotMatch(config, /\[ai\]|GENERATION_MODEL|GENERATION_API_KEY/);
  assert.doesNotMatch(worker, /scheduled|createPipelineRuntime/);
  assert.match(deployment, /Codex CLI/);
  assert.match(deployment, /30 個閱讀主題/);
});
