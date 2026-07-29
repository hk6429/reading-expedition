import { createAssessmentSession } from "../domain/assessment-session.js";

const COMPETENCY_LABELS = Object.freeze({
  comprehension: "找重點",
  inference: "想意思",
  evidence: "找證據",
});

const COMPETENCY_MENTORS = Object.freeze({
  comprehension: "武松：先抓住真正重要的訊息。",
  inference: "吳用：把線索連起來，再檢查推論。",
  evidence: "魯智深：回到原文，讓證據自己說話。",
});

function createQuestion(item, index, total) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "assessment-question";
  fieldset.dataset.itemId = item.id;
  fieldset.tabIndex = -1;
  const legend = document.createElement("legend");
  const label = document.createElement("span");
  label.textContent = `第 ${index + 1}／${total} 題・${COMPETENCY_LABELS[item.type] ?? "閱讀理解"}`;
  legend.append(label, item.prompt);
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

function renderEvidenceExcerpt(container, paragraph, span) {
  const text = typeof paragraph === "string" ? paragraph : paragraph?.text ?? "";
  const start = Math.max(0, Math.min(text.length, span?.start ?? 0));
  const end = Math.max(start, Math.min(text.length, span?.end ?? start));
  if (end <= start) {
    container.textContent = text;
    return;
  }
  const contextStart = Math.max(0, start - 24);
  const contextEnd = Math.min(text.length, end + 24);
  const mark = document.createElement("mark");
  mark.textContent = text.slice(start, end);
  container.replaceChildren(
    contextStart > 0 ? "……" : "",
    text.slice(contextStart, start),
    mark,
    text.slice(end, contextEnd),
    contextEnd < text.length ? "……" : "",
  );
}

function createReadingStrategyPanel(strategy) {
  if (
    !strategy ||
    typeof strategy !== "object" ||
    !Array.isArray(strategy.steps) ||
    strategy.steps.length !== 3
  ) {
    return null;
  }
  const panel = document.createElement("section");
  panel.className = "reading-strategy-panel";
  panel.setAttribute("aria-labelledby", "reading-strategy-title");

  const eyebrow = document.createElement("p");
  eyebrow.className = "chapter-label";
  eyebrow.textContent = "閱讀專家拆解";
  const title = document.createElement("h2");
  title.id = "reading-strategy-title";
  title.textContent = strategy.name;
  const purpose = document.createElement("p");
  purpose.className = "reading-strategy-purpose";
  purpose.textContent = strategy.purpose;

  const structure = document.createElement("div");
  structure.className = "reading-strategy-structure";
  const structureLabel = document.createElement("strong");
  structureLabel.textContent = "文章結構";
  const structureCopy = document.createElement("p");
  structureCopy.textContent = strategy.structureMap;
  structure.append(structureLabel, structureCopy);

  const steps = document.createElement("ol");
  steps.className = "reading-strategy-steps";
  strategy.steps.forEach((step) => {
    const item = document.createElement("li");
    const heading = document.createElement("h3");
    heading.textContent = step.label;
    const instruction = document.createElement("p");
    instruction.textContent = step.instruction;
    const exampleDetails = document.createElement("details");
    exampleDetails.className = "reading-strategy-example";
    const exampleSummary = document.createElement("summary");
    exampleSummary.textContent = "看本文示範";
    const example = document.createElement("p");
    example.className = "reading-strategy-example";
    const exampleLabel = document.createElement("strong");
    exampleLabel.textContent = "本文示範：";
    example.append(exampleLabel, step.example);
    exampleDetails.append(exampleSummary, example);
    item.append(heading, instruction, exampleDetails);
    steps.append(item);
  });

  const takeaway = document.createElement("p");
  takeaway.className = "reading-strategy-takeaway";
  const takeawayLabel = document.createElement("strong");
  takeawayLabel.textContent = "下一篇帶著做：";
  takeaway.append(takeawayLabel, strategy.selfCheck);

  const more = document.createElement("details");
  more.className = "reading-strategy-more";
  const moreSummary = document.createElement("summary");
  moreSummary.textContent = "查看文章結構與專家提醒";
  const reflection = document.createElement("div");
  reflection.className = "reading-strategy-reflection";
  const tip = document.createElement("p");
  const tipLabel = document.createElement("strong");
  tipLabel.textContent = "專家提醒：";
  tip.append(tipLabel, strategy.expertTip);
  reflection.append(tip);
  more.append(moreSummary, structure, reflection);

  panel.append(eyebrow, title, purpose, steps, takeaway, more);
  return panel;
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
      <p class="chapter-label">讀完後想一想・不計速度</p>
      <h1>用 3 題確認你讀懂了什麼</h1>
      <p class="assessment-reading-title">${reading.title}</p>
      <p>依序找重點、想意思、找證據。答錯可以回看並修正一次。</p>
    </header>
  `;

  const form = document.createElement("form");
  const questions = [];
  reading.assessment.forEach((item, index) => {
    const question = createQuestion(item, index, reading.assessment.length);
    questions.push(question);
    form.append(question);
  });

  const error = document.createElement("p");
  error.className = "form-error";
  error.setAttribute("aria-live", "assertive");
  const navigation = document.createElement("div");
  navigation.className = "assessment-navigation";
  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.textContent = "上一題";
  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.textContent = "下一題";
  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "primary-action";
  submitButton.textContent = `送出 ${reading.assessment.length} 題`;
  navigation.append(previousButton, nextButton, submitButton);
  form.append(error, navigation);

  const evidencePanel = document.createElement("section");
  evidencePanel.className = "evidence-drawer";
  evidencePanel.hidden = true;
  evidencePanel.setAttribute("aria-live", "polite");
  const evidenceHeading = document.createElement("h2");
  const evidenceCopy = document.createElement("p");
  const closeEvidence = document.createElement("button");
  closeEvidence.type = "button";
  closeEvidence.textContent = "回到題目";
  let evidenceTrigger = null;
  closeEvidence.addEventListener("click", () => {
    evidencePanel.hidden = true;
    evidenceTrigger?.scrollIntoView({ behavior: "smooth", block: "center" });
    evidenceTrigger?.focus({ preventScroll: true });
  });
  evidencePanel.append(evidenceHeading, evidenceCopy, closeEvidence);

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
  completion.append(completionTitle, completionCopy);
  const strategyPanel = createReadingStrategyPanel(reading.readingStrategy);
  if (strategyPanel) completion.append(strategyPanel);
  completion.append(cityButton);

  const session = createAssessmentSession({
    itemIds: reading.assessment.map(({ id }) => id),
    submit: submitAnswers,
  });
  let currentIndex = 0;
  let revisionMode = false;
  let revisionIndexes = [];

  function focusSection(target) {
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
    target.focus({ preventScroll: true });
  }

  function showStep(index, { moveFocus = false } = {}) {
    currentIndex = Math.max(0, Math.min(index, questions.length - 1));
    questions.forEach((question, questionIndex) => {
      question.hidden = questionIndex !== currentIndex;
    });
    const revisionPosition = revisionIndexes.indexOf(currentIndex);
    previousButton.hidden = revisionMode
      ? revisionPosition <= 0
      : currentIndex === 0;
    nextButton.hidden = revisionMode
      ? revisionPosition < 0 || revisionPosition === revisionIndexes.length - 1
      : currentIndex === questions.length - 1;
    submitButton.hidden = revisionMode
      ? revisionPosition !== revisionIndexes.length - 1
      : currentIndex !== questions.length - 1;
    const label = questions[currentIndex]?.querySelector("legend span");
    if (label) label.setAttribute("aria-current", "step");
    if (moveFocus) focusSection(questions[currentIndex]);
  }

  previousButton.addEventListener("click", () => {
    error.textContent = "";
    const revisionPosition = revisionIndexes.indexOf(currentIndex);
    showStep(
      revisionMode
        ? revisionIndexes[revisionPosition - 1]
        : currentIndex - 1,
      { moveFocus: true },
    );
  });
  nextButton.addEventListener("click", () => {
    const selected = questions[currentIndex].querySelector(
      'input[type="radio"]:checked',
    );
    if (!selected) {
      error.textContent = "請先選一個答案，再前往下一題。";
      questions[currentIndex].focus();
      return;
    }
    error.textContent = "";
    const revisionPosition = revisionIndexes.indexOf(currentIndex);
    showStep(
      revisionMode
        ? revisionIndexes[revisionPosition + 1]
        : currentIndex + 1,
      { moveFocus: true },
    );
  });
  showStep(0);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    const data = new FormData(form);
    try {
      for (const [index, item] of reading.assessment.entries()) {
        if (!data.get(item.id)) {
          showStep(index);
          throw new Error("all items must be answered");
        }
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
        reason.textContent = itemResult.correct
          ? itemResult.rationale
          : `這個選項卡在這裡：${itemResult.diagnostic}`;
        const mentor = document.createElement("p");
        mentor.className = "assessment-mentor";
        mentor.textContent =
          COMPETENCY_MENTORS[
            reading.assessment.find(({ id }) => id === itemResult.id)?.type
          ] ?? "梁山伙伴：回到文章，再走一步就好。";
        const evidence = document.createElement("button");
        evidence.type = "button";
        evidence.className = "evidence-link";
        evidence.textContent = `查看第${itemResult.evidenceSpan.paragraph}段線索`;
        evidence.addEventListener("click", () => {
          evidenceTrigger = evidence;
          const paragraph =
            reading.body[itemResult.evidenceSpan.paragraph - 1];
          evidenceHeading.textContent = `第 ${itemResult.evidenceSpan.paragraph} 段`;
          renderEvidenceExcerpt(
            evidenceCopy,
            paragraph,
            itemResult.evidenceSpan,
          );
          evidencePanel.hidden = false;
          evidencePanel.scrollIntoView({ behavior: "smooth", block: "center" });
          closeEvidence.focus({ preventScroll: true });
        });
        feedback.append(status, reason, mentor, evidence);
      });

      if (result.canRevise) {
        revisionIndexes = result.results
          .map((item, index) => (item.correct ? -1 : index))
          .filter((index) => index >= 0);
        if (revisionIndexes.length) {
          error.textContent = `尚有 ${revisionIndexes.length} 題可以回看文章後修正一次`;
          submitButton.textContent = "完成修正";
          revisionMode = true;
          showStep(revisionIndexes[0], { moveFocus: true });
          return;
        }
      }

      for (const input of form.elements) input.disabled = true;
      const revisedCount = firstResults.filter(
        (item, index) => !item.correct && latestResults[index]?.correct,
      ).length;
      completionCopy.textContent =
        revisedCount > 0
          ? `你回到原文並修正了 ${revisedCount} 題。吳用說：願意重找證據，就是閱讀本領正在長大。`
          : "三位領航伙伴已把你的理解與文證收入航圖，準備帶回浮城。";
      form.hidden = true;
      evidencePanel.hidden = true;
      completion.hidden = false;
      completionTitle.tabIndex = -1;
      focusSection(completionTitle);
    } catch (cause) {
      error.textContent =
        cause.message === "all items must be answered"
          ? `請先完成 ${reading.assessment.length} 題，再送出答案。`
          : "作答暫時無法送出，答案仍保留在這一頁。";
    }
  });

  wrapper.append(form, evidencePanel, completion);
  container.append(wrapper);
}
