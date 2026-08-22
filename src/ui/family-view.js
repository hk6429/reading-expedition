import {
  buildChildReport,
  buildFamilySupportCards,
  reportRowsToCsv,
} from "../domain/family-report.js";
import { createDefaultState } from "../storage/local-store.js";
import { buildReadingInventory } from "../domain/reading-inventory.js";
import { READING_LEVELS } from "../domain/reading-level.js";

function createStatus() {
  const status = document.createElement("p");
  status.className = "family-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  return status;
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function localDate(timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function safeFilenamePart(value, fallback) {
  const safe = String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 24);
  return safe || fallback;
}

function dateInTimeZone(timeZone) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${date}T12:00:00`);
}

function renderAnonymous(
  container,
  { familyClient, localState, localStore, reload },
) {
  container.replaceChildren();
  container.className = "family-view";
  const intro = document.createElement("section");
  intro.className = "family-hero paper-panel";
  intro.innerHTML = `
    <p class="chapter-label">選配功能・不登入也能完整閱讀</p>
    <h1>家庭護照</h1>
    <p>把孩子的浮城帶到另一支手機或平板，也能在同一個家庭中分開保存每位孩子的進度。</p>
    <ul class="family-privacy-list">
      <li>系統無法判定代號是否為真名，請勿輸入真名、Email、學校或班級。</li>
      <li>建立前可以先匿名試讀；是否綁定，由家長決定。</li>
      <li>家庭護照碼就是跨裝置鑰匙，伺服器只保存雜湊。</li>
    </ul>
  `;

  const grid = document.createElement("div");
  grid.className = "family-entry-grid";
  const createPanel = document.createElement("section");
  createPanel.className = "family-card";
  createPanel.innerHTML = `
    <p class="eyebrow">第一次使用</p>
    <h2>建立家庭護照</h2>
    <p>建立後會顯示一組護照碼。請抄下或複製保存，網站不會替你保留明碼。</p>
  `;
  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "primary-action";
  createButton.textContent = "建立護照並綁定目前進度";
  const createStatusNode = createStatus();
  createButton.addEventListener("click", async () => {
    createButton.disabled = true;
    createStatusNode.textContent = "正在建立家庭護照……";
    try {
      const timeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
      const payload = await familyClient.createPassport(timeZone);
      createPanel.replaceChildren();
      const label = document.createElement("p");
      label.className = "chapter-label";
      label.textContent = "護照建立完成・只顯示這一次";
      const heading = document.createElement("h2");
      heading.textContent = "請保存家庭護照碼";
      const code = document.createElement("code");
      code.className = "family-passport-code";
      code.textContent = payload.passportCode;
      const copy = document.createElement("button");
      copy.type = "button";
      copy.textContent = "複製護照碼";
      const status = createStatus();
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(payload.passportCode);
          status.textContent = "護照碼已複製。";
        } catch {
          status.textContent =
            "瀏覽器無法自動複製，請長按上方護照碼並手動複製。";
        }
      });
      const form = document.createElement("form");
      form.className = "family-inline-form";
      const aliasLabel = document.createElement("label");
      aliasLabel.textContent = "這位孩子的代號";
      const alias = document.createElement("input");
      alias.name = "alias";
      alias.required = true;
      alias.maxLength = 12;
      alias.placeholder = "例如：小舟";
      const bind = document.createElement("button");
      bind.type = "submit";
      bind.className = "primary-action";
      bind.textContent = "把目前浮城綁定給這位孩子";
      form.append(aliasLabel, alias, bind);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        bind.disabled = true;
        status.textContent = "正在安全保存目前浮城……";
        try {
          const child = await familyClient.createChild(
            alias.value,
            localState,
          );
          familyClient.setActiveChild(child);
          localStore.save(localState);
          status.textContent = "已完成綁定，正在開啟家庭頁。";
          reload();
        } catch (error) {
          bind.disabled = false;
          status.textContent = error.message;
        }
      });
      createPanel.append(
        label,
        heading,
        code,
        copy,
        status,
        form,
      );
    } catch (error) {
      createButton.disabled = false;
      createStatusNode.textContent = error.message;
    }
  });
  createPanel.append(createButton, createStatusNode);

  const loginPanel = document.createElement("section");
  loginPanel.className = "family-card";
  loginPanel.innerHTML = `
    <p class="eyebrow">已有家庭護照</p>
    <h2>在這部裝置登入</h2>
    <p>輸入保存的護照碼，選擇孩子後再載入各自的浮城。</p>
  `;
  const form = document.createElement("form");
  form.className = "family-inline-form";
  const codeLabel = document.createElement("label");
  codeLabel.textContent = "家庭護照碼";
  const codeInput = document.createElement("input");
  codeInput.name = "passportCode";
  codeInput.required = true;
  codeInput.autocomplete = "off";
  codeInput.autocapitalize = "characters";
  codeInput.spellcheck = false;
  codeInput.inputMode = "text";
  codeInput.placeholder = "XXXX-XXXX-XXXX-XXXX";
  const codeHelp = document.createElement("small");
  codeHelp.id = "family-passport-code-help";
  codeHelp.textContent = "可直接貼上；英文字母大小寫與連字號不影響登入。";
  codeInput.setAttribute("aria-describedby", codeHelp.id);
  const loginButton = document.createElement("button");
  loginButton.type = "submit";
  loginButton.className = "primary-action";
  loginButton.textContent = "登入家庭護照";
  const loginStatus = createStatus();
  form.append(codeLabel, codeInput, codeHelp, loginButton);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginButton.disabled = true;
    loginStatus.textContent = "正在登入……";
    try {
      await familyClient.login(codeInput.value);
      reload();
    } catch (error) {
      loginButton.disabled = false;
      loginStatus.textContent = error.message;
    }
  });
  loginPanel.append(form, loginStatus);
  grid.append(createPanel, loginPanel);
  container.append(intro, grid);
}

function childCard({
  child,
  report,
  active,
  loadError = false,
  onSwitch,
  onExport,
  onExportAnonymous,
  onDelete,
}) {
  const card = document.createElement("article");
  card.className = `family-child-card${active ? " is-active" : ""}`;
  const heading = document.createElement("h3");
  heading.textContent = child.alias;
  const badge = document.createElement("span");
  badge.className = "family-child-badge";
  badge.textContent = active ? "這部裝置正在使用" : "獨立浮城";
  const stats = document.createElement("p");
  stats.textContent = loadError
    ? "目前無法讀取這位孩子的雲端紀錄；這不代表沒有閱讀資料。"
    : `本週 ${report.weeklyCount} 篇（上週 ${report.previousWeekCount} 篇，${
    report.weeklyTrend === "up"
      ? "增加"
      : report.weeklyTrend === "down"
        ? "減少"
        : "持平"
  }）・累積 ${report.completedCount} 篇${
    report.levelTotalCount !== null
      ? `・${READING_LEVELS[report.level]?.label ?? report.level}已完成 ${report.levelCompletedCount} / ${report.levelTotalCount}`
      : ""
  }・${
    !report.hasDiagnosticData
      ? "尚無能力診斷資料"
      : report.stuckSkillLabel
      ? `目前可陪練：${report.stuckSkillLabel}`
      : "三項能力穩定"
  }`;
  const next = document.createElement("p");
  next.className = "family-next-action";
  next.textContent = loadError
    ? "請先重新整理或確認網路，再下載家庭報告。"
    : report.nextAction;
  const support = buildFamilySupportCards(report);
  const supportPanel = document.createElement("section");
  supportPanel.className = "family-support-cards";
  supportPanel.setAttribute("aria-label", "家庭陪伴卡");
  const praise = document.createElement("p");
  praise.innerHTML = "<strong>具體稱讚：</strong>";
  praise.append(support.praise);
  const conversation = document.createElement("p");
  conversation.innerHTML = "<strong>餐桌對話：</strong>";
  conversation.append(support.conversation);
  const story = document.createElement("p");
  story.innerHTML = "<strong>共讀故事：</strong>";
  story.append(support.story);
  const goal = document.createElement("fieldset");
  const goalLegend = document.createElement("legend");
  goalLegend.textContent = "本週家庭共同目標（僅存此裝置，不比較、不扣進度）";
  const goalKey = `reading-expedition.family-goal:${child.id}`;
  let selectedGoal = "只陪伴，不設篇數";
  try {
    selectedGoal = window.localStorage.getItem(goalKey) || selectedGoal;
  } catch {
    // Storage is optional; the controls still work for this page view.
  }
  for (const option of support.sharedGoalOptions) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio";
    input.name = `family-goal-${child.id}`;
    input.value = option;
    input.checked = option === selectedGoal;
    input.addEventListener("change", () => {
      try {
        window.localStorage.setItem(goalKey, option);
      } catch {
        // Keep the current selection when persistent storage is unavailable.
      }
    });
    label.append(input, option);
    goal.append(label);
  }
  supportPanel.append(praise, conversation, story, goal);
  const actions = document.createElement("div");
  actions.className = "family-card-actions";
  const switchButton = document.createElement("button");
  switchButton.type = "button";
  switchButton.textContent = active ? "同步目前紀錄" : "切換到這位孩子";
  switchButton.addEventListener("click", onSwitch);
  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.textContent = "下載完整孩子 CSV（私人）";
  exportButton.disabled = loadError;
  exportButton.addEventListener("click", onExport);
  const anonymousExport = document.createElement("button");
  anonymousExport.type = "button";
  anonymousExport.textContent = "下載匿名化 CSV";
  anonymousExport.disabled = loadError;
  anonymousExport.addEventListener("click", onExportAnonymous);
  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger-action";
  deleteButton.textContent = "刪除孩子";
  deleteButton.addEventListener("click", onDelete);
  actions.append(
    switchButton,
    anonymousExport,
    exportButton,
    deleteButton,
  );
  const details = document.createElement("details");
  details.className = "family-child-details";
  const detailsSummary = document.createElement("summary");
  detailsSummary.textContent = "查看最近閱讀明細";
  const detailList = document.createElement("ol");
  for (const row of report.rows.slice(-5).reverse()) {
    const item = document.createElement("li");
    item.textContent = `${row.date}・${row.title}・初答 ${row.firstCorrect}/3・修正 ${row.revisedCorrect} 題`;
    detailList.append(item);
  }
  if (loadError) {
    const empty = document.createElement("p");
    empty.textContent = "雲端資料載入失敗，暫不顯示明細。";
    details.append(detailsSummary, empty);
  } else if (report.rows.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "尚無閱讀診斷紀錄。";
    details.append(detailsSummary, empty);
  } else {
    details.append(detailsSummary, detailList);
  }
  const privateWarning = document.createElement("p");
  privateWarning.className = "privacy-note";
  privateWarning.textContent =
    "完整 CSV 含孩子代號、日期與篇名，請勿放在公開群組或共用裝置；分享時優先使用匿名化版本。";
  card.append(
    heading,
    badge,
    stats,
    next,
    supportPanel,
    details,
    privateWarning,
    actions,
  );
  return card;
}

async function renderAuthenticated(
  container,
  family,
  {
    familyClient,
    localState,
    localStore,
    loadLevelInventory,
    exportState,
    reload,
  },
) {
  container.replaceChildren();
  container.className = "family-view";
  const activeChild = familyClient.activeChild();
  const initialSync = familyClient.syncStatus();
  const hero = document.createElement("section");
  hero.className = "family-hero paper-panel";
  hero.innerHTML = `
    <p class="chapter-label">家庭護照已連線</p>
    <h1>每位孩子，都有自己的浮城</h1>
    <p>首頁先看週趨勢、卡關能力與下一步；需要時再下載單一孩子或全家庭 CSV。</p>
  `;
  const status = createStatus();
  if (activeChild) {
    status.textContent = {
      pending: "目前紀錄已存本機，正在等待同步。",
      conflict:
        "另一部裝置已有較新紀錄。本機內容尚未覆蓋雲端，請選擇重試或載入雲端版本。",
      error: "本機紀錄安全保留，但雲端同步尚未完成。",
      synced: "目前孩子的雲端紀錄已同步。",
    }[initialSync.status] ?? "";
  }
  hero.append(status);

  const reports = new Map();
  const failedChildren = new Set();
  const reportToday = dateInTimeZone(family.timeZone);
  await Promise.all(
    family.children.map(async (child) => {
      try {
        const record = await familyClient.childState(child.id);
        const level = record.state.preferences?.selectedLevel ?? "launch";
        let inventory = null;
        if (loadLevelInventory) {
          try {
            const readings = await loadLevelInventory(level);
            inventory = buildReadingInventory(
              readings,
              record.state.completedReadings ?? {},
              {
                level,
                supportMode: record.state.preferences?.supportMode ?? "guided",
              },
            );
          } catch {
            // 庫存暫時無法載入時，仍保留已取得的孩子報告與匯出能力。
          }
        }
        reports.set(
          child.id,
          buildChildReport({
            childId: child.id,
            alias: child.alias,
            records: record.state.diagnosticHistory ?? [],
            today: reportToday,
            level,
            levelCompletedCount: inventory?.completedCount ?? null,
            levelTotalCount: inventory?.totalCount ?? null,
            unlockedStoryTitle:
              record.state.city?.storyUnlocks?.at(-1)?.title ?? "",
          }),
        );
      } catch {
        failedChildren.add(child.id);
        reports.set(
          child.id,
          buildChildReport({
            childId: child.id,
            alias: child.alias,
            records: [],
            today: reportToday,
          }),
        );
      }
    }),
  );

  const actions = document.createElement("div");
  actions.className = "family-overview-actions";
  const exportAll = document.createElement("button");
  exportAll.type = "button";
  exportAll.textContent = "下載全家庭 CSV";
  exportAll.disabled =
    family.children.length === 0 || failedChildren.size > 0;
  exportAll.addEventListener("click", () => {
    const rows = [...reports.values()].flatMap(({ rows }) => rows);
    downloadText(
      `萬卷浮城-全家庭-${localDate(family.timeZone)}.csv`,
      reportRowsToCsv(rows),
      "text/csv;charset=utf-8",
    );
  });
  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "登出（保留這部裝置紀錄）";
  logout.addEventListener("click", async () => {
    try {
      await familyClient.logout();
    } finally {
      reload();
    }
  });
  const logoutAndClear = document.createElement("button");
  logoutAndClear.type = "button";
  logoutAndClear.className = "danger-action";
  logoutAndClear.textContent = "登出並清除此裝置紀錄";
  logoutAndClear.addEventListener("click", async () => {
    if (
      !window.confirm(
        "確定登出並清除這部裝置上的閱讀紀錄？已同步的雲端紀錄仍會保留。",
      )
    ) {
      return;
    }
    localStore.restore(
      JSON.stringify(createDefaultState(localState.deviceId)),
    );
    try {
      await familyClient.logout({ clearDevice: true });
    } finally {
      reload();
    }
  });
  const deleteFamily = document.createElement("button");
  deleteFamily.type = "button";
  deleteFamily.className = "danger-action";
  deleteFamily.textContent = "刪除整本家庭護照";
  deleteFamily.addEventListener("click", async () => {
    if (
      !window.confirm(
        "確定刪除整本家庭護照？所有孩子的雲端紀錄都會失效，這個動作無法復原。",
      )
    ) {
      return;
    }
    await familyClient.deleteFamily();
    reload();
  });
  actions.append(exportAll, logout, logoutAndClear, deleteFamily);
  if (failedChildren.size > 0) {
    status.textContent = `有 ${failedChildren.size} 位孩子的雲端紀錄未載入；為避免產生不完整報告，已暫停全家庭 CSV。`;
  }
  if (activeChild && ["pending", "error", "conflict"].includes(initialSync.status)) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = initialSync.status === "conflict"
      ? "保留本機版本並覆蓋雲端"
      : "重試同步本機紀錄";
    retry.addEventListener("click", async () => {
      retry.disabled = true;
      status.textContent = "正在重試同步……";
      try {
        if (initialSync.status === "conflict") {
          if (
            !window.confirm(
              "確定保留本機版本並覆蓋目前雲端紀錄？建議先下載本機 JSON 備份。",
            )
          ) {
            retry.disabled = false;
            status.textContent = "尚未變更任何紀錄。";
            return;
          }
          await familyClient.overwriteActiveChild(localState);
        } else {
          await familyClient.syncActiveChild(localState);
        }
        status.textContent = "雲端同步完成。";
        reload();
      } catch (error) {
        retry.disabled = false;
        status.textContent = error.message;
      }
    });
    actions.prepend(retry);
  }
  if (activeChild && initialSync.status === "conflict") {
    const cloud = family.children.find(({ id }) => id === activeChild.id);
    if (cloud) {
      const comparison = document.createElement("section");
      comparison.className = "family-conflict-comparison";
      comparison.setAttribute("aria-labelledby", "family-conflict-heading");
      const localAttempt = initialSync.failedAt ?? initialSync.pendingSince;
      const localTime = localAttempt
        ? new Date(localAttempt).toLocaleString("zh-TW")
        : "時間未記錄";
      const cloudTime = cloud.updatedAt
        ? new Date(cloud.updatedAt).toLocaleString("zh-TW")
        : "時間未記錄";
      comparison.innerHTML = `
        <h2 id="family-conflict-heading">先比較兩份紀錄</h2>
        <dl>
          <div><dt>本機來源</dt><dd>版本 ${Number(activeChild.stateVersion) || 1}・最後同步嘗試 ${localTime}</dd></div>
          <div><dt>雲端來源</dt><dd>版本 ${Number(cloud.stateVersion) || 1}・更新 ${cloudTime}</dd></div>
        </dl>
        <p>先備份本機，再決定重試上傳或改用雲端；系統不會自動覆蓋其中一份。</p>
      `;
      hero.append(comparison);
      const loadCloud = document.createElement("button");
      loadCloud.type = "button";
      loadCloud.textContent = "改用雲端較新版本";
      loadCloud.addEventListener("click", async () => {
        if (
          !window.confirm(
            "確定改用雲端版本？尚未同步的本機變更會被取代。建議先下載 JSON 備份。",
          )
        ) {
          return;
        }
        const record = await familyClient.activateChild(cloud);
        localStore.restore(JSON.stringify(record.state));
        reload();
      });
      actions.prepend(loadCloud);
      const backup = document.createElement("button");
      backup.type = "button";
      backup.textContent = "先下載目前孩子 JSON 備份";
      backup.addEventListener("click", exportState);
      actions.prepend(backup);
    }
  }
  hero.append(actions);

  const add = document.createElement("section");
  add.className = "family-card";
  add.innerHTML = `
    <p class="eyebrow">新增孩子</p>
    <h2>建立另一座獨立浮城</h2>
    <p>系統無法判定代號是否為真名，請勿輸入真名。新孩子會從空白浮城開始。</p>
  `;
  const addForm = document.createElement("form");
  addForm.className = "family-inline-form";
  const aliasLabel = document.createElement("label");
  aliasLabel.textContent = "孩子代號";
  const alias = document.createElement("input");
  alias.required = true;
  alias.maxLength = 12;
  alias.placeholder = "例如：小樓";
  const addButton = document.createElement("button");
  addButton.type = "submit";
  addButton.className = "primary-action";
  addButton.textContent = "新增孩子";
  const addStatus = createStatus();
  addForm.append(aliasLabel, alias, addButton);
  addForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    addButton.disabled = true;
    addStatus.textContent = "正在建立獨立浮城……";
    try {
      await familyClient.createChild(
        alias.value,
        createDefaultState(crypto.randomUUID()),
      );
      reload();
    } catch (error) {
      addButton.disabled = false;
      addStatus.textContent = error.message;
    }
  });
  add.append(addForm, addStatus);

  const childrenSection = document.createElement("section");
  childrenSection.className = "family-children";
  const sectionHeading = document.createElement("div");
  sectionHeading.className = "section-heading";
  sectionHeading.innerHTML = `
    <div><p class="eyebrow">家庭成員</p><h2>選擇要查看或切換的孩子</h2></div>
    <p>${family.children.length} 位孩子・資料彼此分開</p>
  `;
  const grid = document.createElement("div");
  grid.className = "family-child-grid";
  for (const child of family.children) {
    const report = reports.get(child.id);
    grid.append(
      childCard({
        child,
        report,
        active: activeChild?.id === child.id,
        loadError: failedChildren.has(child.id),
        onSwitch: async () => {
          status.textContent =
            activeChild?.id === child.id
              ? "正在同步這位孩子的最新紀錄……"
              : "正在切換孩子，先保存目前浮城……";
          try {
            if (activeChild) {
              await familyClient.syncActiveChild(localState);
            }
            if (activeChild?.id === child.id) {
              status.textContent = "同步完成。";
              return;
            }
            const record = await familyClient.activateChild(child);
            localStore.restore(JSON.stringify(record.state));
            reload();
          } catch (error) {
            status.textContent = error.message;
          }
        },
        onExport: () => {
          downloadText(
            `萬卷浮城-私人-${safeFilenamePart(child.alias, "孩子")}-${localDate(family.timeZone)}.csv`,
            reportRowsToCsv(report.rows),
            "text/csv;charset=utf-8",
          );
        },
        onExportAnonymous: () => {
          downloadText(
            `萬卷浮城-匿名-${safeFilenamePart(child.id.slice(0, 8), "孩子")}-${localDate(family.timeZone)}.csv`,
            reportRowsToCsv(report.rows, { anonymize: true }),
            "text/csv;charset=utf-8",
          );
        },
        onDelete: async () => {
          if (
            !window.confirm(
              `確定刪除「${child.alias}」的雲端浮城？這個動作無法復原。`,
            )
          ) {
            return;
          }
          const deletingActiveChild = activeChild?.id === child.id;
          await familyClient.deleteChild(child.id);
          if (deletingActiveChild) {
            localStore.restore(
              JSON.stringify(createDefaultState(localState.deviceId)),
            );
          }
          reload();
        },
      }),
    );
  }
  if (family.children.length === 0) {
    const empty = document.createElement("p");
    empty.className = "paper-panel";
    empty.textContent = "尚未建立孩子。先新增一位，再開始累積各自的浮城。";
    grid.append(empty);
  }
  childrenSection.append(sectionHeading, grid);
  container.append(hero, childrenSection, add);
}

export async function renderFamilyView(
  container,
  {
    familyClient,
    localState,
    localStore,
    loadLevelInventory,
    exportState = () => {},
    reload = () => location.reload(),
  },
) {
  container.className = "family-view";
  container.innerHTML = `
    <section class="paper-panel">
      <p class="chapter-label">正在查看護照</p>
      <h1>載入家庭紀錄……</h1>
    </section>
  `;
  try {
    const { family } = await familyClient.current();
    if (!family) {
      renderAnonymous(container, {
        familyClient,
        localState,
        localStore,
        reload,
      });
      return;
    }
    await renderAuthenticated(container, family, {
      familyClient,
      localState,
      localStore,
      loadLevelInventory,
      exportState,
      reload,
    });
  } catch (error) {
    if (error.status && error.status !== 401) {
      container.innerHTML = `
        <section class="paper-panel">
          <p class="chapter-label">暫時無法連線</p>
          <h1>家庭護照稍後再試</h1>
          <p>${error.message}</p>
          <a href="#/">先回到閱讀首頁</a>
        </section>
      `;
      return;
    }
    renderAnonymous(container, {
      familyClient,
      localState,
      localStore,
      reload,
    });
  }
}
