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
  const cloudflare = read("functions/api/[[path]].js");
  assert.match(vercel, /outputDirectory: "dist"/);
  assert.match(vercel, /READING_API_ORIGIN/);
  assert.match(vercel, /source: "\/api\/:path\*"/);
  assert.match(vercel, /destination: `\$\{apiOrigin\}\/api\/:path\*`/);
  assert.match(netlify, /publish = "dist"/);
  assert.match(vercelProxy, /READING_API_ORIGIN/);
  assert.match(cloudflare, /READING_API_ORIGIN/);
  assert.doesNotMatch(
    `${vercel}${vercelProxy}${netlify}${cloudflare}`,
    /workers\.dev/,
  );
});

test("部署文件明定 migration、Worker、前端順序與 Preview 隔離", () => {
  const deployment = read("docs/deployment.md");
  assert.match(deployment, /migration[\s\S]*Worker[\s\S]*Pages[\s\S]*Vercel[\s\S]*Netlify/i);
  assert.match(deployment, /Preview D1/);
  assert.doesNotMatch(deployment, /[A-Za-z0-9_-]{30,}/);
});

test("每日排程直接等待生成完成，不受 HTTP waitUntil 三十秒限制", () => {
  const worker = read("worker/src/index.js");
  assert.match(worker, /async scheduled/);
  assert.match(worker, /await createPipelineRuntime/);
  assert.doesNotMatch(worker, /scheduled[\s\S]{0,200}waitUntil/);
});
