import { waterMarginTheme } from "../theme/water-margin.js";

const CATEGORY_COPY = Object.freeze({
  world: {
    mentor: "武松領航",
    description: "從事件、制度與地理脈絡，讀懂遠方正在發生什麼。",
    mark: "海",
    reward: "可帶回天下驛站，收藏世界議題與制度線索",
  },
  science: {
    mentor: "吳用領航",
    description: "從證據與機制追問原因，把驚奇變成可以檢查的問題。",
    mark: "理",
    reward: "可帶回百工水寨，收藏科學機制與證據",
  },
  humanities: {
    mentor: "魯智深領航",
    description: "從人物的選擇與感受，看見同一件事裡不同的聲音。",
    mark: "人",
    reward: "可帶回聚義書樓，收藏人物故事與金句",
  },
});

function difficultyButton(reading, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `difficulty-button difficulty-${reading.difficulty}`;
  button.setAttribute(
    "aria-label",
    `${label}，約 ${reading.readingMinutes} 分鐘：${reading.title}`,
  );
  button.innerHTML = `
    <span>${label}</span>
    <small>${reading.textType === "classical" ? "文言" : "白話"}・${reading.readingMinutes} 分鐘</small>
  `;
  button.addEventListener("click", () => {
    window.location.hash = `#/read/${reading.id}`;
  });
  return button;
}

export function createRouteCard(route) {
  const copy = CATEGORY_COPY[route.category];
  const primary = route.versions.guided ?? route.versions.challenge;
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
  body.innerHTML = `
    <p>${copy.description}</p>
    <p class="route-question">${primary.hookQuestion}</p>
    <p class="route-reward">${copy.reward}</p>
  `;

  const actions = document.createElement("div");
  actions.className = "route-card__actions";
  for (const difficulty of ["guided", "challenge"]) {
    const reading = route.versions[difficulty];
    if (reading) {
      actions.append(
        difficultyButton(
          reading,
          waterMarginTheme.difficultyLabels[difficulty],
        ),
      );
    }
  }

  article.append(header, body, actions);
  return article;
}
