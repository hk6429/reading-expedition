import assert from "node:assert/strict";
import test from "node:test";

import { groupDailyRoutes } from "../../src/domain/daily-routes.js";

const readings = [
  { id: "w-launch", category: "world", level: "launch" },
  { id: "s-launch", category: "science", level: "launch" },
  { id: "h-launch", category: "humanities", level: "launch" },
  {
    id: "w-tower-guided",
    category: "world",
    level: "tower",
    supportMode: "guided",
  },
  {
    id: "w-tower-independent",
    category: "world",
    level: "tower",
    supportMode: "independent",
  },
];

test("首頁依啟航、行舟、登樓文章庫篩選，不混用不同程度", () => {
  const routes = groupDailyRoutes(readings, {
    level: "launch",
    supportMode: "guided",
  });

  assert.deepEqual(
    routes.map(({ category, reading }) => [category, reading.id]),
    [
      ["world", "w-launch"],
      ["science", "s-launch"],
      ["humanities", "h-launch"],
    ],
  );
});

test("同程度有多篇時優先選符合引導或獨立模式的文章", () => {
  const guided = groupDailyRoutes(readings, {
    level: "tower",
    supportMode: "guided",
  });
  const independent = groupDailyRoutes(readings, {
    level: "tower",
    supportMode: "independent",
  });

  assert.equal(guided[0].reading.id, "w-tower-guided");
  assert.equal(independent[0].reading.id, "w-tower-independent");
});

test("缺少某航線時不捏造假文章", () => {
  const routes = groupDailyRoutes(readings, {
    level: "tower",
    supportMode: "guided",
  });
  assert.deepEqual(routes.map(({ category }) => category), ["world"]);
});

test("每日航線排除已完成文章，且同一種子決定性挑選", () => {
  const inventory = [
    ...readings,
    { id: "w-launch-2", category: "world", level: "launch" },
    { id: "w-launch-3", category: "world", level: "launch" },
  ];
  const options = {
    level: "launch",
    completedIds: ["w-launch"],
    selectionSeed: "2026-08-06:child-1",
  };
  const first = groupDailyRoutes(inventory, options);
  const second = groupDailyRoutes([...inventory].reverse(), options);

  assert.notEqual(first[0].reading.id, "w-launch");
  assert.deepEqual(
    first.map(({ reading }) => reading.id),
    second.map(({ reading }) => reading.id),
  );
});

test("該階段全數完成時回傳空航線，不把已讀誤當未讀", () => {
  const completedIds = readings
    .filter(({ level }) => level === "launch")
    .map(({ id }) => id);
  assert.deepEqual(
    groupDailyRoutes(readings, { level: "launch", completedIds }),
    [],
  );
});

test("同主題任一模式完成後，不會立刻改推另一個模式", () => {
  const sameTopic = [
    {
      id: "water-guided",
      contentKey: "water",
      category: "world",
      level: "launch",
      supportMode: "guided",
    },
    {
      id: "water-challenge",
      contentKey: "water",
      category: "world",
      level: "launch",
      supportMode: "independent",
    },
  ];

  assert.deepEqual(
    groupDailyRoutes(sameTopic, {
      level: "launch",
      supportMode: "guided",
      completedIds: ["water-guided"],
      selectionSeed: "2026-08-06:child-a",
    }),
    [],
  );
});
