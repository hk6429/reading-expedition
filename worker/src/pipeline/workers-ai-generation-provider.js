import { GenerationError } from "./generation-provider.js";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_OUTPUT_TOKENS = 2500;

const glossarySchema = Object.freeze({
  type: "object",
  additionalProperties: false,
  properties: {
    term: { type: "string" },
    definition: { type: "string" },
  },
  required: ["term", "definition"],
});

function readingResponseSchema({ classical }) {
  const paragraphSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      id: { type: "string" },
      text: {
        type: "string",
        minLength: classical ? 70 : 110,
        maxLength: classical ? 100 : 130,
      },
    },
    required: ["id", "text"],
  };
  return {
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
            textType: {
              type: "string",
              enum: [classical ? "classical" : "vernacular"],
            },
            title: { type: "string" },
            hookQuestion: { type: "string" },
            body: {
              type: "array",
              minItems: classical ? 2 : 4,
              maxItems: classical ? 3 : 4,
              items: paragraphSchema,
            },
            glossary: {
              type: "array",
              minItems: classical ? 3 : 0,
              maxItems: classical ? 8 : 0,
              items: glossarySchema,
            },
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
  };
}

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
            items: { type: "string", minLength: 1 },
          },
          correctIndex: { type: "integer", minimum: 0, maximum: 3 },
          rationale: { type: "string", minLength: 1 },
          distractorReasons: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string", minLength: 1 },
          },
          evidenceSpan: {
            type: "object",
            additionalProperties: false,
            properties: {
              paragraph: { type: "integer", minimum: 1 },
              start: { type: "integer", minimum: 0 },
              end: { type: "integer", minimum: 1 },
              text: { type: "string", minLength: 4, maxLength: 50 },
            },
            required: ["paragraph", "start", "end", "text"],
          },
        },
        required: [
          "type",
          "prompt",
          "options",
          "correctIndex",
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
    ? readingResponseSchema({ classical: prompt.task.includes("文言改寫") })
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
          if (
            error instanceof GenerationError &&
            error.code !== "generation_format_invalid"
          ) {
            throw error;
          }
          if (attempt === retries) {
            if (error instanceof GenerationError) throw error;
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
