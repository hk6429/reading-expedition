import { buildingCatalog } from "../data/building-catalog.js";
import { chapterForActiveDay } from "../data/chapter-catalog.js";
import { resolveHistoryChapterProgress } from "../domain/active-days.js";
import {
  ABILITY_EQUIPMENT,
  revisionMilestone,
} from "../domain/ability-mastery.js";
import { investInBuilding } from "../domain/city.js";
import { journeyRewardForActiveDay } from "../domain/journey-progression.js";
import { createChapterCard } from "./chapter-card.js";
import {
  cityThemeTokens,
  loadGamificationProfile,
  saveGamificationProfile,
} from "../domain/gamification-profile.js";
import { createMissionDashboard } from "./mission-dashboard.js";

const ABILITIES = Object.freeze([
  ["comprehension", "找重點", "從文章中辨認重要訊息"],
  ["inference", "想意思", "連結線索並推論作者意思"],
  ["evidence", "找證據", "回到原文定位、檢查與修正"],
]);

function applyCityTheme(container, theme) {
  container.dataset.cityTheme = theme;
  for (const [property, value] of Object.entries(cityThemeTokens(theme))) {
    container.style.setProperty(property, value);
  }
}

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
  const revision = revisionMilestone(
    state.abilityMastery?.revisionStrength?.length ?? 0,
  );
  const section = document.createElement("section");
  section.className = "ability-panel paper-panel";
  section.setAttribute("aria-labelledby", "ability-heading");
  section.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">閱讀本領</p>
        <h2 id="ability-heading">我正在長出的三種能力</h2>
      </div>
      <p>裝備只記錄第一次作答就成功展現的能力；修正成功會另外保存，不混入解鎖進度。</p>
    </div>
    <div class="ability-grid">
      ${ABILITIES.map(([id, label, description]) => {
        const successes =
          state.abilityMastery?.skills?.[id]?.successes ?? [];
        const score = successes.length;
        const uniqueReadings = new Set(
          successes.map(({ readingId }) => readingId),
        ).size;
        const equipment = ABILITY_EQUIPMENT[id];
        const unlocked =
          state.abilityMastery?.unlockedEquipment?.includes(
            equipment.id,
          ) ?? false;
        const step = Math.min(score, 3);
        return `
          <article class="ability-card equipment-card${unlocked ? " is-unlocked" : ""}">
            <div><span>${label}</span><strong>${unlocked ? "已解鎖" : `${step}／3`}</strong></div>
            <h3>${equipment.name}</h3>
            <div class="ability-track" role="progressbar" aria-label="${label}裝備解鎖進度" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${step}">
              <span style="width:${(step / 3) * 100}%"></span>
            </div>
            <p>${description}</p>
            <small>${unlocked ? `這件裝備代表：${equipment.description}` : `還需在至少兩篇文章中，第一次作答成功展現 3 次。目前來自 ${uniqueReadings} 篇。`}</small>
          </article>
        `;
      }).join("")}
    </div>
    <section class="revision-strength" aria-label="修正策略成長">
      <h3>${revision.achieved ? `已獲得「${revision.achieved.name}」` : "修正策略正在累積"}</h3>
      <p>回看原文後修正成功：${revision.count} 次。這條進度不會取代第一次理解的能力裝備。</p>
      <div class="ability-track" role="progressbar" aria-label="修正策略里程碑" aria-valuemin="0" aria-valuemax="${revision.progress.target || 1}" aria-valuenow="${revision.progress.completed}"><span style="width:${revision.progress.percent}%"></span></div>
      <small>${revision.next ? `下一個里程碑「${revision.next.name}」：${revision.next.strategy}` : "三個修正策略里程碑都已收藏；繼續用證據說明每次改變。"}</small>
    </section>
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
      <p>不用連續；每個活躍日第一篇達標閱讀推進主線，額外閱讀仍會收藏進城市。</p>
    </div>
    <div class="journey-track" aria-label="三十日航程進度">
      ${Array.from({ length: 30 }, (_, index) => {
        const day = index + 1;
        const reward = journeyRewardForActiveDay(day);
        return `<span class="${day <= progress.activeDay ? "is-complete" : ""} ${reward.type === "story" ? "is-story" : ""}" title="第 ${day} 日・${reward.title}">${day}</span>`;
      }).join("")}
    </div>
    ${
      progress.firstSeasonComplete
        ? `<div class="next-unlock"><p class="chapter-label">第一航季完成</p><h3>第二航季規劃中</h3><p>目前沒有新的主線獎勵；舊城市、閱讀文證與能力成長完整保留，仍可自由閱讀與收藏。</p></div>`
        : `<div class="next-unlock"><p class="chapter-label">下一回・${nextReward.title}</p><h3>${nextChapter.title}</h3><p>${nextChapter.story}</p></div>`
    }
  `;
  return section;
}

function createInkWorkshop(state, saveState, rerender) {
  const section = document.createElement("section");
  section.className = "paper-panel ink-workshop";
  section.setAttribute("aria-labelledby", "ink-workshop-heading");
  const title = document.createElement("h2");
  title.id = "ink-workshop-heading";
  title.textContent = "使用尚未投入的墨磚";
  const copy = document.createElement("p");
  copy.textContent = "選一份還沒落城的文證，再決定要修築哪座地標。每次投入 5 塊墨磚。";
  const used = new Set(
    state.city.investments.map(({ readingId, date }) => `${readingId}:${date}`),
  );
  const available = Object.entries(state.completedReadings)
    .filter(([, completion]) => completion.evidenceSubmitted === true)
    .filter(([readingId, completion]) => !used.has(`${readingId}:${completion.date}`));
  if (state.city.materials.inkBricks < 5) {
    const status = document.createElement("p");
    status.textContent = "目前墨磚不足 5 塊；完成新的文證閱讀後再回來。";
    section.append(title, copy, status);
    return section;
  }
  if (available.length === 0) {
    const status = document.createElement("p");
    status.textContent = "目前沒有待投入的文證；已投入的紀錄仍保存在各地標。";
    section.append(title, copy, status);
    return section;
  }
  const readingLabel = document.createElement("label");
  readingLabel.textContent = "選擇文證";
  const readingSelect = document.createElement("select");
  for (const [readingId, completion] of available) {
    const option = document.createElement("option");
    option.value = readingId;
    option.textContent = `${completion.date}・${completion.evidence}`;
    readingSelect.append(option);
  }
  readingLabel.append(readingSelect);
  const buildingLabel = document.createElement("label");
  buildingLabel.textContent = "選擇地標";
  const buildingSelect = document.createElement("select");
  for (const building of buildingCatalog.filter(
    ({ id }) => (state.city.buildings[id] ?? 0) < 5,
  )) {
    const option = document.createElement("option");
    option.value = building.id;
    option.textContent = `${building.name}・目前第 ${state.city.buildings[building.id] ?? 0} 階`;
    buildingSelect.append(option);
  }
  buildingLabel.append(buildingSelect);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-action";
  button.textContent = "投入 5 塊墨磚";
  button.disabled = buildingSelect.options.length === 0;
  button.addEventListener("click", () => {
    const readingId = readingSelect.value;
    const completion = state.completedReadings[readingId];
    investInBuilding(state, {
      buildingId: buildingSelect.value,
      readingId,
      date: completion.date,
      inkBricks: 5,
      knowledge: {
        title: completion.title ?? "已完成的讀卷",
        category: completion.category ?? "humanities",
        evidence: completion.evidence,
        ability: "evidence",
      },
    });
    saveState(state);
    rerender();
  });
  section.append(title, copy, readingLabel, buildingLabel, button);
  return section;
}

function createReadingLog(history = [], completedReadings = {}) {
  const section = document.createElement("section");
  section.className = "reading-event-log paper-panel";
  const events = [...history].slice(-8).reverse();
  section.innerHTML = `
    <div class="section-heading">
      <div><p class="eyebrow">閱征事件簿</p><h2>最近帶回的文證</h2></div>
      <p>同一天多讀的文章也會留在這裡，不會消失。</p>
    </div>
    ${
      events.length
        ? `<ol>${events
            .map(
              (event) => {
                const completion = completedReadings[event.readingId];
                const score = completion?.finalCorrectCount;
                return `<li><time>${escapeHtml(event.date)}</time><strong>${escapeHtml(event.title ?? "已完成的讀卷")}</strong>${score === undefined ? "" : `<span class="reading-log-score">答對 ${score} 題・已達標</span>`}<q>${escapeHtml(event.evidence)}</q></li>`;
              },
            )
            .join("")}</ol>`
        : "<p>完成第一篇閱讀後，文證會出現在這裡。</p>"
    }
  `;
  return section;
}

export function renderCityOverview(
  container,
  state,
  { saveState, exportState, restoreState },
) {
  const progress = resolveHistoryChapterProgress(state.readingHistory);
  const currentChapter = chapterForActiveDay(Math.max(progress.activeDay, 1));
  const gamificationProfile = loadGamificationProfile();
  container.replaceChildren();
  container.className = "city-overview";
  container.innerHTML = `
    <section class="city-overview__hero">
      <div>
        <p class="chapter-label">我的萬卷浮城</p>
        <h1>${escapeHtml(gamificationProfile.cityName)}：每一盞燈，都是我讀懂的證據</h1>
        <p>城市不會因為休息而衰敗。點亮建築、收藏文證，慢慢長成自己的閱讀地圖。</p>
        <div class="city-overview__stats">
          <span>${progress.activeDay} 個活躍日</span>
          <span>${state.city.materials.inkBricks} 塊墨磚</span>
          <span>${state.city.materials.fellowshipSeals} 枚聚義印</span>
        </div>
        <div class="city-overview__actions">
          <a class="primary-link" href="#/">繼續下一篇挑戰</a>
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

  const missionDashboard = createMissionDashboard({
    context: "city",
    profile: gamificationProfile,
    readingHistory: state.readingHistory,
    abilityMastery: state.abilityMastery,
    city: state.city,
    onExport: exportState,
    onProfileChange: (profile) => {
      saveGamificationProfile(localStorage, profile);
      applyCityTheme(container, profile.cityTheme);
      container.querySelector(".city-overview__hero h1").textContent =
        `${profile.cityName}：每一盞燈，都是我讀懂的證據`;
    },
  });
  applyCityTheme(container, gamificationProfile.cityTheme);

  container.append(
    missionDashboard,
    createInkWorkshop(state, saveState, () =>
      renderCityOverview(container, state, {
        saveState,
        exportState,
        restoreState,
      }),
    ),
    buildings,
    createReadingLog(state.readingHistory, state.completedReadings),
    createAbilityPanel(state),
    createJourneyPanel(state),
    chapter,
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
