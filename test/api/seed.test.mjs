import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { seedReadingPackage } from "../../worker/src/db/seed.js";

const fixtureUrl = new URL("../fixtures/seed-reading-package.json", import.meta.url);

test("人工種子一次建立來源、事實包、雙難度與四題", async () => {
  const fixture = JSON.parse(await readFile(fixtureUrl, "utf8"));
  const statements = [];
  const db = {
    prepare(sql) {
      return {
        bind(...bindings) {
          return { sql, bindings };
        },
      };
    },
    async batch(batchStatements) {
      statements.push(...batchStatements);
      return batchStatements.map(() => ({ success: true }));
    },
  };

  const result = await seedReadingPackage(db, fixture);

  assert.deepEqual(result, {
    contentKey: "2026-07-28-water-sharing",
    packages: 2,
    assessmentItems: 4,
  });
  assert.equal(
    statements.filter(({ sql }) =>
      /INSERT(?: OR IGNORE)? INTO reading_packages/.test(sql),
    ).length,
    2,
  );
  assert.equal(
    statements.filter(({ sql }) =>
      /INSERT(?: OR IGNORE)? INTO assessment_items/.test(sql),
    ).length,
    4,
  );
});
