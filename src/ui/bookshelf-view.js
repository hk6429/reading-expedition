import { buildReadingInventory } from "../domain/reading-inventory.js";
import { READING_LEVELS } from "../domain/reading-level.js";

let unreadOnly = false;
let searchTerm = "";
let selectedCategory = "all";
let selectedMinutes = "all";

function latestAttemptFor(diagnosticHistory, readingId) {
  const record = diagnosticHistory
    .filter((attempt) => attempt.readingId === readingId)
    .at(-1);
  if (!record) return null;
  return {
    correctCount: record.items.filter(({ finalCorrect }) => finalCorrect).length,
    totalCount: record.items.length,
  };
}

export function renderBookshelf(
  container,
  readings,
  completedReadings,
  { preferences, diagnosticHistory = [], onPreferencesChange },
) {
  const level = preferences.selectedLevel ?? "launch";
  const inventory = buildReadingInventory(readings, completedReadings, {
    level,
    supportMode: preferences.supportMode,
    unreadOnly,
  });
  const levelCopy = READING_LEVELS[level];

  container.replaceChildren();
  container.className = "bookshelf-view";

  const header = document.createElement("section");
  header.className = "bookshelf-hero paper-panel";
  header.innerHTML = `
    <p class="chapter-label">浮城藏卷閣</p>
    <h1>選文書架</h1>
    <p>${levelCopy.label}・已完成 ${inventory.completedCount} / ${inventory.totalCount}</p>
    <p>日期只記錄稿件排程，所有已發布讀卷都會留在這裡，等你照自己的步調翻閱。</p>
    <a href="#/">返回個人挑戰</a>
  `;

  const controls = document.createElement("div");
  controls.className = "bookshelf-controls";
  controls.innerHTML = `
    <label>
      搜尋文章
      <input type="search" placeholder="輸入標題或問題" data-bookshelf-search>
    </label>
    <label>
      主題
      <select data-bookshelf-category>
        <option value="all">全部主題</option>
        <option value="world">世界</option>
        <option value="science">科學</option>
        <option value="humanities">人文</option>
      </select>
    </label>
    <label>
      閱讀時間
      <select data-bookshelf-minutes>
        <option value="all">不限時間</option>
        <option value="short">5 分鐘內</option>
        <option value="long">6 分鐘以上</option>
      </select>
    </label>
  `;
  controls.querySelector("[data-bookshelf-category]").value = selectedCategory;
  controls.querySelector("[data-bookshelf-minutes]").value = selectedMinutes;
  controls.querySelector("[data-bookshelf-search]").value = searchTerm;
  const filter = document.createElement("button");
  filter.type = "button";
  filter.className = unreadOnly ? "is-selected" : "";
  filter.setAttribute("aria-pressed", String(unreadOnly));
  filter.textContent = unreadOnly ? "顯示全部讀卷" : "只看未讀";
  filter.addEventListener("click", () => {
    unreadOnly = !unreadOnly;
    onPreferencesChange(preferences, { persist: false });
  });
  controls.append(filter);

  const list = document.createElement("div");
  list.className = "bookshelf-list";
  if (inventory.allCompleted) {
    const complete = document.createElement("section");
    complete.className = "inventory-complete paper-panel";
    complete.innerHTML = `
      <p class="chapter-label">本批讀卷・全數收妥</p>
      <h2>這一批已讀完，且在浮城歇一歇</h2>
      <p>老師補上下一批讀卷時，藏卷閣會再亮燈。你的城樓、紀錄與所得都安穩留著，不會歸零。</p>
    `;
    list.append(complete);
  }
  for (const { reading, completion, completionReadingId } of inventory.entries) {
    const attempt = latestAttemptFor(
      diagnosticHistory,
      completionReadingId ?? reading.id,
    );
    const article = document.createElement("article");
    article.className = `bookshelf-card${completion ? " is-completed" : ""}`;
    article.dataset.search = `${reading.title} ${reading.hookQuestion}`.toLocaleLowerCase("zh-Hant");
    article.dataset.category = reading.category;
    article.dataset.minutes = String(reading.readingMinutes);
    article.innerHTML = `
      <div>
        <span class="reading-status">${
          completion
            ? `已完成・${completion.finalCorrectCount === undefined ? "已達標" : `答對 ${completion.finalCorrectCount} 題`}・${completion.date}`
            : attempt
              ? `已作答・${attempt.correctCount}／${attempt.totalCount} 題・待再挑戰`
              : "未讀"
        }</span>
        <p class="eyebrow">${reading.category === "world" ? "世界" : reading.category === "science" ? "科學" : "人文"}・${reading.supportMode === "guided" ? "引導" : "獨立"}</p>
        <h2>${reading.title}</h2>
        <p>${reading.hookQuestion}</p>
      </div>
    `;
    const link = document.createElement("a");
    link.className = "primary-action";
    link.href = `#/read/${reading.id}`;
    link.textContent = completion ? "重讀此卷" : `開始 ${reading.readingMinutes} 分鐘閱讀`;
    article.append(link);
    list.append(article);
  }
  if (inventory.entries.length === 0 && !inventory.allCompleted) {
    const empty = document.createElement("section");
    empty.className = "paper-panel";
    empty.innerHTML = unreadOnly
      ? "<h2>目前沒有未讀讀卷</h2><p>切回全部讀卷，就能重讀已完成的篇章。</p>"
      : "<h2>藏卷閣正在等新卷</h2><p>這個階段尚無已發布文章；老師補卷後會自動出現在這裡。</p>";
    list.append(empty);
  }

  const filterCards = () => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase("zh-Hant");
    let visibleCount = 0;
    for (const card of list.querySelectorAll(".bookshelf-card")) {
      const minutes = Number(card.dataset.minutes);
      const visible =
        (!normalizedSearch || card.dataset.search.includes(normalizedSearch)) &&
        (selectedCategory === "all" || card.dataset.category === selectedCategory) &&
        (selectedMinutes === "all" ||
          (selectedMinutes === "short" ? minutes <= 5 : minutes >= 6));
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    }
    let noMatches = list.querySelector("[data-bookshelf-no-matches]");
    if (!noMatches) {
      noMatches = document.createElement("section");
      noMatches.className = "paper-panel bookshelf-no-matches";
      noMatches.dataset.bookshelfNoMatches = "";
      noMatches.innerHTML = "<h2>沒有符合條件的讀卷</h2><p>換個關鍵字、主題或閱讀時間再找找看。</p>";
      list.append(noMatches);
    }
    noMatches.hidden = visibleCount > 0 || inventory.entries.length === 0;
  };
  controls.querySelector("[data-bookshelf-search]").addEventListener("input", (event) => {
    searchTerm = event.currentTarget.value;
    filterCards();
  });
  controls.querySelector("[data-bookshelf-category]").addEventListener("change", (event) => {
    selectedCategory = event.currentTarget.value;
    filterCards();
  });
  controls.querySelector("[data-bookshelf-minutes]").addEventListener("change", (event) => {
    selectedMinutes = event.currentTarget.value;
    filterCards();
  });
  filterCards();

  container.append(header, controls, list);
}
