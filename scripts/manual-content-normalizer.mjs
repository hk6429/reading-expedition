import fs from "node:fs";

function normalizeDistractorReasons(fixture) {
  for (const reading of fixture.packages ?? []) {
    for (const item of reading.assessment ?? []) {
      if (!Array.isArray(item.distractorReasons)) continue;
      item.distractorReasons = Object.fromEntries(
        (item.options ?? [])
          .map((option, index) => [option, item.distractorReasons[index]])
          .filter(
            ([option, reason]) =>
              option !== item.correctAnswer &&
              typeof reason === "string" &&
              reason.trim().length > 0,
          ),
      );
    }
  }
  return fixture;
}

function normalizeEvidenceSpans(fixture) {
  for (const reading of fixture.packages ?? []) {
    for (const item of reading.assessment ?? []) {
      const span = item.evidenceSpan;
      const paragraph = reading.body?.[span?.paragraph - 1];
      if (
        typeof paragraph !== "string" ||
        typeof span?.text !== "string"
      ) {
        continue;
      }
      const exactStart = paragraph.indexOf(span.text);
      const sourceStart =
        exactStart >= 0
          ? exactStart
          : Number.isInteger(span.start) &&
              span.start >= 0 &&
              span.start < paragraph.length
            ? span.start
            : -1;
      if (sourceStart < 0) continue;
      const requestedLength = Math.max(8, Math.min(span.text.length, 30));
      const preciseText = paragraph.slice(
        sourceStart,
        sourceStart + requestedLength,
      );
      if (preciseText.length < 8) continue;
      span.start = sourceStart;
      span.end = sourceStart + preciseText.length;
      span.text = preciseText;
    }
  }
  return fixture;
}

export function normalizeManualContent(fixture) {
  return normalizeEvidenceSpans(normalizeDistractorReasons(fixture));
}

export function normalizeManualContentFile(file) {
  const fixture = JSON.parse(fs.readFileSync(file, "utf8"));
  fs.writeFileSync(
    file,
    `${JSON.stringify(normalizeManualContent(fixture), null, 2)}\n`,
  );
}
