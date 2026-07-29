import { renderReviewDiff } from "./review-diff.js";
import { renderStudentPreview } from "./student-preview.js";
import { renderClassroomManagement } from "./classroom-management.js";

const CSRF_STORAGE_KEY = "reading-expedition.csrf";

const REVIEW_STATUS_COPY = Object.freeze({
  review: {
    title: "今日待審讀卷",
    empty: "目前沒有待審讀卷。",
  },
  draft: {
    title: "需修正讀卷",
    empty: "目前沒有需要修正的讀卷。",
  },
  published: {
    title: "已發布讀卷",
    empty: "目前沒有已發布讀卷。",
  },
  archived: {
    title: "已封存讀卷",
    empty: "目前沒有已封存讀卷。",
  },
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loginMarkup(message = "") {
  return `
    <section class="review-shell paper-panel">
      <p class="chapter-label">梁山校閱臺</p>
      <h1>教師驗證</h1>
      <p>登入最長保留 8 小時；若使用學校共用裝置，離開前請按「安全登出」。</p>
      <p class="privacy-note">教師管理密鑰只用來驗證校閱與班級管理權限，不會顯示在學生端。請向本網站管理者或校內負責維護的教師索取，請勿貼在群組或共用文件中。</p>
      <form data-review-login>
        <label>教師管理密鑰
          <input name="key" type="password" autocomplete="current-password" required>
        </label>
        <button class="primary-action" type="submit">進入校閱臺</button>
      </form>
      <p class="form-message" role="status">${escapeHtml(message)}</p>
    </section>
  `;
}

function sourceMarkup(sources) {
  return sources
    .map(
      (source) => `
        <li>
          <a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
            ${escapeHtml(source.publisher)}
          </a>
          <span>${escapeHtml(source.license)}</span>
        </li>
      `,
    )
    .join("");
}

function assessmentMarkup(items) {
  const labels = {
    comprehension: "擷取與理解",
    inference: "統整與推論",
    evidence: "文證與評鑑",
  };
  return items
    .map(
      (item) => `
        <article class="review-question">
          <p class="chapter-label">${escapeHtml(labels[item.type] ?? "閱讀理解")}</p>
          <p><strong>${escapeHtml(item.prompt)}</strong></p>
          <p>答案：${escapeHtml(item.correctAnswer)}</p>
          <p>理由：${escapeHtml(item.rationale)}</p>
          <p>文證：第 ${item.evidenceSpan.paragraph} 段</p>
        </article>
      `,
    )
    .join("");
}

function reviewListMarkup(packages) {
  return packages
    .map(
      (packageRecord) => `
        <article class="review-list-item">
          <div>
            <p class="chapter-label">${escapeHtml(packageRecord.difficulty === "guided" ? "行舟卷" : "登樓卷")}</p>
            <h2>${escapeHtml(packageRecord.title)}</h2>
            <p>${escapeHtml(packageRecord.contentKey ?? "閱讀任務")}</p>
          </div>
          <div class="review-list-item__action">
            <span class="quality-seal quality-seal--compact" aria-label="品質分數 ${Number(packageRecord.qualityScore) || 0}">
              ${Number(packageRecord.qualityScore) || 0}
              <small>品質分</small>
            </span>
            <button class="primary-action" type="button" data-open-review="${escapeHtml(packageRecord.id)}" aria-label="開啟審查：${escapeHtml(packageRecord.title)}">開啟審查</button>
          </div>
        </article>
      `,
    )
    .join("");
}

function detailMarkup(packageRecord, { reviewable = true } = {}) {
  const characters = packageRecord.body
    .map((paragraph) =>
      typeof paragraph === "string" ? paragraph : paragraph?.text ?? "",
    )
    .join("")
    .replace(/\s/g, "").length;
  const textType =
    packageRecord.textType === "classical" ? "文言文" : "白話文";
  return `
    <section class="review-detail">
      <header class="review-detail__header">
        <div>
          <p class="chapter-label">${escapeHtml(packageRecord.difficulty === "guided" ? "行舟卷" : "登樓卷")}・版本 ${packageRecord.version}</p>
          <h2>${escapeHtml(packageRecord.title)}</h2>
          <p>${textType}・${characters} 字・${packageRecord.glossary.length} 則${packageRecord.textType === "classical" ? "注釋" : "詞語旁批"}</p>
        </div>
        <div class="quality-seal" aria-label="品質分數 ${packageRecord.qualityScore}">
          ${packageRecord.qualityScore}
          <small>品質分</small>
        </div>
      </header>
      <div class="review-columns">
        <section>
          <h3>來源與授權</h3>
          <ul>${sourceMarkup(packageRecord.sourceAttribution)}</ul>
          <h3>已核對事實</h3>
          <ul>${packageRecord.facts.map((fact) => `<li>${escapeHtml(fact.statement ?? fact.claim ?? "")}</li>`).join("")}</ul>
          ${assessmentMarkup(packageRecord.assessment)}
        </section>
        <section>
          <div class="preview-switch" role="group" aria-label="學生預覽尺寸">
            <button type="button" data-preview-mode="mobile">手機</button>
            <button type="button" data-preview-mode="desktop">桌面</button>
          </div>
          <div data-student-preview>${renderStudentPreview(packageRecord, "mobile")}</div>
        </section>
      </div>
      ${renderReviewDiff(packageRecord.title, packageRecord.title)}
      ${
        reviewable
          ? `<form class="review-actions" data-review-action>
        <label>退回原因
          <select name="reasonCode">
            <option value="">請選擇</option>
            <option value="evidence_gap">文證不足</option>
            <option value="factual_conflict">事實衝突</option>
            <option value="reading_level">難度不符</option>
            <option value="question_quality">題目品質</option>
            <option value="license_issue">授權疑慮</option>
            <option value="sensitive_topic">敏感議題</option>
          </select>
        </label>
        <label>短備註
          <input name="note" maxlength="200">
        </label>
        <button type="submit" name="action" value="returned">退回修正</button>
        <button class="primary-action" type="submit" name="action" value="published">核准發布</button>
      </form>`
          : `<p class="review-status-note">此頁為狀態檢視；若要變更內容，請先回到待審或需修正流程。</p>`
      }
    </section>
  `;
}

export async function renderReviewConsole(
  root,
  {
    request = fetch,
    sessionStorage = window.sessionStorage,
    sharedStorage = window.localStorage,
    initialView = "review",
    initialStatus = "review",
  } = {},
) {
  function readSharedCsrfToken() {
    try {
      return sharedStorage.getItem(CSRF_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function saveCsrfToken(value) {
    sessionStorage.setItem(CSRF_STORAGE_KEY, value);
    try {
      sharedStorage.setItem(CSRF_STORAGE_KEY, value);
    } catch {
      // The current tab still works when shared browser storage is unavailable.
    }
  }

  function clearCsrfToken() {
    sessionStorage.removeItem(CSRF_STORAGE_KEY);
    try {
      sharedStorage.removeItem(CSRF_STORAGE_KEY);
    } catch {
      // Ignore storage restrictions while still clearing the current tab.
    }
  }

  let csrfToken =
    readSharedCsrfToken() ?? sessionStorage.getItem(CSRF_STORAGE_KEY);
  const currentCsrfToken = () => readSharedCsrfToken() ?? csrfToken;

  async function logout() {
    const response = await request("/api/v1/teacher/session", {
      method: "DELETE",
      headers: { "x-csrf-token": currentCsrfToken() },
    });
    if (!response.ok && response.status !== 401) return false;
    clearCsrfToken();
    sessionStorage.removeItem("reading-expedition.teacher-class-codes");
    csrfToken = null;
    await showLogin("已安全登出。");
    return true;
  }

  function attachLogout() {
    root.querySelector("[data-teacher-logout]")?.addEventListener(
      "click",
      async (event) => {
        event.currentTarget.disabled = true;
        if (!(await logout()) && event.currentTarget.isConnected) {
          event.currentTarget.disabled = false;
        }
      },
    );
  }

  async function showLogin(message) {
    root.innerHTML = loginMarkup(message);
    root.querySelector("[data-review-login]").addEventListener("submit", async (event) => {
      event.preventDefault();
      const key = new FormData(event.currentTarget).get("key");
      const response = await request("/api/v1/teacher/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!response.ok) {
        await showLogin("驗證失敗，請確認密鑰。");
        return;
      }
      const payload = await response.json();
      csrfToken = payload.csrfToken;
      saveCsrfToken(csrfToken);
      await showWorkspace();
    });
  }

  async function showClasses() {
    root.innerHTML = `
      <section class="review-shell">
        <header class="review-heading teacher-workspace-heading">
          <div>
            <p class="chapter-label">梁山教師臺</p>
            <h1>班級管理</h1>
          </div>
          <nav aria-label="教師工作區">
            <a aria-current="page" href="#/teacher/classes">班級管理</a>
            <a href="#/teacher">內容校閱</a>
            <button type="button" data-teacher-logout>安全登出</button>
          </nav>
        </header>
        <div data-classroom-management></div>
      </section>
    `;
    attachLogout();
    await renderClassroomManagement(
      root.querySelector("[data-classroom-management]"),
      {
        request,
        csrfToken,
        getCsrfToken: currentCsrfToken,
        onAuthenticationInvalid: async () => {
          clearCsrfToken();
          csrfToken = null;
          await showLogin(
            "教師登入狀態已更新，請重新登入後再停用班級。",
          );
        },
        storage: sessionStorage,
      },
    );
  }

  async function showReview(status = initialStatus) {
    const activeStatus = REVIEW_STATUS_COPY[status] ? status : "review";
    const statusCopy = REVIEW_STATUS_COPY[activeStatus];
    const listResponse = await request(
      `/api/v1/teacher/review?status=${activeStatus}`,
    );
    if (!listResponse.ok) {
      if (listResponse.status === 401) {
        clearCsrfToken();
        await showLogin("");
        return;
      }
      root.innerHTML = `
        <section class="review-shell">
          <div class="review-empty" role="alert">
            <p class="chapter-label">校閱臺暫時離線</p>
            <h1>文章清單無法載入</h1>
            <p>請檢查網路後重新整理；既有文章與審核紀錄不會消失。</p>
            <a class="primary-link" href="#/teacher?status=${activeStatus}">重新載入</a>
          </div>
        </section>
      `;
      return;
    }
    const { packages } = await listResponse.json();
    const available = Array.isArray(packages) ? packages : [];
    root.innerHTML = `
      <section class="review-shell">
        <header class="review-heading">
          <div>
            <p class="chapter-label">梁山校閱臺</p>
            <h1>${statusCopy.title}</h1>
          </div>
          <nav aria-label="校閱狀態">
            <a href="#/teacher/classes">班級管理</a>
            <a ${activeStatus === "review" ? 'aria-current="page"' : ""} href="#/teacher?status=review">待審</a>
            <a ${activeStatus === "draft" ? 'aria-current="page"' : ""} href="#/teacher?status=draft">需修正</a>
            <a ${activeStatus === "published" ? 'aria-current="page"' : ""} href="#/teacher?status=published">已發布</a>
            <a ${activeStatus === "archived" ? 'aria-current="page"' : ""} href="#/teacher?status=archived">已封存</a>
            <button type="button" data-teacher-logout>安全登出</button>
          </nav>
        </header>
        <div data-review-content>
          ${
            available.length
              ? `<div class="review-list">${reviewListMarkup(available)}</div>`
            : `<section class="review-empty">
                <p class="chapter-label">目前 0 篇</p>
                <h2>${statusCopy.empty}</h2>
                <p>${activeStatus === "review" ? "新文章完成產生並送審後，會出現在這裡；現有正式文章可從「已發布」查看。" : "切換其他狀態即可查看不同階段的讀卷。"}</p>
                ${activeStatus === "review" ? '<a class="primary-link" href="#/teacher?status=published">查看已發布讀卷</a>' : '<a class="primary-link" href="#/teacher?status=review">回到待審讀卷</a>'}
              </section>`
          }
        </div>
        <p class="form-message" data-review-message role="status"></p>
      </section>
    `;
    attachLogout();

    const reviewContent = root.querySelector("[data-review-content]");
    const message = root.querySelector("[data-review-message]");

    async function openReview(summary, trigger) {
      trigger.disabled = true;
      message.textContent = "正在開啟讀卷……";
      let detailResponse;
      try {
        detailResponse = await request(
          `/api/v1/teacher/review/${summary.id}`,
        );
      } catch {
        detailResponse = null;
      }
      if (!detailResponse?.ok) {
        trigger.disabled = false;
        message.textContent = "讀卷暫時無法開啟，請確認網路後再試。";
        return;
      }
      const record = (await detailResponse.json()).package;
      reviewContent.innerHTML = `
        <button class="review-back" type="button" data-review-back>← 返回${statusCopy.title}</button>
        ${detailMarkup(record, {
          reviewable: activeStatus === "review",
        })}
      `;
      message.textContent = "";
      reviewContent
        .querySelector("[data-review-back]")
        .addEventListener("click", () => showReview(activeStatus));
      reviewContent.querySelectorAll("[data-preview-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          reviewContent.querySelector("[data-student-preview]").innerHTML =
            renderStudentPreview(record, button.dataset.previewMode);
        });
      });
      reviewContent
        .querySelector("[data-review-action]")
        ?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const action = event.submitter.value;
          const response = await request(
            `/api/v1/teacher/review/${record.id}/action`,
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-csrf-token": currentCsrfToken(),
              },
              body: JSON.stringify({
                action,
                expectedVersion: record.version,
                reasonCode: data.get("reasonCode") || undefined,
                note: data.get("note") || undefined,
              }),
            },
          );
          message.textContent = response.ok
            ? action === "published"
              ? "已建立發布紀錄。"
              : "已退回修正。"
            : "操作未完成，請重新載入確認版本。";
        });
      reviewContent.querySelector("[data-review-back]").focus();
    }

    root.querySelectorAll("[data-open-review]").forEach((button) => {
      button.addEventListener("click", () => {
        const summary = available.find(
          ({ id }) => id === button.dataset.openReview,
        );
        if (summary) openReview(summary, button);
      });
    });
  }

  async function showWorkspace() {
    if (initialView === "classes") await showClasses();
    else await showReview(initialStatus);
  }

  if (csrfToken) await showWorkspace();
  else await showLogin("");
}
