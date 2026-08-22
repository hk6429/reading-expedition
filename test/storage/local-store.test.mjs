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
  legacy.schemaVersion = 1;
  delete legacy.readingHistory;
  delete legacy.abilityGrowth;
  delete legacy.abilityMastery;
  delete legacy.diagnosticHistory;
  delete legacy.placement;
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
  assert.equal(loaded.schemaVersion, 2);
  assert.deepEqual(loaded.diagnosticHistory, []);
  assert.deepEqual(loaded.abilityMastery.unlockedEquipment, []);
  assert.equal(loaded.preferences.selectedLevel, "launch");
  assert.equal(loaded.preferences.supportMode, "guided");
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
  assert.equal(result.city.buildings.library, 0);
  assert.equal(store.load().deviceId, "device-restored");

  assert.throws(
    () => store.restore(JSON.stringify({ ...restored, email: "x@example.com" })),
    /email/,
  );
  assert.equal(store.load().deviceId, "device-restored");
});

test("匯入時依有效閱讀與診斷重算獎勵、建築與能力，不信任任意數值", () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage);
  const imported = createDefaultState("device-imported");
  imported.readingHistory = [
    {
      id: "reading-1:2026-08-01",
      readingId: "reading-1",
      date: "2026-08-01",
      category: "science",
      skill: "evidence",
      title: "文章一",
      evidence: "原文證據",
      mainlineReward: true,
    },
  ];
  imported.completedReadings["reading-1"] = {
    date: "2026-08-01",
    category: "science",
    skill: "理解與文證",
    evidence: "原文證據",
    evidenceSubmitted: true,
    assessmentPassed: true,
    reward: 9999,
    rewards: {
      inkBricks: 9999,
      fellowshipSeals: 9999,
      type: "building",
      title: "偽造獎勵",
    },
  };
  imported.city.materials.inkBricks = 999999;
  imported.city.materials.fellowshipSeals = 999999;
  imported.city.buildings.library = 5;
  imported.abilityGrowth.evidence = 999999;

  const restored = store.restore(JSON.stringify(imported));

  assert.equal(restored.completedReadings["reading-1"].reward, 5);
  assert.equal(restored.city.materials.inkBricks, 5);
  assert.equal(restored.city.materials.fellowshipSeals, 0);
  assert.equal(restored.city.buildings.library, 0);
  assert.equal(restored.abilityGrowth.evidence, 0);
});

test("可從含資料字典的作品集包裝還原學習狀態", () => {
  const storage = memoryStorage();
  const store = createLocalStore(storage);
  const state = createDefaultState("device-portfolio");
  const restored = store.restore(
    JSON.stringify({
      kind: "reading-expedition-portfolio",
      version: 1,
      dataDictionary: {},
      privacy: {},
      learningState: state,
    }),
  );
  assert.equal(restored.deviceId, "device-portfolio");
});
