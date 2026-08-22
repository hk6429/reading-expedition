export function renderPrivacyConsent(
  container,
  { decision = null, onDecision = () => {} } = {},
) {
  container.querySelector("[data-privacy-consent]")?.remove();
  if (decision === "on" || decision === "off") return;

  const panel = document.createElement("section");
  panel.className = "privacy-consent paper-panel";
  panel.dataset.privacyConsent = "";
  panel.setAttribute("aria-labelledby", "privacy-consent-title");
  panel.innerHTML = `
    <p class="chapter-label">先由你決定</p>
    <h2 id="privacy-consent-title">要不要協助改善閱讀設計？</h2>
    <p>不傳送也能完整使用。若同意，只傳文章代碼、類別、難度、時間區間與輪替的隨機代碼；不傳姓名、學號、答案文字，也不用於廣告或排名。</p>
    <div class="privacy-consent__actions" role="group" aria-label="匿名統計選擇">
      <button type="button" data-statistics-decline>不用傳送（建議）</button>
      <button type="button" data-statistics-accept>同意傳送匿名統計</button>
    </div>
    <a href="#/guide">查看完整資料說明</a>
    <p class="form-message" role="status" data-privacy-consent-status></p>
  `;
  const choose = (enabled) => {
    onDecision(enabled);
    panel.querySelector("[data-privacy-consent-status]").textContent = enabled
      ? "已同意；之後可在使用說明隨時退出。"
      : "已選擇不傳送；之後仍可在使用說明改變選擇。";
    panel.querySelectorAll("button").forEach((button) => {
      button.disabled = true;
    });
    window.setTimeout(() => panel.remove(), 500);
  };
  panel
    .querySelector("[data-statistics-decline]")
    .addEventListener("click", () => choose(false));
  panel
    .querySelector("[data-statistics-accept]")
    .addEventListener("click", () => choose(true));
  container.prepend(panel);
}
