const CLASS_CODE_STORAGE_KEY = "reading-expedition.teacher-class-codes";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readRememberedCodes(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(CLASS_CODE_STORAGE_KEY) ?? "{}");
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([id, code]) =>
          /^[A-Za-z0-9-]{1,80}$/.test(id) && /^[A-Z2-9]{8}$/.test(code),
      ),
    );
  } catch {
    return {};
  }
}

function saveRememberedCodes(storage, codes) {
  try {
    storage.setItem(CLASS_CODE_STORAGE_KEY, JSON.stringify(codes));
  } catch {
    // The code remains visible for the current render even if storage is blocked.
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "日期未提供";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(date);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("clipboard unavailable");
}

function classroomMarkup(classroom, rememberedCode) {
  const revoked = Boolean(classroom.revokedAt);
  const code = !revoked ? rememberedCode : null;
  const labelId = `classroom-${classroom.id}`;
  const identity = code
    ? `班級 ${code}`
    : `建立於 ${formatDate(classroom.createdAt)}`;
  return `
    <article class="classroom-card${revoked ? " is-revoked" : ""}" aria-labelledby="${escapeHtml(labelId)}">
      <div class="classroom-card__heading">
        <div>
          <p class="chapter-label">${revoked ? "已封印" : "聚義進行中"}</p>
          <h3 id="${escapeHtml(labelId)}">${escapeHtml(identity)}</h3>
        </div>
        <span class="classroom-status">${revoked ? "已停用" : "使用中"}</span>
      </div>
      ${
        code
          ? `
            <div class="class-code-row">
              <code>${escapeHtml(code)}</code>
              <button type="button" aria-label="複製班級碼 ${escapeHtml(code)}" data-copy-class-code="${escapeHtml(classroom.id)}">複製班級碼</button>
            </div>
          `
          : revoked
            ? ""
            : `<p class="class-code-note">班級碼只在建立時顯示；若已遺失，請停用後建立新班級。</p>`
      }
      <dl class="classroom-metrics">
        <div><dt>匿名參與</dt><dd>${Number(classroom.anonymousParticipants) || 0} 人</dd></div>
        <div><dt>有效閱讀</dt><dd>${Number(classroom.validReadings) || 0} 次</dd></div>
        <div><dt>有效期限</dt><dd>${escapeHtml(formatDate(classroom.expiresAt))}</dd></div>
      </dl>
      ${
        revoked
          ? ""
          : `<button class="classroom-revoke" type="button" aria-label="停用${escapeHtml(identity)}" data-revoke-classroom="${escapeHtml(classroom.id)}">停用班級</button>`
      }
    </article>
  `;
}

function createdClassroomMarkup(classroom) {
  if (!classroom?.id || !/^[A-Z2-9]{8}$/.test(classroom.classCode ?? "")) {
    return "";
  }
  return `
    <section class="classroom-created" aria-labelledby="created-classroom-title">
      <div>
        <p class="chapter-label">班級建立成功</p>
        <h3 id="created-classroom-title">現在把這組代碼交給學生</h3>
        <p>學生從頁首「加入班級」輸入即可；這組代碼只在教師目前的分頁保存。</p>
      </div>
      <div class="class-code-row">
        <code>${escapeHtml(classroom.classCode)}</code>
        <button type="button" aria-label="複製班級碼 ${escapeHtml(classroom.classCode)}" data-copy-class-code="${escapeHtml(classroom.id)}">複製班級碼</button>
      </div>
    </section>
  `;
}

export async function renderClassroomManagement(
  root,
  {
    request = fetch,
    csrfToken,
    storage = window.sessionStorage,
    confirmAction = (message) => window.confirm(message),
  } = {},
) {
  let rememberedCodes = readRememberedCodes(storage);

  async function load({
    message = "",
    focusTarget = "",
    createdClassroom = null,
  } = {}) {
    let response;
    try {
      response = await request("/api/v1/teacher/classrooms");
    } catch {
      response = null;
    }
    if (!response?.ok) {
      root.innerHTML = `
        <section class="classroom-manager" aria-labelledby="classroom-manager-title">
          <h2 id="classroom-manager-title">班級管理</h2>
          <p class="form-message" data-classroom-message role="status">班級資料暫時無法載入，請重新登入。</p>
        </section>
      `;
      return;
    }
    const payload = await response.json();
    const classrooms = Array.isArray(payload.classrooms)
      ? payload.classrooms
      : [];
    root.innerHTML = `
      <section class="classroom-manager" aria-labelledby="classroom-manager-title">
        <header class="classroom-manager__heading">
          <div>
            <p class="chapter-label">聚義共建・教師端</p>
            <h2 id="classroom-manager-title">班級管理</h2>
            <p>建立匿名班級後，把 8 碼班級碼交給學生；不收姓名、學號或班級真名。</p>
          </div>
          <button class="primary-action" type="button" data-create-classroom>建立新班級</button>
        </header>
        ${createdClassroomMarkup(createdClassroom)}
        <p class="form-message" data-classroom-message role="status">${escapeHtml(message)}</p>
        <div class="classroom-list">
          ${
            classrooms.length
              ? classrooms
                  .map((classroom) =>
                    classroomMarkup(
                      classroom,
                      rememberedCodes[classroom.id],
                    ),
                  )
                  .join("")
              : `<p class="classroom-empty">尚未建立班級。建立後即可複製班級碼給學生。</p>`
          }
        </div>
      </section>
    `;

    root
      .querySelector("[data-create-classroom]")
      .addEventListener("click", async (event) => {
        const createButton = event.currentTarget;
        createButton.disabled = true;
        let createResponse;
        try {
          createResponse = await request("/api/v1/teacher/classrooms", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-csrf-token": csrfToken,
            },
            body: "{}",
          });
        } catch {
          createResponse = null;
        }
        if (!createResponse?.ok) {
          createButton.disabled = false;
          root.querySelector("[data-classroom-message]").textContent =
            "班級建立失敗，請確認網路或重新登入後再試。";
          return;
        }
        const classroom = await createResponse.json();
        rememberedCodes = {
          ...rememberedCodes,
          [classroom.id]: classroom.classCode,
        };
        saveRememberedCodes(storage, rememberedCodes);
        await load({
          message: "班級碼已顯示在上方，也會保留在下方班級卡片。",
          focusTarget: `.classroom-created [data-copy-class-code="${classroom.id}"]`,
          createdClassroom: classroom,
        });
      });

    root.querySelectorAll("[data-copy-class-code]").forEach((button) => {
      button.addEventListener("click", async () => {
        const code = rememberedCodes[button.dataset.copyClassCode];
        try {
          await copyText(code);
          button.textContent = "已複製 ✓";
          root.querySelector("[data-classroom-message]").textContent =
            `班級碼 ${code} 已複製。`;
        } catch {
          root.querySelector("[data-classroom-message]").textContent =
            "無法自動複製，請手動選取班級碼。";
        }
      });
    });

    root.querySelectorAll("[data-revoke-classroom]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (
          !confirmAction(
            `確定停用「${button.getAttribute("aria-label").replace(/^停用/, "")}」嗎？已加入的學生也會失去參與權限。`,
          )
        ) {
          return;
        }
        button.disabled = true;
        const classroomId = button.dataset.revokeClassroom;
        let revokeResponse;
        try {
          revokeResponse = await request(
            `/api/v1/teacher/classrooms/${classroomId}`,
            {
              method: "DELETE",
              headers: { "x-csrf-token": csrfToken },
            },
          );
        } catch {
          revokeResponse = null;
        }
        if (!revokeResponse?.ok) {
          button.disabled = false;
          root.querySelector("[data-classroom-message]").textContent =
            "班級停用失敗，請確認網路後重新載入。";
          return;
        }
        delete rememberedCodes[classroomId];
        saveRememberedCodes(storage, rememberedCodes);
        await load({
          message: "班級已停用，原有班級碼與學生權杖皆已失效。",
          focusTarget: "[data-create-classroom]",
        });
      });
    });
    if (focusTarget) {
      const target = root.querySelector(focusTarget);
      target?.focus();
      target
        ?.closest(".classroom-created")
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  await load();
}
