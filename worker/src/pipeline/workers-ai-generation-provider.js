import { GenerationError } from "./generation-provider.js";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_OUTPUT_TOKENS = 4000;

const paragraphSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    text: { type: "string" },
  },
  required: ["id", "text"],
});

const glossarySchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    term: { type: "string" },
    definition: { type: "string" },
  },
  required: ["term", "definition"],
});

const readingResponseSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    readings: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          difficulty: { type: "string", enum: ["guided", "challenge"] },
          textType: { type: "string", enum: ["vernacular", "classical"] },
          title: { type: "string" },
          hookQuestion: { type: "string" },
          body: { type: "array", minItems: 1, items: paragraphSchema },
          glossary: { type: "array", items: glossarySchema },
          readingMinutes: { type: "integer", minimum: 5, maximum: 15 },
        },
        required: [
          "difficulty",
          "textType",
          "title",
          "hookQuestion",
          "body",
          "glossary",
          "readingMinutes",
        ],
      },
    },
  },
  required: ["readings"],
});

const assessmentResponseSchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["comprehension", "inference", "evidence"],
          },
          prompt: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" },
          },
          correctAnswer: { type: "string" },
          rationale: { type: "string" },
          distractorReasons: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          evidenceSpan: {
            type: "object",
            additionalProperties: false,
            properties: {
              paragraph: { type: "integer", minimum: 1 },
              start: { type: "integer", minimum: 0 },
              end: { type: "integer", minimum: 1 },
              text: { type: "string" },
            },
            required: ["paragraph", "start", "end", "text"],
          },
        },
        required: [
          "type",
          "prompt",
          "options",
          "correctAnswer",
          "rationale",
          "distractorReasons",
          "evidenceSpan",
        ],
      },
    },
  },
  required: ["items"],
});

function responseSchema(prompt) {
  return prompt.task.includes("readings")
    ? readingResponseSchema
    : assessmentResponseSchema;
}

function parseResponse(result) {
  const response = result?.response;
  if (response && typeof response === "object" && !Array.isArray(response)) {
    return response;
  }
  if (typeof response === "string") {
    try {
      const parsed = JSON.parse(response);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // 統一轉成不洩漏供應器原文的錯誤。
    }
  }
  throw new GenerationError(
    "generation_format_invalid",
    "Generation provider returned invalid JSON",
  );
}

export function createWorkersAiGenerationProvider({
  ai,
  model = DEFAULT_MODEL,
  maxRetries = 2,
}) {
  if (!ai || typeof ai.run !== "function") {
    throw new GenerationError(
      "generation_not_configured",
      "Workers AI binding is not configured",
    );
  }
  const retries = Math.min(Math.max(Number(maxRetries) || 0, 0), 2);
  return Object.freeze({
    async generate(prompt) {
      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const result = await ai.run(model, {
            messages: [
              { role: "system", content: prompt.system },
              {
                role: "user",
                content: JSON.stringify({
                  task: prompt.task,
                  untrusted_data: prompt.data,
                }),
              },
            ],
            response_format: {
              type: "json_schema",
              json_schema: responseSchema(prompt),
            },
            max_tokens: MAX_OUTPUT_TOKENS,
            stream: false,
          });
          return parseResponse(result);
        } catch (error) {
          if (error instanceof GenerationError) throw error;
          if (attempt === retries) {
            throw new GenerationError(
              "generation_provider_error",
              "Workers AI generation failed",
              { cause: error },
            );
          }
        }
      }
      throw new GenerationError(
        "generation_provider_error",
        "Workers AI generation failed",
      );
    },
  });
}
