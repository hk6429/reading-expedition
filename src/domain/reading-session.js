function assertPosition(position) {
  if (!Number.isInteger(position.paragraph) || position.paragraph < 0) {
    throw new TypeError("paragraph must be a non-negative integer");
  }
  if (!Number.isInteger(position.offset) || position.offset < 0) {
    throw new TypeError("offset must be a non-negative integer");
  }
  if (
    typeof position.progress !== "number" ||
    position.progress < 0 ||
    position.progress > 1
  ) {
    throw new TypeError("progress must be between 0 and 1");
  }
}

export function createReadingSession(state, save) {
  if (!state?.readingProgress || typeof save !== "function") {
    throw new TypeError("reading state and save callback are required");
  }

  return Object.freeze({
    updatePosition(readingId, position) {
      assertPosition(position);
      state.readingProgress[readingId] = { ...position };
      save(state);
    },
    positionForSwitch(contentKey, _targetId, targetParagraphs) {
      const source = Object.values(state.readingProgress)
        .filter((position) => position.contentKey === contentKey)
        .at(-1);
      if (!source) {
        return { paragraph: 0, offset: 0, progress: 0 };
      }
      return {
        paragraph: Math.min(
          targetParagraphs - 1,
          Math.floor(source.progress * targetParagraphs),
        ),
        offset: 0,
        progress: source.progress,
      };
    },
  });
}
