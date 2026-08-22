import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);

function run(command, args, { capture = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 執行失敗`);
  }
  return capture ? `${result.stdout ?? ""}\n${result.stderr ?? ""}` : "";
}

function read(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} 執行失敗`);
  }
  return result.stdout.trim();
}

async function expectHttp(url, validate, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok && (await validate(response))) return;
      lastError = new Error(`${url} 回應 ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
    }
  }
  throw lastError;
}

const branch = read("git", ["branch", "--show-current"]);
if (branch !== "main") {
  throw new Error(`快速部署只允許 main，目前是 ${branch || "detached HEAD"}`);
}
if (read("git", ["status", "--porcelain"])) {
  throw new Error("工作樹尚未提交；請先完成 commit，再執行快速部署。");
}

console.log("[1/7] 驗證 GitHub 與 Cloudflare 登入");
run("gh", ["auth", "status"]);
run("npx", ["wrangler", "whoami"]);

console.log("[2/7] 執行快速測試");
run("npm", ["test"]);

console.log("[3/7] 建置靜態網站");
run("npm", ["run", "build"]);

console.log("[4/7] 推送 GitHub main");
run("git", ["push", "origin", "main"]);
const commitHash = read("git", ["rev-parse", "HEAD"]);
const commitMessage = read("git", ["log", "-1", "--pretty=%s"]);
if (read("git", ["rev-parse", "origin/main"]) !== commitHash) {
  throw new Error("origin/main 尚未同步目前 commit");
}

console.log("[5/7] 部署 Cloudflare Worker");
run("npm", ["run", "deploy:worker"]);

console.log("[6/7] 部署 Cloudflare Pages");
const pagesOutput = run(
  "npx",
  [
    "wrangler",
    "pages",
    "deploy",
    "dist",
    "--project-name",
    "reading-expedition",
    "--branch",
    "main",
    "--commit-hash",
    commitHash,
    "--commit-message",
    commitMessage,
  ],
  { capture: true },
);
const deploymentUrl = pagesOutput.match(
  /https:\/\/[a-z0-9]+\.reading-expedition-2u1\.pages\.dev/u,
)?.[0];
if (!deploymentUrl) throw new Error("無法從 Pages 輸出取得部署網址");

console.log("[7/7] 正式站健康檢查");
await expectHttp(`${deploymentUrl}/manifest.webmanifest`, async (response) => {
  const manifest = await response.json();
  return manifest.display === "standalone";
});
await expectHttp(
  "https://reading-expedition-api.hk6429.workers.dev/api/v1/readings?level=launch&page=1&pageSize=1",
  async (response) => {
    const payload = await response.json();
    return Array.isArray(payload.readings) && payload.readings.length > 0;
  },
);

console.log(`快速部署完成：${deploymentUrl}`);
console.log(`正式站：https://reading-expedition-2u1.pages.dev/`);
