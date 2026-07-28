import { buildingCatalog } from "../data/building-catalog.js";
import { investInBuilding } from "../domain/city.js";

export function renderCityInvest(
  container,
  state,
  { readingId, earnedInkBricks, date, saveState },
) {
  container.replaceChildren();
  container.className = "city-view";

  const header = document.createElement("header");
  header.className = "city-header";
  header.innerHTML = `
    <p class="chapter-label">知識落城</p>
    <h1>把今天讀懂的，蓋進城市裡</h1>
    <p class="city-earned">帶回 ${earnedInkBricks} 塊墨磚</p>
    <p>每一棟建築都會記得，它是由哪一篇閱讀長出來的。</p>
  `;

  const announcement = document.createElement("section");
  announcement.className = "city-announcement";
  announcement.hidden = true;
  announcement.setAttribute("aria-live", "polite");

  const grid = document.createElement("div");
  grid.className = "building-grid";
  for (const building of buildingCatalog) {
    const stage = state.city.buildings[building.id] ?? 0;
    const card = document.createElement("article");
    card.className = `building-card building-stage-${stage}`;
    const mark = document.createElement("span");
    mark.className = "building-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = building.mark;
    const title = document.createElement("h2");
    title.textContent = `${building.name}・第 ${stage} 階`;
    const copy = document.createElement("p");
    copy.textContent = building.purpose;
    const stageTrack = document.createElement("div");
    stageTrack.className = "building-stage-track";
    stageTrack.setAttribute("aria-label", `${building.name}目前第 ${stage} 階`);
    for (let index = 1; index <= 5; index += 1) {
      const step = document.createElement("span");
      step.className = index <= stage ? "is-built" : "";
      step.textContent = String(index);
      stageTrack.append(step);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.className = "building-invest";
    button.textContent = `投入${building.name}・5 塊墨磚`;
    button.disabled =
      state.city.materials.inkBricks < 5 ||
      stage >= 5 ||
      state.city.investments.some(
        (investment) =>
          investment.readingId === readingId && investment.date === date,
      );
    button.addEventListener("click", () => {
      const result = investInBuilding(state, {
        buildingId: building.id,
        readingId,
        date,
        inkBricks: 5,
      });
      saveState(state);
      card.className = `building-card building-stage-${result.stage} is-upgraded`;
      title.textContent = `${building.name}・第 ${result.stage} 階`;
      stageTrack.children[result.stage - 1].classList.add("is-built");
      for (const peer of grid.querySelectorAll("button")) peer.disabled = true;
      announcement.hidden = false;
      announcement.innerHTML = `
        <p class="chapter-label">朱砂落印</p>
        <h2>${building.name}升到第 ${result.stage} 階</h2>
        <p>燈火已點亮。你的閱讀證據會永久留在這座地標裡。</p>
        <a class="primary-link" href="#/">完成今日遠征</a>
      `;
    });
    card.append(mark, title, copy, stageTrack, button);
    grid.append(card);
  }

  container.append(header, announcement, grid);
}
