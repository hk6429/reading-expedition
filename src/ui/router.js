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
  onBookshelf,
  onRest,
  afterRoute,
}) {
  function applyRouteContext() {
    const hash = window.location.hash || "#/";
    const heading = document.querySelector("main h1");
    const routeTitle = heading?.textContent?.trim() || "個人閱讀首頁";
    document.title = `${routeTitle}｜萬卷浮城`;

    document.querySelectorAll(".site-nav a[aria-current]").forEach((link) => {
      link.removeAttribute("aria-current");
    });
    const activeHref = hash.startsWith("#/city")
      ? "#/city"
      : hash.startsWith("#/teacher")
        ? "#/teacher"
        : hash.startsWith("#/read") || hash.startsWith("#/quiz")
          ? "#/bookshelf"
          : hash.split("?")[0];
    const current = [...document.querySelectorAll(".site-nav a")].find(
      (link) => link.getAttribute("href") === activeHref,
    );
    current?.setAttribute("aria-current", "page");

    const status = document.querySelector("#route-status");
    if (status) status.textContent = `已前往：${routeTitle}`;
  }

  async function renderRoute(render) {
    await render();
    applyRouteContext();
    if (afterRoute) await afterRoute();
    window.scrollTo(0, 0);
    const heading = document.querySelector(
      ".backup-reminder h2, main h1",
    );
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }

  async function navigate() {
    if (window.location.hash === "#/rest") {
      if (onRest) await renderRoute(onRest);
      return;
    }
    if (window.location.hash === "#/placement") {
      if (onPlacement) await renderRoute(onPlacement);
      return;
    }
    if (window.location.hash === "#/family") {
      if (onFamily) await renderRoute(onFamily);
      return;
    }
    if (window.location.hash === "#/bookshelf") {
      if (onBookshelf) await renderRoute(onBookshelf);
      return;
    }
    if (window.location.hash === "#/guide") {
      if (onGuide) await renderRoute(onGuide);
      return;
    }
    if (window.location.hash.startsWith("#/class")) {
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
