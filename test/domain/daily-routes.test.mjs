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
