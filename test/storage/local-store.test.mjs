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
