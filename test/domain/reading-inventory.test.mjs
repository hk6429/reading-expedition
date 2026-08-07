import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReadingInventory,
  nextUnreadReading,
} from "../../src/domain/reading-inventory.js";

const readings = [
  {
    id: "topic-guided",
    contentKey: "topic",
    title: "引導卷",
    level: "launch",
    supportMode: "guided",
  },
  {
    id: "topic-challenge",
    contentKey: "topic",
    title: "獨立卷",
    level: "launch",
    supportMode: "independent",
  },
];

test("書架以主題計數，雙模式不重複占用總篇數", () => {
  const inventory = buildReadingInventory(readings, {}, { level: "launch" });
  assert.equal(inventory.totalCount, 1);
  assert.equal(inventory.entries[0].reading.id, "topic-guided");
});

test("啟航只有一篇且已完成時顯示全數讀完狀態，不歸零", () => {
  const completed = {
    "topic-guided": { date: "2026-08-06" },
  };
  const inventory = buildReadingInventory(readings, completed, {
    level: "launch",
    unreadOnly: true,
  });
  assert.equal(inventory.totalCount, 1);
  assert.equal(inventory.completedCount, 1);
  assert.equal(inventory.allCompleted, true);
  assert.deepEqual(inventory.entries, []);
});

test("完成引導版後切換獨立模式，仍顯示偏好版本並保留主題完成狀態", () => {
  const completed = {
    "topic-guided": { date: "2026-08-06", finalCorrectCount: 2 },
  };
  const inventory = buildReadingInventory(readings, completed, {
    level: "launch",
    supportMode: "independent",
  });
  assert.equal(inventory.entries[0].reading.id, "topic-challenge");
  assert.equal(inventory.entries[0].completionReadingId, "topic-guided");
  assert.equal(inventory.entries[0].completion.finalCorrectCount, 2);
});

test("個人閱讀只接續一篇未讀挑戰，完成後往下一篇", () => {
  const expanded = [
    ...readings,
    {
      id: "another-guided",
      contentKey: "another",
      title: "第二篇",
      level: "launch",
      supportMode: "guided",
    },
  ];
  const first = nextUnreadReading(expanded, {}, {
    level: "launch",
    supportMode: "guided",
  });
  const second = nextUnreadReading(
    expanded,
    { [first.id]: { date: "2026-08-06" } },
    {
      level: "launch",
      supportMode: "guided",
      currentReadingId: first.id,
    },
  );

  assert.ok(first);
  assert.ok(second);
  assert.notEqual(second.id, first.id);
});
