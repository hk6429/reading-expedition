import { GenerationError } from "./generation-provider.js";

function safeHttpError(status) {
  return new GenerationError(
    "generation_http_error",
    `Generation provider responded with HTTP ${status}`,
  );
}

function parseGeneratedPayload(payload) {
  const message = payload?.choices?.[0]?.message;
  if (message?.refusal) {
    throw new GenerationError(
      "generation_refused",
      "Generation provider declined the request",
    );
  }
  const content = message?.content ?? payload?.output;
  if (content && typeof content === "object") return content;
  if (typeof content !== "string") {
    throw new GenerationError(
      "generation_format_invalid",
      "Generation provider returned an unsupported response",
    );
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new GenerationError(
      "generation_format_invalid",
      "Generation provider returned invalid JSON",
    );
  }
}

export function createHttpGenerationProvider({ config, fetchImpl = fetch }) {
  return Object.freeze({
    async generate(prompt) {
      let lastError;
      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
        try {
          const response = await fetchImpl(`${config.apiBase}/chat/completions`, {
            method: "POST",
            signal: controller.signal,
            headers: {
              authorization: `Bearer ${config.apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: config.model,
              response_format: { type: "json_object" },
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
            }),
          });
          if (!response.ok) throw safeHttpError(response.status);
          let payload;
          try {
            payload = await response.json();
          } catch {
            throw new GenerationError(
              "generation_format_invalid",
              "Generation provider returned invalid JSON",
            );
          }
          return parseGeneratedPayload(payload);
        } catch (error) {
          if (error?.name === "AbortError") {
            lastError = new GenerationError(
              "generation_timeout",
              "Generation provider timed out",
            );
          } else if (error instanceof GenerationError) {
            lastError = error;
          } else {
            lastError = new GenerationError(
              "generation_network_error",
              "Generation provider request failed",
              { cause: error },
            );
          }
          const retryable = [
            "generation_timeout",
            "generation_network_error",
            "generation_http_error",
          ].includes(lastError.code);
          if (!retryable || attempt === config.maxRetries) throw lastError;
        } finally {
          clearTimeout(timeout);
        }
      }
      throw lastError;
    },
  });
}
