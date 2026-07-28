import { chapterForActiveDay } from "../data/chapter-catalog.js";
import { resolveChapterProgress } from "../domain/active-days.js";
import { createChapterCard } from "./chapter-card.js";

export function createReadingJournal(completedReadings = {}) {
  const progress = resolveChapterProgress(completedReadings);
  const currentDay = Math.max(progress.activeDay, 1);
  const chapter = chapterForActiveDay(currentDay);
  const section = document.createElement("section");
  section.className = "reading-journal paper-panel";
  section.setAttribute("aria-labelledby", "journal-heading");
  section.innerHTML = `
    <div class="section-heading">
      <div>
        <p class="eyebrow">閱行札記</p>
        <h2 id="journal-heading">${progress.activeDay} 個活躍日</h2>
      </div>
      <p>不必連續；離開幾天，城市與章回都會在原處等你。</p>
    </div>
  `;
  section.append(createChapterCard(chapter, { completed: progress.activeDay > 0 }));
  if (progress.nextSeasonUnlocked) {
    const notice = document.createElement("p");
    notice.className = "season-unlocked";
    notice.textContent = "下一航季已解鎖；舊城市與所有閱讀證據完整保留。";
    section.append(notice);
  }
  return section;
}
