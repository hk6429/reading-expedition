import { GenerationError } from "./generation-provider.js";

const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_OUTPUT_TOKENS = 4000;

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
            response_format: { type: "json_object" },
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
