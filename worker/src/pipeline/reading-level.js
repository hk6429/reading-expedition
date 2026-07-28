function sentenceLengths(reading) {
  const text = reading.body.map(({ text: paragraph }) => paragraph).join("");
  return text
    .split(/[。！？!?]/)
    .map((sentence) => sentence.replace(/\s/g, "").length)
    .filter(Boolean);
}

export function measureReadingLevel(reading) {
  const lengths = sentenceLengths(reading);
  const characters = reading.body
    .map(({ text }) => text)
    .join("")
    .replace(/\s/g, "").length;
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
  return {
    ok:
      guidedLevel.characters <= challengeLevel.characters &&
      guidedLevel.averageSentenceLength <=
        challengeLevel.averageSentenceLength + 2,
    guided: guidedLevel,
    challenge: challengeLevel,
  };
}
