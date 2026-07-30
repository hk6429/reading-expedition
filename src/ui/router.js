export function createRouter({
  onHome,
  onRead,
  onQuiz,
  onCity,
  onCityInvest,
  onGuide,
  onTeacher,
  onClass,
  onPlacement,
  onFamily,
}) {
  async function renderRoute(render) {
    await render();
    window.scrollTo(0, 0);
    const heading = document.querySelector("main h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  async function navigate() {
    if (window.location.hash === "#/placement") {
      if (onPlacement) await renderRoute(onPlacement);
      return;
    }
    if (window.location.hash === "#/family") {
      if (onFamily) await renderRoute(onFamily);
      return;
    }
    if (window.location.hash === "#/guide") {
      if (onGuide) await renderRoute(onGuide);
      return;
    }
    if (window.location.hash === "#/class") {
      if (onClass) await renderRoute(onClass);
      return;
    }
    if (window.location.hash.startsWith("#/teacher")) {
      if (onTeacher) {
        const [teacherPath, teacherQuery = ""] =
          window.location.hash.slice(1).split("?");
        const teacherStatus =
          new URLSearchParams(teacherQuery).get("status") ?? "review";
        await renderRoute(() =>
          onTeacher(
            teacherPath === "/teacher/classes" ? "classes" : "review",
            teacherStatus,
          ),
        );
      }
      return;
    }
    const cityMatch = /^#\/city\/invest\/([a-zA-Z0-9-]+)$/.exec(
      window.location.hash,
    );
    if (cityMatch) {
      if (onCityInvest) {
        await renderRoute(() => onCityInvest(cityMatch[1]));
      }
      return;
    }
    if (window.location.hash === "#/city") {
      if (onCity) await renderRoute(onCity);
      return;
    }
    const quizMatch = /^#\/quiz\/([a-zA-Z0-9-]+)$/.exec(
      window.location.hash,
    );
    if (quizMatch) {
      await renderRoute(() => onQuiz(quizMatch[1]));
      return;
    }
    const readMatch = /^#\/read\/([a-zA-Z0-9-]+)$/.exec(
      window.location.hash,
    );
    if (readMatch) {
      await renderRoute(() => onRead(readMatch[1]));
      return;
    }
    await renderRoute(onHome);
  }

  window.addEventListener("hashchange", navigate);
  return Object.freeze({ navigate });
}
