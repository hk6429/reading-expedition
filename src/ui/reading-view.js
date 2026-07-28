import { waterMarginTheme } from "../theme/water-margin.js";
import { createReadingControls } from "./reading-controls.js";

const MENTOR_GUIDES = Object.freeze({
  world: {
    name: "武松",
    opening: "先辨認事件中的人、時間與規則，再決定相信什麼。",
    halfway: "已走過一半。回看帶讀問題，找出真正能承重的段落。",
  },
  science: {
    name: "吳用",
    opening: "先找證據與機制，不急著被最驚奇的說法帶走。",
    halfway: "已走過一半。留意原因、結果與數字之間是否真的相連。",
  },
  humanities: {
    name: "魯智深",
    opening: "先看人物的選擇與處境，同一件事可能有不同聲音。",
    halfway: "已走過一半。想想哪些人的聲音還沒有被文章說出來。",
  },
});

function paragraphText(paragraph) {
  return typeof paragraph === "string" ? paragraph : paragraph?.text ?? "";
}

export function renderReading(
  container,
  reading,
  { state, saveState, session },
) {
  container.replaceChildren();
  container.className = "reading-view";
  document.documentElement.dataset.readingMode = state.preferences.mode;
  document.documentElement.style.setProperty(
    "--reading-scale",
    state.preferences.fontScale,
  );

  const progress = document.createElement("div");
  progress.className = "reading-progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "閱讀進度");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", "0");
  const progressBar = document.createElement("span");
  progressBar.className = "reading-progress__bar";
  const progressText = document.createElement("span");
  progressText.className = "reading-progress__text";
  progressText.textContent = `尚未開始・共 ${reading.body.length} 段`;
  progress.append(progressBar, progressText);
  container.append(progress);

  const layout = document.createElement("div");
  layout.className = "reading-layout";

  const side = document.createElement("aside");
  side.className = "reading-side";
  side.innerHTML = `
    <a class="back-link" href="#/">← 返回三條航線</a>
    <p class="chapter-label">${waterMarginTheme.categoryLabels[reading.category]}</p>
    <p class="reading-difficulty">${waterMarginTheme.difficultyLabels[reading.difficulty]}</p>
  `;

  const article = document.createElement("article");
  article.className = "reading-article";
  const header = document.createElement("header");
  header.className = "reading-header";
  const kicker = document.createElement("p");
  kicker.className = "reading-meta";
  const characters = reading.body
    .map(paragraphText)
    .join("")
    .replace(/\s/g, "").length;
  const textTypeLabel =
    reading.textType === "classical" ? "文言文" : "白話文";
  kicker.textContent = `約 ${reading.readingMinutes} 分鐘・${textTypeLabel} ${characters} 字・第 ${reading.version} 版`;
  const title = document.createElement("h1");
  title.textContent = reading.title;
  const question = document.createElement("p");
  question.className = "reading-hook";
  const mentor = MENTOR_GUIDES[reading.category] ?? MENTOR_GUIDES.humanities;
  const mentorGuide = document.createElement("aside");
  mentorGuide.className = "mentor-guide";
  mentorGuide.setAttribute("aria-live", "polite");
  mentorGuide.innerHTML = `
    <span>${mentor.name}領航</span>
    <p>${mentor.opening}</p>
  `;
  if (reading.hookQuestion) {
    const questionLabel = document.createElement("span");
    questionLabel.textContent = "帶著這個問題讀";
    question.append(questionLabel, `：${reading.hookQuestion}`);
    header.append(kicker, title, question);
  } else {
    header.append(kicker, title);
  }
  article.append(header, mentorGuide);

  const paragraphs = document.createElement("div");
  paragraphs.className = "reading-body";
  reading.body.forEach((text, index) => {
    const paragraph = document.createElement("p");
    paragraph.className = "reading-paragraph";
    paragraph.dataset.paragraph = String(index);
    paragraph.textContent = paragraphText(text);
    paragraphs.append(paragraph);
  });
  const savedPosition = state.readingProgress[reading.id];
  let resumeChoicePending =
    savedPosition?.paragraph > 0 &&
    savedPosition.progress >= 0.1 &&
    savedPosition.progress < 0.95;
  if (resumeChoicePending) {
    const resume = document.createElement("section");
    resume.className = "reading-resume";
    const resumeCopy = document.createElement("p");
    resumeCopy.textContent = `上次讀到第 ${savedPosition.paragraph + 1}／${reading.body.length} 段`;
    const resumeActions = document.createElement("div");
    const continueButton = document.createElement("button");
    continueButton.type = "button";
    continueButton.className = "primary-action";
    continueButton.textContent = "從上次位置繼續";
    const restartButton = document.createElement("button");
    restartButton.type = "button";
    restartButton.textContent = "從頭開始";
    continueButton.addEventListener("click", () => {
      resumeChoicePending = false;
      const target = paragraphs.children[savedPosition.paragraph];
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      target?.classList.add("is-resumed");
      resume.remove();
    });
    restartButton.addEventListener("click", () => {
      resumeChoicePending = false;
      session.updatePosition(reading.id, {
        contentKey: reading.contentKey,
        paragraph: 0,
        offset: 0,
        progress: 0,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      resume.remove();
    });
    resumeActions.append(continueButton, restartButton);
    resume.append(resumeCopy, resumeActions);
    article.append(resume);
  }
  article.append(paragraphs);

  if (reading.glossary.length > 0) {
    const glossary = document.createElement("section");
    glossary.className = "glossary-panel";
    glossary.setAttribute("aria-labelledby", "glossary-title");
    const glossaryTitle = document.createElement("h2");
    glossaryTitle.id = "glossary-title";
    glossaryTitle.textContent =
      reading.textType === "classical" ? "文言注釋" : "詞語旁批";
    glossary.append(glossaryTitle);
    for (const item of reading.glossary) {
      const entry = document.createElement("p");
      const term = document.createElement("strong");
      term.textContent = item.term;
      entry.append(term, `：${item.definition}`);
      glossary.append(entry);
    }
    article.append(glossary);
  }

  const source = document.createElement("section");
  source.className = "source-panel";
  source.setAttribute("aria-labelledby", "source-title");
  const sourceTitle = document.createElement("h2");
  sourceTitle.id = "source-title";
  sourceTitle.textContent = "來源與授權";
  source.append(sourceTitle);
  for (const item of reading.sourceAttribution) {
    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = `${item.publisher}・${item.license}`;
    source.append(link);
  }
  article.append(source);

  const quizButton = document.createElement("button");
  quizButton.type = "button";
  quizButton.className = "primary-action";
  quizButton.textContent = `前往 ${reading.assessment.length} 題問答`;
  quizButton.addEventListener("click", () => {
    window.location.hash = `#/quiz/${reading.id}`;
  });
  article.append(quizButton);

  const controls = createReadingControls(state.preferences, () => {
    saveState(state);
  });
  layout.append(side, article, controls);
  container.append(layout);

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const paragraph = Number(visible.target.dataset.paragraph);
      const readingProgress = (paragraph + 1) / reading.body.length;
      progressBar.style.width = `${readingProgress * 100}%`;
      progressText.textContent = `第 ${paragraph + 1}／${reading.body.length} 段`;
      progress.setAttribute(
        "aria-valuenow",
        String(Math.round(readingProgress * 100)),
      );
      if (
        readingProgress >= 0.5 &&
        mentorGuide.dataset.halfway !== "true"
      ) {
        mentorGuide.dataset.halfway = "true";
        mentorGuide.querySelector("p").textContent = mentor.halfway;
      }
      if (resumeChoicePending) return;
      session.updatePosition(reading.id, {
        contentKey: reading.contentKey,
        paragraph,
        offset: 0,
        progress: readingProgress,
      });
    },
    { threshold: [0.35, 0.7] },
  );
  for (const paragraph of paragraphs.children) observer.observe(paragraph);
}
