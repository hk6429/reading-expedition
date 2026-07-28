export function createRouter({ onHome, onRead, onQuiz }) {
  async function navigate() {
    const quizMatch = /^#\/quiz\/([a-zA-Z0-9-]+)$/.exec(
      window.location.hash,
    );
    if (quizMatch) {
      await onQuiz(quizMatch[1]);
      return;
    }
    const readMatch = /^#\/read\/([a-zA-Z0-9-]+)$/.exec(
      window.location.hash,
    );
    if (readMatch) {
      await onRead(readMatch[1]);
      return;
    }
    await onHome();
  }

  window.addEventListener("hashchange", navigate);
  return Object.freeze({ navigate });
}
