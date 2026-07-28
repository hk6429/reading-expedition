import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultState,
  createLocalStore,
} from "../../src/storage/local-store.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    snapshot: () => Object.fromEntries(values),
  };
}

test("本機狀態可保存閱讀位置、城市與偏好", () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage);
  const state = createDefaultState("device-123");
  state.readingProgress["water-sharing-guided-v1"] = {
    paragraph: 2,
    offset: 18,
  };
  state.city.buildings.library = 1;
  state.preferences.mode = "night";

  store.save(state);
  const loaded = store.load();

  assert.equal(loaded.readingProgress["water-sharing-guided-v1"].paragraph, 2);
  assert.equal(loaded.city.buildings.library, 1);
  assert.equal(loaded.preferences.mode, "night");
});

test("壞 JSON 安全復原並保留原始備份", () => {
  const storage = memoryStorage({
    "reading-expedition:v1": "{broken",
  });
  const store = createLocalStore(storage, {
    createDeviceId: () => "recovered-device",
  });

  const loaded = store.load();
  const snapshot = storage.snapshot();

  assert.equal(loaded.deviceId, "recovered-device");
  assert.equal(
    snapshot["reading-expedition:backup:invalid"],
    "{broken",
  );
});

test("保存時拒絕規格禁止的個資欄位", () => {
  const store = createLocalStore(memoryStorage());
  const state = {
    ...createDefaultState("device-123"),
    email: "student@example.com",
  };

  assert.throws(() => store.save(state), /email/);
});

test("舊版狀態載入時補上事件簿、能力成長與章回解鎖，不清除既有城市", () => {
  const legacy = createDefaultState("device-123");
  delete legacy.readingHistory;
  delete legacy.abilityGrowth;
  delete legacy.city.storyUnlocks;
  legacy.completedReadings["water-sharing-guided-v1"] = {
    date: "2026-07-28",
    category: "world",
    skill: "理解與文證",
    evidence: "已完成文證定位",
  };
  legacy.city.buildings.library = 2;
  const storage = memoryStorage({
    "reading-expedition:v1": JSON.stringify(legacy),
  });

  const loaded = createLocalStore(storage).load();

  assert.equal(loaded.city.buildings.library, 2);
  assert.deepEqual(loaded.city.storyUnlocks, []);
  assert.deepEqual(loaded.abilityGrowth, {
    comprehension: 0,
    inference: 0,
    evidence: 1,
  });
  assert.equal(loaded.readingHistory.length, 1);
  assert.equal(loaded.readingHistory[0].date, "2026-07-28");
});

test("閱征紀錄可安全復原，含禁止欄位的檔案不會覆寫原狀態", () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage);
  const original = createDefaultState("device-original");
  store.save(original);
  const restored = createDefaultState("device-restored");
  restored.city.buildings.library = 3;

  const result = store.restore(JSON.stringify(restored));
  assert.equal(result.city.buildings.library, 3);
  assert.equal(store.load().deviceId, "device-restored");

  assert.throws(
    () => store.restore(JSON.stringify({ ...restored, email: "x@example.com" })),
    /email/,
  );
  assert.equal(store.load().deviceId, "device-restored");
});
