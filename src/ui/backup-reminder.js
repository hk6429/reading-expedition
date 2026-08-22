import { backupHealthStatus } from "../domain/backup-health.js";

const REMINDER_PREFIX = "reading-expedition:backup-reminder:";

export function renderBackupReminder(
  container,
  {
    personId,
    personLabel = "此裝置的閱行者",
    recordCount = 0,
    sessionStorage,
    onExport,
  },
) {
  const health = backupHealthStatus(recordCount);
  if (!health.shouldRemind) return;
  const key = `${REMINDER_PREFIX}${personId}:${health.milestone}`;
  if (sessionStorage.getItem(key) === "seen") return;
  const previousFocus = document.activeElement;

  const reminder = document.createElement("dialog");
  reminder.className = "backup-reminder paper-panel";
  reminder.setAttribute("role", "alertdialog");
  reminder.setAttribute("aria-modal", "true");
  reminder.setAttribute("aria-labelledby", "backup-reminder-title");
  reminder.innerHTML = `
    <div>
      <p class="chapter-label">進入閱征前先做一件事</p>
      <h2 id="backup-reminder-title" tabindex="-1">替${personLabel}留一份個人備份</h2>
      <p class="backup-reminder__identity">目前紀錄：${personLabel}</p>
      <p>${health.message}</p>
      <p>系統會逐篇保存閱讀、第一次作答、修正結果與達標紀錄。多人共用裝置時，必須先到家庭護照切換孩子；若直接繼續，就會沿用這部裝置目前的紀錄。</p>
    </div>
  `;
  const actions = document.createElement("div");
  actions.className = "backup-reminder__actions";
  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "primary-action";
  exportButton.textContent = "立即下載個人備份";
  const familyLink = document.createElement("a");
  familyLink.href = "#/family";
  familyLink.textContent = "切換家庭護照中的孩子";
  const continueButton = document.createElement("button");
  continueButton.type = "button";
  continueButton.textContent = "這次先不備份，開始閱讀";
  const status = document.createElement("p");
  status.className = "backup-reminder__status";
  status.setAttribute("role", "status");
  function dismiss() {
    sessionStorage.setItem(key, "seen");
    if (reminder.open) reminder.close();
    reminder.remove();
    if (previousFocus?.isConnected) previousFocus?.focus();
  }
  exportButton.addEventListener("click", () => {
    if (onExport() === false) {
      status.textContent = "目前無法產生備份，請先選擇「已確認」繼續，稍後到我的浮城重試。";
      return;
    }
    status.textContent = "個人備份已開始下載。";
    window.setTimeout(dismiss, 450);
  });
  continueButton.addEventListener("click", dismiss);
  reminder.addEventListener("cancel", (event) => event.preventDefault());
  reminder.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const focusable = [
      ...reminder.querySelectorAll(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => !element.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  actions.append(exportButton, familyLink, continueButton);
  reminder.append(actions, status);
  container.prepend(reminder);
  if (typeof reminder.showModal === "function") {
    reminder.showModal();
  } else {
    reminder.setAttribute("open", "");
  }
  exportButton.focus();
}
