import { waterMarginTheme } from "../theme/water-margin.js";
import { createReadingControls } from "./reading-controls.js";

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
  progress.setAttribute("aria-hidden", "true");
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
  kicker.textContent = `約 ${reading.readingMinutes} 分鐘・第 ${reading.version} 版`;
  const title = document.createElement("h1");
  title.textContent = reading.title;
  const question = document.createElement("p");
  question.className = "reading-hook";
  question.textContent = reading.hookQuestion;
  header.append(kicker, title, question);
  article.append(header);

  const paragraphs = document.createElement("div");
  paragraphs.className = "reading-body";
  reading.body.forEach((text, index) => {
    const paragraph = document.createElement("p");
    paragraph.className = "reading-paragraph";
    paragraph.dataset.paragraph = String(index);
    paragraph.textContent = text;
    paragraphs.append(paragraph);
  });
  article.append(paragraphs);

  if (reading.glossary.length > 0) {
    const glossary = document.createElement("section");
    glossary.className = "glossary-panel";
    glossary.setAttribute("aria-labelledby", "glossary-title");
    const glossaryTitle = document.createElement("h2");
    glossaryTitle.id = "glossary-title";
    glossaryTitle.textContent = "詞語旁批";
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
  quizButton.textContent = "前往兩題問答";
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
      progress.style.width = `${readingProgress * 100}%`;
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
