export function createChapterCard(chapter, { completed = false } = {}) {
  const article = document.createElement("div");
  article.className = `chapter-card${completed ? " is-complete" : ""}`;
  article.innerHTML = `
    <p class="eyebrow">${chapter.phase}・活躍日 ${chapter.activeDay}</p>
    <h3>${chapter.title}</h3>
    <p>${chapter.story}</p>
    <p class="chapter-mentor">${chapter.mentor}領航・${chapter.rewardTitle}</p>
    ${chapter.unlock ? `<span class="chapter-unlock">解鎖：${chapter.unlock}</span>` : ""}
    ${chapter.review ? '<span class="chapter-review">里程碑回顧</span>' : ""}
  `;
  return article;
}
