import assert from "node:assert/strict";
import test from "node:test";

import { runDailyPipeline } from "../../worker/src/pipeline/daily-run.js";
import { createPipelineRuntime } from "../../worker/src/pipeline/pipeline-runtime.js";

function repository() {
  const runs = new Map();
  const drafts = [];
  return {
    runs,
    drafts,
    async getPipelineRun(key) {
      return runs.get(key) ?? null;
    },
    async startPipelineRun(run) {
      runs.set(run.idempotencyKey, { ...run });
    },
    async finishPipelineRun(key, update) {
      Object.assign(runs.get(key), update);
    },
    async saveDraftIfAbsent(draft) {
      if (drafts.some(({ contentKey }) => contentKey === draft.contentKey)) {
        return false;
      }
      drafts.push(draft);
      return true;
    },
  };
}

test("每日管線保存階段、錯誤、重試數與追蹤 ID，且失敗不覆蓋既有內容", async () => {
  const repo = repository();
  repo.drafts.push({ contentKey: "existing-world", title: "既有內容" });
  const result = await runDailyPipeline({
    date: "2026-07-28",
    version: "v1",
    repository: repo,
    acquireCandidates: async () => [
      { id: "world", category: "world", contentKey: "existing-world", score: 96 },
      { id: "science", category: "science", contentKey: "science-new", score: 94 },
    ],
    loadFallbackCandidates: async () => [],
    buildDraft: async (candidate) => {
      if (candidate.id === "science") throw new Error("temporary failure");
      return candidate;
    },
  });
  const run = repo.runs.get("daily:2026-07-28:v1");

  assert.equal(result.status, "partial");
  assert.equal(repo.drafts[0].title, "既有內容");
  assert.equal(run.stage, "finished");
  assert.equal(run.attempts, 0);
  assert.equal(typeof run.traceId, "string");
  assert.equal(run.errorCode, "candidate_failed");
});

test("同一天同版本成功後重跑不重複建立", async () => {
  const repo = repository();
  const options = {
    date: "2026-07-28",
    version: "v1",
    repository: repo,
    acquireCandidates: async () => [
      { id: "world", category: "world", contentKey: "world-new", score: 96 },
    ],
    loadFallbackCandidates: async () => [],
    buildDraft: async (candidate) => candidate,
  };

  await runDailyPipeline(options);
  const second = await runDailyPipeline(options);

  assert.equal(second.skipped, true);
  assert.equal(repo.drafts.length, 1);
});

test("排程 runtime 串起三類 RSS、雙難度生成、品管與待審稿", async () => {
  const repo = repository();
  const sources = ["world", "science", "humanities"].map((category) => ({
    id: `${category}-source`,
    name: `${category} source`,
    baseUrl: `https://${category}.example.test`,
    feedUrl: `https://${category}.example.test/feed`,
    publisher: `${category} publisher`,
    license: { type: "open", version: "1" },
    allowedUsage: "facts-and-short-extracts",
    extractScope: "title-summary-link",
    adapter: "rss",
    category,
    topicKind: "evergreen",
  }));
  const provider = {
    async generate(prompt) {
      if (prompt.task.includes("兩份")) {
        return {
          readings: [
            {
              difficulty: "guided",
              title: "今日線索",
              hookQuestion: "這件事如何影響生活？",
              body: [{ id: "p1", text: "我們先觀察現象，再比較不同資料所提供的線索。" }],
              glossary: [],
              readingMinutes: 8,
            },
            {
              difficulty: "challenge",
              title: "今日線索的多重觀點",
              hookQuestion: "我們如何檢驗不同解釋？",
              body: [{ id: "p1", text: "研究者先觀察現象，再比較不同資料，並檢查推論是否能被證據支持。" }],
              glossary: [],
              readingMinutes: 10,
            },
          ],
        };
      }
      const text = prompt.data.reading.body[0].text;
      return {
        items: [
          {
            type: "evidence",
            prompt: "哪個詞指出第一個步驟？",
            options: ["觀察", "猜測", "忽略"],
            correctAnswer: "觀察",
            rationale: "正文先要求觀察現象。",
            distractorReasons: { 猜測: "正文未提及", 忽略: "與正文相反" },
            evidenceSpan: {
              paragraph: 1,
              start: text.indexOf("觀察"),
              end: text.indexOf("觀察") + 2,
              text: "觀察",
            },
          },
        ],
      };
    },
  };
  const fetchImpl = async (url) => {
    const category = new URL(url).hostname.split(".")[0];
    return new Response(
      `<rss><channel><item><title>${category} 題材</title><link>https://${category}.example.test/article</link><description>一段可核對的公開資料摘要。</description><pubDate>Mon, 27 Jul 2026 21:30:00 GMT</pubDate></item></channel></rss>`,
      { headers: { "content-type": "application/rss+xml" } },
    );
  };
  const runtime = createPipelineRuntime({
    env: { PIPELINE_VERSION: "v1", FORMAL_DAY: "1" },
    repository: repo,
    sources,
    fetchImpl,
    provider,
  });

  const result = await runtime.run("2026-07-28");

  assert.equal(result.status, "succeeded");
  assert.equal(repo.drafts.length, 3);
  assert.ok(
    repo.drafts.every(
      (bundle) =>
        bundle.packages.length === 2 &&
        bundle.packages.every(
          (packageRecord) => packageRecord.publicationStatus === "review",
        ),
    ),
  );
});
