import {
  createPipelineIdempotencyKey,
  shouldSkipPipelineRun,
} from "./idempotency.js";
import { selectDailyCandidates } from "./fallback-candidates.js";

export async function runDailyPipeline({
  date,
  version,
  repository,
  acquireCandidates,
  loadFallbackCandidates,
  buildDraft,
  traceId = crypto.randomUUID(),
  attempts = 0,
}) {
  const idempotencyKey = createPipelineIdempotencyKey(date, version);
  const existingRun = await repository.getPipelineRun(idempotencyKey);
  if (shouldSkipPipelineRun(existingRun)) {
    return {
      status: existingRun.status,
      skipped: true,
      idempotencyKey,
      traceId: existingRun.traceId,
    };
  }

  await repository.startPipelineRun({
    id: crypto.randomUUID(),
    runDate: date,
    idempotencyKey,
    stage: "acquire",
    status: "running",
    attempts: Math.min(attempts, 2),
    traceId,
  });

  const errors = [];
  let selected = [];
  let preserved = 0;
  let created = 0;
  try {
    const [fresh, fallback] = await Promise.all([
      acquireCandidates(),
      loadFallbackCandidates(date, 7),
    ]);
    selected = selectDailyCandidates({ date, fresh, fallback });
    const built = await Promise.all(
      selected.map(async (candidate) => {
        try {
          return {
            candidate,
            draft: await buildDraft(candidate, { date, traceId }),
          };
        } catch (error) {
          return { candidate, error };
        }
      }),
    );
    for (const result of built) {
      if (result.error) {
        errors.push({
          candidateId: result.candidate.id,
          code: result.error.code ?? "candidate_failed",
          message: result.error.message,
        });
        continue;
      }
      try {
        const inserted = await repository.saveDraftIfAbsent(result.draft);
        if (inserted) created += 1;
        else preserved += 1;
      } catch (error) {
        errors.push({
          candidateId: result.candidate.id,
          code: error.code ?? "candidate_failed",
          message: error.message,
        });
      }
    }
  } catch (error) {
    errors.push({
      candidateId: null,
      code: error.code ?? "pipeline_failed",
      message: error.message,
    });
  }

  const available = created + preserved;
  const status =
    errors.length === 0
      ? "succeeded"
      : available > 0
        ? "partial"
        : "failed";
  await repository.finishPipelineRun(idempotencyKey, {
    stage: "finished",
    status,
    attempts: Math.min(attempts, 2),
    traceId,
    errorCode: errors[0]?.code ?? null,
    errorSummary:
      errors.length > 0
        ? JSON.stringify(
            errors.map(({ candidateId, code }) => ({ candidateId, code })),
          )
        : null,
    finishedAt: new Date().toISOString(),
  });

  return {
    status,
    skipped: false,
    idempotencyKey,
    traceId,
    selected: selected.length,
    created,
    preserved,
    errors,
  };
}
