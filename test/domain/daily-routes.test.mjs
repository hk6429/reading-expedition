import assert from "node:assert/strict";
import test from "node:test";

import { groupDailyRoutes } from "../../src/domain/daily-routes.js";

const readings = [
  { id: "w-g", category: "world", difficulty: "guided" },
  { id: "w-c", category: "world", difficulty: "challenge" },
  { id: "s-g", category: "science", difficulty: "guided" },
  { id: "s-c", category: "science", difficulty: "challenge" },
  { id: "h-g", category: "humanities", difficulty: "guided" },
  { id: "h-c", category: "humanities", difficulty: "challenge" },
];

test("每日六篇整理成三條平權航線與雙難度", () => {
  const routes = groupDailyRoutes(readings);

  assert.deepEqual(
    routes.map(({ category }) => category),
    ["world", "science", "humanities"],
  );
  for (const route of routes) {
    assert.equal(route.versions.guided.category, route.category);
    assert.equal(route.versions.challenge.category, route.category);
  }
});

test("缺少任一難度時仍保留航線，但不捏造假選項", () => {
  const routes = groupDailyRoutes(readings.filter(({ id }) => id !== "s-c"));
  const science = routes.find(({ category }) => category === "science");

  assert.equal(science.versions.guided.id, "s-g");
  assert.equal(science.versions.challenge, null);
});
