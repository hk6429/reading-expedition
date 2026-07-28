import { readingText } from "./content-profile.js";

function sentenceLengths(reading) {
  const text = readingText(reading);
  return text
    .split(/[。！？!?]/)
    .map((sentence) => sentence.replace(/\s/g, "").length)
    .filter(Boolean);
}

export function measureReadingLevel(reading) {
  const lengths = sentenceLengths(reading);
  const characters = readingText(reading).replace(/\s/g, "").length;
  return {
    characters,
    averageSentenceLength:
      lengths.length === 0
        ? 0
        : lengths.reduce((sum, value) => sum + value, 0) / lengths.length,
    glossaryCount: reading.glossary?.length ?? 0,
  };
}

export function compareDifficultyLevels(guided, challenge) {
  const guidedLevel = measureReadingLevel(guided);
  const challengeLevel = measureReadingLevel(challenge);
  const meaningfullyLonger =
    challengeLevel.characters >= Math.ceil(guidedLevel.characters * 1.05);
  const sentenceLoadHigher =
    challengeLevel.averageSentenceLength >=
    guidedLevel.averageSentenceLength + 1;
  const glossaryLoadHigher =
    challengeLevel.glossaryCount > guidedLevel.glossaryCount;
  return {
    ok:
      guidedLevel.characters <= challengeLevel.characters &&
      (meaningfullyLonger || sentenceLoadHigher || glossaryLoadHigher),
    guided: guidedLevel,
    challenge: challengeLevel,
  };
}
