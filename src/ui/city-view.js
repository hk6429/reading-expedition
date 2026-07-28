import { buildingCatalog } from "../data/building-catalog.js";
import { chapterForActiveDay } from "../data/chapter-catalog.js";
import { investInBuilding } from "../domain/city.js";

export function renderCityInvest(
  container,
  state,
  {
    readingId,
    earnedInkBricks,
    earnedFellowshipSeals = 0,
    rewardType = "building",
    rewardTitle = "",
    activeDay = 1,
    reading = null,
    evidence = "",
    date,
    saveState,
  },
) {
  container.replaceChildren();
  container.className = "city-view";

  const header = document.createElement("header");
  header.className = "city-header";
  const earnedLabel =
    rewardType === "story"
      ? `獲得 ${earnedFellowshipSeals} 枚聚義印`
      : rewardType === "collection"
        ? "今日主線已完成，文證仍已收藏"
        : `帶回 ${earnedInkBricks} 塊墨磚`;
  header.innerHTML = `
    <p class="chapter-label">知識落城</p>
    <h1>${rewardType === "story" ? "今日文證，解開一回故事" : "把今天讀懂的，蓋進城市裡"}</h1>
    <p class="city-earned">${earnedLabel}</p>
    <p>每一棟建築都會記得，它是由哪一篇閱讀長出來的。</p>
  `;

  const announcement = document.createElement("section");
  announcement.className = "city-announcement";
  announcement.setAttribute("aria-live", "polite");
  if (rewardType === "story") {
    const chapter = chapterForActiveDay(activeDay);
    announcement.innerHTML = `
      <p class="chapter-label">${chapter.mentor}・第 ${activeDay} 個活躍日</p>
      <h2>${chapter.unlock ?? rewardTitle}</h2>
      <p>${chapter.story}</p>
      <p>這枚聚義印已永久收進你的浮城；今天不必再投入墨磚。</p>
      <a class="primary-link" href="#/city">查看解鎖後的浮城</a>
    `;
  } else if (rewardType === "collection") {
    announcement.innerHTML = `
      <p class="chapter-label">額外閱卷・知識仍會留下</p>
      <h2>文證已收入你的閱讀事件簿</h2>
      <p>每天第一篇推進主線；今天多讀的內容仍會累積能力與城市記憶，不需要為了獎勵停下閱讀。</p>
      <a class="primary-link" href="#/city">回看我的浮城</a>
    `;
  } else {
    announcement.hidden = true;
  }

  const grid = document.createElement("div");
  grid.className = "building-grid";
  const canInvestThisCompletion =
    rewardType === "building" && earnedInkBricks >= 5;
  const recommendedBuilding = {
    world: "worldPost",
    science: "craftHarbor",
    humanities: "library",
  }[reading?.category];
  for (const building of buildingCatalog) {
    const stage = state.city.buildings[building.id] ?? 0;
    const card = document.createElement("article");
    card.className = `building-card building-stage-${stage}${
      building.id === recommendedBuilding ? " is-recommended" : ""
    }`;
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
    button.textContent = `${
      building.id === recommendedBuilding ? "推薦・" : ""
    }投入${building.name}・5 塊墨磚`;
    button.disabled =
      !canInvestThisCompletion ||
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
        knowledge: {
          title: reading?.title ?? "已完成的讀卷",
          category: reading?.category ?? "humanities",
          evidence: evidence || "已完成文證定位",
          ability: "evidence",
        },
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
        <p class="city-growth-feedback">燈火已點亮。你的閱讀證據會永久留在這座地標裡。</p>
        <div class="city-growth-seal" aria-hidden="true">印</div>
        <a class="primary-link" href="#/city">看見整座浮城的變化</a>
      `;
    });
    card.append(mark, title, copy, stageTrack, button);
    grid.append(card);
  }

  container.append(header, announcement, grid);
}
