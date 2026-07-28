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

test("多個候選主題並行生成，避免長文模型串行超時", async () => {
  const repo = repository();
  let active = 0;
  let maximumActive = 0;
  const result = await runDailyPipeline({
    date: "2026-07-28",
    version: "parallel-v1",
    repository: repo,
    acquireCandidates: async () => [
      { id: "world", category: "world", contentKey: "world-parallel", score: 96 },
      { id: "science", category: "science", contentKey: "science-parallel", score: 95 },
    ],
    loadFallbackCandidates: async () => [],
    buildDraft: async (candidate) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      active -= 1;
      return candidate;
    },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(maximumActive, 2);
  assert.equal(repo.drafts.length, 2);
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
        const classical = prompt.system.includes("classical");
        const guidedText = classical
          ? "城中乏水，民、農、工皆爭其用。吏欲均減之，或曰：「民不可無飲，田不可失時，工亦繫眾人生計，均之未必平也。」乃令三方各陳所需、所害與可省之數，並書其據，使眾共察。後水情有變，則復議其分。眾乃知公道非守一成之數，實在所據可驗、所議可改，方能取信於眾。若徒守舊令而不察新情，雖名為均，實有偏害矣。"
          : "一座城市進入缺水期，家庭、農田與工廠都需要有限的水。若只要求三方減少相同比例，看來採用同一規則，實際造成的影響卻可能不同。家庭需要維持飲水與清潔，農作物錯過灌溉期可能無法補救，工廠停水也可能牽動工作與供應。因此，分配者先確認最低需求，再比較各方受影響的程度，以及是否能先調整設備、流程或用水習慣。每一方都要說明資料來源與仍不確定的地方，不能只用聲量爭取資源。這些資料公開後，其他人才能檢查分配理由是否一致。當水情、需求或節水成果改變，原先的比例也應重新評估。公平不是把同一個數字套在每個人身上，而是讓基本需要受到保障，讓不同影響被看見，也讓決定能依新證據修正。學生閱讀這類公共議題時，可以追問作者採用了哪些原則、遺漏了哪些資訊，以及結論在什麼條件下應該改變。若一份方案只公布最後比例，卻沒有交代資料如何取得、誰承擔較大的風險，讀者就無法判斷理由是否充分。進一步比較不同方案時，也要檢查它們是否用相同時間範圍與計算方式，避免表面相似的數字掩蓋真正差異。";
        const challengeText = classical
          ? "郡歲旱，泉竭。民求飲，農恐禾槁，工匠亦憂百業之停。守曰：「三者均減其水，可乎？」議者對曰：「法同而害異。民之飲，急也；禾之灌，有時也；工之用，或可改具以省。宜先驗其實，次察其害，復責可省者陳其方。」守從之，榜其數於市，使眾得問。月餘，雨至而需求亦變，遂再定其分。於是人知：公平非一令終身不易，乃所據明、所議公、所失可補、所行能隨證而更也。若數有疑，亦當明告，毋以未定為已定。"
          : "城市進入枯水期後，民生、農業與產業同時面對供水縮減。決策者若採取「一律減少百分之十」，形式上使用相同規則，實際後果卻未必相同：有些用途關係到維持生活的最低需要，有些受到作物生長時間限制，有些則較有機會改變流程、降低浪費。只比較總量，很容易把處境差異藏在整齊的百分比後面。另一種做法，是先保障各方基本需要，再依影響程度分配剩餘水量，但「基本」由誰判定，影響要看眼前損失，還是連後續工作與供應也計入，都需要公開說明。若只由單一部門回答，方案仍可能偏向它最熟悉的觀點。節水能力也不能只靠口頭承諾。能更換設備、調整時段或減少浪費的一方，應提出可追蹤的目標；認為已無法再減的一方，也要交代限制。這些資料不只用來決定當下分水，更能在日後比較承諾與結果。公平因此不是永遠維持第一次決定，而是一套可說明、可檢查、可修正的程序。閱讀者除了判斷自己贊成哪一方，也要辨認作者採用哪些分配原則、哪些資料仍然缺少，以及新證據出現時，原有結論是否應該改變。若方案把短期產量、長期生態與基本生活混成同一個分數，結果雖然簡單，卻可能失去重要差異。較好的比較會分開列出指標、限制與資料期限，再說明各項判斷如何影響分配。只有當讀者能循著資料重做判斷，公開才不只是形式。";
        const glossary = classical
          ? [
              { term: "乏", definition: "缺少。" },
              { term: "繫", definition: "關聯、牽涉。" },
              { term: "陳", definition: "陳述、說明。" },
            ]
          : [];
        return {
          readings: [
            {
              difficulty: "guided",
              textType: classical ? "classical" : "vernacular",
              title: "今日線索",
              hookQuestion: "這件事如何影響生活？",
              body: [{ id: "p1", text: guidedText }],
              glossary,
              readingMinutes: 8,
            },
            {
              difficulty: "challenge",
              textType: classical ? "classical" : "vernacular",
              title: "今日線索的多重觀點",
              hookQuestion: "我們如何檢驗不同解釋？",
              body: [{ id: "p1", text: challengeText }],
              glossary: classical
                ? [
                    { term: "槁", definition: "枯乾。" },
                    { term: "榜", definition: "張貼公告。" },
                    { term: "易", definition: "改變。" },
                  ]
                : [],
              readingMinutes: 10,
            },
          ],
        };
      }
      const text = prompt.data.reading.body[0].text;
      const evidence = text.slice(0, Math.min(18, text.length));
      const options = [evidence, "只看單一數字", "忽略實際影響", "永遠不再調整"];
      const item = (type, question) => ({
        type,
        prompt: question,
        options,
        correctAnswer: evidence,
        rationale: "正文開頭提供可直接核對的線索。",
        distractorReasons: {
          "只看單一數字": "正文要求比較多項條件。",
          "忽略實際影響": "正文強調需要檢查影響。",
          "永遠不再調整": "正文主張依新證據修正。",
        },
        evidenceSpan: {
          paragraph: 1,
          start: 0,
          end: evidence.length,
          text: evidence,
        },
      });
      return {
        items: [
          item("comprehension", "正文首先交代了什麼情境？"),
          item("inference", "依照正文，作者最可能同意哪個看法？"),
          item("evidence", "哪個文字片段最能支持前述判斷？"),
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

  assert.equal(result.status, "succeeded", JSON.stringify(result.errors));
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
