import { READING_LEVELS } from "../domain/reading-level.js";
import { waterMarginTheme } from "../theme/water-margin.js";

const CATEGORY_COPY = Object.freeze({
  world: {
    mentor: "武松領航",
    description: "從事件、制度與地理脈絡，讀懂遠方正在發生什麼。",
    reward: "可帶回天下驛站，收藏世界議題與制度線索",
  },
  science: {
    mentor: "吳用領航",
    description: "從證據與機制追問原因，把驚奇變成可以檢查的問題。",
    reward: "可帶回百工水寨，收藏科學機制與證據",
  },
  humanities: {
    mentor: "魯智深領航",
    description: "從人物的選擇與感受，看見同一件事裡不同的聲音。",
    reward: "可帶回聚義書樓，收藏人物故事與金句",
  },
});

export function createRouteCard(
  route,
  { level = "launch", supportMode = "guided", onStart },
) {
  const copy = CATEGORY_COPY[route.category];
  const reading = route.reading;
  const article = document.createElement("article");
  article.className = `route-card route-${route.category}`;
  article.dataset.category = route.category;

  const header = document.createElement("div");
  header.className = "route-card__header";
  header.innerHTML = `
    <img
      class="route-art"
      src="./assets/scenes/${route.category}-720.webp"
      alt=""
      width="720"
      height="540"
      loading="lazy"
    >
    <div>
      <p class="route-mentor">${copy.mentor}</p>
      <h2>${waterMarginTheme.categoryLabels[route.category]}</h2>
    </div>
  `;

  const body = document.createElement("div");
  body.className = "route-card__body";
  const levelCopy = READING_LEVELS[level] ?? READING_LEVELS.launch;
  body.innerHTML = `
    <p>${copy.description}</p>
    <span class="route-level-badge">${levelCopy.label}・${supportMode === "guided" ? "引導模式" : "獨立模式"}</span>
    <h3>${reading.title}</h3>
    <p class="route-question">${reading.hookQuestion}</p>
    <p class="route-reward">${copy.reward}</p>
  `;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-action route-start";
  button.textContent = `開始 ${reading.readingMinutes} 分鐘閱讀`;
  button.setAttribute(
    "aria-label",
    `${levelCopy.label}，${supportMode === "guided" ? "引導模式" : "獨立模式"}：${reading.title}`,
  );
  button.addEventListener("click", () => onStart(reading));
  article.append(header, body, button);
  return article;
}
