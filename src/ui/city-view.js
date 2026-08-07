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
    assessmentPassed = true,
    finalCorrectCount = 0,
    requiredCorrectCount = 2,
    assessmentTotal = 3,
    nextReading = null,
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
      <p>每個活躍日第一篇達標閱讀推進主線；今天多讀的內容仍會累積能力與城市記憶，不需要為了獎勵停下閱讀。</p>
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
  const orderedBuildings = [...buildingCatalog].sort(
    (left, right) =>
      Number(right.id === recommendedBuilding) -
      Number(left.id === recommendedBuilding),
  );
  for (const building of orderedBuildings) {
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
      building.id === recommendedBuilding ? "依內容推薦（可自由選）・" : ""
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
      announcement.setAttribute("role", "status");
      announcement.setAttribute("aria-live", "polite");
      announcement.innerHTML = `
        <p class="chapter-label">朱砂落印</p>
        <h2 tabindex="-1">${building.name}升到第 ${result.stage} 階</h2>
        <p class="city-growth-feedback">燈火已點亮。你的閱讀證據會永久留在這座地標裡。</p>
        <div class="city-growth-seal" aria-hidden="true">印</div>
        <a class="primary-link" href="#/city">看見整座浮城的變化</a>
      `;
      announcement.querySelector("h2")?.focus({ preventScroll: true });
    });
    card.append(mark, title, copy, stageTrack, button);
    grid.append(card);
  }

  container.append(header, announcement);
  if (rewardType === "building") container.append(grid);

  const journeyChoice = document.createElement("section");
  journeyChoice.className = "journey-choice paper-panel";
  const choiceLabel = document.createElement("p");
  choiceLabel.className = "chapter-label";
  choiceLabel.textContent = assessmentPassed ? "本篇達標" : "本篇再練一次";
  const choiceTitle = document.createElement("h2");
  choiceTitle.textContent = assessmentPassed
    ? "下一步，由你決定"
    : "先把這篇讀穩，再往下一篇";
  const choiceCopy = document.createElement("p");
  choiceCopy.textContent = assessmentPassed
    ? `最後答對 ${finalCorrectCount}／${assessmentTotal} 題，已達 ${requiredCorrectCount} 題門檻。可以接著讀，也可以今天先結束。`
    : `最後答對 ${finalCorrectCount}／${assessmentTotal} 題，尚未達 ${requiredCorrectCount} 題門檻。作答紀錄已保存。`;
  const choiceActions = document.createElement("div");
  choiceActions.className = "journey-choice__actions";
  if (assessmentPassed && nextReading) {
    const nextLink = document.createElement("a");
    nextLink.className = "primary-link";
    nextLink.href = `#/read/${nextReading.id}`;
    nextLink.textContent = `繼續下一篇挑戰：${nextReading.title}`;
    choiceActions.append(nextLink);
  } else if (!assessmentPassed) {
    const retryLink = document.createElement("a");
    retryLink.className = "primary-link";
    retryLink.href = `#/read/${readingId}`;
    retryLink.textContent = "回到文章，重新挑戰";
    choiceActions.append(retryLink);
  }
  const restLink = document.createElement("a");
  restLink.href = "#/rest";
  restLink.textContent = "今天先到這裡，明天再來";
  choiceActions.append(restLink);
  journeyChoice.append(choiceLabel, choiceTitle, choiceCopy, choiceActions);
  if (grid.isConnected) {
    container.insertBefore(journeyChoice, grid);
  } else {
    container.append(journeyChoice);
  }
}
