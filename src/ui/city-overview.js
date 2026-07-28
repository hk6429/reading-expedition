import { buildingCatalog } from "../data/building-catalog.js";
import { chapterForActiveDay } from "../data/chapter-catalog.js";
import { resolveHistoryChapterProgress } from "../domain/active-days.js";
import { journeyRewardForActiveDay } from "../domain/journey-progression.js";
import { createChapterCard } from "./chapter-card.js";

const ABILITIES = Object.freeze([
  ["comprehension", "找重點", "從文章中辨認重要訊息"],
  ["inference", "想意思", "連結線索並推論作者意思"],
  ["evidence", "找證據", "回到原文定位、檢查與修正"],
]);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function createBuildingOverview(building, state) {
  const stage = state.city.buildings[building.id] ?? 0;
  const investments = state.city.investments
    .filter(({ buildingId }) => buildingId === building.id)
    .slice(-3)
    .reverse();
  const article = document.createElement("article");
  article.className = `building-card city-building building-stage-${stage}`;
  article.innerHTML = `
    <div class="city-building__scene" style="--building-stage:${stage}">
      <span class="building-mark" aria-hidden="true">${building.mark}</span>
      <span class="city-building__tower" aria-hidden="true"></span>
      <span class="city-building__lights" aria-hidden="true">${"●".repeat(stage)}</span>
    </div>
    <p class="eyebrow">第 ${stage}／5 階</p>
    <h2>${building.name}</h2>
    <p>${building.purpose}</p>
    <div class="building-stage-track" aria-label="${building.name}目前第 ${stage} 階">
      ${Array.from(
        { length: 5 },
        (_, index) =>
          `<span class="${index < stage ? "is-built" : ""}">${index + 1}</span>`,
      ).join("")}
    </div>
    <div class="building-knowledge">
      <h3>這座地標記得</h3>
      ${
        investments.length
          ? `<ul>${investments
              .map(
                ({ knowledge }) =>
                  `<li><strong>${escapeHtml(knowledge?.title ?? "已完成的讀卷")}</strong><span>${escapeHtml(knowledge?.evidence ?? "文證已收藏")}</span></li>`,
              )
              .join("")}</ul>`
          : "<p>下一份文證，會成為這座地標的第一段記憶。</p>"
      }
    </div>
  `;
  return article;
}

function createAbilityPanel(state) {
  const section = document.createElement("section");
  section.className = "ability-panel paper-panel";
  section.setAttribute("aria-labelledby", "ability-heading");
  section.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">閱讀本領</p>
        <h2 id="ability-heading">我正在長出的三種能力</h2>
      </div>
      <p>不是排名，也不比較答對率；完成、回看文證與修正都算成長。</p>
    </div>
    <div class="ability-grid">
      ${ABILITIES.map(([id, label, description]) => {
        const score = state.abilityGrowth[id] ?? 0;
        const level = Math.floor(score / 5) + 1;
        const step = score % 5;
        return `
          <article class="ability-card">
            <div><span>${label}</span><strong>第 ${level} 階</strong></div>
            <div class="ability-track" role="progressbar" aria-label="${label}本階進度" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${step}">
              <span style="width:${(step / 5) * 100}%"></span>
            </div>
            <p>${description}・累積 ${score} 點</p>
          </article>
        `;
      }).join("")}
    </div>
  `;
  return section;
}

function createJourneyPanel(state) {
  const progress = resolveHistoryChapterProgress(state.readingHistory);
  const nextDay = Math.min(progress.activeDay + 1, 30);
  const nextChapter = chapterForActiveDay(nextDay);
  const nextReward = journeyRewardForActiveDay(nextDay);
  const section = document.createElement("section");
  section.className = "journey-panel paper-panel";
  section.setAttribute("aria-labelledby", "journey-heading");
  section.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">三十日航圖</p>
        <h2 id="journey-heading">${progress.activeDay}／30 個活躍日</h2>
      </div>
      <p>不用連續；每天第一篇推進主線，額外閱讀仍會收藏進城市。</p>
    </div>
    <div class="journey-track" aria-label="三十日航程進度">
      ${Array.from({ length: 30 }, (_, index) => {
        const day = index + 1;
        const reward = journeyRewardForActiveDay(day);
        return `<span class="${day <= progress.activeDay ? "is-complete" : ""} ${reward.type === "story" ? "is-story" : ""}" title="第 ${day} 日・${reward.title}">${day}</span>`;
      }).join("")}
    </div>
    ${
      progress.nextSeasonUnlocked
        ? `<div class="next-unlock"><p class="chapter-label">第一航季完成</p><h3>下一航圖已解鎖</h3><p>舊城市、閱讀文證與能力成長完整保留；下一航季開放前，仍可自由閱讀與收藏。</p></div>`
        : `<div class="next-unlock"><p class="chapter-label">下一回・${nextReward.title}</p><h3>${nextChapter.title}</h3><p>${nextChapter.story}</p></div>`
    }
  `;
  return section;
}

function createGoalPanel(state, saveState) {
  const section = document.createElement("section");
  section.className = "weekly-goal paper-panel";
  section.setAttribute("aria-labelledby", "goal-heading");
  const target = state.weeklyGoal?.target ?? 0;
  section.innerHTML = `
    <p class="eyebrow">無壓力習慣契約</p>
    <h2 id="goal-heading">這週想讀幾篇？</h2>
    <p>依自己的生活選 3、5 或 7 篇；沒有連續簽到，休息也不扣分。</p>
    <div class="goal-options" role="group" aria-label="每週閱讀目標">
      ${[3, 5, 7]
        .map(
          (value) =>
            `<button type="button" data-goal="${value}" aria-pressed="${String(target === value)}">每週 ${value} 篇</button>`,
        )
        .join("")}
    </div>
  `;
  for (const button of section.querySelectorAll("[data-goal]")) {
    button.addEventListener("click", () => {
      state.weeklyGoal = { target: Number(button.dataset.goal) };
      saveState(state);
      for (const peer of section.querySelectorAll("[data-goal]")) {
        peer.setAttribute("aria-pressed", String(peer === button));
      }
    });
  }
  return section;
}

export function renderCityOverview(
  container,
  state,
  { saveState, exportState, restoreState },
) {
  const progress = resolveHistoryChapterProgress(state.readingHistory);
  const currentChapter = chapterForActiveDay(Math.max(progress.activeDay, 1));
  container.replaceChildren();
  container.className = "city-overview";
  container.innerHTML = `
    <section class="city-overview__hero">
      <div>
        <p class="chapter-label">我的萬卷浮城</p>
        <h1>每一盞燈，都是我讀懂的證據</h1>
        <p>城市不會因為休息而衰敗。點亮建築、收藏文證，慢慢長成自己的閱讀地圖。</p>
        <div class="city-overview__stats">
          <span>${progress.activeDay} 個活躍日</span>
          <span>${state.city.materials.inkBricks} 塊墨磚</span>
          <span>${state.city.materials.fellowshipSeals} 枚聚義印</span>
        </div>
        <div class="city-overview__actions">
          <a class="primary-link" href="#/">繼續今日航線</a>
          <button type="button" data-export-city>下載我的閱征紀錄</button>
          <label class="restore-record">
            復原閱征紀錄
            <input type="file" accept="application/json,.json" data-restore-city>
          </label>
        </div>
        <p class="restore-status" role="status" data-restore-status></p>
      </div>
      <div class="city-panorama" aria-label="依四座建築階段成長的萬卷浮城">
        ${buildingCatalog
          .map(({ id, mark }) => {
            const stage = state.city.buildings[id] ?? 0;
            return `<span class="panorama-building stage-${stage}" style="--stage:${stage}" aria-label="${mark}字地標第${stage}階"><b>${mark}</b><i aria-hidden="true">${"•".repeat(stage)}</i></span>`;
          })
          .join("")}
      </div>
    </section>
  `;

  const buildings = document.createElement("section");
  buildings.className = "city-overview__buildings";
  buildings.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">知識落城</p><h2>四座地標，各自收藏不同的閱讀</h2></div>
      <p>你選擇投入哪裡，就決定這份知識在城市裡如何被記住。</p>
    </div>
  `;
  const grid = document.createElement("div");
  grid.className = "building-grid";
  for (const building of buildingCatalog) {
    grid.append(createBuildingOverview(building, state));
  }
  buildings.append(grid);

  const chapter = document.createElement("section");
  chapter.className = "current-chapter paper-panel";
  chapter.innerHTML = `<p class="eyebrow">目前章回</p>`;
  chapter.append(createChapterCard(currentChapter, {
    completed: progress.activeDay > 0,
  }));

  container.append(
    buildings,
    createAbilityPanel(state),
    createJourneyPanel(state),
    chapter,
    createGoalPanel(state, saveState),
  );
  container
    .querySelector("[data-export-city]")
    .addEventListener("click", exportState);
  const restoreInput = container.querySelector("[data-restore-city]");
  const restoreStatus = container.querySelector("[data-restore-status]");
  restoreInput.addEventListener("change", async () => {
    const [file] = restoreInput.files;
    if (!file) return;
    restoreStatus.textContent = "正在檢查紀錄…";
    try {
      await restoreState(file);
      restoreStatus.textContent = "紀錄已復原，正在重新開啟浮城。";
    } catch {
      restoreStatus.textContent =
        "無法復原：請確認這是由梁山閱征記下載的 JSON 紀錄。";
      restoreInput.value = "";
    }
  });
}
