import { renderReviewDiff } from "./review-diff.js";
import { renderStudentPreview } from "./student-preview.js";

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
      <p>教師權限由安全 session 驗證，畫面上的身份切換不會取得權限。</p>
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

function detailMarkup(packageRecord) {
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
          <ul>${packageRecord.facts.map((fact) => `<li>${escapeHtml(fact.claim)}</li>`).join("")}</ul>
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
      <form class="review-actions" data-review-action>
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
      </form>
    </section>
  `;
}

export async function renderReviewConsole(
  root,
  {
    request = fetch,
    sessionStorage = window.sessionStorage,
  } = {},
) {
  let csrfToken = sessionStorage.getItem("reading-expedition.csrf");

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
      sessionStorage.setItem("reading-expedition.csrf", csrfToken);
      await showReview();
    });
  }

  async function showReview() {
    const listResponse = await request("/api/v1/teacher/review?status=review");
    if (!listResponse.ok) {
      sessionStorage.removeItem("reading-expedition.csrf");
      await showLogin("");
      return;
    }
    const { packages } = await listResponse.json();
    const details = await Promise.all(
      packages.map(async ({ id }) => {
        const response = await request(`/api/v1/teacher/review/${id}`);
        return response.ok ? (await response.json()).package : null;
      }),
    );
    const available = details.filter(Boolean);
    root.innerHTML = `
      <section class="review-shell">
        <header class="review-heading">
          <div>
            <p class="chapter-label">梁山校閱臺</p>
            <h1>今日待審讀卷</h1>
          </div>
          <nav aria-label="校閱狀態">
            <a href="#/teacher?status=review">待審</a>
            <a href="#/teacher?status=draft">需修正</a>
            <a href="#/teacher?status=published">已發布</a>
            <a href="#/teacher?status=archived">已封存</a>
          </nav>
        </header>
        <div class="review-pair">${available.map(detailMarkup).join("")}</div>
        <p class="form-message" data-review-message role="status"></p>
      </section>
    `;

    root.querySelectorAll("[data-preview-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const detail = button.closest(".review-detail");
        const index = [...root.querySelectorAll(".review-detail")].indexOf(detail);
        detail.querySelector("[data-student-preview]").innerHTML =
          renderStudentPreview(available[index], button.dataset.previewMode);
      });
    });
    root.querySelectorAll("[data-review-action]").forEach((form, index) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const action = event.submitter.value;
        const response = await request(
          `/api/v1/teacher/review/${available[index].id}/action`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-csrf-token": csrfToken,
            },
            body: JSON.stringify({
              action,
              expectedVersion: available[index].version,
              reasonCode: data.get("reasonCode") || undefined,
              note: data.get("note") || undefined,
            }),
          },
        );
        root.querySelector("[data-review-message]").textContent = response.ok
          ? action === "published"
            ? "已建立發布紀錄。"
            : "已退回修正。"
          : "操作未完成，請重新載入確認版本。";
      });
    });
  }

  if (csrfToken) await showReview();
  else await showLogin("");
}
