import { createAssessmentSession } from "../domain/assessment-session.js";

function createQuestion(item, index) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "assessment-question";
  fieldset.dataset.itemId = item.id;
  const legend = document.createElement("legend");
  legend.innerHTML = `<span>第 ${index + 1}／2 題</span>${item.prompt}`;
  fieldset.append(legend);

  const options = document.createElement("div");
  options.className = "assessment-options";
  item.options.forEach((option, optionIndex) => {
    const label = document.createElement("label");
    label.className = "assessment-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = item.id;
    input.value = option;
    const marker = document.createElement("span");
    marker.className = "option-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "甲乙丙丁"[optionIndex] ?? String(optionIndex + 1);
    const text = document.createElement("span");
    text.textContent = option;
    label.append(input, marker, text);
    options.append(label);
  });
  fieldset.append(options);

  const feedback = document.createElement("div");
  feedback.className = "question-feedback";
  feedback.setAttribute("aria-live", "polite");
  fieldset.append(feedback);
  return fieldset;
}

export function renderAssessment(
  container,
  reading,
  { submitAnswers, onComplete },
) {
  container.replaceChildren();
  container.className = "assessment-view";

  const wrapper = document.createElement("section");
  wrapper.className = "assessment-sheet";
  wrapper.innerHTML = `
    <header class="assessment-header">
      <a href="#/read/${reading.id}">← 返回文章</a>
      <p class="chapter-label">過關問答・不計速度</p>
      <h1>帶回兩份文證</h1>
      <p>先回答理解，再指出支持答案的段落。答錯可以回看並修正一次。</p>
    </header>
  `;

  const form = document.createElement("form");
  reading.assessment.forEach((item, index) => {
    form.append(createQuestion(item, index));
  });

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("aria-live", "assertive");
  form.append(error);

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "primary-action";
  submitButton.textContent = "送出兩題";
  form.append(submitButton);

  const completion = document.createElement("section");
  completion.className = "assessment-completion";
  completion.hidden = true;
  const completionTitle = document.createElement("h2");
  completionTitle.textContent = "文證已帶回";
  const completionCopy = document.createElement("p");
  completionCopy.textContent =
    "不論第一次是否答對，你都完成了閱讀、查找與修正。";
  const cityButton = document.createElement("button");
  cityButton.type = "button";
  cityButton.className = "primary-action";
  cityButton.textContent = "把知識帶回浮城";
  let firstResults = null;
  let latestResults = null;
  let latestAttempt = 0;
  cityButton.addEventListener("click", () => {
    onComplete({
      firstResults,
      finalResults: latestResults,
      attempt: latestAttempt,
    });
  });
  completion.append(completionTitle, completionCopy, cityButton);

  const session = createAssessmentSession({
    itemIds: reading.assessment.map(({ id }) => id),
    submit: submitAnswers,
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const data = new FormData(form);
    try {
      for (const item of reading.assessment) {
        session.answer(item.id, String(data.get(item.id) ?? ""));
      }
      const result = await session.submit();
      firstResults ??= result.results;
      latestResults = result.results;
      latestAttempt = result.attempt;
      result.results.forEach((itemResult) => {
        const fieldset = form.querySelector(
          `[data-item-id="${itemResult.id}"]`,
        );
        const feedback = fieldset.querySelector(".question-feedback");
        feedback.className = `question-feedback ${
          itemResult.correct ? "is-correct" : "is-incorrect"
        }`;
        feedback.replaceChildren();
        const status = document.createElement("strong");
        status.textContent = itemResult.correct ? "文證吻合" : "再找一次";
        const reason = document.createElement("p");
        reason.textContent = itemResult.rationale;
        const evidence = document.createElement("a");
        evidence.href = `#/read/${reading.id}?paragraph=${itemResult.evidenceSpan.paragraph}`;
        evidence.textContent = `再看第${itemResult.evidenceSpan.paragraph}段`;
        feedback.append(status, reason, evidence);
      });

      if (result.canRevise) {
        const incorrect = result.results.find((item) => !item.correct);
        if (incorrect) {
          error.textContent = "第一題還可以修正一次";
          submitButton.textContent = "完成修正";
          return;
        }
      }

      for (const input of form.elements) input.disabled = true;
      submitButton.hidden = true;
      completion.hidden = false;
    } catch (cause) {
      error.textContent =
        cause.message === "all items must be answered"
          ? "請先完成兩題，再送出答案。"
          : "作答暫時無法送出，答案仍保留在這一頁。";
    }
  });

  wrapper.append(form, completion);
  container.append(wrapper);
}
