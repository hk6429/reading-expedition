import { groupDailyRoutes } from "../domain/daily-routes.js";
import {
  LEVEL_ORDER,
  READING_LEVELS,
  recommendNextLevel,
} from "../domain/reading-level.js";
import { createRouteCard } from "./route-card.js";
import { createReadingJournal } from "./reading-journal.js";

function createChoiceButton({
  label,
  description,
  selected,
  onClick,
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `reading-choice${selected ? " is-selected" : ""}`;
  button.setAttribute("aria-pressed", String(selected));
  const title = document.createElement("strong");
  title.textContent = label;
  const copy = document.createElement("small");
  copy.textContent = description;
  button.append(title, copy);
  button.addEventListener("click", onClick);
  return button;
}

export function renderHome(
  container,
  readings,
  completedReadings = {},
  readingHistory = [],
  {
    preferences,
    onPreferencesChange,
  },
) {
  const selectedLevel = preferences.selectedLevel ?? "launch";
  const supportMode = preferences.supportMode ?? "guided";
  const routes = groupDailyRoutes(readings, {
    level: selectedLevel,
    supportMode,
  });
  container.replaceChildren();
  container.className = "home-view";

  const hero = document.createElement("section");
  hero.className = "home-hero";
  hero.setAttribute("aria-labelledby", "today-heading");
  hero.innerHTML = `
    <div class="hero-copy">
      <p class="chapter-label">今日十刻遠征</p>
      <h1 id="today-heading">今天，想從哪裡讀懂世界？</h1>
      <p class="hero-lead">
        不必一口氣讀完整座梁山。選一條航線，帶回一份可信的知識，就能讓浮城亮起一盞燈。
      </p>
      <div class="today-status" aria-label="今日任務狀態">
        <span>今日只需完成一篇</span>
        <span>約 6–10 分鐘</span>
        <span>中斷不會歸零</span>
      </div>
      <a class="placement-link" href="#/placement">${
        preferences.recommendedLevel
          ? `重做五分鐘測讀・目前建議 ${READING_LEVELS[preferences.recommendedLevel].label}`
          : "第一次使用？先做五分鐘測讀"
      }</a>
    </div>
    <picture class="hero-illustration">
      <source media="(max-width: 700px)" srcset="./assets/scenes/hero-960.webp">
      <img
        src="./assets/scenes/hero-1600.webp"
        width="1600"
        height="900"
        alt="六名Q版閱行伙伴站在雲海浮城，以書卷、羅盤與燈籠準備今日閱讀遠征"
        fetchpriority="high"
      >
    </picture>
  `;

  const chooser = document.createElement("section");
  chooser.className = "reading-chooser paper-panel";
  chooser.setAttribute("aria-labelledby", "chooser-heading");
  chooser.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">先選程度，再選陪讀方式</p>
        <h2 id="chooser-heading">三段文章，各有自己的閱讀路線</h2>
      </div>
      <p>程度只提供起點，不會鎖住文章；引導模式會多顯示段落與領航提示。</p>
    </div>
  `;
  const levelChoices = document.createElement("div");
  levelChoices.className = "reading-level-choices";
  levelChoices.setAttribute("aria-label", "閱讀程度");
  for (const level of LEVEL_ORDER) {
    const config = READING_LEVELS[level];
    levelChoices.append(
      createChoiceButton({
        label: config.label,
        description: config.description,
        selected: selectedLevel === level,
        onClick: () => {
          preferences.selectedLevel = level;
          onPreferencesChange(preferences);
        },
      }),
    );
  }
  const modeChoices = document.createElement("div");
  modeChoices.className = "reading-mode-choices";
  modeChoices.setAttribute("aria-label", "閱讀模式");
  for (const [mode, label, description] of [
    ["guided", "引導模式", "顯示段落路標與領航提示"],
    ["independent", "獨立模式", "保留點詞解釋，自己整理文章"],
  ]) {
    modeChoices.append(
      createChoiceButton({
        label,
        description,
        selected: supportMode === mode,
        onClick: () => {
          preferences.supportMode = mode;
          onPreferencesChange(preferences);
        },
      }),
    );
  }
  chooser.append(levelChoices, modeChoices);

  const recommendation = recommendNextLevel({
    currentLevel: selectedLevel,
    completedCount: readingHistory.length,
    lastPromptCount: preferences.lastLevelPromptCount ?? 0,
  });
  let recommendationPanel = null;
  if (recommendation) {
    recommendationPanel = document.createElement("section");
    recommendationPanel.className = "level-recommendation";
    const suggested = READING_LEVELS[recommendation.suggestedLevel];
    recommendationPanel.innerHTML = `
      <div>
        <p class="chapter-label">已完成 ${recommendation.promptAt} 篇</p>
        <h2>可以試試 ${suggested.label}</h2>
        <p>${suggested.description}。這只是邀請，不會自動升級。</p>
      </div>
    `;
    const actions = document.createElement("div");
    const tryButton = document.createElement("button");
    tryButton.type = "button";
    tryButton.className = "primary-action";
    tryButton.textContent = `試試 ${suggested.label}`;
    tryButton.addEventListener("click", () => {
      preferences.selectedLevel = recommendation.suggestedLevel;
      preferences.lastLevelPromptCount = recommendation.promptAt;
      onPreferencesChange(preferences);
    });
    const later = document.createElement("button");
    later.type = "button";
    later.textContent = "先維持目前程度";
    later.addEventListener("click", () => {
      preferences.lastLevelPromptCount = recommendation.promptAt;
      onPreferencesChange(preferences);
    });
    actions.append(tryButton, later);
    recommendationPanel.append(actions);
  }

  const routeSection = document.createElement("section");
  routeSection.className = "route-section";
  routeSection.setAttribute("aria-labelledby", "routes-heading");
  routeSection.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">三路同行</p>
        <h2 id="routes-heading">${READING_LEVELS[selectedLevel].label}文章庫</h2>
      </div>
      <p>${supportMode === "guided" ? "引導模式會陪你找段落線索。" : "獨立模式保留點詞解釋，其餘由你判斷。"}</p>
    </div>
  `;

  const grid = document.createElement("div");
  grid.className = "route-grid";
  for (const route of routes) {
    grid.append(
      createRouteCard(route, {
        level: selectedLevel,
        supportMode,
        onStart: (reading) => {
          preferences.selectedLevel = selectedLevel;
          preferences.supportMode = supportMode;
          onPreferencesChange(preferences, { navigate: false });
          window.location.hash = `#/read/${reading.id}`;
        },
      }),
    );
  }
  if (routes.length === 0) {
    const empty = document.createElement("section");
    empty.className = "paper-panel";
    empty.innerHTML = `
      <p class="chapter-label">文章庫正在補卷</p>
      <h3>這個程度今天還沒有可讀文章</h3>
      <p>可以先選另一個程度；你的推薦與完成紀錄都不會受影響。</p>
    `;
    grid.append(empty);
  }
  routeSection.append(grid);

  container.append(
    hero,
    chooser,
    ...(recommendationPanel ? [recommendationPanel] : []),
    routeSection,
    createReadingJournal(completedReadings, readingHistory),
  );
}
