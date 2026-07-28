export function createRouter({ onHome, onRead, onQuiz, onCityInvest, onGuide, onTeacher, onClass }) {
  async function navigate() {
    if (window.location.hash === "#/guide") {
      if (onGuide) await onGuide();
      return;
    }
    if (window.location.hash === "#/class") {
      if (onClass) await onClass();
      return;
    }
    if (window.location.hash.startsWith("#/teacher")) {
      if (onTeacher) {
        await onTeacher(
          window.location.hash === "#/teacher/classes" ? "classes" : "review",
        );
      }
      return;
    }
    const cityMatch = /^#\/city\/invest\/([a-zA-Z0-9-]+)$/.exec(
      window.location.hash,
    );
    if (cityMatch) {
      if (onCityInvest) await onCityInvest(cityMatch[1]);
      return;
    }
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
