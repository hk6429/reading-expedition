import assert from "node:assert/strict";
import test from "node:test";

import { GenerationError } from "../../worker/src/pipeline/generation-provider.js";
import { createWorkersAiGenerationProvider } from "../../worker/src/pipeline/workers-ai-generation-provider.js";

const prompt = Object.freeze({
  system: "只輸出 JSON。",
  task: "產生 readings 陣列。",
  data: { factPack: { id: "fact-1" } },
});

test("Workers AI binding 使用受限輸出與 JSON schema，不需要外部 API key", async () => {
  const calls = [];
  const provider = createWorkersAiGenerationProvider({
    ai: {
      async run(model, input) {
        calls.push({ model, input });
        return { response: { readings: [] } };
      },
    },
    model: "@cf/meta/llama-3.1-8b-instruct-fast",
  });

  const result = await provider.generate(prompt);

  assert.deepEqual(result, { readings: [] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].model, "@cf/meta/llama-3.1-8b-instruct-fast");
  assert.equal(calls[0].input.max_tokens, 4000);
  assert.equal(calls[0].input.stream, false);
  assert.equal(calls[0].input.response_format.type, "json_schema");
  const readingSchema =
    calls[0].input.response_format.json_schema.properties.readings.items.properties;
  assert.equal(readingSchema.body.minItems, 4);
  assert.equal(readingSchema.body.items.properties.text.minLength, 110);
  assert.equal(readingSchema.glossary.maxItems, 0);
  assert.equal(calls[0].input.messages[0].role, "system");
  assert.match(calls[0].input.messages[1].content, /untrusted_data/);
});

test("Workers AI 可解析 JSON 字串，格式錯誤時回傳可判讀錯誤", async () => {
  const stringProvider = createWorkersAiGenerationProvider({
    ai: {
      async run() {
        return { response: '{"items":[]}' };
      },
    },
  });
  assert.deepEqual(await stringProvider.generate(prompt), { items: [] });

  const invalidProvider = createWorkersAiGenerationProvider({
    ai: {
      async run() {
        return { response: "not-json" };
      },
    },
    maxRetries: 0,
  });
  await assert.rejects(
    invalidProvider.generate(prompt),
    (error) =>
      error instanceof GenerationError &&
      error.code === "generation_format_invalid",
  );
});

test("Workers AI 暫時失敗最多重試兩次且錯誤不回顯供應器內容", async () => {
  let calls = 0;
  const provider = createWorkersAiGenerationProvider({
    ai: {
      async run() {
        calls += 1;
        throw new Error("internal provider details");
      },
    },
    maxRetries: 2,
  });

  await assert.rejects(
    provider.generate(prompt),
    (error) =>
      error instanceof GenerationError &&
      error.code === "generation_provider_error" &&
      !error.message.includes("internal provider details"),
  );
  assert.equal(calls, 3);
});
