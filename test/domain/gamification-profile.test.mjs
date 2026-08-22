import assert from "node:assert/strict";
import test from "node:test";

import {
  createGamificationProfile,
  cityThemeTokens,
  deriveMissionProgress,
  loadGamificationProfile,
  saveGamificationProfile,
  updateGamificationProfile,
} from "../../src/domain/gamification-profile.js";

test("個人化任務設定使用安全預設值，且只接受白名單選項", () => {
  const profile = createGamificationProfile({
    readerIdentity: "排行榜冠軍",
    dailyIntent: "evidence",
    timeBudget: 10,
    contentCategory: "science",
    weeklyTarget: 3,
    weeklyAbility: "inference",
    cityTheme: "night",
  });

  assert.equal(profile.readerIdentity, null);
  assert.equal(profile.dailyIntent, "evidence");
  assert.equal(profile.timeBudget, 10);
  assert.equal(profile.contentCategory, "science");
  assert.equal(profile.weeklyTarget, 3);
  assert.equal(profile.weeklyAbility, "inference");
  assert.equal(profile.cityTheme, "night");

  const changed = updateGamificationProfile(profile, {
    readerIdentity: "curator",
    timeBudget: 99,
  });
  assert.equal(changed.readerIdentity, "curator");
  assert.equal(changed.timeBudget, 10);
});

test("三種城市外觀都有確定且安全的色彩設定", () => {
  assert.deepEqual(cityThemeTokens("forest"), {
    "--panel-background": "#f3f7ef",
    "--chip-background": "#e2eddd",
    "--mineral-blue": "#527269",
    "--mineral-green": "#446b50",
  });
  assert.deepEqual(cityThemeTokens("unknown"), cityThemeTokens("dawn"));
});

test("每週進度由閱讀與能力證據衍生，久未閱讀只提供溫和回歸任務", () => {
  const profile = createGamificationProfile({
    weeklyTarget: 3,
    weeklyAbility: "inference",
  });
  const progress = deriveMissionProgress({
    profile,
    now: new Date("2026-08-22T12:00:00+08:00"),
    readingHistory: [
      { readingId: "old", date: "2026-08-01" },
      { readingId: "a", date: "2026-08-17" },
      { readingId: "a", date: "2026-08-17" },
      { readingId: "b", date: "2026-08-20" },
    ],
    abilityMastery: {
      skills: {
        inference: {
          successes: [
            { readingId: "a", date: "2026-08-17" },
            { readingId: "b", date: "2026-08-20" },
          ],
        },
      },
    },
  });

  assert.deepEqual(progress.weeklyReading, {
    completed: 2,
    target: 3,
    percent: 67,
  });
  assert.deepEqual(progress.weeklyAbility, {
    ability: "inference",
    completed: 2,
    target: 3,
    percent: 67,
  });
  assert.equal(progress.returnMission, null);

  const returning = deriveMissionProgress({
    profile,
    now: new Date("2026-08-22T12:00:00+08:00"),
    readingHistory: [{ readingId: "old", date: "2026-08-01" }],
  });
  assert.equal(returning.returnMission.title, "先讀一小段，找回熟悉感");
  assert.match(returning.returnMission.message, /不補進度/);
});

test("專用儲存只寫入版本化設定，損壞資料會安全回到預設值", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const saved = saveGamificationProfile(storage, {
    readerIdentity: "scout",
    cityName: "星圖城<script>",
    weeklyTarget: 5,
    extraSecret: "不應保存",
  });

  assert.equal(saved.readerIdentity, "scout");
  assert.equal(saved.cityName, "星圖城script");
  assert.equal(JSON.parse([...values.values()][0]).extraSecret, undefined);
  assert.deepEqual(loadGamificationProfile(storage), saved);

  values.set([...values.keys()][0], "{broken");
  assert.equal(loadGamificationProfile(storage).readerIdentity, null);
});

test("可選本週休息且不產生除以零或欠篇壓力", () => {
  const profile = createGamificationProfile({ weeklyTarget: 0 });
  const progress = deriveMissionProgress({
    profile,
    readingHistory: [{ readingId: "a", date: "2026-08-20" }],
    now: new Date("2026-08-22T12:00:00+08:00"),
  });

  assert.deepEqual(progress.weeklyReading, {
    completed: 1,
    target: 0,
    percent: 0,
  });
});
