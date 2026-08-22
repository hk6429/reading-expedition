import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) =>
  fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Worker 以同一個 completion proof service 簽發並驗證", () => {
  const source = read("worker/src/index.js");
  assert.match(source, /createCompletionProofService/);
  assert.match(source, /COMPLETION_PROOF_SECRET/);
  assert.match(
    source,
    /const completionProofService =[\s\S]*createCompletionProofService/,
  );
  assert.match(
    source,
    /createClassroomApi\(\{\s*repository,\s*completionProofService,?\s*\}\)/,
  );
  assert.match(
    source,
    /createApi\(\{[\s\S]*familyPassportApi,\s*completionProofService,?\s*\}\)/,
  );
});

test("Worker 每日清除超過 45 天的匿名事件", () => {
  const source = read("worker/src/index.js");
  const config = read("wrangler.worker.toml");
  assert.match(source, /scheduled\(controller, env, ctx\)/);
  assert.match(source, /45 \* 86_400_000/);
  assert.match(source, /purgeExpiredAnonymousEvents/);
  assert.match(config, /crons = \["17 19 \* \* \*"\]/);
});

test("前端只把伺服器簽發的 proof 與文章識別送入班級佇列", () => {
  const app = read("src/app.js");
  const assessment = read("src/ui/assessment-view.js");
  assert.match(assessment, /completionProof/);
  assert.match(app, /completionProof/);
  assert.match(app, /firstCorrect[,\s]/);
  assert.match(app, /revisedCorrect:/);
  assert.match(app, /evidenceViewed:/);
  assert.match(app, /transferCompleted:/);
  assert.match(
    app,
    /classContributionQueue\.enqueue\(\{\s*completionProof,\s*readingId: reading\.id,\s*contentKey: reading\.contentKey,\s*version: reading\.version,[\s\S]*quality:/,
  );
  assert.doesNotMatch(app, /validReading:\s*true/);
});

test("前端以伺服器簽發的作答工作階段取得速度證明", () => {
  const app = read("src/app.js");
  const assessment = read("src/ui/assessment-view.js");
  assert.match(
    app,
    /`\/api\/v1\/readings\/\$\{reading\.id\}\/assessment-session`/,
  );
  assert.match(app, /body: JSON\.stringify\(\{ version: reading\.version \}\)/);
  assert.match(app, /assessmentSession/);
  assert.match(
    app,
    /JSON\.stringify\(\{[\s\S]*version: reading\.version,[\s\S]*answers,[\s\S]*assessmentSession: reading\.assessmentSession/,
  );
  assert.doesNotMatch(app, /readingSeconds|elapsedSeconds|clientDuration/);
  assert.match(app, /assessmentSessionUnavailable/);
  assert.match(app, /if \(cause\?\.serverResponse\) throw cause/);
  assert.match(app, /error\.userMessage = message/);
  assert.match(assessment, /cause\.userMessage/);
  assert.match(assessment, /這次不會計入班級共建/);
});
