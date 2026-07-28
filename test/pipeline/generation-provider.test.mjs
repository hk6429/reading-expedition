import assert from "node:assert/strict";
import test from "node:test";

import {
  GenerationError,
  createGenerationConfig,
} from "../../worker/src/pipeline/generation-provider.js";
import { createHttpGenerationProvider } from "../../worker/src/pipeline/http-generation-provider.js";

test("生成供應器只從環境取得 API base、model 與 secret", () => {
  const config = createGenerationConfig({
    GENERATION_API_BASE: "https://ai.example.test/v1",
    GENERATION_MODEL: "reading-model",
    GENERATION_API_KEY: "super-secret",
  });

  assert.equal(config.apiBase, "https://ai.example.test/v1");
  assert.equal(config.model, "reading-model");
  assert.equal(config.apiKey, "super-secret");
});

test("逾時、格式錯誤與拒答有明確錯誤類型且不洩漏 secret", async () => {
  const secret = "never-log-this";
  const provider = createHttpGenerationProvider({
    config: {
      apiBase: "https://ai.example.test/v1",
      model: "reading-model",
      apiKey: secret,
      timeoutMs: 20,
      maxRetries: 0,
    },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { refusal: "不能回答" } }],
        }),
        { headers: { "content-type": "application/json" } },
      ),
  });

  await assert.rejects(
    provider.generate({ system: "規則", data: { facts: [] } }),
    (error) =>
      error instanceof GenerationError &&
      error.code === "generation_refused" &&
      !error.message.includes(secret),
  );
});

test("相同策略遇暫時錯誤最多重試兩次", async () => {
  let calls = 0;
  const provider = createHttpGenerationProvider({
    config: {
      apiBase: "https://ai.example.test/v1",
      model: "reading-model",
      apiKey: "secret",
      timeoutMs: 100,
      maxRetries: 2,
    },
    fetchImpl: async () => {
      calls += 1;
      return new Response("busy", { status: 503 });
    },
  });

  await assert.rejects(
    provider.generate({ system: "規則", data: {} }),
    (error) => error.code === "generation_http_error",
  );
  assert.equal(calls, 3);
});
