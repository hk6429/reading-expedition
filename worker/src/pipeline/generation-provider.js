export class GenerationError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "GenerationError";
    this.code = code;
  }
}

export function createGenerationConfig(env) {
  const apiBase = env.GENERATION_API_BASE;
  const model = env.GENERATION_MODEL;
  const apiKey = env.GENERATION_API_KEY;
  if (!apiBase || !model || !apiKey) {
    throw new GenerationError(
      "generation_not_configured",
      "Generation provider is not configured",
    );
  }
  let parsedBase;
  try {
    parsedBase = new URL(apiBase);
  } catch {
    throw new GenerationError(
      "generation_config_invalid",
      "Generation API base is invalid",
    );
  }
  if (parsedBase.protocol !== "https:") {
    throw new GenerationError(
      "generation_config_invalid",
      "Generation API base must use HTTPS",
    );
  }
  return Object.freeze({
    apiBase: parsedBase.toString().replace(/\/$/, ""),
    model,
    apiKey,
    timeoutMs: Number(env.GENERATION_TIMEOUT_MS ?? 30_000),
    maxRetries: Math.min(Number(env.GENERATION_MAX_RETRIES ?? 2), 2),
  });
}
