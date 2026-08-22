import { placementReading } from "../data/placement-reading.js";
import {
  LEVEL_ORDER,
  READING_LEVELS,
  recommendLevelFromPlacement,
} from "../domain/reading-level.js";

const PLACEMENT_SKILLS = Object.freeze({
  comprehension: ["找重點", "先圈出重複出現的人、事與關鍵句。"],
  inference: ["想意思", "把原因、結果與人物立場連起來。"],
  evidence: ["找證據", "選答案前，先回原文指出直接支持的句子。"],
});

function scrollBehavior() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.dataset.reducedMotion === "true"
    ? "auto"
    : "smooth";
}

export function renderPlacement(
  container,
  { state, saveState },
) {
  container.replaceChildren();
  container.className = "placement-view";

  const article = document.createElement("article");
  article.className = "placement-sheet";
  article.innerHTML = `
    <header class="placement-header">
      <a href="#/">← 返回閱讀首頁</a>
      <p class="chapter-label">五分鐘測讀・只推薦，不分班</p>
      <h1>${placementReading.title}</h1>
      <p>先讀完一篇完整短文，再回答三題。結果只幫你選起點，三個程度仍然都能自由閱讀。</p>
    </header>
  `;
  const body = document.createElement("div");
  body.className = "placement-reading-body";
  for (const paragraph of placementReading.body) {
    const copy = document.createElement("p");
    copy.textContent = paragraph;
    body.append(copy);
  }

  const form = document.createElement("form");
  form.className = "placement-form";
  const heading = document.createElement("h2");
  heading.textContent = "讀完後回答三題";
  form.append(heading);
  for (const [index, item] of placementReading.assessment.entries()) {
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = `第 ${index + 1} 題・${item.prompt}`;
    fieldset.append(legend);
    for (const option of item.options) {
      const label = document.createElement("label");
      label.className = "placement-option";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = item.id;
      input.value = option;
      const text = document.createElement("span");
      text.textContent = option;
      label.append(input, text);
      fieldset.append(label);
    }
    form.append(fieldset);
  }
  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("role", "alert");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "primary-action";
  submit.textContent = "看看建議起點";
  form.append(error, submit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    if (
      placementReading.assessment.some((item) => !data.get(item.id))
    ) {
      error.textContent = "請完成三題，才看得到建議起點。";
      return;
    }
    const correctCount = placementReading.assessment.filter(
      (item) => data.get(item.id) === item.correctAnswer,
    ).length;
    const { recommendedLevel } =
      recommendLevelFromPlacement(correctCount);
    state.placement = {
      completed: true,
      correctCount,
      recommendedLevel,
      completedAt: new Date().toISOString(),
    };
    state.preferences.recommendedLevel = recommendedLevel;
    saveState(state);

    const result = document.createElement("section");
    result.className = "placement-result";
    result.setAttribute("role", "status");
    result.setAttribute("aria-live", "polite");
    const label = READING_LEVELS[recommendedLevel];
    result.innerHTML = `
      <p class="chapter-label">今天可先嘗試的起點</p>
      <h2 tabindex="-1">${label.label}</h2>
      <p>${label.description}</p>
      <p>你答對 ${correctCount}／3 題。每項只有一題，不能代表已精熟或固定程度；這只是今天比較舒服的起點。</p>
      <ul class="placement-skill-results">
        ${placementReading.assessment
          .map((item) => {
            const correct = data.get(item.id) === item.correctAnswer;
            const [skillLabel, advice] = PLACEMENT_SKILLS[item.type];
            return `<li class="${correct ? "is-correct" : "needs-practice"}"><strong>${skillLabel}：${correct ? "這一題有抓到" : "這一題可再練"}</strong><span>${correct ? "這次能抓到文章線索；還要用更多文章才能看出穩定表現。" : advice}</span></li>`;
          })
          .join("")}
      </ul>
      <p>請親自選擇起點；看到建議不會自動替你換級。</p>
    `;
    const choices = document.createElement("div");
    choices.className = "placement-level-choices";
    for (const level of LEVEL_ORDER) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        level === recommendedLevel ? "primary-action" : "";
      button.textContent = `${
        level === recommendedLevel ? "從建議的" : "我想選"
      }${READING_LEVELS[level].label}開始`;
      button.addEventListener("click", () => {
        state.preferences.selectedLevel = level;
        saveState(state);
        window.location.hash = "#/";
      });
      choices.append(button);
    }
    result.append(choices);
    form.hidden = true;
    body.hidden = true;
    article.append(result);
    result.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
    result.querySelector("h2")?.focus({ preventScroll: true });
  });

  article.append(body, form);
  container.append(article);
}
