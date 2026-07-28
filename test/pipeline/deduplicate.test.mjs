import assert from "node:assert/strict";
import test from "node:test";

import { deduplicateCandidates } from "../../worker/src/pipeline/deduplicate.js";

test("候選題材同時以網址、標題與事實指紋去重", () => {
  const candidates = [
    {
      id: "a",
      canonicalUrl: "https://source.test/a",
      title: "海水為何升高？",
      factFingerprint: "same-fact",
    },
    {
      id: "url-copy",
      canonicalUrl: "https://source.test/a#top",
      title: "另一標題",
      factFingerprint: "another-fact",
    },
    {
      id: "title-copy",
      canonicalUrl: "https://source.test/b",
      title: "海水為何升高",
      factFingerprint: "third-fact",
    },
    {
      id: "fact-copy",
      canonicalUrl: "https://source.test/c",
      title: "不同標題",
      factFingerprint: "same-fact",
    },
  ];

  const result = deduplicateCandidates(candidates);

  assert.deepEqual(result.unique.map(({ id }) => id), ["a"]);
  assert.equal(result.duplicates.length, 3);
});
