import { createReadingRepository } from "../db/repository.js";
import { createHttpGenerationProvider } from "./http-generation-provider.js";
import { createWorkersAiGenerationProvider } from "./workers-ai-generation-provider.js";
import { createGenerationConfig } from "./generation-provider.js";
import { createSourceRegistry } from "./source-registry.js";
import { createSourceFetcher, fetchSourcesIndependently } from "./source-adapter.js";
import { createRssAdapter } from "./rss-adapter.js";
import { buildFactPack } from "./fact-pack.js";
import { generateReadings } from "./generate-readings.js";
import { generateAssessments } from "./generate-assessments.js";
import { contentSimilarity } from "./similarity.js";
import { compareDifficultyLevels } from "./reading-level.js";
import { validateAssessmentAnswers } from "./answer-validator.js";
import { calculateQualityScore } from "./quality-score.js";
import { decidePublication, evaluateHardGates } from "./hard-gates.js";
import { runDailyPipeline } from "./daily-run.js";
import { APPROVED_SOURCES } from "./approved-sources.js";
import {
  evaluateContentProfile,
  readingText,
  selectDailyTextType,
} from "./content-profile.js";

function taipeiDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function compactId(value) {
  return value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toLowerCase();
}

function candidateDate(item, fallbackDate) {
  const parsed = new Date(item.publishedAt);
  return Number.isNaN(parsed.getTime())
    ? fallbackDate
    : taipeiDate(parsed);
}

function createFact(candidate, date) {
  return {
    factKey: `source-summary-${compactId(candidate.contentFingerprint)}`,
    claim: candidate.extract,
    sourceItemId: candidate.contentFingerprint,
    sourceOriginId: candidate.source.id,
    location: {
      field: "extract",
      start: 0,
      end: candidate.extract.length,
    },
    publishedAt: candidate.publishedAt ?? `${date}T00:00:00Z`,
    confidence: 0.9,
    entities: { numbers: [], dates: [], people: [], units: [] },
  };
}

function createDraftBundle({
  candidate,
  factPack,
  readings,
  assessments,
  quality,
  decision,
  date,
}) {
  const shortId = compactId(candidate.contentFingerprint);
  const publicationStatus =
    decision.status === "eligible_for_auto_publish" ? "published" : "review";
  return {
    contentKey: `${date}-${candidate.category}-${shortId}`,
    source: candidate.source,
    sourceItem: {
      id: candidate.contentFingerprint,
      sourceId: candidate.source.id,
      canonicalUrl: candidate.canonicalUrl,
      title: candidate.title,
      publisher: candidate.publisher,
      publishedAt: candidate.publishedAt,
      fetchedAt: new Date().toISOString(),
      contentFingerprint: candidate.contentFingerprint,
      licenseSnapshot: candidate.licenseSnapshot,
      extractScope: candidate.extractScope,
    },
    factPack,
    packages: readings.map((reading, index) => ({
      id: `${date}-${candidate.category}-${shortId}-${reading.difficulty}-v1`,
      difficulty: reading.difficulty,
      textType: reading.textType,
      title: reading.title,
      hookQuestion: reading.hookQuestion,
      body: reading.body,
      glossary: reading.glossary,
      readingMinutes: reading.readingMinutes,
      sourceAttribution: [
        {
          publisher: candidate.publisher,
          url: candidate.canonicalUrl,
          license: candidate.licenseSnapshot.type,
        },
      ],
      qualityScore: quality.total,
      hardGateStatus: "passed",
      publicationStatus,
      assessment: assessments[index],
      version: 1,
    })),
  };
}

export function createPipelineRuntime({
  env,
  repository = createReadingRepository(env.READING_DB),
  sources = APPROVED_SOURCES,
  fetchImpl = fetch,
  provider = null,
}) {
  const generationProvider =
    provider ??
    (env.AI
      ? createWorkersAiGenerationProvider({
          ai: env.AI,
          model:
            env.GENERATION_MODEL ??
            "@cf/meta/llama-3.1-8b-instruct-fast",
          maxRetries: env.GENERATION_MAX_RETRIES ?? 2,
        })
      : createHttpGenerationProvider({
          config: createGenerationConfig(env),
          fetchImpl,
        }));
  const registry = createSourceRegistry(sources);
  const sourceFetcher = createSourceFetcher({ registry, fetchImpl });
  const rssAdapter = createRssAdapter({ fetchSource: sourceFetcher });
  let candidatesPromise;

  async function loadCandidates(date) {
    if (!candidatesPromise) {
      candidatesPromise = fetchSourcesIndependently(
        sources.map((source) => ({
          source,
          url: source.feedUrl,
          adapter: rssAdapter,
        })),
      ).then(({ results, errors }) => {
        if (results.length === 0 && errors.length > 0) {
          const error = new Error("all approved sources failed");
          error.code = "all_sources_failed";
          throw error;
        }
        return results.flatMap((result) => {
          const source = sources.find(({ id }) => id === result.sourceId);
          return result.items.map((item) => ({
            ...item,
            id: item.contentFingerprint,
            category: source.category,
            topicKind: source.topicKind,
            source,
            candidateDate: candidateDate(item, date),
            score: 100,
            hardGateStatus: "passed",
            published: false,
          }));
        });
      });
    }
    return candidatesPromise;
  }

  async function buildDraft(candidate, { date }) {
    const factPack = buildFactPack({
      id: `${date}-${candidate.category}-${compactId(candidate.contentFingerprint)}`,
      topicDate: date,
      category: candidate.category,
      topicKind: candidate.topicKind,
      facts: [createFact(candidate, date)],
    });
    const textType = selectDailyTextType({
      category: candidate.category,
      date,
    });
    const readings = await generateReadings(generationProvider, factPack, {
      textType,
    });
    const assessments = await Promise.all(
      readings.map((reading) =>
        generateAssessments(
          generationProvider,
          {
            ...reading,
            id: `${factPack.id}-${reading.difficulty}`,
          },
          factPack,
        ),
      ),
    );
    const maxSimilarity = Math.max(
      ...readings.map((reading) =>
        contentSimilarity(
          candidate.extract,
          readingText(reading),
        ),
      ),
    );
    const levels = compareDifficultyLevels(readings[0], readings[1]);
    const assessmentsValid = assessments.every(
      (items, index) => validateAssessmentAnswers(readings[index], items).ok,
    );
    const contentProfileValid = readings.every(
      (reading) => evaluateContentProfile(reading).ok,
    );
    const hardGates = evaluateHardGates({
      sourceTraceable: true,
      licenseClear: candidate.source.allowedUsage === "facts-and-short-extracts",
      factPackVerified: factPack.verificationStatus === "verified",
      twoDifficultiesShareFacts: readings.every(
        ({ factPackId }) => factPackId === factPack.id,
      ),
      similarity: maxSimilarity,
      assessmentValid: assessmentsValid,
      readingLevelValid: levels.ok,
      contentProfileValid,
      schemaValid: true,
    });
    const quality = calculateQualityScore({
      sources: 1,
      facts: 0.95,
      originality: Math.max(0, 1 - maxSimilarity),
      readingLevel: levels.ok ? 1 : 0.6,
      assessment: assessmentsValid ? 1 : 0,
      safety: factPack.sensitivityFlags.length === 0 ? 1 : 0.5,
    });
    const decision = decidePublication({
      hardGates,
      qualityScore: quality.total,
      formalDay: Number(env.FORMAL_DAY ?? 1),
      sensitivityFlags: factPack.sensitivityFlags,
    });
    if (decision.status === "blocked") {
      const error = new Error("generated package failed hard gates");
      error.code = "hard_gate_failed";
      throw error;
    }
    return createDraftBundle({
      candidate,
      factPack,
      readings,
      assessments,
      quality,
      decision:
        env.AUTO_PUBLISH === "true"
          ? decision
          : { status: "manual_review" },
      date,
    });
  }

  return Object.freeze({
    async run(date = taipeiDate()) {
      candidatesPromise = null;
      return runDailyPipeline({
        date,
        version: env.PIPELINE_VERSION ?? "v1",
        repository,
        acquireCandidates: async () =>
          (await loadCandidates(date)).filter(
            (candidate) => candidate.candidateDate === date,
          ),
        loadFallbackCandidates: async () =>
          (await loadCandidates(date)).filter(
            (candidate) => candidate.candidateDate !== date,
          ),
        buildDraft,
      });
    },
  });
}
